import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import { commerceService } from '../../server/services/commerceService';
import type {
  ProductSkuEntity,
  RentalBookingEntity,
  RentalListingEntity,
  TripEntity
} from '../../server/db/schema';

/**
 * Drops the whole state rather than clearing individual arrays, so a test can
 * never inherit a row a previous test forgot about.
 */
export function resetDb(): void {
  db.setAdapter(new InMemoryPersistenceAdapter());
}

export function seedSku(over: Partial<ProductSkuEntity> = {}): ProductSkuEntity {
  const sku: ProductSkuEntity = {
    id: 'SKU-DIVE-TEST',
    supplierId: 'SUP-TEST',
    serviceType: 'diving',
    title: 'Test Blue Hole Dive',
    titleAr: 'غطسة اختبارية',
    description: 'Fixture SKU.',
    basePriceEGP: 1200,
    currency: 'EGP',
    maxCapacityPerSlot: 8,
    active: true,
    cancellationPolicyHours: 24,
    ...over
  };
  db.productSkus.push(sku);
  return sku;
}

/**
 * The trip a checkout is filed against.
 *
 * Checkout now rejects a tripId with no matching trip, so the fixtures have to
 * provide one. They did not before, which is the point: the tests were passing
 * against exactly the gap that left a CAPTURED booking, its payment and two
 * ledger entries pointing at an itinerary that never existed.
 */
export function seedTrip(over: Partial<TripEntity> = {}): TripEntity {
  const now = new Date().toISOString();
  const trip: TripEntity = {
    id: 'TRIP-TEST',
    userId: 'USR-TEST',
    title: 'Fixture Trip',
    status: 'PLANNED',
    lengthDays: 3,
    travelersCount: 2,
    budget: 'Moderate',
    pace: 'Balanced',
    interests: ['diving'],
    totalEstimatedEGP: 0,
    totalPaidEGP: 0,
    createdAt: now,
    updatedAt: now,
    ...over
  };
  db.trips.push(trip);
  return trip;
}

let holdSeq = 0;
export const nextIdempotencyKey = () => `IDK-TEST-${++holdSeq}`;

/**
 * A calendar date `days` from today (YYYY-MM-DD, UTC). Cancellation windows
 * are measured against the service start, so a fixture pinned to a fixed date
 * silently turns into a past booking as the calendar moves on.
 */
export function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * A checkout line backed by a real ACTIVE hold, priced by the catalogue.
 *
 * Multi-service checkout requires a hold owned by the caller and charges the
 * server's price for the held party size, so a fixture can no longer hand it a
 * bare skuId and an arbitrary amount.
 */
export function heldItem(over: {
  skuId?: string;
  tripId?: string;
  userId?: string;
  date?: string;
  time?: string;
  pax?: number;
} = {}) {
  const skuId = over.skuId ?? 'SKU-DIVE-TEST';
  const sku = db.productSkus.find(s => s.id === skuId);
  if (!sku) throw new Error(`heldItem: seed ${skuId} first`);
  const scheduledDate = over.date ?? futureDate(30);
  const scheduledTime = over.time ?? '08:30 AM (Morning Dive)';
  const hold = commerceService.createHold({
    skuId,
    tripId: over.tripId ?? 'TRIP-TEST',
    travelerId: over.userId ?? 'USR-TEST',
    date: scheduledDate,
    timeSlot: scheduledTime,
    passengersCount: over.pax ?? 1,
    idempotencyKey: nextIdempotencyKey()
  });
  return {
    serviceType: sku.serviceType,
    skuId,
    holdToken: hold.holdToken,
    scheduledDate,
    scheduledTime,
    amountEGP: hold.amountEGP,
    passengersCount: hold.passengersCount
  };
}

/**
 * An approved, active rental listing plus its supplier and 'rental' SKU.
 * Idempotent on supplier/SKU ids so repeated seeding in one test is safe.
 */
export function seedRentalListing(over: Partial<RentalListingEntity> = {}): RentalListingEntity {
  const supplierId = 'SUP-TEST';
  if (!db.suppliers.some(s => s.id === supplierId)) {
    db.suppliers.push({
      id: supplierId,
      businessName: 'Test Bikes',
      businessNameAr: 'دراجات الاختبار',
      category: 'bike_rental',
      serviceTypes: ['rental'],
      tier: 'Vetted Local Partner',
      status: 'Active',
      area: 'mashraba',
      rating: 4.8,
      reviewCount: 10
    });
  }

  const now = new Date().toISOString();
  const listing: RentalListingEntity = {
    id: 'RENT-TEST',
    slug: 'test-mountain-bike',
    supplierId,
    skuId: 'SKU-REN-TEST',
    category: 'bike',
    subcategory: 'mountain',
    name: 'Test Mountain Bike',
    nameAr: 'دراجة جبلية للاختبار',
    tagline: '',
    taglineAr: '',
    description: '',
    descriptionAr: '',
    features: [],
    featuresAr: [],
    specs: {},
    images: [],
    quantity: 10,
    dailyRateEGP: 300,
    weeklyRateEGP: 1800,
    multiDayMinDays: 3,
    multiDayDiscountPercent: 10,
    depositEGP: 500,
    pickupZoneId: 'mashraba',
    deliveryZones: [
      { zoneId: 'mashraba', feeEGP: 0 },
      { zoneId: 'assalah', feeEGP: 100 }
    ],
    pickupMode: 'BOTH',
    rating: 4.8,
    reviewCount: 10,
    featured: false,
    status: 'APPROVED',
    active: true,
    cancellationPolicyHours: 24,
    policies: { en: '', ar: '' },
    createdAt: now,
    updatedAt: now,
    ...over
  };

  if (!db.productSkus.some(s => s.id === listing.skuId)) {
    db.productSkus.push({
      id: listing.skuId,
      supplierId,
      serviceType: 'rental',
      title: listing.name,
      titleAr: listing.nameAr,
      description: '',
      basePriceEGP: listing.dailyRateEGP,
      currency: 'EGP',
      maxCapacityPerSlot: listing.quantity,
      active: true,
      cancellationPolicyHours: listing.cancellationPolicyHours
    });
  }

  const existing = db.rentalListings.find(l => l.id === listing.id);
  if (existing) {
    const index = db.rentalListings.indexOf(existing);
    db.rentalListings[index] = listing;
  } else {
    db.rentalListings.push(listing);
  }
  return listing;
}

let rentalSeq = 0;

/**
 * A CONFIRMED rental booking that consumes inventory, for availability math.
 * Pass status/paymentState/etc. via `over` to test non-consuming states.
 */
export function seedRentalBooking(
  listing: RentalListingEntity,
  over: Partial<RentalBookingEntity> = {}
): RentalBookingEntity {
  const now = new Date().toISOString();
  const booking: RentalBookingEntity = {
    id: `RENTAL-TEST-${++rentalSeq}`,
    bookingRef: `DHB-REN-TEST-${rentalSeq}`,
    listingId: listing.id,
    skuId: listing.skuId,
    supplierId: listing.supplierId,
    tripId: 'TRIP-TEST',
    userId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'traveler@test.test',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    quantity: 4,
    status: 'CONFIRMED',
    paymentState: 'CAPTURED',
    priceBreakdown: {
      days: 3,
      dailyRateEGP: listing.dailyRateEGP,
      baseEGP: listing.dailyRateEGP * 3,
      discountEGP: 0,
      extrasEGP: 0,
      deliveryEGP: 0,
      depositEGP: listing.depositEGP,
      totalEGP: listing.dailyRateEGP * 3
    },
    deliveryMode: 'PICKUP',
    extras: [],
    depositStatus: 'RECORDED',
    createdAt: now,
    updatedAt: now,
    ...over
  };
  db.rentalBookings.push(booking);
  return booking;
}
