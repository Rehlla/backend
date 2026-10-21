import crypto from 'crypto';
import { db } from '../db/database';
import type {
  BookingEntity,
  ProductSkuEntity,
  TransferBusScheduleEntity,
  TransferTelemetryEntity,
  TransferZonePriceEntity,
  TransferDestinationEntity,
  TransferPairPriceEntity,
  TransferRequestEntity,
} from '../db/schema';
import { transferRouteService } from './transferRouteService';
import { paymentService } from './paymentService';
import { assertSupplierBookable } from './commerceService';
import { assertTransition } from './bookingLifecycle';
import { assertCheckoutAllowed } from './fraudDetectionService';
import { notificationService } from './notificationService';
import {
  HUB_ADDONS,
  HUB_ASSIGN_LEAD_MS,
  HUB_BUS_SEED,
  HUB_DESTINATION_SEED,
  HUB_DRIVER_SEED,
  HUB_EARLY_DAYS,
  HUB_EARLY_RATE,
  HUB_EXTRA_STOP_EGP,
  HUB_LUGGAGE_EGP,
  HUB_RETURN_RATE,
  HUB_TIER_FACTORS,
  HUB_ZONE_SEED,
  ZONE_ORIGIN,
  type HubDestination
} from '../data/transferHubCatalog';
import type {
  HubLuggage,
  HubMode,
  HubTierId,
  HubTripType,
  TransferHubOpsQuote,
  TransferHubPublicQuote,
  TransferHubQuoteRequest,
  TransferHubQuoteSnapshot
} from '../../src/shared/types/transferHub';

const SUPPLIER_ID = 'SUP-SHUTTLE-01';
const DAY_MS = 24 * 60 * 60 * 1000;

export class TransferHubError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'TransferHubError';
    this.status = status;
    this.code = code;
  }
}

export interface HubQuoteInput extends TransferHubQuoteRequest {
  now?: Date;
}

interface PricedTier {
  vehicleEGP: number;
  supplierBaseEGP: number;
  totalEGP: number;
  earlyDiscountEGP: number;
  supplierCostEGP: number;
}

/**
 * Future-ride quotes, price locks, free cancellation, and the 12-hour driver assign.
 * Every EGP figure is computed here. The client amount is checked, never trusted.
 */
export class TransferHubService {
  public ensureSeed(): void {
    let inserted = false;
    if (db.transferZonePrices.length === 0) {
      db.transferZonePrices.push(...HUB_ZONE_SEED.map(row => ({ ...row })));
      inserted = true;
    }
    if (db.transferBusSchedules.length === 0) {
      db.transferBusSchedules.push(...HUB_BUS_SEED.map(row => ({ ...row })));
      inserted = true;
    }
    if (db.transferDrivers.length === 0) {
      db.transferDrivers.push(...HUB_DRIVER_SEED.map(row => ({ ...row, langs: [...row.langs], badgesEn: [...row.badgesEn], badgesAr: [...row.badgesAr] })));
      inserted = true;
    }
    // The destination catalog is runtime-editable, so this only supplies the
    // shipped set once; an operations edit afterwards is the source of truth.
    if (db.transferDestinations.length === 0) {
      db.transferDestinations.push(...HUB_DESTINATION_SEED.map(row => ({ ...row })));
      inserted = true;
    }
    if (inserted) db.saveToDisk();
  }

  public catalog() {
    this.ensureSeed();
    const zones = transferRouteService.getOrigins({ transferType: 'within_dahab' }).map(zoneOrigin => ({
      id: zoneOrigin.id,
      labelEn: zoneOrigin.labelEn,
      labelAr: zoneOrigin.labelAr,
      subEn: 'Dahab',
      subAr: 'دهب',
      regionEn: 'Dahab',
      distanceKm: zoneOrigin.distanceKm,
      durationEn: '',
      durationAr: '',
      haul: 'short' as const
    }));
    const cities = db.transferZonePrices.filter(row => row.active).map(row => ({
      id: row.id,
      labelEn: row.labelEn,
      labelAr: row.labelAr,
      subEn: row.subEn,
      subAr: row.subAr,
      regionEn: row.regionEn,
      distanceKm: row.distanceKm,
      durationEn: row.durationEn,
      durationAr: row.durationAr,
      haul: row.haul
    }));
    return {
      origins: [...cities, ...zones],
      destinations: this.activeDestinations(),
      addons: HUB_ADDONS.map(addon => ({ ...addon })),
      luggage: HUB_LUGGAGE_EGP,
      extraStopEGP: HUB_EXTRA_STOP_EGP,
      earlyDays: HUB_EARLY_DAYS,
      earlyRate: HUB_EARLY_RATE
    };
  }

  public busesFor(originId: string) {
    this.ensureSeed();
    return db.transferBusSchedules
      .filter(row => row.active && row.originId === originId)
      .map(row => ({
        id: row.id,
        originId: row.originId,
        operatorId: row.operatorId,
        operatorName: row.operatorName,
        operatorNameAr: row.operatorNameAr,
        departLabel: row.departLabel,
        arriveLabel: row.arriveLabel,
        durationLabel: row.durationLabel,
        priceEGP: row.priceEGP,
        fromLabel: row.fromLabel,
        toLabel: row.toLabel,
        seats: row.seats
      }));
  }

  public driverPreview() {
    this.ensureSeed();
    return db.transferDrivers.filter(driver => driver.active).map(driver => ({
      id: driver.id,
      nameEn: driver.nameEn,
      nameAr: driver.nameAr,
      rating: driver.rating,
      trips: driver.trips,
      langs: driver.langs,
      badgesEn: driver.badgesEn,
      badgesAr: driver.badgesAr,
      carEn: driver.carEn,
      carAr: driver.carAr,
      initials: driver.initials,
      verified: driver.verified
    }));
  }

  public opsCatalog() {
    this.ensureSeed();
    return {
      zones: db.transferZonePrices.map(row => ({ ...row })),
      buses: db.transferBusSchedules.map(row => ({ ...row })),
      drivers: db.transferDrivers.map(row => ({ ...row })),
      destinations: db.transferDestinations.map(dest => ({ ...dest })),
      pairs: db.transferPairs.map(pair => ({ ...pair })),
      requests: db.transferRequests.map(request => ({ ...request }))
    };
  }

  public quotePublic(input: HubQuoteInput): TransferHubPublicQuote {
    const full = this.quote(input);
    const { supplierCostEGP: _supplier, slotId: _slot, reservedUnits: _units, ...rest } = full.snapshot;
    return {
      ...rest,
      distanceKm: full.distanceKm,
      durationEn: full.durationEn,
      durationAr: full.durationAr,
      busLastMileEGP: full.busLastMileEGP,
      comparison: full.comparison,
      tiers: full.tiers
    };
  }

  public quoteOps(input: HubQuoteInput): TransferHubOpsQuote {
    const full = this.quote(input);
    const pub = this.quotePublic(input);
    return {
      ...pub,
      supplierCostEGP: full.snapshot.supplierCostEGP,
      marginEGP: full.snapshot.sellEGP - full.snapshot.supplierCostEGP
    };
  }

  public fleet(originId: string, destinationId: string, tierId: HubTierId, now = new Date()) {
    this.ensureSeed();
    const days: Array<{ date: string; demand: number; tone: 'cheap' | 'moderate' | 'busy'; displayEGP: number }> = [];
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(now.getTime() + offset * DAY_MS);
      const date = localDate(day);
      const count = db.bookings.filter(booking =>
        booking.hubQuote &&
        booking.scheduledDate === date &&
        booking.supplierState !== 'CANCELLED' &&
        booking.supplierState !== 'REJECTED'
      ).length;
      const demand = Math.min(1, count / 8);
      const tone = demand >= 0.8 ? 'busy' : demand >= 0.5 ? 'moderate' : 'cheap';
      const base = this.quote({
        originId,
        destinationId,
        tierId,
        tripType: 'one',
        date,
        time: '09:30',
        passengers: 1,
        luggage: 'small',
        addonIds: [],
        mode: 'private',
        now
      }).snapshot.vehicleEGP;
      days.push({ date, demand, tone, displayEGP: Math.round(base * (1 + demand * 0.25)) });
    }
    return { days };
  }

  public lock(params: {
    travelerId: string;
    tripId: string;
    input: HubQuoteInput;
    expectedSellEGP: number;
    idempotencyKey: string;
    flightNumber?: string;
  }): { booking: BookingEntity; quote: TransferHubPublicQuote } {
    this.ensureSeed();
    const existingPayment = db.payments.find(payment => payment.idempotencyKey === params.idempotencyKey);
    if (existingPayment?.bookingId) {
      const existing = db.bookings.find(booking => booking.id === existingPayment.bookingId || booking.bookingRef === existingPayment.bookingId);
      if (existing?.hubQuote) {
        return { booking: existing, quote: this.quotePublic(params.input) };
      }
    }

    const trip = db.trips.find(row => row.id === params.tripId);
    if (!trip) throw new TransferHubError('Trip not found.', 404, 'TRIP_NOT_FOUND');
    if (trip.userId !== params.travelerId) {
      throw new TransferHubError('Trip not found.', 404, 'TRIP_NOT_FOUND');
    }

    const built = this.quote(params.input);
    if (built.snapshot.sellEGP !== params.expectedSellEGP) {
      throw new TransferHubError('The price changed. Review the new total before locking.', 409, 'PRICE_CHANGED');
    }
    const pickup = new Date(built.snapshot.pickupAt);
    if (!built.snapshot.asap && pickup.getTime() < (params.input.now || new Date()).getTime()) {
      throw new TransferHubError('Pickup is in the past.', 400, 'PICKUP_PAST');
    }

    const user = db.users.find(row => row.id === params.travelerId);
    const sku = this.ensureSku(built.snapshot);
    assertSupplierBookable(sku.supplierId, sku.id);
    this.assertCapacity(sku, built.snapshot, params.input.date, params.input.time);

    if (!existingPayment) {
      assertCheckoutAllowed({
        userId: params.travelerId,
        transactionId: params.idempotencyKey,
        amountEGP: built.snapshot.sellEGP,
        bookingId: 'HUB-PENDING'
      });
    }

    const paymentResult = paymentService.processCheckout({
      idempotencyKey: params.idempotencyKey,
      tripId: params.tripId,
      bookingId: 'PENDING',
      amountEGP: built.snapshot.sellEGP,
      provider: 'CASH_ON_ARRIVAL',
      payerEmail: user?.email,
      payerPhone: user?.phone
    });

    const nowIso = new Date().toISOString();
    const bookingRef = `DHB-HUB-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const booking = db.runInTransaction(() => {
      const schedule = built.snapshot.mode === 'bus' ? this.takeBusSeat(built.snapshot.busScheduleId) : undefined;
      const slotId = built.snapshot.mode === 'private'
        ? this.reserveSlot(sku, params.input.date, params.input.time, built.snapshot.reservedUnits)
        : undefined;
      const snapshot: TransferHubQuoteSnapshot = { ...built.snapshot, slotId, busScheduleId: schedule?.id || built.snapshot.busScheduleId };

      const row: BookingEntity = {
        id: bookingRef,
        bookingRef,
        tripId: params.tripId,
        supplierId: sku.supplierId,
        skuId: sku.id,
        serviceType: 'transfer',
        amountEGP: snapshot.sellEGP,
        paymentState: paymentResult.payment.state,
        supplierState: 'PENDING_CONFIRMATION',
        travelerName: user?.name || 'Traveler',
        travelerPhone: user?.phone || '',
        travelerEmail: user?.email || '',
        passengersCount: snapshot.passengers,
        pickupLocation: snapshot.originLabelEn,
        dropoffLocation: snapshot.destinationLabelEn,
        scheduledDate: params.input.date,
        scheduledTime: snapshot.asap ? 'ASAP' : params.input.time,
        flightNumber: params.flightNumber,
        specialRequests: this.specialRequests(snapshot),
        confirmationCode: `DHB-HUB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        hubQuote: snapshot,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.bookings.push(row);
      paymentResult.payment.bookingId = row.id;

      db.tripItems.push({
        id: `ITEM-HUB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        tripId: params.tripId,
        serviceType: 'transfer',
        skuId: sku.id,
        title: `${snapshot.originLabelEn} → ${snapshot.destinationLabelEn}`,
        dayNumber: 1,
        timeSlot: row.scheduledTime,
        priceEGP: snapshot.sellEGP,
        status: 'CONFIRMED',
        bookingId: row.id,
        metadata: { futureBooking: true, mode: snapshot.mode },
        createdAt: nowIso,
        updatedAt: nowIso
      });

      trip.totalEstimatedEGP += snapshot.sellEGP;
      trip.updatedAt = nowIso;

      const telemetry: TransferTelemetryEntity = {
        bookingId: row.id,
        referenceCode: row.bookingRef,
        driverName: undefined as unknown as string,
        driverPhone: undefined as unknown as string,
        vehicleModel: undefined as unknown as string,
        vehiclePlate: undefined as unknown as string,
        pickupLocation: row.pickupLocation || '',
        dropoffLocation: row.dropoffLocation || '',
        scheduledTime: row.scheduledTime,
        flightNumber: params.flightNumber || '',
        flightStatus: 'ON_TIME',
        status: 'ASSIGNED',
        lastGpsUpdate: 'Awaiting the 12-hour assignment',
        updatedAt: nowIso
      };
      db.transferTelemetry.push(telemetry);

      notificationService.sendNotification({
        userId: row.travelerEmail || params.travelerId,
        type: 'BOOKING_CREATED',
        title: 'Ride price locked',
        message: `Ride ${bookingRef} is locked at ${snapshot.sellEGP} EGP. Pay the driver on arrival. Free cancellation until 24 hours before pickup.`,
        channel: 'WHATSAPP',
        // The transport needs a number and a purpose to pick a session with.
        metadata: { recipientPhone: row.travelerPhone, purpose: 'traveler', bookingRef }
      });

      db.logAudit(params.travelerId, 'Traveler', 'HUB_RIDE_LOCKED', 'Booking', row.id, {
        bookingRef,
        sellEGP: snapshot.sellEGP
      });
      return row;
    });

    this.assignDueDrivers(params.input.now || new Date());
    const fresh = db.bookings.find(row => row.id === booking.id) || booking;
    return { booking: fresh, quote: this.quotePublic(params.input) };
  }

  public cancel(params: { bookingId: string; travelerId: string; role: string; now?: Date }): BookingEntity {
    const booking = db.bookings.find(row => row.id === params.bookingId || row.bookingRef === params.bookingId);
    if (!booking?.hubQuote) throw new TransferHubError('Booking not found.', 404, 'NOT_FOUND');
    const trip = db.trips.find(row => row.id === booking.tripId);
    const staff = params.role === 'Operations' || params.role === 'Admin';
    if (!trip || (trip.userId !== params.travelerId && !staff)) {
      throw new TransferHubError('Booking not found.', 404, 'NOT_FOUND');
    }
    if (booking.supplierState === 'CANCELLED') return booking;
    const now = params.now || new Date();
    const deadline = booking.hubQuote.freeCancelUntil ? new Date(booking.hubQuote.freeCancelUntil) : null;
    if (!deadline || now.getTime() >= deadline.getTime()) {
      throw new TransferHubError('Free cancellation has closed. It ends 24 hours before pickup.', 409, 'CANCEL_CLOSED');
    }
    assertTransition(booking.supplierState, 'CANCELLED');

    return db.runInTransaction(() => {
      this.releaseCapacity(booking);
      booking.supplierState = 'CANCELLED';
      booking.updatedAt = now.toISOString();
      db.logAudit(params.travelerId, params.role, 'HUB_RIDE_CANCELLED', 'Booking', booking.id, {
        bookingRef: booking.bookingRef
      });
      return booking;
    });
  }

  /**
   * A driver replied to a ride alert ("5 min", "on my way", "وصلت").
   *
   * The console and the traveller's tracking read the same telemetry row, so a
   * message from a phone is the cheapest live update there is — no driver app
   * required. `minutes` is the parsed ETA, or undefined when the reply was a
   * status phrase rather than a number; the raw text is always stored so an
   * operator can read what was actually said.
   */
  public recordDriverEta(bookingId: string, minutes: number | undefined, raw: string): BookingEntity {
    const booking = db.bookings.find(row => row.id === bookingId);
    if (!booking) throw new TransferHubError('Booking not found.', 404, 'NOT_FOUND');
    let telemetry = db.transferTelemetry.find(row => row.bookingId === booking.id);
    if (!telemetry) {
      telemetry = {
        bookingId: booking.id,
        referenceCode: booking.confirmationCode,
        driverName: booking.assignedResource?.driverName || 'Unassigned',
        driverPhone: booking.assignedResource?.driverPhone || '',
        vehicleModel: '',
        vehiclePlate: '',
        pickupLocation: booking.pickupLocation || '',
        dropoffLocation: booking.dropoffLocation || '',
        scheduledTime: booking.scheduledTime,
        flightStatus: 'SCHEDULED',
        status: 'ASSIGNED',
        lastGpsUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.transferTelemetry.push(telemetry);
    }
    telemetry.status = 'EN_ROUTE';
    telemetry.lastGpsUpdate = new Date().toISOString();
    telemetry.updatedAt = new Date().toISOString();
    (telemetry as unknown as { etaMinutes?: number; etaNote?: string }).etaMinutes = minutes;
    (telemetry as unknown as { etaNote?: string }).etaNote = raw.slice(0, 300);
    // A driver saying they are on the way is the earliest moment the ride stops
    // being "pending supplier confirmation" for everyone watching it.
    if (booking.supplierState === 'PENDING_CONFIRMATION') {
      booking.supplierState = 'CONFIRMED';
    }
    booking.updatedAt = new Date().toISOString();
    db.logAudit('WhatsAppGateway', 'System', 'DRIVER_ETA_RECORDED', 'Booking', booking.id, {
      minutes, note: raw.slice(0, 120)
    });
    db.saveToDisk();
    return booking;
  }

  /**
   * Hub rides a traveller owns (through their trips), or everything for
   * operations. Ownership is the trip's owner, same rule cancel() checks.
   */
  public bookingsForUser(userId: string, all: boolean): BookingEntity[] {
    this.ensureSeed();
    const ownedTrips = new Set(db.trips.filter(trip => all || trip.userId === userId).map(trip => trip.id));
    return db.bookings
      .filter(row => row.serviceType === 'transfer' && ownedTrips.has(row.tripId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(row => ({ ...row }));
  }

  /** One hub ride, by internal id or booking reference. */
  public bookingForUser(ref: string, userId: string, all: boolean): BookingEntity {
    const found = this.bookingsForUser(userId, all).find(row => row.id === ref || row.bookingRef === ref);
    if (!found) throw new TransferHubError('Booking not found.', 404, 'NOT_FOUND');
    return found;
  }

  /**
   * Assigns a verified driver once pickup is inside 12 hours, or immediately for ASAP.
   * Called from telemetry reads and the operations poll. No phone is written until then.
   */
  public assignDueDrivers(now = new Date()): void {
    this.ensureSeed();
    const drivers = db.transferDrivers.filter(driver => driver.active && driver.verified)
      .slice()
      .sort((a, b) => b.rating - a.rating);
    if (drivers.length === 0) return;

    for (const booking of db.bookings) {
      if (!booking.hubQuote) continue;
      if (booking.supplierState === 'CANCELLED' || booking.supplierState === 'REJECTED' || booking.supplierState === 'COMPLETED') continue;
      if (booking.assignedResource?.driverName) continue;
      const pickup = new Date(booking.hubQuote.pickupAt);
      const due = booking.hubQuote.asap || pickup.getTime() - now.getTime() <= HUB_ASSIGN_LEAD_MS;
      if (!due) continue;
      const driver = drivers.find(candidate => !this.driverBusy(candidate.id, booking));
      if (!driver) continue;
      this.writeAssignment(booking, driver.id);
    }
  }

  public assignDriver(bookingId: string, driverId: string): BookingEntity {
    this.ensureSeed();
    const booking = db.bookings.find(row => row.id === bookingId || row.bookingRef === bookingId);
    if (!booking?.hubQuote) throw new TransferHubError('Booking not found.', 404, 'NOT_FOUND');
    const driver = db.transferDrivers.find(row => row.id === driverId && row.active);
    if (!driver) throw new TransferHubError('Driver not found.', 404, 'DRIVER_NOT_FOUND');
    this.writeAssignment(booking, driver.id);
    return booking;
  }

  public updateZone(id: string, patch: Partial<TransferZonePriceEntity>): TransferZonePriceEntity {
    this.ensureSeed();
    const row = db.transferZonePrices.find(zoneRow => zoneRow.id === id);
    if (!row) throw new TransferHubError('Zone not found.', 404, 'NOT_FOUND');
    const numeric: Array<keyof TransferZonePriceEntity> = [
      'privateEGP', 'sharedEGP', 'busEGP', 'supplierPrivateEGP', 'supplierBusEGP', 'lastMileEGP', 'lastMileDriverDiscountEGP', 'distanceKm'
    ];
    for (const key of numeric) {
      const value = patch[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        (row as unknown as Record<string, number>)[key] = Math.round(value);
      }
    }
    if (patch.labelEn) row.labelEn = String(patch.labelEn).slice(0, 80);
    if (patch.labelAr) row.labelAr = String(patch.labelAr).slice(0, 80);
    db.saveToDisk();
    return row;
  }

  public updateBus(id: string, patch: Partial<TransferBusScheduleEntity>): TransferBusScheduleEntity {
    this.ensureSeed();
    const row = db.transferBusSchedules.find(busRow => busRow.id === id);
    if (!row) throw new TransferHubError('Bus not found.', 404, 'NOT_FOUND');
    if (typeof patch.priceEGP === 'number' && patch.priceEGP >= 0) row.priceEGP = Math.round(patch.priceEGP);
    if (typeof patch.seats === 'number' && patch.seats >= 0) row.seats = Math.round(patch.seats);
    if (typeof patch.departLabel === 'string') row.departLabel = patch.departLabel.slice(0, 80);
    if (typeof patch.arriveLabel === 'string') row.arriveLabel = patch.arriveLabel.slice(0, 80);
    if (typeof patch.active === 'boolean') row.active = patch.active;
    db.saveToDisk();
    return row;
  }

  public addBus(originId: string): TransferBusScheduleEntity {
    this.ensureSeed();
    if (!db.transferZonePrices.some(row => row.id === originId)) {
      throw new TransferHubError('Origin not found.', 404, 'NOT_FOUND');
    }
    const row: TransferBusScheduleEntity = {
      id: `bus-${originId}-${crypto.randomBytes(3).toString('hex')}`,
      originId,
      operatorId: 'gobus',
      operatorName: 'Go Bus',
      operatorNameAr: 'جو باص',
      departLabel: '11:40 PM',
      arriveLabel: '07:00 AM',
      durationLabel: '7h',
      priceEGP: 380,
      fromLabel: originId,
      toLabel: 'Dahab',
      seats: 10,
      active: true
    };
    db.transferBusSchedules.push(row);
    db.saveToDisk();
    return row;
  }

  public updateDriver(id: string, patch: { nameEn?: string; nameAr?: string; phone?: string; plate?: string; active?: boolean; rating?: number }): void {
    this.ensureSeed();
    const driver = db.transferDrivers.find(row => row.id === id);
    if (!driver) throw new TransferHubError('Driver not found.', 404, 'NOT_FOUND');
    if (typeof patch.nameEn === 'string') driver.nameEn = patch.nameEn.slice(0, 80);
    if (typeof patch.nameAr === 'string') driver.nameAr = patch.nameAr.slice(0, 80);
    if (typeof patch.phone === 'string') driver.phone = patch.phone.slice(0, 32);
    if (typeof patch.plate === 'string') driver.plate = patch.plate.slice(0, 32);
    if (typeof patch.active === 'boolean') driver.active = patch.active;
    if (typeof patch.rating === 'number' && patch.rating >= 0 && patch.rating <= 5) driver.rating = patch.rating;
    db.saveToDisk();
  }

  // ---------------------------------------------------------------------------
  // Dynamic route catalog
  //
  // The hub is a catalog, not a fixed list: operations publishes origins
  // (cities), destinations and explicit price pairs at runtime. Quotes validate
  // the pair against those tables, so a route the seed never heard of can be
  // sold by adding a row — and a route nobody priced yet is a review request
  // rather than a silently wrong number.
  // ---------------------------------------------------------------------------

  /** Active destinations, in catalog order. */
  private activeDestinations(): HubDestination[] {
    this.ensureSeed();
    return db.transferDestinations.filter(dest => dest.active).map(dest => ({ ...dest }));
  }

  /** The active price pair for an origin→destination, if one exists. */
  private pairFor(originId: string, destinationId: string): TransferPairPriceEntity | undefined {
    this.ensureSeed();
    return db.transferPairs.find(pair => pair.active && pair.originId === originId && pair.destinationId === destinationId);
  }

  /** Publish a new origin city with its own price matrix. */
  public addZone(
    actor: { userId: string; role: string },
    input: {
      id: string;
      labelEn: string;
      labelAr: string;
      subEn?: string;
      subAr?: string;
      regionEn?: string;
      privateEGP: number;
      sharedEGP?: number;
      busEGP?: number;
      supplierPrivateEGP?: number;
      distanceKm?: number;
      durationEn?: string;
      durationAr?: string;
      haul?: 'short' | 'long';
    }
  ): TransferZonePriceEntity {
    this.ensureSeed();
    const id = String(input.id || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(id)) {
      throw new TransferHubError('Zone id must be 2-32 characters of letters, digits and dashes.', 400, 'BAD_ID');
    }
    if (db.transferZonePrices.some(row => row.id === id)) {
      throw new TransferHubError('That zone already exists.', 409, 'ALREADY_EXISTS');
    }
    const privateEGP = Math.round(Number(input.privateEGP));
    if (!Number.isFinite(privateEGP) || privateEGP <= 0) {
      throw new TransferHubError('A zone needs a positive private price.', 400, 'BAD_PRICE');
    }
    const row: TransferZonePriceEntity = {
      id,
      labelEn: String(input.labelEn || '').slice(0, 80),
      labelAr: String(input.labelAr || '').slice(0, 80),
      subEn: String(input.subEn || '').slice(0, 80),
      subAr: String(input.subAr || '').slice(0, 80),
      regionEn: String(input.regionEn || '').slice(0, 80),
      privateEGP,
      sharedEGP: Math.round(Number(input.sharedEGP ?? privateEGP * HUB_TIER_FACTORS.shared.priceFactor)),
      busEGP: Math.round(Number(input.busEGP ?? privateEGP * HUB_TIER_FACTORS.shared.priceFactor)),
      supplierPrivateEGP: Math.round(Number(input.supplierPrivateEGP ?? privateEGP * 0.8)),
      supplierBusEGP: Math.round(Number(input.busEGP ?? privateEGP * HUB_TIER_FACTORS.shared.priceFactor) * 0.7),
      lastMileEGP: 0,
      lastMileDriverDiscountEGP: 50,
      distanceKm: Math.round(Number(input.distanceKm ?? 0)),
      durationEn: String(input.durationEn || '').slice(0, 32),
      durationAr: String(input.durationAr || '').slice(0, 32),
      haul: input.haul === 'long' ? 'long' : 'short',
      active: true
    };
    if (!row.labelEn || !row.labelAr) {
      throw new TransferHubError('A zone needs an English and an Arabic label.', 400, 'BAD_LABELS');
    }
    db.transferZonePrices.push(row);
    db.logAudit(actor.userId, actor.role, 'TRANSFER_ZONE_CREATED', 'Transfer', row.id, { id: row.id });
    db.saveToDisk();
    return row;
  }

  /** Publish a destination (a city, a resort town, a Dahab micro-zone). */
  public addDestination(
    actor: { userId: string; role: string },
    input: {
      id: string;
      labelEn: string;
      labelAr: string;
      subEn?: string;
      subAr?: string;
      kind: 'zone' | 'area';
      priceAddEGP?: number;
    }
  ): TransferDestinationEntity {
    this.ensureSeed();
    const id = String(input.id || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(id)) {
      throw new TransferHubError('Destination id must be 2-32 characters of letters, digits and dashes.', 400, 'BAD_ID');
    }
    if (db.transferDestinations.some(dest => dest.id === id)) {
      throw new TransferHubError('That destination already exists.', 409, 'ALREADY_EXISTS');
    }
    const row: TransferDestinationEntity = {
      id,
      labelEn: String(input.labelEn || '').slice(0, 80),
      labelAr: String(input.labelAr || '').slice(0, 80),
      subEn: String(input.subEn || '').slice(0, 80),
      subAr: String(input.subAr || '').slice(0, 80),
      priceAddEGP: Math.max(0, Math.round(Number(input.priceAddEGP) || 0)),
      kind: input.kind === 'area' ? 'area' : 'zone',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!row.labelEn || !row.labelAr) {
      throw new TransferHubError('A destination needs an English and an Arabic label.', 400, 'BAD_LABELS');
    }
    db.transferDestinations.push(row);
    db.logAudit(actor.userId, actor.role, 'TRANSFER_DESTINATION_CREATED', 'Transfer', row.id, { id: row.id, kind: row.kind });
    db.saveToDisk();
    return row;
  }

  public updateDestination(id: string, patch: Partial<TransferDestinationEntity>, actor: { userId: string; role: string }): TransferDestinationEntity {
    this.ensureSeed();
    const row = db.transferDestinations.find(dest => dest.id === id);
    if (!row) throw new TransferHubError('Destination not found.', 404, 'NOT_FOUND');
    if (patch.labelEn) row.labelEn = String(patch.labelEn).slice(0, 80);
    if (patch.labelAr) row.labelAr = String(patch.labelAr).slice(0, 80);
    if (patch.subEn !== undefined) row.subEn = String(patch.subEn).slice(0, 80);
    if (patch.subAr !== undefined) row.subAr = String(patch.subAr).slice(0, 80);
    if (typeof patch.priceAddEGP === 'number' && patch.priceAddEGP >= 0) row.priceAddEGP = Math.round(patch.priceAddEGP);
    if (typeof patch.active === 'boolean') row.active = patch.active;
    row.updatedAt = new Date().toISOString();
    db.logAudit(actor.userId, actor.role, 'TRANSFER_DESTINATION_UPDATED', 'Transfer', row.id, {});
    db.saveToDisk();
    return row;
  }

  /**
   * Publish (or replace) an explicit origin→destination price pair. This is how
   * a route the seed matrix does not cover gets sold: the pair carries the
   * figures operations set, and it overrides any derived price.
   */
  public addPair(
    actor: { userId: string; role: string },
    input: {
      originId: string;
      destinationId: string;
      privateEGP: number;
      sharedEGP?: number;
      premiumEGP?: number;
      supplierPrivateEGP?: number;
      supplierSharedEGP?: number;
      supplierPremiumEGP?: number;
      distanceKm?: number;
      durationEn?: string;
      durationAr?: string;
    }
  ): TransferPairPriceEntity {
    this.ensureSeed();
    const originId = String(input.originId || '').trim();
    const destinationId = String(input.destinationId || '').trim();
    if (!db.transferZonePrices.some(row => row.id === originId)) {
      throw new TransferHubError('Origin not found. Publish the city as a zone first.', 404, 'ORIGIN_NOT_FOUND');
    }
    if (!db.transferDestinations.some(dest => dest.id === destinationId)) {
      throw new TransferHubError('Destination not found. Publish it as a destination first.', 404, 'DESTINATION_NOT_FOUND');
    }
    const privateEGP = Math.round(Number(input.privateEGP));
    if (!Number.isFinite(privateEGP) || privateEGP <= 0) {
      throw new TransferHubError('A pair needs a positive private price.', 400, 'BAD_PRICE');
    }
    const sharedEGP = Math.round(Number(input.sharedEGP ?? privateEGP * HUB_TIER_FACTORS.shared.priceFactor));
    const premiumEGP = Math.round(Number(input.premiumEGP ?? privateEGP * HUB_TIER_FACTORS.premium.priceFactor));
    const supplierPrivateEGP = Math.round(Number(input.supplierPrivateEGP ?? privateEGP * 0.8));
    const now = new Date().toISOString();
    const existing = db.transferPairs.find(pair => pair.originId === originId && pair.destinationId === destinationId);
    const row: TransferPairPriceEntity = {
      id: existing ? existing.id : `pair-${originId}-${destinationId}`,
      originId,
      destinationId,
      privateEGP,
      sharedEGP: sharedEGP > 0 ? sharedEGP : Math.round(privateEGP * HUB_TIER_FACTORS.shared.priceFactor),
      premiumEGP: premiumEGP > 0 ? premiumEGP : Math.round(privateEGP * HUB_TIER_FACTORS.premium.priceFactor),
      supplierPrivateEGP,
      supplierSharedEGP: Math.round(Number(input.supplierSharedEGP ?? supplierPrivateEGP * HUB_TIER_FACTORS.shared.supplierFactor)),
      supplierPremiumEGP: Math.round(Number(input.supplierPremiumEGP ?? supplierPrivateEGP * HUB_TIER_FACTORS.premium.supplierFactor)),
      distanceKm: Math.round(Number(input.distanceKm ?? 0)),
      durationEn: String(input.durationEn || '').slice(0, 32),
      durationAr: String(input.durationAr || '').slice(0, 32),
      active: true,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      createdBy: actor.userId
    };
    if (existing) {
      db.transferPairs[db.transferPairs.indexOf(existing)] = row;
    } else {
      db.transferPairs.push(row);
    }
    db.logAudit(actor.userId, actor.role, 'TRANSFER_PAIR_UPSERTED', 'Transfer', row.id, { originId, destinationId, privateEGP });
    db.saveToDisk();
    return row;
  }

  public updatePair(id: string, patch: Partial<TransferPairPriceEntity>, actor: { userId: string; role: string }): TransferPairPriceEntity {
    this.ensureSeed();
    const row = db.transferPairs.find(pair => pair.id === id);
    if (!row) throw new TransferHubError('Pair not found.', 404, 'NOT_FOUND');
    const numeric: Array<keyof TransferPairPriceEntity> = [
      'privateEGP', 'sharedEGP', 'premiumEGP',
      'supplierPrivateEGP', 'supplierSharedEGP', 'supplierPremiumEGP', 'distanceKm'
    ];
    for (const key of numeric) {
      const value = patch[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        (row as unknown as Record<string, number>)[key] = Math.round(value);
      }
    }
    if (typeof patch.durationEn === 'string') row.durationEn = patch.durationEn.slice(0, 32);
    if (typeof patch.durationAr === 'string') row.durationAr = patch.durationAr.slice(0, 32);
    if (typeof patch.active === 'boolean') row.active = patch.active;
    row.updatedAt = new Date().toISOString();
    db.logAudit(actor.userId, actor.role, 'TRANSFER_PAIR_UPDATED', 'Transfer', row.id, {});
    db.saveToDisk();
    return row;
  }

  public listPairs(): TransferPairPriceEntity[] {
    this.ensureSeed();
    return db.transferPairs.map(pair => ({ ...pair }));
  }

  /**
   * A traveller asks for a ride the hub does not price today. It lands in the
   * operations queue instead of returning a number nobody can stand behind.
   */
  public createRequest(
    actor: { userId: string; role: string; name?: string; phone?: string },
    input: {
      originLabel: string;
      destinationLabel: string;
      originId?: string;
      destinationId?: string;
      date?: string;
      time?: string;
      passengers?: number;
      luggage?: 'small' | 'medium' | 'large';
      notes?: string;
    }
  ): TransferRequestEntity {
    this.ensureSeed();
    const originLabel = String(input.originLabel || '').trim().slice(0, 120);
    const destinationLabel = String(input.destinationLabel || '').trim().slice(0, 120);
    if (!originLabel || !destinationLabel) {
      throw new TransferHubError('Say where the ride starts and where it ends.', 400, 'BAD_REQUEST');
    }
    const row: TransferRequestEntity = {
      id: `TRQ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: actor.userId,
      travelerName: actor.name,
      travelerPhone: actor.phone,
      originLabel,
      destinationLabel,
      originId: input.originId ? String(input.originId).slice(0, 64) : undefined,
      destinationId: input.destinationId ? String(input.destinationId).slice(0, 64) : undefined,
      date: input.date ? String(input.date).slice(0, 10) : undefined,
      time: input.time ? String(input.time).slice(0, 8) : undefined,
      passengers: Math.max(1, Math.min(14, Math.round(Number(input.passengers) || 1))),
      luggage: input.luggage,
      notes: input.notes ? String(input.notes).slice(0, 500) : undefined,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.transferRequests.push(row);
    db.logAudit(actor.userId, actor.role, 'TRANSFER_REQUEST_CREATED', 'Transfer', row.id, { originLabel, destinationLabel });
    db.saveToDisk();
    return row;
  }

  public listRequests(status?: string): TransferRequestEntity[] {
    this.ensureSeed();
    const rows = status ? db.transferRequests.filter(request => request.status === status) : db.transferRequests;
    return rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(request => ({ ...request }));
  }

  public requestsForUser(userId: string): TransferRequestEntity[] {
    this.ensureSeed();
    return db.transferRequests.filter(request => request.userId === userId).map(request => ({ ...request }));
  }

  /**
   * Operations decides whether a request can be served. Accepting it with a
   * price publishes the pair, so the route quotes like any other from then on.
   */
  public reviewRequest(
    id: string,
    actor: { userId: string; role: string },
    input: {
      decision: 'ACCEPT' | 'DECLINE';
      note?: string;
      pair?: {
        originId: string;
        destinationId: string;
        privateEGP: number;
        sharedEGP?: number;
        premiumEGP?: number;
        supplierPrivateEGP?: number;
        distanceKm?: number;
        durationEn?: string;
        durationAr?: string;
      };
    }
  ): TransferRequestEntity {
    this.ensureSeed();
    const row = db.transferRequests.find(request => request.id === id);
    if (!row) throw new TransferHubError('Request not found.', 404, 'NOT_FOUND');
    if (row.status !== 'PENDING_REVIEW') {
      throw new TransferHubError('This request has already been reviewed.', 409, 'ALREADY_REVIEWED');
    }
    const now = new Date().toISOString();
    if (input.decision === 'ACCEPT') {
      if (input.pair) {
        const pair = this.addPair(actor, input.pair);
        row.pairId = pair.id;
      }
      row.status = 'ACCEPTED';
    } else {
      row.status = 'DECLINED';
    }
    row.reviewNote = input.note ? String(input.note).slice(0, 500) : undefined;
    row.updatedAt = now;
    db.logAudit(actor.userId, actor.role, 'TRANSFER_REQUEST_REVIEWED', 'Transfer', row.id, { decision: row.status });
    db.saveToDisk();
    return row;
  }

  /** Drops supplier cost before a supplier reads the booking. */
  public hideMargin<T extends { hubQuote?: TransferHubQuoteSnapshot }>(booking: T): T {
    if (!booking.hubQuote) return booking;
    const { supplierCostEGP: _cost, ...rest } = booking.hubQuote;
    return { ...booking, hubQuote: rest as TransferHubQuoteSnapshot };
  }

  private quote(input: HubQuoteInput): {
    snapshot: TransferHubQuoteSnapshot;
    distanceKm: number;
    durationEn: string;
    durationAr: string;
    busLastMileEGP: number;
    comparison: { privateEGP: number; sharedEGP: number; busLastMileEGP: number };
    tiers: Array<{ id: HubTierId; totalEGP: number }>;
  } {
    this.ensureSeed();
    const origin = this.resolveOrigin(input.originId);
    const destination = this.resolveDestination(input.destinationId);
    const now = input.now || new Date();
    const pickup = pickupInstant(input.date, input.time, now);
    const longHaul = origin.haul === 'long' && !origin.formulaId;
    if (input.mode === 'bus' && !longHaul && origin.haul === 'short' && origin.formulaId) {
      throw new TransferHubError('Bus plus last-mile is only offered on long-haul routes.', 400, 'BUS_NOT_OFFERED');
    }
    const passengers = input.passengers;
    const luggageEGP = HUB_LUGGAGE_EGP[input.luggage];
    const stops = input.tripType === 'multi' ? input.stops || [] : [];
    for (const stop of stops) {
      if (!db.transferDestinations.some(dest => dest.active && dest.id === stop)) {
        throw new TransferHubError(`Unknown stop "${stop}".`, 400, 'BAD_STOP');
      }
    }
    const stopsEGP = stops.length * HUB_EXTRA_STOP_EGP;
    const addonsEGP = input.addonIds.reduce((sum, id) => {
      const addon = HUB_ADDONS.find(row => row.id === id);
      if (!addon) throw new TransferHubError(`Unknown add-on "${id}".`, 400, 'BAD_ADDON');
      return sum + addon.priceEGP;
    }, 0);

    const priceOne = (tierId: HubTierId): { vehicleEGP: number; supplierBaseEGP: number } => {
      // An explicit pair wins: it is how operations sells a route the seed
      // matrix does not cover, with figures they set rather than derive.
      const pair = this.pairFor(input.originId, input.destinationId);
      if (pair) {
        const vehicleEGP = tierId === 'shared' ? pair.sharedEGP : tierId === 'premium' ? pair.premiumEGP : pair.privateEGP;
        const supplierBaseEGP =
          tierId === 'shared' ? pair.supplierSharedEGP
            : tierId === 'premium' ? pair.supplierPremiumEGP
              : pair.supplierPrivateEGP;
        return { vehicleEGP, supplierBaseEGP };
      }
      // A formula origin prices the ride it actually is: the airport/area leg
      // for a city destination, or the in-city loop when the destination is
      // another Dahab micro-zone. Anything else must come from the matrix (or a
      // pair) — never from a formula that ignores the destination.
      if (origin.formulaId && destination.kind === 'zone') {
        const quoted = transferRouteService.quote(origin.formulaId, tierId)[0];
        const base = tierId === 'shared' ? quoted.priceEGP * passengers : quoted.priceEGP;
        const zoneAdd = destination.priceAddEGP || 0;
        const vehicleEGP = base + zoneAdd;
        return { vehicleEGP, supplierBaseEGP: Math.round(vehicleEGP * 0.85) };
      }
      const row = this.priceRow(origin.zone, destination);
      const factors = HUB_TIER_FACTORS[tierId];
      const zoneAdd = destination.kind === 'zone' && destination.id !== row.id ? destination.priceAddEGP : 0;
      const vehicleEGP = Math.round(row.privateEGP * factors.priceFactor) + zoneAdd;
      const supplierBaseEGP = tierId === 'private'
        ? row.supplierPrivateEGP
        : Math.round(row.supplierPrivateEGP * factors.supplierFactor);
      return { vehicleEGP, supplierBaseEGP };
    };

    const finish = (tierId: HubTierId, mode: HubMode): PricedTier => {
      const base = priceOne(tierId);
      const returnEGP = input.tripType === 'round' ? Math.round(base.vehicleEGP * HUB_RETURN_RATE) : 0;
      let sell = base.vehicleEGP + returnEGP + luggageEGP + stopsEGP + addonsEGP;
      let supplier = base.supplierBaseEGP;
      if (mode === 'bus') {
        const row = this.priceRow(origin.zone, destination);
        const schedule = input.busScheduleId
          ? db.transferBusSchedules.find(busRow => busRow.id === input.busScheduleId && busRow.active)
          : undefined;
        const ticket = schedule ? schedule.priceEGP : row.busEGP;
        sell = ticket + row.lastMileEGP + luggageEGP + stopsEGP + addonsEGP + returnEGP;
        const driverPay = Math.max(0, row.lastMileEGP - row.lastMileDriverDiscountEGP);
        supplier = row.supplierBusEGP + driverPay;
      }
      const days = Math.max(1, Math.ceil((pickup.getTime() - now.getTime()) / DAY_MS));
      const earlyDiscountEGP = !input.time || input.time === 'ASAP' || days < HUB_EARLY_DAYS
        ? 0
        : Math.round(sell * HUB_EARLY_RATE);
      sell -= earlyDiscountEGP;
      return {
        vehicleEGP: base.vehicleEGP,
        supplierBaseEGP: base.supplierBaseEGP,
        totalEGP: sell,
        earlyDiscountEGP,
        supplierCostEGP: supplier
      };
    };

    const selected = finish(input.tierId, input.mode);
    const privateOnly = finish('private', 'private');
    const sharedOnly = finish('shared', 'private');
    const tiers: Array<{ id: HubTierId; totalEGP: number }> = (['shared', 'private', 'premium'] as HubTierId[]).map(id => ({
      id,
      totalEGP: finish(id, 'private').totalEGP
    }));

    const rowForBus = origin.zone ? this.priceRow(origin.zone, destination) : null;
    const schedule = input.busScheduleId
      ? db.transferBusSchedules.find(busRow => busRow.id === input.busScheduleId && busRow.active)
      : undefined;
    const busLastMileEGP = rowForBus
      ? (schedule ? schedule.priceEGP : rowForBus.busEGP) + rowForBus.lastMileEGP
      : 0;

    const returnEGP = input.tripType === 'round' ? Math.round(priceOne(input.tierId).vehicleEGP * HUB_RETURN_RATE) : 0;
    const snapshot: TransferHubQuoteSnapshot = {
      originId: input.originId,
      destinationId: input.destinationId,
      originLabelEn: origin.labelEn,
      originLabelAr: origin.labelAr,
      destinationLabelEn: destination.labelEn,
      destinationLabelAr: destination.labelAr,
      tierId: input.tierId,
      tripType: input.tripType,
      stops,
      mode: input.mode,
      busScheduleId: schedule?.id,
      passengers,
      luggage: input.luggage,
      addonIds: [...input.addonIds],
      sellEGP: selected.totalEGP,
      supplierCostEGP: selected.supplierCostEGP,
      earlyDiscountEGP: selected.earlyDiscountEGP,
      vehicleEGP: priceOne(input.tierId).vehicleEGP,
      returnEGP,
      luggageEGP,
      stopsEGP,
      addonsEGP,
      freeCancelUntil: new Date(pickup.getTime() - DAY_MS).toISOString(),
      pickupAt: pickup.toISOString(),
      returnDate: input.returnDate,
      returnTime: input.returnTime,
      asap: input.time === 'ASAP',
      longHaul: !origin.formulaId,
      reservedUnits: input.mode === 'bus' ? 1 : (input.tierId === 'shared' && origin.formulaId ? passengers : 1)
    };

    // A published pair describes the route itself, so its distance and
    // duration are what the traveller reads; the origin row is the fallback.
    const routed = this.pairFor(input.originId, input.destinationId);
    return {
      snapshot,
      distanceKm: routed && routed.distanceKm > 0 ? routed.distanceKm : origin.distanceKm,
      durationEn: routed && routed.durationEn ? routed.durationEn : origin.durationEn,
      durationAr: routed && routed.durationAr ? routed.durationAr : origin.durationAr,
      busLastMileEGP,
      comparison: {
        privateEGP: privateOnly.vehicleEGP,
        sharedEGP: sharedOnly.vehicleEGP,
        busLastMileEGP
      },
      tiers
    };
  }

  private resolveOrigin(originId: string): {
    labelEn: string;
    labelAr: string;
    distanceKm: number;
    durationEn: string;
    durationAr: string;
    haul: 'short' | 'long';
    formulaId?: string;
    zone?: TransferZonePriceEntity;
  } {
    const formulaFromZone = ZONE_ORIGIN[originId];
    const formulaId = originId.startsWith('ZONE-')
      ? originId
      : originId === 'ssh'
        ? 'SSH-AIRPORT'
        : originId === 'nuweiba'
          ? 'NWB-CITY'
          : formulaFromZone;
    if (formulaId && (originId.startsWith('ZONE-') || originId === 'ssh' || originId === 'nuweiba' || formulaFromZone)) {
      const route = transferRouteService.getById(formulaId);
      if (!route) throw new TransferHubError('Origin not found.', 404, 'ORIGIN_NOT_FOUND');
      // A formula origin has no city row of its own; the matrix lookup misses
      // on purpose and the route's own distance/duration is used instead.
      const matrix = db.transferZonePrices.find(row => row.id === originId && row.active);
      return {
        labelEn: route.originEn,
        labelAr: route.originAr,
        distanceKm: matrix?.distanceKm || route.distanceKm,
        durationEn: matrix?.durationEn || `${route.baseDurationMinutes} min`,
        durationAr: matrix?.durationAr || `${route.baseDurationMinutes} د`,
        haul: 'short',
        formulaId
      };
    }
    const zone = db.transferZonePrices.find(row => row.id === originId && row.active);
    if (!zone) throw new TransferHubError('Origin not found.', 404, 'ORIGIN_NOT_FOUND');
    if (zone.haul === 'short') {
      const mapped = zone.id === 'ssh' ? 'SSH-AIRPORT' : zone.id === 'nuweiba' ? 'NWB-CITY' : undefined;
      if (mapped) {
        const route = transferRouteService.getById(mapped);
        if (route) {
          return {
            labelEn: zone.labelEn,
            labelAr: zone.labelAr,
            distanceKm: zone.distanceKm,
            durationEn: zone.durationEn,
            durationAr: zone.durationAr,
            haul: 'short',
            formulaId: mapped,
            zone
          };
        }
      }
    }
    return {
      labelEn: zone.labelEn,
      labelAr: zone.labelAr,
      distanceKm: zone.distanceKm,
      durationEn: zone.durationEn,
      durationAr: zone.durationAr,
      haul: zone.haul,
      zone
    };
  }

  /**
   * Destinations come from the runtime catalog, never from the seed. A city id
   * that exists only as an *origin* row (Sharm, Cairo, Hurghada, …) is not a
   * destination: accepting it priced a 95 km airport run as a 2 km in-town hop,
   * because the formula branch then ignored the destination entirely. If a
   * route is not in the catalog, the traveller asks for a review instead.
   */
  private resolveDestination(destinationId: string): HubDestination {
    this.ensureSeed();
    const known = db.transferDestinations.find(dest => dest.active && dest.id === destinationId);
    if (known) return { ...known };
    const route = destinationId.startsWith('ZONE-') ? transferRouteService.getById(destinationId) : undefined;
    if (route) {
      return {
        id: destinationId,
        labelEn: route.originEn,
        labelAr: route.originAr,
        subEn: 'Dahab',
        subAr: 'دهب',
        priceAddEGP: 0,
        kind: 'zone'
      };
    }
    throw new TransferHubError('Destination not found.', 404, 'DESTINATION_NOT_FOUND');
  }

  /** Siwa and Nuweiba as a destination use that area's matrix. Otherwise the origin's. */
  private priceRow(origin: TransferZonePriceEntity | undefined, destination: HubDestination): TransferZonePriceEntity {
    if (destination.kind === 'area') {
      const area = db.transferZonePrices.find(row => row.id === destination.id && row.active);
      if (area) return area;
    }
    if (!origin) throw new TransferHubError('This route has no zone price.', 400, 'NO_MATRIX');
    return origin;
  }

  private ensureSku(snapshot: TransferHubQuoteSnapshot): ProductSkuEntity {
    const skuId = `SKU-TRF-HUB-${snapshot.originId}-${snapshot.mode === 'bus' ? 'bus' : snapshot.tierId}`;
    const existing = db.productSkus.find(sku => sku.id === skuId);
    if (existing) {
      existing.basePriceEGP = snapshot.sellEGP;
      return existing;
    }
    const sku: ProductSkuEntity = {
      id: skuId,
      supplierId: SUPPLIER_ID,
      serviceType: 'transfer',
      title: `${snapshot.originLabelEn} → ${snapshot.destinationLabelEn}`,
      titleAr: `${snapshot.originLabelAr} ← ${snapshot.destinationLabelAr}`,
      description: 'Price locked until departure. Pay the driver on arrival.',
      routeFrom: snapshot.originLabelEn,
      routeTo: snapshot.destinationLabelEn,
      durationMinutes: 0,
      basePriceEGP: snapshot.sellEGP,
      currency: 'EGP',
      maxCapacityPerSlot: snapshot.tierId === 'shared' ? 14 : 8,
      pricingBasis: 'per_vehicle',
      active: true,
      cancellationPolicyHours: 24
    };
    db.productSkus.push(sku);
    return sku;
  }

  private assertCapacity(sku: ProductSkuEntity, snapshot: TransferHubQuoteSnapshot, date: string, time: string): void {
    if (snapshot.mode === 'bus') {
      const schedule = snapshot.busScheduleId
        ? db.transferBusSchedules.find(row => row.id === snapshot.busScheduleId)
        : undefined;
      if (snapshot.busScheduleId && (!schedule || schedule.seats < 1)) {
        throw new TransferHubError('That bus is full.', 409, 'BUS_FULL');
      }
      return;
    }
    const slot = db.inventorySlots.find(row => row.skuId === sku.id && row.date === date && row.timeSlot === time);
    if (!slot) return;
    const available = slot.totalCapacity - slot.reservedCapacity - slot.heldCapacity;
    if (available < snapshot.reservedUnits) {
      throw new TransferHubError('That departure is full.', 409, 'CAPACITY');
    }
  }

  private reserveSlot(sku: ProductSkuEntity, date: string, time: string, units: number): string {
    let slot = db.inventorySlots.find(row => row.skuId === sku.id && row.date === date && row.timeSlot === time);
    if (!slot) {
      slot = {
        id: `SLOT-HUB-${sku.id}-${date}-${time}`,
        skuId: sku.id,
        date,
        timeSlot: time,
        totalCapacity: sku.maxCapacityPerSlot || 8,
        reservedCapacity: 0,
        heldCapacity: 0,
        priceEGP: sku.basePriceEGP,
        status: 'AVAILABLE'
      };
      db.inventorySlots.push(slot);
    }
    const available = slot.totalCapacity - slot.reservedCapacity - slot.heldCapacity;
    if (available < units) throw new TransferHubError('That departure is full.', 409, 'CAPACITY');
    slot.reservedCapacity += units;
    if (slot.reservedCapacity + slot.heldCapacity >= slot.totalCapacity) slot.status = 'SOLD_OUT';
    return slot.id;
  }

  private takeBusSeat(scheduleId?: string): TransferBusScheduleEntity | undefined {
    if (!scheduleId) return undefined;
    const schedule = db.transferBusSchedules.find(row => row.id === scheduleId && row.active);
    if (!schedule || schedule.seats < 1) throw new TransferHubError('That bus is full.', 409, 'BUS_FULL');
    schedule.seats -= 1;
    return schedule;
  }

  private releaseCapacity(booking: BookingEntity): void {
    const quote = booking.hubQuote;
    if (!quote) return;
    if (quote.slotId) {
      const slot = db.inventorySlots.find(row => row.id === quote.slotId);
      if (slot) {
        slot.reservedCapacity = Math.max(0, slot.reservedCapacity - quote.reservedUnits);
        if (slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) slot.status = 'AVAILABLE';
      }
    }
    if (quote.busScheduleId) {
      const schedule = db.transferBusSchedules.find(row => row.id === quote.busScheduleId);
      if (schedule) schedule.seats += 1;
    }
  }

  private driverBusy(driverId: string, booking: BookingEntity): boolean {
    return db.bookings.some(other =>
      other.id !== booking.id &&
      other.hubQuote &&
      other.assignedResource?.driverName &&
      other.scheduledDate === booking.scheduledDate &&
      other.scheduledTime === booking.scheduledTime &&
      other.supplierState !== 'CANCELLED' &&
      db.transferDrivers.find(driver => driver.id === driverId)?.nameEn === other.assignedResource?.driverName
    );
  }

  private writeAssignment(booking: BookingEntity, driverId: string): void {
    const driver = db.transferDrivers.find(row => row.id === driverId);
    if (!driver || !booking.hubQuote) return;
    if (booking.supplierState === 'PENDING_CONFIRMATION') {
      assertTransition(booking.supplierState, 'CONFIRMED');
      booking.supplierState = 'CONFIRMED';
    }
    if (booking.supplierState === 'CONFIRMED') {
      assertTransition(booking.supplierState, 'ASSIGNED');
      booking.supplierState = 'ASSIGNED';
    }
    booking.assignedResource = {
      ...booking.assignedResource,
      driverName: driver.nameEn,
      driverNameAr: driver.nameAr,
      driverPhone: driver.phone || undefined,
      vehicleModel: driver.carEn,
      vehiclePlate: driver.plate || undefined
    };
    booking.updatedAt = new Date().toISOString();
    const telemetry = db.transferTelemetry.find(row => row.bookingId === booking.id);
    if (telemetry) {
      telemetry.driverName = driver.nameEn;
      telemetry.driverNameAr = driver.nameAr;
      telemetry.driverPhone = driver.phone;
      telemetry.vehicleModel = driver.carEn;
      telemetry.vehiclePlate = driver.plate;
      telemetry.status = 'ASSIGNED';
      telemetry.lastGpsUpdate = new Date().toISOString();
      telemetry.updatedAt = telemetry.lastGpsUpdate;
    }
  }

  private specialRequests(snapshot: TransferHubQuoteSnapshot): string {
    const parts = [`Price locked ${snapshot.sellEGP} EGP. Pay on arrival.`];
    if (snapshot.tripType === 'round' && snapshot.returnDate) parts.push(`Return ${snapshot.returnDate} ${snapshot.returnTime || ''}`.trim());
    if (snapshot.stops.length) parts.push(`Stops: ${snapshot.stops.join(', ')}`);
    if (snapshot.addonIds.length) parts.push(`Add-ons: ${snapshot.addonIds.join(', ')}`);
    return parts.join(' ');
  }
}

function pickupInstant(date: string, time: string, now: Date): Date {
  if (time === 'ASAP') return new Date(now.getTime() + 12 * 60 * 1000);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const transferHubService = new TransferHubService();
