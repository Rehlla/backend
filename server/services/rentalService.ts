import crypto from 'crypto';
import { db } from '../db/database';
import {
  BookingEntity,
  InventorySlotEntity,
  RentalBookingEntity,
  RentalBookingExtraSnapshot,
  RentalBookingStatus,
  RentalExtraEntity,
  RentalListingEntity,
  RentalMaintenanceBlockEntity,
  RentalPriceBreakdown
} from '../db/schema';
import { assertSupplierBookable, InsufficientCapacityError } from './commerceService';
import { distributedLockService } from './distributedLockService';
import { paymentService } from './paymentService';
import { assertCheckoutAllowed } from './fraudDetectionService';
import { supplierService } from './supplierService';
import { ledgerService } from './ledgerService';
import { notificationService } from './notificationService';
import { reconcileTripStatus } from './tripStatusReconciler';
import { resolveBookability } from './bookabilityReconciler';

// ---------------------------------------------------------------------------
// Dahab zones — shared with the seed's zone vocabulary (hotels area guide ids).
// Delivery fees are per-listing; the zone list is the fixed Dahab geography.
// ---------------------------------------------------------------------------
export const RENTAL_ZONES: Array<{ id: string; name: string; nameAr: string }> = [
  { id: 'lighthouse', name: 'Lighthouse', nameAr: 'المنارة' },
  { id: 'mashraba', name: 'Mashraba', nameAr: 'المشربة' },
  { id: 'assalah', name: 'Assalah', nameAr: 'العسلة' },
  { id: 'eel_garden', name: 'Eel Garden', nameAr: 'حديقة الأنقليس' },
  { id: 'laguna', name: 'Laguna', nameAr: 'لاجونا' },
  { id: 'blue_hole', name: 'Blue Hole', nameAr: 'البلوهول' },
  { id: 'dahab_heights', name: 'Dahab Heights', nameAr: 'مرتفعات دهب' },
  { id: 'north_camps', name: 'North Camps', nameAr: 'كمبات الشمال' }
];

const HOLD_TTL_MS = 15 * 60 * 1000;
const MAX_RENTAL_DAYS = 30;
const MAX_RENTAL_QUANTITY = 50;
const OVERDUE_GRACE_MS = 3 * 60 * 60 * 1000; // 3h after endDate before OVERDUE

// Statuses that consume inventory. Everything else (CANCELLED, REJECTED,
// COMPLETED, RETURNED) releases it.
const CONSUMING_STATUSES: RentalBookingStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'READY_FOR_PICKUP',
  'ACTIVE',
  'OVERDUE'
];

// ---------------------------------------------------------------------------
// Date helpers. All rental dates are local Dahab calendar dates (UTC+2, no
// DST) stored as YYYY-MM-DD strings; arithmetic runs on UTC-of-components so
// string comparisons and day math never cross timezone boundaries.
// ---------------------------------------------------------------------------
const DAY_MS = 86400000;

function parseDay(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fmtDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function daysInRange(start: string, end: string): number {
  return Math.round((parseDay(end) - parseDay(start)) / DAY_MS) + 1;
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let ts = parseDay(start); ts <= parseDay(end); ts += DAY_MS) out.push(fmtDay(ts));
  return out;
}

/** Today's local calendar date in Dahab (Africa/Cairo, UTC+2, no DST). */
function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Cairo' });
}

/**
 * A rental window must start today or later, end on or after its start, and
 * stay within the maximum rental length. Shared by availability, quoting and
 * hold creation so no path can price or hold a past/inverted window.
 */
function assertBookingWindow(startDate: string, endDate: string): void {
  if (daysInRange(startDate, endDate) > MAX_RENTAL_DAYS) {
    throw domainError(`Rental windows must be between 1 and ${MAX_RENTAL_DAYS} days.`, 400);
  }
  if (endDate < startDate) {
    throw domainError('The end date must be on or after the start date.', 400);
  }
  if (startDate < todayLocal()) {
    throw domainError(`The start date must be today or later (today is ${todayLocal()}).`, 400);
  }
}

function domainError(message: string, status = 400, details: Record<string, unknown> = {}) {
  const err = new Error(message) as Error & { status?: number; details?: Record<string, unknown> };
  err.status = status;
  err.details = details;
  return err;
}

export interface RentalAvailabilityResult {
  listingId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  available: boolean;
  windowAvailable: number;
  availablePerDay: Array<{ date: string; available: number; committed: number; blocked: number }>;
  /** First day that falls short of the requested quantity, when unavailable. */
  reasonDay?: string;
}

export interface RentalQuoteResult {
  listingId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  breakdown: RentalPriceBreakdown;
  extras: RentalBookingExtraSnapshot[];
  deliveryMode: 'PICKUP' | 'DELIVERY';
  deliveryZoneId?: string;
  deliveryFeeEGP: number;
  cancellationPolicyHours: number;
}

export class RentalService {
  // ------------------------------------------------------------------ helpers

  private committedQuantityForDay(listingId: string, day: string): number {
    let total = 0;
    for (const b of db.rentalBookings) {
      if (b.listingId === listingId && CONSUMING_STATUSES.includes(b.status)) {
        if (b.startDate <= day && b.endDate >= day) total += b.quantity;
      }
    }
    return total;
  }

  private blockedQuantityForDay(listingId: string, day: string): number {
    let total = 0;
    for (const block of db.rentalMaintenanceBlocks) {
      if (block.listingId === listingId && block.startDate <= day && block.endDate >= day) {
        total += block.quantityBlocked;
      }
    }
    return total;
  }

  private availableQuantityForDay(listing: RentalListingEntity, day: string): number {
    return Math.max(0, listing.quantity - this.committedQuantityForDay(listing.id, day) - this.blockedQuantityForDay(listing.id, day));
  }

  private listingOrThrow(listingId: string): RentalListingEntity {
    const listing = db.rentalListings.find(l => l.id === listingId);
    if (!listing) throw domainError('Rental listing not found.', 404);
    return listing;
  }

  private bookingOrThrow(bookingId: string): RentalBookingEntity {
    const booking = db.rentalBookings.find(b => b.id === bookingId || b.bookingRef === bookingId);
    if (!booking) throw domainError('Rental booking not found.', 404);
    return booking;
  }

  private notifyForBooking(booking: RentalBookingEntity, title: string, message: string, metadata: Record<string, any>) {
    notificationService.sendNotification({
      userId: db.trips.find(t => t.id === booking.tripId)?.userId || 'UNATTRIBUTED',
      type: 'RENTAL_STATUS_CHANGED',
      channel: 'WHATSAPP',
      title,
      message,
      metadata: { recipientPhone: booking.travelerPhone, purpose: 'traveler', rentalBookingId: booking.id, ...metadata }
    });
  }

  /**
   * Mirrors commerceService's slot accounting for the existing engine: one
   * inventory_slots row per (listing, day, 'FULL_DAY') carrying held/reserved
   * capacity so inventory views and bookability checks stay consistent.
   */
  private applySlotDelta(listing: RentalListingEntity, startDate: string, endDate: string, quantity: number, field: 'held' | 'reserved', delta: number) {
    for (const day of eachDay(startDate, endDate)) {
      let slot = db.inventorySlots.find(s => s.skuId === listing.skuId && s.date === day && s.timeSlot === 'FULL_DAY');
      if (!slot) {
        slot = {
          id: `SLOT-REN-${listing.skuId}-${day}-${Date.now()}`,
          skuId: listing.skuId,
          date: day,
          timeSlot: 'FULL_DAY',
          totalCapacity: listing.quantity,
          reservedCapacity: 0,
          heldCapacity: 0,
          priceEGP: listing.dailyRateEGP,
          status: 'AVAILABLE'
        };
        db.inventorySlots.push(slot);
      }
      slot[field === 'held' ? 'heldCapacity' : 'reservedCapacity'] = Math.max(
        0,
        (field === 'held' ? slot.heldCapacity : slot.reservedCapacity) + delta
      );
      slot.status =
        slot.reservedCapacity + slot.heldCapacity >= slot.totalCapacity ? 'SOLD_OUT' : 'AVAILABLE';
    }
  }

  // --------------------------------------------------------------- availability

  public releaseExpiredHolds(): number {
    const now = new Date().toISOString();
    let released = 0;
    db.runInTransaction(() => {
      const expired = db.rentalBookings.filter(b => b.status === 'PENDING_PAYMENT' && b.expiresAt && b.expiresAt < now);
      for (const booking of expired) {
        booking.status = 'CANCELLED';
        booking.updatedAt = now;
        const listing = db.rentalListings.find(l => l.id === booking.listingId);
        if (listing) this.applySlotDelta(listing, booking.startDate, booking.endDate, booking.quantity, 'held', -booking.quantity);
        released += 1;
      }
      if (expired.length > 0) db.saveToDisk();
    });
    return released;
  }

  public checkAvailability(params: {
    listingId: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }): RentalAvailabilityResult {
    this.releaseExpiredHolds();
    assertBookingWindow(params.startDate, params.endDate);
    const listing = this.listingOrThrow(params.listingId);
    const days = eachDay(params.startDate, params.endDate);

    const availablePerDay = days.map(day => ({
      date: day,
      available: this.availableQuantityForDay(listing, day),
      committed: this.committedQuantityForDay(listing.id, day),
      blocked: this.blockedQuantityForDay(listing.id, day)
    }));

    const windowAvailable = Math.min(...availablePerDay.map(d => d.available));
    const reasonDay = windowAvailable < params.quantity
      ? availablePerDay.find(d => d.available < params.quantity)?.date
      : undefined;

    return {
      listingId: listing.id,
      startDate: params.startDate,
      endDate: params.endDate,
      quantity: params.quantity,
      available: windowAvailable >= params.quantity,
      windowAvailable,
      availablePerDay,
      reasonDay
    };
  }

  /** A full-month availability map for the detail-page calendar widget. */
  public monthlyAvailability(listingId: string, monthStart: string): Array<{ date: string; available: number }> {
    const listing = this.listingOrThrow(listingId);
    const days = eachDay(monthStart, fmtDay(parseDay(monthStart) + 29 * DAY_MS));
    return days.map(day => ({ date: day, available: this.availableQuantityForDay(listing, day) }));
  }

  // ------------------------------------------------------------------- pricing

  public quote(params: {
    listingId: string;
    startDate: string;
    endDate: string;
    quantity: number;
    extraIds?: string[];
    deliveryMode?: 'PICKUP' | 'DELIVERY';
    deliveryZoneId?: string;
  }): RentalQuoteResult {
    const listing = this.listingOrThrow(params.listingId);
    const deliveryMode = params.deliveryMode || 'PICKUP';

    let deliveryZoneId: string | undefined;
    let deliveryFeeEGP = 0;
    if (deliveryMode === 'DELIVERY') {
      if (!params.deliveryZoneId) {
        throw domainError('A delivery zone is required for delivery.', 400);
      }
      const zone = listing.deliveryZones.find(z => z.zoneId === params.deliveryZoneId);
      if (!zone) {
        throw domainError(`Delivery is not available to zone "${params.deliveryZoneId}" for this listing.`, 400);
      }
      deliveryZoneId = zone.zoneId;
      deliveryFeeEGP = zone.feeEGP;
    }

    assertBookingWindow(params.startDate, params.endDate);
    const breakdown = this.computeBreakdown(listing, params.startDate, params.endDate, params.quantity);
    const extras = this.resolveExtras(listing.id, params.extraIds || [], params.startDate, params.endDate);

    return {
      listingId: listing.id,
      startDate: params.startDate,
      endDate: params.endDate,
      quantity: params.quantity,
      breakdown: {
        ...breakdown,
        extrasEGP: extras.reduce((sum, e) => sum + e.priceEGP * e.count, 0),
        deliveryEGP: deliveryFeeEGP,
        totalEGP: breakdown.baseEGP + extras.reduce((sum, e) => sum + e.priceEGP * e.count, 0) + deliveryFeeEGP
      },
      extras,
      deliveryMode,
      deliveryZoneId,
      deliveryFeeEGP,
      cancellationPolicyHours: listing.cancellationPolicyHours
    };
  }

  /**
   * The server-authoritative price. The client sends only ids and dates; every
   * amount is derived here from stored config, and the hold snapshots the
   * result so checkout can never be repriced by the request body.
   */
  private computeBreakdown(
    listing: RentalListingEntity,
    startDate: string,
    endDate: string,
    quantity: number
  ): RentalPriceBreakdown {
    const days = daysInRange(startDate, endDate);
    let baseEGP = 0;
    let discountEGP = 0;

    // Weekly rate wins when it exists and the span covers a full week; the
    // remainder is priced at the daily rate. Partial weeks (<7 days) use daily only.
    // Verified: weeklyRate correctly applies floor(days/7) weeks + remainder days. See rentalService weekly tests.
    if (listing.weeklyRateEGP != null && days >= 7) {
      const weeks = Math.floor(days / 7);
      const remainder = days % 7;
      const weeklyBase = weeks * listing.weeklyRateEGP + remainder * listing.dailyRateEGP;
      discountEGP += weeks * 7 * listing.dailyRateEGP - weeks * listing.weeklyRateEGP;
      baseEGP = weeklyBase;
    } else {
      baseEGP = days * listing.dailyRateEGP;
    }

    // Multi-day discount applies to the (possibly weekly-reduced) base.
    if (
      listing.multiDayMinDays != null &&
      listing.multiDayDiscountPercent != null &&
      days >= listing.multiDayMinDays
    ) {
      const discount = Math.round((baseEGP * listing.multiDayDiscountPercent) / 100);
      baseEGP -= discount;
      discountEGP += discount;
    }

    baseEGP *= quantity;

    return {
      days,
      dailyRateEGP: listing.dailyRateEGP,
      baseEGP: Math.round(baseEGP),
      discountEGP: Math.round(discountEGP),
      extrasEGP: 0,
      deliveryEGP: 0,
      depositEGP: listing.depositEGP,
      totalEGP: Math.round(baseEGP)
    };
  }

  private resolveExtras(
    listingId: string,
    extraIds: string[],
    startDate: string,
    endDate: string
  ): RentalBookingExtraSnapshot[] {
    const days = daysInRange(startDate, endDate);
    const snapshots: RentalBookingExtraSnapshot[] = [];
    const seen = new Set<string>();
    for (const id of extraIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const extra = db.rentalExtras.find(e => e.id === id && e.listingId === listingId && e.active);
      if (!extra) {
        throw domainError(`Extra "${id}" is not available for this listing.`, 400);
      }
      const count = extra.pricingBasis === 'PER_DAY' ? days : 1;
      snapshots.push({ extraId: extra.id, name: extra.name, nameAr: extra.nameAr, priceEGP: extra.priceEGP, count });
    }
    return snapshots;
  }

  // ---------------------------------------------------------------- catalogue

  /** Availability-aware catalogue query. Returns full listings; routes shape them. */
  public listListings(filters: {
    category?: string;
    subcategory?: string;
    zone?: string;
    q?: string;
    priceMin?: number;
    priceMax?: number;
    startDate?: string;
    endDate?: string;
    quantity?: number;
  }): RentalListingEntity[] {
    this.releaseExpiredHolds();
    const q = (filters.q || '').trim().toLowerCase();
    const wantsWindow = Boolean(filters.startDate && filters.endDate && filters.quantity);

    const candidates = db.rentalListings.filter(listing => {
      if (listing.status !== 'APPROVED' || !listing.active) return false;
      if (filters.category && listing.category !== filters.category) return false;
      if (filters.subcategory && listing.subcategory !== filters.subcategory) return false;
      if (filters.zone) {
        const inPickupZone = listing.pickupZoneId === filters.zone;
        const inDeliveryZones = listing.deliveryZones.some(z => z.zoneId === filters.zone);
        if (!inPickupZone && !inDeliveryZones) return false;
      }
      if (filters.priceMin != null && listing.dailyRateEGP < filters.priceMin) return false;
      if (filters.priceMax != null && listing.dailyRateEGP > filters.priceMax) return false;
      if (q) {
        const haystack = [
          listing.name,
          listing.nameAr,
          listing.tagline,
          listing.taglineAr,
          listing.subcategory,
          ...listing.features,
          ...listing.featuresAr
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (wantsWindow) {
      return candidates.filter(listing =>
        this.checkAvailability({
          listingId: listing.id,
          startDate: filters.startDate!,
          endDate: filters.endDate!,
          quantity: filters.quantity!
        }).available
      );
    }
    return candidates;
  }

  public getListingView(listing: RentalListingEntity) {
    const sku = db.productSkus.find(s => s.id === listing.skuId);
    const supplier = db.suppliers.find(s => s.id === listing.supplierId);
    return {
      ...listing,
      bookable: resolveBookability(listing.skuId) !== null,
      sku: sku
        ? {
            id: sku.id,
            title: sku.title,
            titleAr: sku.titleAr,
            basePriceEGP: sku.basePriceEGP,
            maxCapacityPerSlot: sku.maxCapacityPerSlot,
            active: sku.active,
            serviceType: sku.serviceType
          }
        : null,
      supplier: supplier
        ? {
            id: supplier.id,
            businessName: supplier.businessName,
            businessNameAr: supplier.businessNameAr,
            area: supplier.area,
            address: supplier.address,
            city: supplier.city,
            rating: supplier.rating,
            reviewCount: supplier.reviewCount,
            whatsapp: supplier.whatsapp,
            phone: supplier.phone
          }
        : null,
      extras: db.rentalExtras.filter(e => e.listingId === listing.id && e.active),
      maintenanceBlocks: db.rentalMaintenanceBlocks.filter(b => b.listingId === listing.id)
    };
  }

  // ------------------------------------------------------------------- booking

  public createRentalBooking(params: {
    listingId: string;
    tripId: string;
    userId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    startDate: string;
    endDate: string;
    quantity: number;
    deliveryMode?: 'PICKUP' | 'DELIVERY';
    deliveryZoneId?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    extraIds?: string[];
    notes?: string;
    idempotencyKey?: string;
  }): { booking: RentalBookingEntity; replayed?: boolean } {
    this.releaseExpiredHolds();
    const listing = this.listingOrThrow(params.listingId);
    if (listing.status !== 'APPROVED' || !listing.active) {
      throw domainError('This rental is not currently bookable.', 409);
    }
    // A Suspended / unverified provider cannot be booked, whatever the listing says.
    assertSupplierBookable(listing.supplierId, listing.skuId);
    const days = daysInRange(params.startDate, params.endDate);
    if (days < 1 || days > MAX_RENTAL_DAYS) {
      throw domainError(`Rental windows must be between 1 and ${MAX_RENTAL_DAYS} days.`, 400);
    }
    assertBookingWindow(params.startDate, params.endDate);
    if (params.quantity < 1 || params.quantity > MAX_RENTAL_QUANTITY) {
      throw domainError(`Quantity must be between 1 and ${MAX_RENTAL_QUANTITY}.`, 400);
    }
    if (!db.trips.some(t => t.id === params.tripId)) {
      throw domainError(`Trip "${params.tripId}" does not exist. A rental booking has to belong to a traveller's itinerary.`, 400);
    }

    // Idempotency: a retry with the same key returns the same hold.
    if (params.idempotencyKey) {
      const existing = db.rentalBookings.find(
        b => b.idempotencyKey === params.idempotencyKey && b.status === 'PENDING_PAYMENT'
      );
      if (existing) return { booking: existing, replayed: true };
    }

    // The authoritative availability + price check, serialized on the listing.
    const lease = distributedLockService.tryAcquire(`lock:rental:${listing.id}`, 5000);
    try {
      let holdResult!: RentalBookingEntity;
      db.runInTransaction(() => {
        const availability = this.checkAvailability({
          listingId: listing.id,
          startDate: params.startDate,
          endDate: params.endDate,
          quantity: params.quantity
        });
        if (!availability.available) {
          throw new InsufficientCapacityError(
            `Only ${availability.windowAvailable} bike(s) remain for "${listing.name}" between ` +
              `${params.startDate} and ${params.endDate}; ${params.quantity} were requested.`,
            {
              listingId: listing.id,
              startDate: params.startDate,
              endDate: params.endDate,
              requested: params.quantity,
              available: availability.windowAvailable,
              reasonDay: availability.reasonDay,
              availablePerDay: availability.availablePerDay
            }
          );
        }

        const quote = this.quote({
          listingId: listing.id,
          startDate: params.startDate,
          endDate: params.endDate,
          quantity: params.quantity,
          extraIds: params.extraIds,
          deliveryMode: params.deliveryMode,
          deliveryZoneId: params.deliveryZoneId
        });

        const expiresAt = new Date(Date.now() + HOLD_TTL_MS).toISOString();
        const now = new Date().toISOString();
        const holdToken = `HLD-REN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        // booking_ref is UNIQUE in SQLite. A hold has no real ref yet, but it
        // must still be unique — a cancelled hold keeps its placeholder, and a
        // second hold with '' would violate the constraint (the in-memory
        // adapter does not enforce UNIQUE, so only the SQLite adapter sees it).
        // Checkout replaces the placeholder with the real ref.
        const booking: RentalBookingEntity = {
          id: `RENTAL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          bookingRef: `DHB-REN-HOLD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          listingId: listing.id,
          skuId: listing.skuId,
          supplierId: listing.supplierId,
          tripId: params.tripId,
          userId: params.userId,
          travelerName: params.travelerName,
          travelerPhone: params.travelerPhone,
          travelerEmail: params.travelerEmail,
          startDate: params.startDate,
          endDate: params.endDate,
          quantity: params.quantity,
          status: 'PENDING_PAYMENT',
          paymentState: 'INITIATED',
          holdToken,
          idempotencyKey: params.idempotencyKey,
          priceBreakdown: quote.breakdown,
          deliveryMode: quote.deliveryMode,
          deliveryZoneId: quote.deliveryZoneId,
          deliveryAddress: params.deliveryAddress,
          pickupTime: params.pickupTime,
          extras: quote.extras,
          depositStatus: 'RECORDED',
          notes: params.notes,
          expiresAt,
          createdAt: now,
          updatedAt: now
        };

        // Materialize the day slots the existing engine can see, holding qty.
        this.applySlotDelta(listing, params.startDate, params.endDate, params.quantity, 'held', params.quantity);
        db.rentalBookings.push(booking);

        db.logAudit(params.userId, 'Traveler', 'RENTAL_HOLD_CREATED', 'RentalBooking', booking.id, {
          holdToken,
          listingId: listing.id,
          startDate: params.startDate,
          endDate: params.endDate,
          quantity: params.quantity,
          totalEGP: quote.breakdown.totalEGP,
          expiresAt
        });
        db.saveToDisk();
        holdResult = booking;
      });
      return { booking: holdResult };
    } finally {
      if (lease) distributedLockService.release(lease);
    }
  }

  public checkoutRentalBooking(params: {
    rentalBookingId: string;
    tripId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    idempotencyKey: string;
    provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
  }): { success: boolean; bookingRef: string; totalAmountEGP: number; replayed?: boolean } {
    const rentalBooking = this.bookingOrThrow(params.rentalBookingId);

    // Whole-checkout replay protection, exactly like the existing engine: if a
    // payment already exists for this key, the checkout already ran. Checked
    // before the status guards so a client retry after a committed response
    // returns the settled result instead of a 409.
    const existingPayment = db.payments.find(p => p.idempotencyKey === params.idempotencyKey);
    if (existingPayment) {
      return {
        success: true,
        replayed: true,
        bookingRef: rentalBooking.bookingRef,
        totalAmountEGP: existingPayment.amountEGP
      };
    }

    if (rentalBooking.tripId !== params.tripId) {
      throw domainError('This rental booking does not belong to the given trip.', 400);
    }
    if (rentalBooking.status !== 'PENDING_PAYMENT') {
      throw domainError(
        rentalBooking.status === 'PENDING_CONFIRMATION'
          ? 'This rental is already paid and awaiting provider confirmation.'
          : `This rental cannot be checked out from status ${rentalBooking.status}.`,
        409
      );
    }
    if (rentalBooking.expiresAt && rentalBooking.expiresAt < new Date().toISOString()) {
      throw domainError('This rental hold has expired. Please book again.', 409);
    }

    // Before payment: the provider may have been suspended since the hold.
    assertSupplierBookable(rentalBooking.supplierId, rentalBooking.skuId);

    // Price comes from the hold's server-computed snapshot — never the body.
    const totalAmountEGP = rentalBooking.priceBreakdown.totalEGP;
    const listing = db.rentalListings.find(l => l.id === rentalBooking.listingId);
    const now = new Date().toISOString();
    const bookingRef = `DHB-REN-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const confirmationCode = `DHB-REN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Fraud gate — the same call every checkout path makes; rentals never ran
    // it. After the replay check above, so a retry is never scored as a
    // duplicate payment.
    assertCheckoutAllowed({
      userId: rentalBooking.userId,
      transactionId: params.idempotencyKey,
      amountEGP: totalAmountEGP,
      bookingId: bookingRef
    });

    // bookingRef is generated before settlement so the PAYMENT_CAPTURED ledger
    // entry and the payment row carry it — refunds are keyed off the ledger's
    // bookingRef, and an entry without one would never be refundable.
    const paymentResult = paymentService.processCheckout({
      idempotencyKey: params.idempotencyKey,
      tripId: params.tripId,
      holdToken: rentalBooking.holdToken,
      bookingId: bookingRef,
      amountEGP: totalAmountEGP,
      provider: params.provider || 'PAYMOB',
      cardLast4: params.cardLast4,
      cardBrand: params.cardBrand,
      cardHolderName: params.cardHolderName,
      payerEmail: params.travelerEmail,
      payerPhone: params.travelerPhone
    });

    db.runInTransaction(() => {
      rentalBooking.status = 'PENDING_CONFIRMATION';
      // The payment state must mirror what the gateway (or absence of one)
      // actually decided. CASH_ON_ARRIVAL never captured anything: the
      // traveler pays the provider in person. Hardcoding CAPTURED here put
      // unsettled cash bookings into the books as settled money.
      rentalBooking.paymentState = paymentResult.payment.state;
      rentalBooking.bookingRef = bookingRef;
      rentalBooking.expiresAt = undefined;
      rentalBooking.updatedAt = now;

      // held -> reserved on the existing engine's day slots.
      if (listing) {
        this.applySlotDelta(listing, rentalBooking.startDate, rentalBooking.endDate, rentalBooking.quantity, 'held', -rentalBooking.quantity);
        this.applySlotDelta(listing, rentalBooking.startDate, rentalBooking.endDate, rentalBooking.quantity, 'reserved', rentalBooking.quantity);
      }

      const booking: BookingEntity = {
        id: bookingRef,
        bookingRef,
        tripId: params.tripId,
        rentalBookingId: rentalBooking.id,
        supplierId: rentalBooking.supplierId,
        skuId: rentalBooking.skuId,
        serviceType: 'rental',
        amountEGP: totalAmountEGP,
        paymentState: paymentResult.payment.state,
        // The supplier has not seen this yet — same convention as every vertical.
        supplierState: 'PENDING_CONFIRMATION',
        travelerName: params.travelerName,
        travelerPhone: params.travelerPhone,
        travelerEmail: params.travelerEmail,
        passengersCount: rentalBooking.quantity,
        pickupLocation:
          rentalBooking.deliveryMode === 'DELIVERY'
            ? `Delivery — ${rentalBooking.deliveryAddress || rentalBooking.deliveryZoneId}`
            : `Pickup — ${listing?.pickupZoneId || 'shop'}`,
        dropoffLocation: undefined,
        scheduledDate: rentalBooking.startDate,
        scheduledTime: rentalBooking.pickupTime || 'FULL DAY',
        specialRequests: rentalBooking.notes,
        confirmationCode,
        createdAt: now,
        updatedAt: now
      };
      db.bookings.push(booking);

      // Attach to the itinerary line this booking fulfils (existing convention).
      let tripItem = db.tripItems.find(
        ti =>
          ti.tripId === params.tripId &&
          ti.skuId === rentalBooking.skuId &&
          !ti.bookingId &&
          ti.status !== 'CANCELLED'
      );
      if (tripItem) {
        tripItem.status = 'CONFIRMED';
        tripItem.bookingId = booking.id;
        tripItem.priceEGP = totalAmountEGP;
        tripItem.updatedAt = now;
      } else {
        db.tripItems.push({
          id: `ITEM-${Date.now()}-REN`,
          tripId: params.tripId,
          serviceType: 'rental',
          skuId: rentalBooking.skuId,
          title: listing?.name || 'Rental Booking',
          dayNumber: 2,
          timeSlot: rentalBooking.pickupTime || 'FULL DAY',
          priceEGP: totalAmountEGP,
          status: 'CONFIRMED',
          bookingId: booking.id,
          createdAt: now,
          updatedAt: now
        });
      }

      const trip = db.trips.find(t => t.id === params.tripId);
      if (trip) {
        trip.totalPaidEGP += totalAmountEGP;
        trip.updatedAt = now;
      }
      reconcileTripStatus(params.tripId, params.travelerName);

      notificationService.sendNotification({
        userId: db.trips.find(t => t.id === params.tripId)?.userId || 'UNATTRIBUTED',
        type: 'BOOKING_CREATED',
        channel: 'WHATSAPP',
        title: `Booking Confirmed: RENTAL`,
        message: `Your rental ${bookingRef} is confirmed! Voucher code: ${confirmationCode}.`,
        metadata: { recipientPhone: params.travelerPhone, bookingRef, priceEGP: totalAmountEGP, rentalBookingId: rentalBooking.id }
      });
      db.logAudit(params.travelerName, 'Traveler', 'RENTAL_CHECKOUT_COMPLETED', 'RentalBooking', rentalBooking.id, {
        bookingRef,
        totalAmountEGP,
        transactionId: paymentResult.payment.transactionId
      });
    });

    return { success: true, bookingRef, totalAmountEGP };
  }

  // ---------------------------------------------------------------- lifecycle

  public cancelRentalBooking(params: {
    bookingId: string;
    actor: { userId: string; role: string };
    reason?: string;
  }): RentalBookingEntity {
    const booking = this.bookingOrThrow(params.bookingId);
    const now = new Date().toISOString();
    const isOps = params.actor.role === 'Operations' || params.actor.role === 'Admin';

    const cancellableFrom: RentalBookingStatus[] = isOps
      ? ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'OVERDUE']
      : ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'];
    if (!cancellableFrom.includes(booking.status)) {
      throw domainError(`A rental in status ${booking.status} cannot be cancelled.`, 409);
    }

    let refundEGP = 0;
    db.runInTransaction(() => {
      const listing = db.rentalListings.find(l => l.id === booking.listingId);
      const wasPaid = booking.paymentState === 'CAPTURED';
      // Captured before the mutation: a PENDING_PAYMENT cancel releases held
      // slots, a paid cancel releases reserved slots.
      const heldBeforeCancel = booking.status === 'PENDING_PAYMENT';

      if (wasPaid && !isOps) {
        // Free cancellation window: within cancellationPolicyHours of start.
        const startTs = parseDay(booking.startDate);
        const policyMs = (listing?.cancellationPolicyHours ?? 24) * 3600 * 1000;
        if (Date.now() > startTs - policyMs) {
          refundEGP = 0; // past the window: cancellation allowed, no refund (per policy)
        } else {
          refundEGP = booking.priceBreakdown.totalEGP;
        }
      } else if (wasPaid && isOps) {
        refundEGP = booking.priceBreakdown.totalEGP;
      }

      booking.status = 'CANCELLED';
      booking.updatedAt = now;
      if (booking.paymentState === 'CAPTURED' && refundEGP > 0) {
        booking.paymentState = 'REFUNDED';
        paymentService.processRefund({
          bookingId: booking.bookingRef,
          tripId: booking.tripId,
          amountEGP: refundEGP,
          reason: params.reason || 'Rental cancelled',
          idempotencyKey: `REF-REN-${booking.id}`,
          initiatedBy: params.actor.userId
        });
      }

      // Release whatever the booking still consumes.
      if (listing) {
        this.applySlotDelta(
          listing,
          booking.startDate,
          booking.endDate,
          booking.quantity,
          heldBeforeCancel ? 'held' : 'reserved',
          -booking.quantity
        );
      }

      const bookingsRow = db.bookings.find(b => b.bookingRef === booking.bookingRef);
      if (bookingsRow) {
        bookingsRow.supplierState = 'CANCELLED';
        if (refundEGP > 0) bookingsRow.paymentState = 'REFUNDED';
        bookingsRow.updatedAt = now;
      }

      this.notifyForBooking(booking, 'Rental Cancelled', `Your rental ${booking.bookingRef || booking.id} has been cancelled${refundEGP > 0 ? ` and ${refundEGP} EGP refunded.` : '.'}`, {
        reason: params.reason
      });
      db.logAudit(params.actor.userId, params.actor.role, 'RENTAL_CANCELLED', 'RentalBooking', booking.id, {
        refundEGP,
        reason: params.reason
      });
    });

    return booking;
  }

  public acceptRentalBooking(params: { bookingId: string; supplierId: string }): RentalBookingEntity {
    const booking = this.bookingOrThrow(params.bookingId);
    if (booking.supplierId !== params.supplierId) {
      throw domainError('This booking belongs to a different supplier.', 403);
    }
    if (booking.status !== 'PENDING_CONFIRMATION') {
      throw domainError(`A rental in status ${booking.status} cannot be accepted.`, 409);
    }
    supplierService.updateBookingState({
      bookingId: booking.bookingRef,
      supplierId: params.supplierId,
      action: 'ACCEPT'
    });
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date().toISOString();
    this.notifyForBooking(booking, 'Rental Confirmed', `Your rental for ${booking.startDate} – ${booking.endDate} is confirmed.`, {});
    return booking;
  }

  public rejectRentalBooking(params: { bookingId: string; supplierId: string; reason?: string }): RentalBookingEntity {
    const booking = this.bookingOrThrow(params.bookingId);
    if (booking.supplierId !== params.supplierId) {
      throw domainError('This booking belongs to a different supplier.', 403);
    }
    if (booking.status !== 'PENDING_CONFIRMATION') {
      throw domainError(`A rental in status ${booking.status} cannot be rejected.`, 409);
    }
    const now = new Date().toISOString();
    db.runInTransaction(() => {
      booking.status = 'REJECTED';
      booking.updatedAt = now;
      // Reject first: the supplier route now enforces the lifecycle, and
      // PENDING_CONFIRMATION → REJECTED is the legal step. processRefund
      // leaves a REJECTED mirror as it is (it only cancels live bookings), so
      // rentals still distinguish REJECTED from CANCELLED.
      supplierService.updateBookingState({
        bookingId: booking.bookingRef,
        supplierId: params.supplierId,
        action: 'REJECT',
        reason: params.reason || 'Capacity constraint'
      });
      if (booking.paymentState === 'CAPTURED') {
        booking.paymentState = 'REFUNDED';
        paymentService.processRefund({
          bookingId: booking.bookingRef,
          tripId: booking.tripId,
          amountEGP: booking.priceBreakdown.totalEGP,
          reason: params.reason || 'Rejected by supplier',
          idempotencyKey: `REF-REN-${booking.id}-REJ`,
          initiatedBy: params.supplierId
        });
      }
      const listing = db.rentalListings.find(l => l.id === booking.listingId);
      if (listing) {
        this.applySlotDelta(listing, booking.startDate, booking.endDate, booking.quantity, 'reserved', -booking.quantity);
      }
      this.notifyForBooking(booking, 'Rental Rejected', `The provider could not fulfil your rental ${booking.bookingRef}. Your payment has been refunded.`, {});
      db.logAudit(params.supplierId, 'Supplier', 'RENTAL_REJECTED', 'RentalBooking', booking.id, { reason: params.reason });
    });
    return booking;
  }

  public markRentalReturned(params: {
    bookingId: string;
    supplierId: string;
    damageReport?: string;
    depositDeductionEGP?: number;
    lateFeeEGP?: number;
  }): RentalBookingEntity {
    const booking = this.bookingOrThrow(params.bookingId);
    if (booking.supplierId !== params.supplierId) {
      throw domainError('This booking belongs to a different supplier.', 403);
    }
    if (booking.status !== 'ACTIVE' && booking.status !== 'OVERDUE' && booking.status !== 'READY_FOR_PICKUP') {
      throw domainError(`A rental in status ${booking.status} cannot be marked returned.`, 409);
    }
    const now = new Date().toISOString();
    db.runInTransaction(() => {
      const listing = db.rentalListings.find(l => l.id === booking.listingId);
      booking.status = 'RETURNED';
      booking.updatedAt = now;
      booking.damageReport = params.damageReport;
      if (params.depositDeductionEGP != null && params.depositDeductionEGP > 0) {
        booking.depositStatus = 'DEDUCTED';
        booking.depositDeductionEGP = Math.min(params.depositDeductionEGP, booking.priceBreakdown.depositEGP);
      } else {
        booking.depositStatus = 'RETURNED';
      }
      if (params.lateFeeEGP != null && params.lateFeeEGP > 0) {
        booking.lateFeeEGP = params.lateFeeEGP;
        ledgerService.recordDoubleEntry({
          transactionId: `TXN-LATE-${Date.now()}`,
          idempotencyKey: `IDEMP-LATE-${booking.id}`,
          bookingRef: booking.bookingRef,
          tripId: booking.tripId,
          type: 'ADJUSTMENT',
          amountEGP: params.lateFeeEGP,
          debitAccount: 'PLATFORM_ESCROW_MAIN',
          creditAccount: `SUPPLIER_PAYABLE_${booking.supplierId}`,
          metadata: { reason: 'RENTAL_LATE_FEE', rentalBookingId: booking.id }
        });
      }

      const bookingsRow = db.bookings.find(b => b.bookingRef === booking.bookingRef);
      if (bookingsRow) {
        bookingsRow.supplierState = 'RETURNED';
        bookingsRow.updatedAt = now;
      }
      // Inventory is released the moment the bike is back.
      if (listing) {
        this.applySlotDelta(listing, booking.startDate, booking.endDate, booking.quantity, 'reserved', -booking.quantity);
      }
      this.notifyForBooking(booking, 'Rental Returned', `Your rental ${booking.bookingRef} has been returned${booking.depositStatus === 'DEDUCTED' ? ' with a deposit deduction' : ' and your deposit released'}.`, {
        depositStatus: booking.depositStatus
      });
      db.logAudit(params.supplierId, 'Supplier', 'RENTAL_RETURNED', 'RentalBooking', booking.id, {
        damageReport: params.damageReport,
        depositStatus: booking.depositStatus
      });
    });
    return booking;
  }

  public completeRentalBooking(params: { bookingId: string; supplierId: string }): RentalBookingEntity {
    const booking = this.bookingOrThrow(params.bookingId);
    if (booking.supplierId !== params.supplierId) {
      throw domainError('This booking belongs to a different supplier.', 403);
    }
    if (booking.status !== 'RETURNED') {
      throw domainError(`A rental in status ${booking.status} cannot be completed.`, 409);
    }
    supplierService.updateBookingState({
      bookingId: booking.bookingRef,
      supplierId: params.supplierId,
      action: 'COMPLETE'
    });
    booking.status = 'COMPLETED';
    booking.updatedAt = new Date().toISOString();
    this.notifyForBooking(booking, 'Rental Completed', `Your rental ${booking.bookingRef} is complete. Thank you!`, {});
    return booking;
  }

  /** Read-time reconciliation, mirroring reconcileTripStatus. */
  public reconcileBookingStates(): number {
    const nowIso = new Date().toISOString();
    const today = todayLocal();
    let changed = 0;
    db.runInTransaction(() => {
      for (const b of db.rentalBookings) {
        if (b.status === 'CONFIRMED' && b.startDate <= today) {
          b.status = 'READY_FOR_PICKUP';
          b.updatedAt = nowIso;
          const row = db.bookings.find(x => x.bookingRef === b.bookingRef);
          if (row) row.supplierState = 'READY_FOR_PICKUP';
          changed += 1;
        } else if (b.status === 'ACTIVE') {
          const endTs = parseDay(b.endDate);
          if (Date.now() > endTs + OVERDUE_GRACE_MS) {
            b.status = 'OVERDUE';
            b.updatedAt = nowIso;
            changed += 1;
          }
        }
      }
      if (changed > 0) db.saveToDisk();
    });
    return changed;
  }

  // --------------------------------------------------------- maintenance blocks

  public createMaintenanceBlock(params: {
    listingId: string;
    startDate: string;
    endDate: string;
    quantityBlocked: number;
    reason: string;
    createdBy: string;
  }): RentalMaintenanceBlockEntity {
    const listing = this.listingOrThrow(params.listingId);
    if (params.quantityBlocked < 1 || params.quantityBlocked > listing.quantity) {
      throw domainError(`Blocked quantity must be between 1 and the fleet size (${listing.quantity}).`, 400);
    }
    if (daysInRange(params.startDate, params.endDate) < 1) {
      throw domainError('Block start must be on or before block end.', 400);
    }

    const block: RentalMaintenanceBlockEntity = {
      id: `BLK-REN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      listingId: listing.id,
      startDate: params.startDate,
      endDate: params.endDate,
      quantityBlocked: params.quantityBlocked,
      reason: params.reason,
      createdBy: params.createdBy,
      createdAt: new Date().toISOString()
    };

    db.runInTransaction(() => {
      // A block and a confirmed booking may only coexist if the day still fits:
      // blocked(day) + committed(day) <= quantity on every day.
      for (const day of eachDay(params.startDate, params.endDate)) {
        const committed = this.committedQuantityForDay(listing.id, day);
        const otherBlocks = this.blockedQuantityForDay(listing.id, day) + params.quantityBlocked;
        if (committed + otherBlocks > listing.quantity) {
          throw domainError(
            `This block would over-commit ${day}: ${committed} bike(s) already booked and ` +
              `${otherBlocks} blocked out of ${listing.quantity}.`,
            409,
            { day, committed, blocked: otherBlocks, quantity: listing.quantity }
          );
        }
      }
      db.rentalMaintenanceBlocks.push(block);
      db.logAudit(params.createdBy, 'Supplier', 'RENTAL_MAINTENANCE_BLOCKED', 'RentalListing', listing.id, {
        blockId: block.id,
        startDate: params.startDate,
        endDate: params.endDate,
        quantityBlocked: params.quantityBlocked
      });
      db.saveToDisk();
    });
    return block;
  }

  public deleteMaintenanceBlock(params: { blockId: string; supplierId?: string; actorRole?: string }): boolean {
    const index = db.rentalMaintenanceBlocks.findIndex(b => b.id === params.blockId);
    if (index === -1) throw domainError('Maintenance block not found.', 404);
    const block = db.rentalMaintenanceBlocks[index];
    const listing = db.rentalListings.find(l => l.id === block.listingId);
    const isOps = params.actorRole === 'Operations' || params.actorRole === 'Admin';
    if (!isOps && listing && params.supplierId && listing.supplierId !== params.supplierId) {
      throw domainError('This block belongs to a different supplier.', 403);
    }
    db.rentalMaintenanceBlocks.splice(index, 1);
    return true;
  }

  // ------------------------------------------------------ provider & admin views

  public providerListings(supplierId: string): RentalListingEntity[] {
    return db.rentalListings.filter(l => l.supplierId === supplierId);
  }

  public providerBookings(supplierId: string, filters: { status?: string; from?: string; to?: string }): RentalBookingEntity[] {
    return db.rentalBookings
      .filter(b => b.supplierId === supplierId)
      .filter(b => !filters.status || b.status === filters.status)
      .filter(b => !filters.from || b.endDate >= filters.from)
      .filter(b => !filters.to || b.startDate <= filters.to)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  public setListingStatus(params: { listingId: string; status: RentalListingEntity['status']; actor: { userId: string; role: string } }): RentalListingEntity {
    const listing = this.listingOrThrow(params.listingId);
    if (params.actor.role !== 'Operations' && params.actor.role !== 'Admin') {
      throw domainError('Only Operations or Admin may change listing status.', 403);
    }
    listing.status = params.status;
    listing.updatedAt = new Date().toISOString();
    db.logAudit(params.actor.userId, params.actor.role, 'RENTAL_LISTING_STATUS_CHANGED', 'RentalListing', listing.id, {
      status: params.status
    });
    db.saveToDisk();
    return listing;
  }

  /** Hourly sweep: expired holds + read-time reconciliation. Called from server.ts. */
  public startScheduledSweep(): void {
    const sweep = () => {
      try {
        this.releaseExpiredHolds();
        this.reconcileBookingStates();
      } catch (err: any) {
        console.error('[Rentals] scheduled sweep failed:', err.message);
      }
    };
    sweep();
    const timer = setInterval(sweep, 60_000);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
  }
}

export const rentalService = new RentalService();
