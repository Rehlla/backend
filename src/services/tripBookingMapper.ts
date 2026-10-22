import type {
  CommerceServiceType,
  ConfirmedBookingItem,
  TripBookingRecord,
  ProductSkuEntity,
  RentalBookingStatus,
  RentalBookingView
} from '../shared/types/commerce';
import type { TripEntity, TimelineActivityStatus, TimelineActivityType, TimelineDay, TripItemEntity, TripItemWithSupplier } from '../shared/types/trip';

/**
 * Turns the server's booking records into the shape the bookings and my-trip
 * views render.
 *
 * Every field here comes from a stored value or from another stored value; when
 * the server has nothing, the field is omitted rather than filled with a
 * plausible-looking default. That rule is the point of this file: the views it
 * feeds previously rendered a hardcoded reference and a demo supplier, and a
 * mapper that invents a provider name would reproduce exactly that with extra
 * steps.
 */

const ICON_BY_SERVICE: Record<TripBookingRecord['serviceType'], ConfirmedBookingItem['iconType']> = {
  hotel: 'building',
  transfer: 'car',
  diving: 'waves',
  safari: 'compass',
  wellness: 'sparkles',
  dining: 'utensils',
  rental: 'bike'
};

/**
 * The traveler-facing status.
 *
 * Two server fields carry it — `paymentState` and `supplierState` — and they
 * can disagree (paid, supplier not yet confirmed). The traveler is told the
 * weaker of the two, because "Confirmed" must mean the supplier has the
 * booking, not merely that the money moved.
 */
export function travelerStatusOf(booking: TripBookingRecord): ConfirmedBookingItem['status'] {
  const changed: ReadonlyArray<TripBookingRecord['supplierState']> = ['CANCELLED', 'REJECTED'];
  const unsettled: ReadonlyArray<TripBookingRecord['paymentState']> = [
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'FAILED',
    'CANCELLED',
    'DISPUTED'
  ];

  if (changed.includes(booking.supplierState)) return 'Changed';
  if (unsettled.includes(booking.paymentState)) return 'Changed';
  if (booking.supplierState === 'PENDING_CONFIRMATION') return 'Pending';
  // CAPTURED is the only state in which the money has actually been taken.
  // AUTHORIZED, PENDING and INITIATED have not, and telling a traveler their
  // booking is confirmed before that is the failure this whole phase exists to
  // stop repeating.
  if (booking.paymentState !== 'CAPTURED') return 'Pending';
  return 'Confirmed ✓';
}

/** The person or place the traveler would actually contact about this booking. */
function contactPhoneOf(booking: TripBookingRecord): string | undefined {
  return (
    booking.assignedResource?.driverPhone ||
    booking.assignedResource?.guidePhone ||
    booking.supplier?.phone ||
    undefined
  );
}

function whereOf(booking: TripBookingRecord): string {
  return (
    booking.pickupLocation ||
    booking.assignedResource?.diveSite ||
    booking.assignedResource?.expeditionRoute ||
    booking.supplier?.area ||
    'Dahab'
  );
}

/** What was actually assigned — a named driver, a guide, a dive site. */
function assignmentOf(booking: TripBookingRecord): string {
  const resource = booking.assignedResource;
  if (!resource) return '';
  return [
    resource.driverName,
    resource.vehicleModel,
    resource.vehiclePlate,
    resource.guideName,
    resource.diveSite,
    resource.expeditionRoute
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' · ');
}

/** Checked at runtime rather than asserted: TripItemEntity widens the type. */
const COMMERCE_SERVICE_TYPES: readonly CommerceServiceType[] = [
  'transfer',
  'diving',
  'hotel',
  'safari',
  'wellness',
  'dining',
  'rental'
];

const SERVICE_LABEL: Record<string, string> = {
  hotel: 'Hotel',
  transfer: 'Transfer',
  diving: 'Diving',
  safari: 'Safari',
  wellness: 'Wellness',
  dining: 'Dining',
  rental: 'Rental'
};

/** Shown where the card has nothing stored to show. Never a plausible guess. */
const UNKNOWN = '—';

export function toConfirmedBookingItem(
  booking: TripBookingRecord,
  item?: TripItemEntity
): ConfirmedBookingItem {
  const provider = booking.supplier?.businessName || booking.supplierId;
  const assignment = assignmentOf(booking);
  const passengers = booking.passengersCount;

  return {
    id: booking.id,
    serviceType: booking.serviceType,
    // The card renders `title` as a small eyebrow and `subtitle` as
    // the heading, so the category goes in the eyebrow and what was actually
    // booked goes in the heading. Before this the eyebrow held the full item
    // title, set at 11px.
    title: SERVICE_LABEL[booking.serviceType] || booking.serviceType,
    subtitle: item?.title || provider,
    details: assignment || `${passengers} ${passengers === 1 ? 'traveler' : 'travelers'}`,
    datesOrTime: [booking.scheduledDate, booking.scheduledTime].filter(Boolean).join(' · '),
    priceEGP: booking.amountEGP,
    provider,
    confirmationCode: booking.confirmationCode || booking.bookingRef,
    status: travelerStatusOf(booking),
    location: whereOf(booking),
    iconType: ICON_BY_SERVICE[booking.serviceType] ?? 'compass',
    phone: contactPhoneOf(booking),
    futureRide: booking.hubQuote
      ? { driverAssigned: Boolean(booking.assignedResource?.driverName) }
      : undefined
  };
}

/**
 * A booked trip item that has no booking record behind it.
 *
 * Two of the seeded trip's five items are in exactly this state: CONFIRMED,
 * carrying a bookingId and a matching PAYMENT_CAPTURED ledger entry, with no
 * row in db.bookings. Rendering only booking records dropped them, and with
 * them 16,700 of the traveler's 22,200 EGP. Everything below comes from the
 * item or its SKU's supplier; what neither holds is left blank rather than
 * filled in.
 */
export function tripItemToConfirmedBookingItem(item: TripItemWithSupplier): ConfirmedBookingItem {
  const provider = item.supplier?.businessName || UNKNOWN;
  const status: ConfirmedBookingItem['status'] =
    item.status === 'CONFIRMED' || item.status === 'BOOKED'
      ? 'Confirmed ✓'
      : item.status === 'CANCELLED'
        ? 'Changed'
        : 'Pending';

  return {
    id: item.id,
    // TripItemEntity widens serviceType to string for activities and food,
    // which have no card icon of their own; the narrow set is checked rather
    // than asserted.
    serviceType: COMMERCE_SERVICE_TYPES.includes(item.serviceType as CommerceServiceType)
      ? (item.serviceType as CommerceServiceType)
      : 'safari',
    title: SERVICE_LABEL[item.serviceType] || item.serviceType,
    subtitle: item.title,
    details: `Day ${item.dayNumber}`,
    datesOrTime: item.timeSlot || UNKNOWN,
    priceEGP: item.priceEGP,
    provider,
    confirmationCode: item.bookingId || UNKNOWN,
    status,
    location: item.supplier?.area || 'Dahab',
    iconType: ICON_BY_SERVICE[item.serviceType as TripBookingRecord['serviceType']] ?? 'compass',
    phone: item.supplier?.phone
  };
}

/**
 * The traveler's bookings, built from their trip items with booking records
 * merged in where they exist.
 *
 * Items are the spine because they are what the traveler committed to; a
 * booking record adds the supplier's assignment, the schedule it was actually
 * booked for and the real payment state. A booking with no item of its own
 * (created directly, outside a planned trip) is appended rather than dropped.
 */
export function buildTravelerBookings(
  items: TripItemWithSupplier[],
  bookings: TripBookingRecord[]
): ConfirmedBookingItem[] {
  const bookingByKey = new Map<string, TripBookingRecord>();
  bookings.forEach(booking => {
    bookingByKey.set(booking.id, booking);
    if (booking.bookingRef) bookingByKey.set(booking.bookingRef, booking);
  });

  const consumed = new Set<string>();
  const bookable = items.filter(item => typeof item.bookingId === 'string' && item.bookingId.length > 0);

  const fromItems = bookable.map(item => {
    const booking = item.bookingId ? bookingByKey.get(item.bookingId) : undefined;
    if (!booking) return tripItemToConfirmedBookingItem(item);
    consumed.add(booking.id);
    return toConfirmedBookingItem(booking, item);
  });

  const orphanBookings = bookings
    .filter(booking => !consumed.has(booking.id))
    .map(booking => toConfirmedBookingItem(booking));

  return [...fromItems, ...orphanBookings];
}

/**
 * The traveler-facing status of a rental booking.
 *
 * A rental booking has one status field (unlike commerce bookings, which split
 * paymentState from supplierState). The traveler is told the booking is
 * confirmed once the provider has accepted it; before that it reads as
 * pending, and any terminal rejection/cancellation reads as changed.
 */
export function travelerRentalStatusOf(booking: RentalBookingView): ConfirmedBookingItem['status'] {
  const terminal: ReadonlyArray<RentalBookingStatus> = ['CANCELLED', 'REJECTED'];
  const confirmed: ReadonlyArray<RentalBookingStatus> = [
    'CONFIRMED',
    'READY_FOR_PICKUP',
    'ACTIVE',
    'OVERDUE',
    'RETURNED',
    'COMPLETED'
  ];
  if (terminal.includes(booking.status)) return 'Changed';
  if (confirmed.includes(booking.status)) return 'Confirmed ✓';
  // PENDING_PAYMENT / PENDING_CONFIRMATION — a hold is not a booking yet.
  return 'Pending';
}

/**
 * A rental booking, mapped into the shape the bookings and my-trip views
 * render.
 *
 * Rentals live in their own table (`rental_bookings`) rather than in
 * db.bookings, so the commerce mappers above do not see them. This is the
 * rental-domain equivalent of toConfirmedBookingItem: it reads only stored
 * values, and where the booking holds nothing it omits rather than guesses.
 */
export function rentalBookingToConfirmedBookingItem(booking: RentalBookingView): ConfirmedBookingItem {
  const listing = booking.listing;
  const dateRange = [booking.startDate, booking.endDate].filter(Boolean).join(' → ');
  return {
    id: booking.id,
    serviceType: 'rental',
    title: SERVICE_LABEL.rental,
    subtitle: listing?.name || 'Bike Rental',
    details:
      `${booking.quantity} × ${booking.priceBreakdown.days} day${booking.priceBreakdown.days === 1 ? '' : 's'}` +
      (booking.deliveryMode === 'DELIVERY' ? ' · delivered' : ' · pickup'),
    datesOrTime: dateRange,
    priceEGP: booking.priceBreakdown.totalEGP,
    provider: listing?.supplierName || booking.supplierId,
    confirmationCode: booking.bookingRef,
    status: travelerRentalStatusOf(booking),
    location: booking.deliveryAddress || 'Dahab',
    iconType: 'bike',
    phone: undefined
  };
}

/**
 * Which of a traveler's trips the app should open on.
 *
 * Prefers a trip that is under way, then one that is confirmed, then the most
 * recently updated — so a traveler with an old completed trip and a live one
 * lands on the live one. Returns null rather than inventing a trip id, which is
 * how 'DHB-TRIP-894' ended up hardcoded in forty places.
 */
export function selectActiveTrip(trips: TripEntity[]): TripEntity | null {
  if (trips.length === 0) return null;

  const rank = (trip: TripEntity): number => {
    switch (trip.status) {
      case 'IN_DESTINATION': return 0;
      case 'CONFIRMED': return 1;
      case 'PLANNED': return 2;
      case 'DRAFT': return 3;
      case 'COMPLETED': return 4;
      case 'CANCELLED': return 5;
      default: return 6;
    }
  };

  const updatedAt = (trip: TripEntity): number => {
    const parsed = Date.parse(trip.updatedAt || trip.createdAt || '');
    // An unparseable date must not sort as "now" — it sorts last.
    return Number.isNaN(parsed) ? -Infinity : parsed;
  };

  return [...trips].sort((a, b) => rank(a) - rank(b) || updatedAt(b) - updatedAt(a))[0];
}

const ACTIVITY_TYPE_BY_SERVICE: Record<string, TimelineActivityType> = {
  hotel: 'Accommodation',
  transfer: 'Transfer',
  diving: 'Activity',
  safari: 'Experience',
  activity: 'Activity',
  food: 'Dining'
};

const ACTIVITY_STATUS_BY_ITEM: Record<TripItemEntity['status'], TimelineActivityStatus> = {
  SUGGESTED: 'Suggested',
  HELD: 'Pending',
  BOOKED: 'Booked ✓',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Pending'
};

/**
 * The traveler's real itinerary, grouped into days.
 *
 * `tripDays` in ItineraryContext has always started empty and was never filled,
 * so the timeline fell through to AHMED_TRIP_DAYS — a hand-authored five-day
 * plan for the demo persona, shown to every traveler as though it were theirs.
 * This builds the days from the trip's own items.
 *
 * It deliberately does *not* invent the texture the hardcoded version has
 * (meals, walks, free time). Those are editorial content with no backend
 * behind them; a day here contains what the traveler actually booked, and the
 * caller keeps the hardcoded plan for a traveler who has no trip at all.
 */
export function buildTimelineDays(trip: TripEntity, items: TripItemWithSupplier[]): TimelineDay[] {
  if (items.length === 0) return [];

  const startedAt = Date.parse(trip.startDate || '');
  const dayNumbers = [...new Set(items.map(item => item.dayNumber))].sort((a, b) => a - b);

  return dayNumbers.map(dayNumber => {
    const dayItems = items
      .filter(item => item.dayNumber === dayNumber)
      // timeSlot is free text ("09:00 AM", "Check-in 14:00"), so it is sorted
      // as text — stable and predictable, without pretending it parses.
      .sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));

    const date = Number.isNaN(startedAt)
      ? null
      : new Date(startedAt + (dayNumber - 1) * 24 * 60 * 60 * 1000);

    return {
      dayNumber,
      dateStr: date
        ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        : `Day ${dayNumber}`,
      title: `Day ${dayNumber}`,
      subtitle: `${dayItems.length} ${dayItems.length === 1 ? 'booking' : 'bookings'}`,
      activities: dayItems.map(item => ({
        id: item.id,
        time: item.timeSlot || '',
        title: item.title,
        // Carried so the timeline can offer to book an item that is only
        // suggested. Empty string rather than absent is how the server stores
        // "no product", so it is normalised away here.
        skuId: item.skuId || undefined,
        serviceType: item.serviceType,
        type: ACTIVITY_TYPE_BY_SERVICE[item.serviceType] || 'Activity',
        status: ACTIVITY_STATUS_BY_ITEM[item.status] || 'Suggested',
        location: item.supplier?.area,
        priceEGP: item.priceEGP,
        bookingRef: item.bookingId,
        provider: item.supplier?.businessName
      }))
    };
  });
}
