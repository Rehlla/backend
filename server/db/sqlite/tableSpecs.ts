import { DatabaseState } from '../database';

/**
 * The single definition of how the in-memory DatabaseState maps onto SQLite.
 *
 * One spec drives three things that used to have no shared source of truth:
 * the DDL, the row<->entity mapping, and the indexed query helpers. Writing
 * those by hand in three places is how server/db/sql/schema.sql ended up
 * covering 16 of the 46 collections while claiming to be the schema.
 *
 * ---------------------------------------------------------------------------
 * Storage shape: promoted columns + a `data` JSON document
 * ---------------------------------------------------------------------------
 * Every table stores the complete entity as JSON in `data`, and *additionally*
 * promotes the fields that need a constraint or an index into real typed
 * columns. Reads hydrate from `data`, so round-trip fidelity is total and a
 * new optional field on a TypeScript interface does not need a migration.
 * Writes fill both, so PRIMARY KEY / UNIQUE / FOREIGN KEY / indexes are
 * enforced by SQLite on exactly the fields the application actually queries.
 *
 * The alternative — one column per interface field across 46 entities — means
 * ~400 columns hand-kept in sync with types that are still moving, and a
 * silent data-loss bug every time the two drift. This shape trades a column
 * count for correctness that the engine enforces.
 *
 * ---------------------------------------------------------------------------
 * When a relationship gets a FOREIGN KEY and when it only gets an index
 * ---------------------------------------------------------------------------
 * A FOREIGN KEY is declared where the reference is *mandatory and owned*: a
 * session belongs to a user, a booking belongs to a trip. Those are the rows
 * where a dangling pointer is a real defect, and where the audit found actual
 * orphans (1 booking, 1 tripItem, 3 holds, 2 ledger entries, 1 payment).
 *
 * It is deliberately NOT declared where the column holds something other than
 * a plain row reference:
 *   - notifications.userId carries the literal 'ALL' for broadcasts, so it is
 *     a recipient selector, not a user id. A FK here would reject broadcasts.
 *   - The market-intelligence tables reference suppliers that the crawler may
 *     legitimately observe *before* the supplier row exists. Those references
 *     are advisory and get an index, not a constraint.
 * Both cases get an index, because they are still query paths.
 */

export type SqlType = 'TEXT' | 'INTEGER' | 'REAL';

export interface ColumnSpec {
  /** SQL column name. */
  name: string;
  /** Field on the entity this column is promoted from. */
  field: string;
  type: SqlType;
  notNull?: boolean;
  unique?: boolean;
  index?: boolean;
  /** Stored as 0/1; hydration still comes from `data`, so the JS type is kept. */
  boolean?: boolean;
  references?: {
    table: string;
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

export interface TableSpec {
  /** SQL table name. */
  table: string;
  /** Key on DatabaseState holding this collection. */
  collection: keyof DatabaseState;
  /** Entity field used as the primary key. Not always `id`. */
  key: string;
  /** Human label used in migration and integrity reports. */
  label: string;
  columns: ColumnSpec[];
  /** Multi-column indexes that a single column spec cannot express. */
  compositeIndexes?: string[][];
}

const t = (name: string, field = name, extra: Partial<ColumnSpec> = {}): ColumnSpec =>
  ({ name, field, type: 'TEXT', ...extra });
const i = (name: string, field = name, extra: Partial<ColumnSpec> = {}): ColumnSpec =>
  ({ name, field, type: 'INTEGER', ...extra });
const r = (name: string, field = name, extra: Partial<ColumnSpec> = {}): ColumnSpec =>
  ({ name, field, type: 'REAL', ...extra });
const bool = (name: string, field = name, extra: Partial<ColumnSpec> = {}): ColumnSpec =>
  ({ name, field, type: 'INTEGER', boolean: true, ...extra });

const fk = (table: string, onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT') =>
  ({ table, onDelete });

/**
 * Order matters twice: CREATE TABLE needs parents first so the FK targets
 * exist, and the migration inserts in this order so a child never lands before
 * its parent.
 */
export const TABLE_SPECS: TableSpec[] = [
  // ------------------------------------------------------------------ identity
  {
    table: 'users',
    collection: 'users',
    key: 'id',
    label: 'Users',
    columns: [
      t('email', 'email', { notNull: true, unique: true }),
      t('firebase_uid', 'firebaseUid', { unique: true }),
      t('role', 'role', { notNull: true, index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('phone'),
      t('created_at', 'createdAt'),
      t('updated_at', 'updatedAt')
    ]
  },
  {
    table: 'suppliers',
    collection: 'suppliers',
    key: 'id',
    label: 'Suppliers',
    columns: [
      t('business_name', 'businessName', { index: true }),
      t('vertical', 'vertical', { index: true }),
      t('status', 'status', { index: true }),
      t('email'),
      t('phone'),
      r('commission_rate', 'commissionRate')
    ]
  },
  {
    table: 'sessions',
    collection: 'sessions',
    key: 'id',
    label: 'Sessions',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true, references: fk('users', 'CASCADE') }),
      t('token', 'token', { notNull: true, unique: true }),
      t('role'),
      t('expires_at', 'expiresAt', { notNull: true, index: true }),
      t('created_at', 'createdAt')
    ]
  },
  {
    table: 'trips',
    collection: 'trips',
    key: 'id',
    label: 'Trips',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true, references: fk('users', 'CASCADE') }),
      t('status', 'status', { notNull: true, index: true }),
      t('title'),
      t('start_date', 'startDate', { index: true }),
      t('end_date', 'endDate'),
      i('length_days', 'lengthDays'),
      i('travelers_count', 'travelersCount'),
      r('total_estimated_egp', 'totalEstimatedEGP'),
      r('total_paid_egp', 'totalPaidEGP'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ]
  },

  // ----------------------------------------------------------------- inventory
  {
    table: 'product_skus',
    collection: 'productSkus',
    key: 'id',
    label: 'Product SKUs',
    columns: [
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'CASCADE') }),
      t('service_type', 'serviceType', { notNull: true, index: true }),
      t('title'),
      r('base_price_egp', 'basePriceEGP'),
      bool('active'),
      i('max_capacity_per_slot', 'maxCapacityPerSlot')
    ],
    compositeIndexes: [['service_type', 'active']]
  },
  {
    table: 'hotels',
    collection: 'hotels',
    key: 'id',
    label: 'Hotels',
    columns: [
      // Advisory reference to the hotel's 5-night package SKU: the SKU is
      // created by the seed in the same transaction, so the reference is real
      // but indexed rather than constrained to keep the tables order-agnostic.
      t('sku_id', 'skuId', { index: true }),
      t('slug', 'slug', { unique: true, index: true }),
      t('category', 'category', { index: true }),
      t('price_band', 'priceBand', { index: true }),
      t('area', 'area', { index: true }),
      r('rating', 'rating'),
      i('review_count', 'reviewCount'),
      r('per_night_egp', 'perNightEGP'),
      bool('active'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['category', 'area']]
  },
  {
    // NOTE: declared ahead of accommodations/places (its FK children) even
    // though it reads as a DKOS table — flushAll() upserts parent-first in
    // spec order, so this position is load-bearing for fresh-database seeds.
    table: 'area_profiles',
    collection: 'areaProfiles',
    key: 'id',
    label: 'Area profiles',
    columns: [t('name_en', 'nameEn', { index: true })]
  },
  {
    table: 'accommodations',
    collection: 'accommodations',
    key: 'id',
    label: 'Accommodations',
    columns: [
      // Advisory reference, same rationale as hotels.skuId above: the SKU is
      // created by the seed/service in the same transaction.
      t('sku_id', 'skuId', { index: true }),
      t('slug', 'slug', { unique: true, index: true }),
      t('property_type', 'propertyType', { notNull: true, index: true }),
      t('category', 'category', { index: true }),
      t('price_band', 'priceBand', { index: true }),
      // RESTRICT, not CASCADE like places.area_id: an accommodation is
      // commerce-linked (has a real skuId, can have live bookings) — deleting
      // an area profile must not silently delete paid inventory.
      t('area_id', 'areaId', { notNull: true, index: true, references: fk('area_profiles', 'RESTRICT') }),
      t('area', 'area', { index: true }),
      r('rating', 'rating'),
      i('review_count', 'reviewCount'),
      r('per_night_egp', 'perNightEGP'),
      r('latitude', 'latitude'),
      r('longitude', 'longitude'),
      bool('active'),
      bool('featured'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['property_type', 'area_id'], ['property_type', 'active'], ['category', 'area_id']]
  },
  {
    table: 'property_sources',
    collection: 'propertySources',
    key: 'id',
    label: 'Property external reference links',
    columns: [
      // CASCADE is correct here (unlike accommodations.area_id above): a link
      // row has no value independent of the property it belongs to.
      t('accommodation_id', 'accommodationId', { notNull: true, index: true, references: fk('accommodations', 'CASCADE') }),
      t('source_type', 'sourceType', { notNull: true, index: true }),
      bool('active'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['accommodation_id', 'source_type']]
  },

  // ----------------------------------------------------------------- rentals
  {
    table: 'rental_listings',
    collection: 'rentalListings',
    key: 'id',
    label: 'Rental listings',
    columns: [
      // Catalogue content owned by the supplier, like product_skus.
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'CASCADE') }),
      // Advisory reference to the 'rental' ProductSkuEntity this listing sells
      // through — created by the seed in the same transaction, so the
      // reference is real but indexed rather than constrained (hotels.skuId
      // precedent).
      t('sku_id', 'skuId', { index: true }),
      t('slug', 'slug', { unique: true, index: true }),
      t('category', 'category', { index: true }),
      t('subcategory', 'subcategory', { index: true }),
      i('quantity'),
      r('daily_rate_egp', 'dailyRateEGP'),
      t('status', 'status', { index: true }),
      bool('active'),
      bool('featured'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['category', 'active']]
  },
  {
    table: 'rental_extras',
    collection: 'rentalExtras',
    key: 'id',
    label: 'Rental extras',
    columns: [
      t('listing_id', 'listingId', { notNull: true, index: true, references: fk('rental_listings', 'CASCADE') }),
      t('name'),
      t('name_ar', 'nameAr'),
      r('price_egp', 'priceEGP'),
      t('pricing_basis', 'pricingBasis'),
      bool('active')
    ]
  },
  {
    table: 'inventory_slots',
    collection: 'inventorySlots',
    key: 'id',
    label: 'Inventory slots',
    columns: [
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'CASCADE') }),
      t('date', 'date', { index: true }),
      t('time_slot', 'timeSlot'),
      t('status', 'status', { index: true }),
      i('total_capacity', 'totalCapacity'),
      i('reserved_capacity', 'reservedCapacity'),
      i('held_capacity', 'heldCapacity'),
      r('price_egp', 'priceEGP')
    ],
    compositeIndexes: [['sku_id', 'date']]
  },
  {
    table: 'trip_items',
    collection: 'tripItems',
    key: 'id',
    label: 'Trip items',
    columns: [
      t('trip_id', 'tripId', { notNull: true, index: true, references: fk('trips', 'CASCADE') }),
      t('sku_id', 'skuId', { index: true }),
      t('booking_id', 'bookingId', { index: true }),
      t('service_type', 'serviceType'),
      t('status', 'status', { index: true }),
      i('day_number', 'dayNumber'),
      r('price_egp', 'priceEGP')
    ]
  },
  {
    table: 'trip_members',
    collection: 'tripMembers',
    key: 'id',
    label: 'Trip members',
    columns: [
      t('trip_id', 'tripId', { notNull: true, index: true, references: fk('trips', 'CASCADE') }),
      t('user_id', 'userId', { notNull: true, index: true }),
      t('role', 'role', { notNull: true, index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('invited_by', 'invitedBy'),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['trip_id', 'user_id']]
  },
  {
    table: 'trip_item_votes',
    collection: 'tripItemVotes',
    key: 'id',
    label: 'Trip item votes',
    columns: [
      t('trip_id', 'tripId', { notNull: true, index: true, references: fk('trips', 'CASCADE') }),
      t('trip_item_id', 'tripItemId', { notNull: true, index: true }),
      t('user_id', 'userId', { notNull: true, index: true }),
      t('vote', 'vote', { notNull: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['trip_item_id', 'user_id']]
  },
  {
    table: 'trip_splits',
    collection: 'tripSplits',
    key: 'id',
    label: 'Trip splits',
    columns: [
      t('trip_id', 'tripId', { notNull: true, index: true, references: fk('trips', 'CASCADE') }),
      t('user_id', 'userId', { notNull: true, index: true }),
      t('status', 'status', { notNull: true, index: true }),
      r('share_egp', 'shareEGP'),
      r('paid_egp', 'paidEGP'),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['trip_id', 'user_id']]
  },
  {
    table: 'holds',
    collection: 'holds',
    key: 'id',
    label: 'Holds',
    columns: [
      t('hold_token', 'holdToken', { notNull: true, unique: true }),
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'CASCADE') }),
      t('slot_id', 'slotId', { index: true }),
      t('trip_id', 'tripId', { notNull: true, index: true, references: fk('trips', 'CASCADE') }),
      t('traveler_id', 'travelerId', { notNull: true, index: true, references: fk('users', 'CASCADE') }),
      t('status', 'status', { notNull: true, index: true }),
      t('expires_at', 'expiresAt', { index: true }),
      t('idempotency_key', 'idempotencyKey', { unique: true }),
      r('amount_egp', 'amountEGP'),
      i('passengers_count', 'passengersCount')
    ],
    compositeIndexes: [['status', 'expires_at']]
  },

  // --------------------------------------------------------------------- money
  {
    table: 'bookings',
    collection: 'bookings',
    key: 'id',
    label: 'Bookings',
    columns: [
      t('booking_ref', 'bookingRef', { notNull: true, unique: true }),
      // Indexed, deliberately NOT a foreign key. See the note on money tables
      // above the ledger_entries spec.
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('trip_item_id', 'tripItemId', { index: true }),
      // RESTRICT, not CASCADE: deleting a supplier must not silently delete the
      // bookings travelers have already paid for.
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'RESTRICT') }),
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'RESTRICT') }),
      t('service_type', 'serviceType', { index: true }),
      t('payment_state', 'paymentState', { index: true }),
      t('supplier_state', 'supplierState', { index: true }),
      t('traveler_email', 'travelerEmail', { index: true }),
      t('traveler_phone', 'travelerPhone'),
      t('scheduled_date', 'scheduledDate', { index: true }),
      t('confirmation_code', 'confirmationCode'),
      r('amount_egp', 'amountEGP'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['supplier_id', 'supplier_state']]
  },
  {
    table: 'rental_bookings',
    collection: 'rentalBookings',
    key: 'id',
    label: 'Rental bookings',
    columns: [
      t('booking_ref', 'bookingRef', { notNull: true, unique: true }),
      // RESTRICT, not CASCADE: deleting a listing, supplier or SKU must not
      // delete rentals travelers have paid for (bookings convention).
      t('listing_id', 'listingId', { notNull: true, index: true, references: fk('rental_listings', 'RESTRICT') }),
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'RESTRICT') }),
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'RESTRICT') }),
      // Money-row convention: indexed, deliberately NOT a foreign key — the
      // row outlives its parents and must survive a trip/user deletion.
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('user_id', 'userId', { index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('payment_state', 'paymentState', { index: true }),
      t('start_date', 'startDate', { index: true }),
      t('end_date', 'endDate', { index: true }),
      i('quantity'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['listing_id', 'status'], ['listing_id', 'start_date', 'end_date']]
  },
  {
    table: 'rental_maintenance_blocks',
    collection: 'rentalMaintenanceBlocks',
    key: 'id',
    label: 'Rental maintenance blocks',
    columns: [
      t('listing_id', 'listingId', { notNull: true, index: true, references: fk('rental_listings', 'CASCADE') }),
      t('start_date', 'startDate', { index: true }),
      t('end_date', 'endDate', { index: true }),
      i('quantity_blocked', 'quantityBlocked'),
      t('reason'),
      t('created_by', 'createdBy'),
      t('created_at', 'createdAt')
    ],
    compositeIndexes: [['listing_id', 'start_date', 'end_date']]
  },
  // ------------------------------------------------------------ hotel booking
  {
    table: 'room_types',
    collection: 'roomTypes',
    key: 'id',
    label: 'Room types',
    columns: [
      t('accommodation_id', 'accommodationId', { notNull: true, index: true }),
      // RESTRICT, not CASCADE (see rental_bookings): a room type is a product
      // travellers have paid against, so retiring the property must not delete
      // the sellable record of what they bought.
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'RESTRICT') }),
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'RESTRICT') }),
      t('code', 'code', { notNull: true, index: true }),
      t('name'),
      t('name_ar', 'nameAr'),
      i('max_guests_per_unit', 'maxGuestsPerUnit', { notNull: true }),
      i('base_nightly_egp', 'baseNightlyEGP', { notNull: true }),
      i('weekly_rate_egp', 'weeklyRateEGP'),
      i('monthly_rate_egp', 'monthlyRateEGP'),
      i('min_nights', 'minNights', { notNull: true }),
      i('max_nights', 'maxNights', { notNull: true }),
      // Capacity is the column availability is read from, so it is indexed with
      // active: the backfill queue is "every inactive type", and the guest-facing
      // list is "every active type with units to spare".
      i('total_units', 'totalUnits', { notNull: true, index: true }),
      t('inventory_source', 'inventorySource', { notNull: true, index: true }),
      i('cancellation_policy_hours', 'cancellationPolicyHours', { notNull: true }),
      bool('active'),
      i('display_order', 'displayOrder')
    ],
    compositeIndexes: [['accommodation_id', 'active'], ['accommodation_id', 'code']]
  },
  {
    table: 'room_rate_nights',
    collection: 'roomRateNights',
    key: 'id',
    label: 'Room rate calendar',
    columns: [
      t('accommodation_id', 'accommodationId', { notNull: true, index: true }),
      // CASCADE: an override row is worthless without the type it overrides —
      // it carries no traveller money and no supplier obligation.
      t('room_type_id', 'roomTypeId', { notNull: true, index: true, references: fk('room_types', 'CASCADE') }),
      t('date', 'date', { notNull: true, index: true }),
      i('nightly_egp', 'nightlyEGP'),
      i('min_nights', 'minNights'),
      bool('closed'),
      t('closed_reason', 'closedReason'),
      t('created_by', 'createdByUserId'),
      t('created_at', 'createdAt'),
      t('updated_at', 'updatedAt')
    ],
    // One override per room type per night. Without this the calendar could
    // hold two rows for the same date with different prices, and the winner
    // would be whichever the query happened to see first.
    compositeIndexes: [['room_type_id', 'date']]
  },
  {
    table: 'hotel_bookings',
    collection: 'hotelBookings',
    key: 'id',
    label: 'Hotel bookings',
    columns: [
      t('booking_ref', 'bookingRef', { notNull: true, unique: true }),
      t('accommodation_id', 'accommodationId', { notNull: true, index: true, references: fk('accommodations', 'RESTRICT') }),
      t('room_type_id', 'roomTypeId', { notNull: true, index: true, references: fk('room_types', 'RESTRICT') }),
      t('sku_id', 'skuId', { notNull: true, index: true, references: fk('product_skus', 'RESTRICT') }),
      t('supplier_id', 'supplierId', { notNull: true, index: true, references: fk('suppliers', 'RESTRICT') }),
      // The join to the commerce bookings row created on confirmation. Indexed
      // but not constrained: that row is the finance record and this one is
      // allowed to outlive a trip or a user deletion.
      t('booking_ref_linked', 'bookingRefLinked', { index: true }),
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('user_id', 'userId', { index: true }),
      t('traveler_name', 'travelerName'),
      t('traveler_phone', 'travelerPhone'),
      t('traveler_email', 'travelerEmail'),
      // The stay window. (room_type_id, status, check_in, check_out) is the
      // availability query: "does any booking already hold these units on these
      // nights", which is how unitsLeft is derived rather than stored.
      t('check_in', 'checkIn', { notNull: true, index: true }),
      t('check_out', 'checkOut', { notNull: true, index: true }),
      i('nights', 'nights', { notNull: true }),
      i('rooms', 'rooms', { notNull: true }),
      i('adults'),
      i('children'),
      t('status', 'status', { notNull: true, index: true }),
      t('payment_state', 'paymentState', { index: true }),
      i('deposit_egp', 'depositEGP', { notNull: true }),
      i('balance_due_egp', 'balanceDueEGP', { notNull: true }),
      t('payment_method', 'paymentMethod', { index: true }),
      t('payment_reference', 'paymentReference'),
      t('payment_proof_url', 'paymentProofUrl'),
      t('hold_expires_at', 'holdExpiresAt', { index: true }),
      // The engine enforces what a retried submit relies on: one reservation per
      // attempt key, not two holds on the same nights.
      t('idempotency_key', 'idempotencyKey', { unique: true }),
      t('free_cancellation_until', 'freeCancellationUntil'),
      t('confirmation_code', 'confirmationCode'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [
      ['room_type_id', 'status', 'check_in', 'check_out'],
      ['trip_id', 'status'],
      ['supplier_id', 'status']
    ]
  },
  {
    table: 'payments',
    collection: 'payments',
    key: 'id',
    label: 'Payments',
    columns: [
      t('transaction_id', 'transactionId', { index: true }),
      // The idempotency guarantee stops being a convention and becomes a
      // constraint the engine will not let the application violate.
      t('idempotency_key', 'idempotencyKey', { notNull: true, unique: true }),
      t('hold_token', 'holdToken', { index: true }),
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('booking_id', 'bookingId', { index: true }),
      t('state', 'state', { index: true }),
      t('provider'),
      r('amount_egp', 'amountEGP'),
      bool('simulated'),
      t('created_at', 'createdAt', { index: true })
    ]
  },
  /**
   * Money tables: bookings, payments, ledger_entries.
   *
   * `trip_id` on these three is indexed but has NO foreign key, and that is a
   * deliberate reversal of the obvious modelling.
   *
   * Two reasons, and the first is the serious one:
   *
   * 1. A cascade here is a way to destroy financial records. `ON DELETE CASCADE`
   *    from trips would mean that deleting one trip silently deletes the
   *    bookings a traveller paid for, their payments, and the ledger entries
   *    recording the money — the audit trail disappearing along with the thing
   *    it exists to account for. No delete path should be able to do that.
   *
   * 2. A ledger outlives its subject. These rows are append-only financial
   *    facts; `tripId` on them is a recorded value, not a live relationship.
   *    Requiring the parent to still exist would mean either refusing to
   *    migrate real captured payments (the store already contains some whose
   *    trip is gone) or deleting them to make the constraint pass.
   *
   * Their integrity is guaranteed by stronger things than a foreign key: a
   * UNIQUE idempotency key per entry, and the ledger's own hash chain. The
   * dangling references stay visible — `npm run db:check` reports them by name
   * rather than dropping the rows.
   *
   * trip_items and holds keep CASCADE, because those genuinely are parts of a
   * trip's lifecycle and are meant to disappear with it.
   */
  {
    table: 'ledger_entries',
    collection: 'ledgerEntries',
    key: 'id',
    label: 'Ledger entries',
    columns: [
      t('transaction_id', 'transactionId', { index: true }),
      t('idempotency_key', 'idempotencyKey', { notNull: true, unique: true }),
      t('booking_ref', 'bookingRef', { index: true }),
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('type', 'type', { index: true }),
      t('status', 'status', { index: true }),
      t('debit_account', 'debitAccount', { index: true }),
      t('credit_account', 'creditAccount', { index: true }),
      r('amount_egp', 'amountEGP'),
      t('timestamp', 'timestamp', { index: true })
    ]
  },
  {
    table: 'transfer_telemetry',
    collection: 'transferTelemetry',
    key: 'bookingId',
    label: 'Transfer telemetry',
    columns: [
      t('reference_code', 'referenceCode', { index: true }),
      t('status', 'status', { index: true }),
      t('flight_status', 'flightStatus'),
      t('driver_phone', 'driverPhone'),
      r('latitude'),
      r('longitude'),
      t('updated_at', 'updatedAt', { index: true })
    ]
  },

  // ------------------------------------------------------- operations & audit
  {
    table: 'notifications',
    collection: 'notifications',
    key: 'id',
    label: 'Notifications',
    columns: [
      // No FK: 'ALL' is a broadcast selector, not a user id. See the note above.
      t('user_id', 'userId', { notNull: true, index: true }),
      t('type', 'type', { index: true }),
      t('status', 'status', { index: true }),
      t('channel'),
      t('created_at', 'createdAt', { index: true })
    ]
  },
  {
    table: 'ambient_nudges',
    collection: 'ambientNudges',
    key: 'id',
    label: 'Ambient nudges',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true }),
      t('trip_id', 'tripId', { notNull: true, index: true }),
      t('nudge_type', 'nudgeType', { notNull: true, index: true }),
      t('priority', 'priority', { index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['user_id', 'status'], ['trip_id', 'nudge_type']]
  },
  {
    table: 'push_subscriptions',
    collection: 'pushSubscriptions',
    key: 'id',
    label: 'Push subscriptions',
    columns: [
      // No FK, same reasoning as notifications: a subscription must survive
      // its user row long enough for cleanup to prune it deliberately, and
      // the endpoint itself is the dedupe key (first owner wins).
      t('user_id', 'userId', { notNull: true, index: true }),
      t('endpoint', 'endpoint', { notNull: true, unique: true }),
      t('created_at', 'createdAt', { index: true })
    ]
  },
  {
    table: 'supplier_metrics',
    collection: 'supplierMetrics',
    key: 'id',
    label: 'Supplier metrics',
    columns: [
      t('supplier_id', 'supplierId', { notNull: true, index: true }),
      t('booking_ref', 'bookingRef', { notNull: true, index: true }),
      t('event', 'event', { notNull: true, index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['supplier_id', 'event']]
  },
  {
    table: 'reviews',
    collection: 'reviews',
    key: 'id',
    label: 'Reviews',
    columns: [
      t('booking_ref', 'bookingRef', { notNull: true, index: true }),
      t('user_id', 'userId', { notNull: true, index: true }),
      t('supplier_id', 'supplierId', { notNull: true, index: true }),
      t('moderation_status', 'moderationStatus', { index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['supplier_id', 'moderation_status']]
  },
  {
    table: 'supplier_availability_blocks',
    collection: 'supplierAvailabilityBlocks',
    key: 'id',
    label: 'Supplier availability blocks',
    columns: [
      t('supplier_id', 'supplierId', { notNull: true, index: true }),
      t('start_date', 'startDate', { notNull: true, index: true }),
      t('end_date', 'endDate', { notNull: true, index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['supplier_id', 'start_date', 'end_date']]
  },
  {
    table: 'payout_schedule',
    collection: 'payoutSchedule',
    key: 'id',
    label: 'Payout schedule',
    columns: [
      t('supplier_id', 'supplierId', { notNull: true, index: true }),
      t('booking_ref', 'bookingRef', { notNull: true, index: true }),
      t('payout_state', 'payoutState', { notNull: true, index: true }),
      t('settle_after', 'settleAfter', { index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['payout_state', 'settle_after']]
  },
  {
    table: 'analytics_events',
    collection: 'analyticsEvents',
    key: 'id',
    label: 'Analytics events',
    columns: [
      // Indexed, not a FK: events must survive the user row (a deleted account
      // does not erase the funnel that measured it), and anonymous events have
      // no user at all.
      t('user_id', 'userId', { index: true }),
      t('session_id', 'sessionId', { index: true }),
      t('event_name', 'eventName', { notNull: true, index: true }),
      t('timestamp', 'timestamp', { index: true })
    ],
    compositeIndexes: [['event_name', 'timestamp']]
  },
  {
    table: 'support_messages',
    collection: 'supportMessages',
    key: 'id',
    label: 'Support messages',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true, references: fk('users', 'CASCADE') }),
      t('trip_id', 'tripId', { index: true }),
      t('booking_ref', 'bookingRef'),
      t('status', 'status', { index: true }),
      bool('urgent'),
      t('created_at', 'createdAt', { index: true })
    ]
  },
  {
    table: 'audit_events',
    collection: 'auditEvents',
    key: 'id',
    label: 'Audit events',
    columns: [
      t('actor', 'actor', { index: true }),
      t('actor_role', 'actorRole'),
      t('action', 'action', { index: true }),
      t('entity_type', 'entityType'),
      t('entity_id', 'entityId'),
      t('timestamp', 'timestamp', { index: true })
    ],
    compositeIndexes: [['entity_type', 'entity_id']]
  },
  {
    table: 'opportunities',
    collection: 'opportunities',
    key: 'id',
    label: 'Product opportunities',
    columns: [
      t('status', 'status', { index: true }),
      t('product_area', 'productArea', { index: true }),
      r('confidence_score', 'confidenceScore')
    ]
  },
  {
    table: 'distributed_locks',
    collection: 'locks',
    key: 'id',
    label: 'Distributed locks',
    columns: [
      t('owner_id', 'ownerId', { index: true }),
      t('expires_at', 'expiresAt', { index: true }),
      i('fencing_token', 'fencingToken')
    ]
  },

  // ------------------------------------------------- local commerce & market
  {
    table: 'raw_supplier_sources',
    collection: 'rawSupplierSources',
    key: 'id',
    label: 'Raw supplier sources',
    columns: [t('source_type', 'sourceType', { index: true })]
  },
  {
    table: 'raw_offer_sources',
    collection: 'rawOfferSources',
    key: 'id',
    label: 'Raw offer sources',
    columns: [t('source_type', 'sourceType', { index: true })]
  },
  {
    table: 'supplier_offers',
    collection: 'supplierOffers',
    key: 'id',
    label: 'Supplier offers',
    columns: [
      // Advisory reference: the crawler can observe an offer before the
      // supplier row is created. Indexed, not constrained.
      t('supplier_id', 'supplierId', { index: true }),
      t('activity_id', 'activityId', { index: true }),
      t('canonical_category', 'canonicalCategory', { index: true }),
      t('currency'),
      r('price')
    ]
  },
  {
    table: 'market_price_stats',
    collection: 'marketPriceStats',
    key: 'activityId',
    label: 'Market price stats',
    columns: [
      r('lowest_observed_price', 'lowestObservedPrice'),
      r('highest_observed_price', 'highestObservedPrice'),
      r('median_observed_price', 'medianObservedPrice'),
      i('observed_offer_count', 'observedOfferCount'),
      t('last_calculated_at', 'lastCalculatedAt', { index: true })
    ]
  },
  {
    table: 'social_accounts',
    collection: 'socialAccounts',
    key: 'id',
    label: 'Social accounts',
    columns: [
      t('platform', 'platform', { index: true }),
      t('username', 'username', { index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('ownership_status', 'ownershipStatus', { index: true }),
      t('category', 'category', { index: true })
    ]
  },
  {
    table: 'source_records',
    collection: 'sourceRecords',
    key: 'id',
    label: 'Source records',
    columns: [
      t('source_type', 'sourceType', { index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('verification_status', 'verificationStatus', { index: true }),
      t('captured_at', 'capturedAt', { index: true })
    ]
  },
  {
    table: 'price_observations',
    collection: 'priceObservations',
    key: 'id',
    label: 'Price observations',
    columns: [
      t('offer_id', 'offerId', { index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('activity_id', 'activityId', { index: true }),
      t('freshness_status', 'freshnessStatus', { index: true }),
      t('verification_status', 'verificationStatus' ),
      r('amount'),
      t('observed_at', 'observedAt', { index: true })
    ]
  },
  {
    table: 'market_change_events',
    collection: 'marketChangeEvents',
    key: 'id',
    label: 'Market change events',
    columns: [
      t('event_type', 'eventType', { index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('detected_at', 'detectedAt', { index: true })
    ]
  },
  {
    table: 'market_snapshots',
    collection: 'marketSnapshots',
    key: 'id',
    label: 'Market snapshots',
    columns: [t('created_at', 'createdAt', { index: true })]
  },
  {
    table: 'source_freshness',
    collection: 'sourceFreshnessRecords',
    key: 'id',
    label: 'Source freshness',
    columns: [
      t('source_id', 'sourceId', { index: true }),
      t('freshness_status', 'freshnessStatus', { index: true })
    ]
  },
  {
    table: 'contact_history',
    collection: 'contactHistory',
    key: 'id',
    label: 'Contact history',
    columns: [
      t('supplier_id', 'supplierId', { index: true }),
      t('contacted_at', 'contactedAt', { index: true })
    ]
  },
  {
    table: 'market_refresh_runs',
    collection: 'marketRefreshRuns',
    key: 'id',
    label: 'Market refresh runs',
    columns: [
      t('run_id', 'runId', { index: true }),
      t('source_id', 'sourceId', { index: true }),
      t('status', 'status', { index: true }),
      t('started_at', 'startedAt', { index: true })
    ]
  },
  {
    table: 'market_review_queue',
    collection: 'marketReviewQueue',
    key: 'id',
    label: 'Market review queue',
    columns: [
      t('status', 'status', { index: true }),
      t('supplier_id', 'supplierId', { index: true })
    ]
  },
  {
    table: 'source_health',
    collection: 'sourceHealthRecords',
    key: 'id',
    label: 'Source health',
    columns: [
      t('source_id', 'sourceId', { index: true }),
      t('status', 'status', { index: true })
    ]
  },
  {
    table: 'refresh_schedule_policies',
    collection: 'refreshSchedulePolicies',
    key: 'id',
    label: 'Refresh schedule policies',
    columns: [
      t('source_id', 'sourceId', { index: true }),
      t('interval', 'interval')
    ]
  },
  {
    table: 'market_alerts',
    collection: 'marketAlerts',
    key: 'id',
    label: 'Market alerts',
    columns: [
      t('alert_type', 'alertType', { index: true }),
      t('severity', 'severity', { index: true }),
      t('created_at', 'createdAt', { index: true })
    ]
  },

  // ------------------------------------------------------------------- DKOS
  {
    table: 'research_sources',
    collection: 'researchSources',
    key: 'id',
    label: 'Research sources',
    columns: [
      t('source_type', 'sourceType', { index: true }),
      r('authority_weight', 'authorityWeight'),
      t('last_audited', 'lastAudited')
    ]
  },
  {
    table: 'places',
    collection: 'places',
    key: 'id',
    label: 'Places',
    columns: [
      t('area_id', 'areaId', { notNull: true, index: true, references: fk('area_profiles', 'CASCADE') }),
      t('name_en', 'nameEn', { index: true }),
      t('category', 'category', { index: true }),
      t('operational_status', 'operationalStatus', { index: true }),
      t('google_place_id', 'googlePlaceId', { index: true })
    ]
  },
  {
    table: 'temporal_facts',
    collection: 'temporalFacts',
    key: 'id',
    label: 'Temporal facts',
    columns: [
      t('subject_id', 'subjectId', { index: true }),
      t('subject_type', 'subjectType', { index: true }),
      t('predicate', 'predicate', { index: true }),
      t('confidence_tier', 'confidenceTier', { index: true }),
      t('status', 'status', { index: true }),
      t('valid_from', 'validFrom'),
      t('valid_until', 'validUntil', { index: true }),
      t('verified_at', 'verifiedAt', { index: true })
    ],
    compositeIndexes: [['subject_id', 'predicate']]
  },
  {
    table: 'evidence_nodes',
    collection: 'evidenceNodes',
    key: 'id',
    label: 'Evidence nodes',
    columns: [t('fact_id', 'factId', { index: true })]
  },
  {
    table: 'conflict_sets',
    collection: 'conflictSets',
    key: 'id',
    label: 'Conflict sets',
    columns: [
      t('subject_id', 'subjectId', { index: true }),
      t('status', 'status', { index: true })
    ]
  },
  {
    table: 'activities',
    collection: 'activities',
    key: 'id',
    label: 'Activity details',
    columns: [
      t('sku_id', 'skuId', { index: true }),
      // Advisory: one activity already references a supplier that no longer
      // exists (SUP-BEDOUIN-TRANS). Indexed so the gap stays visible.
      t('supplier_id', 'supplierId', { index: true }),
      t('place_id', 'placeId', { index: true }),
      t('area_id', 'areaId', { index: true }),
      t('category', 'category', { index: true }),
      r('base_price_egp', 'basePriceEGP')
    ]
  },
  {
    table: 'dining_venues',
    collection: 'diningVenues',
    key: 'id',
    label: 'Dining venues',
    columns: [
      t('place_id', 'placeId', { index: true }),
      t('area_id', 'areaId', { index: true })
    ]
  },
  {
    table: 'emergency_resources',
    collection: 'emergencyResources',
    key: 'id',
    label: 'Emergency resources',
    columns: [
      t('resource_type', 'resourceType', { index: true }),
      t('area_id', 'areaId', { index: true })
    ]
  },
  {
    table: 'regulatory_decrees',
    collection: 'regulatoryDecrees',
    key: 'id',
    label: 'Regulatory decrees',
    columns: [t('status', 'status', { index: true })]
  },
  {
    table: 'knowledge_snapshots',
    collection: 'knowledgeSnapshots',
    // Keyed on the content fingerprint, not on versionId.
    //
    // versionId looks like an identifier and is not one: snapshotService only
    // generates a unique `DAHAB-<date>-v<n>` when no tag is passed, and callers
    // pass an explicit tag. All 54 snapshots in the store share the single
    // versionId 'DAHAB-2026-08-26-BOOTSTRAP', while createdAt and
    // fingerprintHash are distinct 54/54. The fingerprint is the real identity.
    key: 'fingerprintHash',
    label: 'Knowledge snapshots',
    columns: [
      t('version_id', 'versionId', { index: true }),
      t('created_at', 'createdAt', { index: true }),
      i('total_facts', 'totalFacts'),
      r('quality_score_overall', 'qualityScoreOverall')
    ]
  },
  {
    table: 'place_discoveries',
    collection: 'placeDiscoveries',
    key: 'id',
    label: 'Place discoveries',
    columns: [
      t('status', 'status', { index: true }),
      t('area_id', 'areaId', { index: true })
    ]
  },
  {
    table: 'resolution_candidates',
    collection: 'resolutionCandidates',
    key: 'id',
    label: 'Entity resolution candidates',
    columns: [
      t('status', 'status', { index: true }),
      r('score')
    ]
  },
  // ------------------------------------------------------------------ P2: Long-Stay / Reef / Bundles / Journal
  {
    table: 'reef_positive_logs',
    collection: 'reefPositiveLogs',
    key: 'id',
    label: 'Reef-positive conservation logs',
    columns: [
      t('booking_id', 'bookingId', { index: true }),
      t('trip_id', 'tripId', { index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('user_id', 'userId', { index: true }),
      t('action_type', 'actionType', { index: true }),
      i('points_awarded', 'pointsAwarded')
    ]
  },
  {
    table: 'bundles',
    collection: 'bundles',
    key: 'id',
    label: 'Dynamic bundles',
    columns: [
      bool('active', 'active'),
      t('service_types', 'serviceTypes')
    ]
  },
  {
    table: 'trip_journal_entries',
    collection: 'tripJournalEntries',
    key: 'id',
    label: 'Trip journal entries',
    columns: [
      t('trip_id', 'tripId', { index: true }),
      t('user_id', 'userId', { index: true }),
      bool('auto_captured', 'autoCaptured')
    ]
  },
  {
    table: 'trip_places_visited',
    collection: 'tripPlacesVisited',
    key: 'id',
    label: 'Trip places visited',
    columns: [
      t('trip_id', 'tripId', { index: true }),
      t('user_id', 'userId', { index: true }),
      t('booking_id', 'bookingId', { index: true })
    ]
  },
  // ------------------------------------------------------------------ P3: Fraud Detection
  {
    table: 'fraud_signals',
    collection: 'fraudSignals',
    key: 'id',
    label: 'Fraud detection signals',
    columns: [
      t('transaction_id', 'transactionId', { index: true }),
      t('user_id', 'userId', { index: true }),
      t('signal_type', 'signalType', { index: true }),
      t('action', 'action', { index: true }),
      i('risk_score', 'riskScore')
    ]
  },
  {
    table: 'fraud_rules',
    collection: 'fraudRules',
    key: 'id',
    label: 'Fraud detection rules',
    columns: [
      t('rule_name', 'ruleName', { unique: true }),
      bool('enabled', 'enabled')
    ]
  },
  {
    table: 'fraud_user_stats',
    collection: 'fraudUserStats',
    key: 'userId',
    label: 'Per-user fraud stats',
    columns: [
      t('user_id', 'userId', { index: true }),
      bool('blocked', 'blocked'),
      i('cumulative_risk_score', 'cumulativeRiskScore')
    ]
  },
  // ------------------------------------------------------ Dining: menus & orders
  // Appended at the tail deliberately: both specs carry a mandatory venue_id
  // FK, and TABLE_SPECS order is load-bearing in three places (the DDL, the
  // flush, and the JSON->SQLite migration) — a child listed before its parent
  // fails all three.
  {
    table: 'dining_menu_items',
    collection: 'diningMenuItems',
    key: 'id',
    label: 'Dining menu items',
    columns: [
      // RESTRICT: a dish is part of what a traveler ordered, so deleting a
      // venue must not silently orphan the row a placed order points at.
      t('venue_id', 'venueId', { notNull: true, index: true, references: fk('dining_venues', 'RESTRICT') }),
      t('category', 'category', { index: true }),
      r('price_egp', 'priceEGP'),
      bool('available'),
      i('sort_order', 'sortOrder')
    ],
    compositeIndexes: [['venue_id', 'category']]
  },
  {
    table: 'dining_orders',
    collection: 'diningOrders',
    key: 'id',
    label: 'Dining orders',
    columns: [
      t('order_ref', 'orderRef', { notNull: true, unique: true }),
      t('venue_id', 'venueId', { notNull: true, index: true, references: fk('dining_venues', 'RESTRICT') }),
      // Money-row convention (see rental_bookings): the supplier the payout
      // belongs to is indexed, not constrained — the order outlives the
      // supplier record and must survive its deletion.
      t('supplier_id', 'supplierId', { index: true }),
      t('user_id', 'userId', { index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('fulfillment', 'fulfillment', { notNull: true, index: true }),
      t('payment_method', 'paymentMethod', { index: true }),
      t('idempotency_key', 'idempotencyKey', { unique: true }),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['venue_id', 'status'], ['user_id', 'created_at']]
  },
  {
    // Dahab parties & nightlife. zone/category/frequency carry the hot filters
    // of GET /api/dahab/parties; license_verified gates every public read.
    table: 'dahab_parties',
    collection: 'dahabParties',
    key: 'id',
    label: 'Dahab parties',
    columns: [
      t('category', 'category', { index: true }),
      t('zone', 'zone', { index: true }),
      t('frequency', 'frequency', { index: true }),
      t('start_time', 'startTime', { index: true }),
      r('price_egp', 'priceEgp'),
      r('transport_egp', 'transportEgp'),
      r('price_usd', 'priceUsd'),
      bool('is_featured', 'isFeatured'),
      // The public catalogue serves verified rows only; the index keeps that
      // predicate a table scan away from becoming a full scan.
      bool('license_verified', 'licenseVerified', { index: true }),
      i('booking_intent_count', 'bookingIntentCount'),
      t('created_at', 'createdAt', { index: true }),
      t('updated_at', 'updatedAt')
    ],
    compositeIndexes: [['zone', 'category'], ['license_verified', 'is_featured']]
  },
  {
    // Append-only WhatsApp intent log. Indexed by party for the ops counter
    // drill-down and by day for "how many intents did yesterday drive".
    table: 'dahab_party_intents',
    collection: 'dahabPartyIntents',
    key: 'id',
    label: 'Dahab party booking intents',
    columns: [
      t('party_id', 'partyId', { notNull: true, index: true }),
      t('target_date', 'targetDate', { index: true }),
      i('persons', 'persons'),
      t('language', 'language', { index: true }),
      t('user_id', 'userId', { index: true }),
      t('created_at', 'createdAt', { index: true })
    ],
    compositeIndexes: [['party_id', 'created_at'], ['target_date', 'created_at']]
  },
  {
    table: 'transfer_zone_prices',
    collection: 'transferZonePrices',
    key: 'id',
    label: 'Transfer hub zone prices',
    columns: [
      t('haul', 'haul', { index: true }),
      bool('active', 'active'),
      r('private_egp', 'privateEGP'),
      r('supplier_private_egp', 'supplierPrivateEGP')
    ]
  },
  {
    table: 'transfer_bus_schedules',
    collection: 'transferBusSchedules',
    key: 'id',
    label: 'Transfer hub bus timetable',
    columns: [
      t('origin_id', 'originId', { notNull: true, index: true }),
      t('operator_id', 'operatorId', { index: true }),
      i('seats', 'seats'),
      r('price_egp', 'priceEGP'),
      bool('active', 'active')
    ]
  },
  {
    table: 'transfer_drivers',
    collection: 'transferDrivers',
    key: 'id',
    label: 'Transfer hub drivers',
    columns: [
      t('name_en', 'nameEn'),
      bool('active', 'active'),
      bool('verified', 'verified'),
      r('rating', 'rating')
    ]
  },
  // ------------------------------------------- Staff control plane (ops contract)
  // Appended at the tail (TABLE_SPECS order is load-bearing — see the dining
  // note above). None of these declare a FOREIGN KEY: overrides, device
  // sessions and refresh tokens must survive as audit evidence after the
  // user row they point at is removed, so they are indexed, not constrained.
  {
    table: 'roles',
    collection: 'roles',
    key: 'id',
    label: 'Staff roles',
    columns: [
      t('name', 'name', { notNull: true, unique: true }),
      bool('is_system', 'isSystem'),
      t('base_role', 'baseRole', { index: true })
    ]
  },
  {
    table: 'user_permission_overrides',
    collection: 'userPermissionOverrides',
    key: 'id',
    label: 'User permission overrides',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true }),
      t('permission', 'permission', { notNull: true }),
      t('effect', 'effect', { notNull: true })
    ],
    compositeIndexes: [['user_id', 'permission']]
  },
  {
    table: 'settings',
    collection: 'settings',
    key: 'id',
    label: 'Platform settings',
    columns: [
      i('version', 'version'),
      t('updated_at', 'updatedAt')
    ]
  },
  {
    table: 'settings_history',
    collection: 'settingsHistory',
    key: 'id',
    label: 'Platform settings history',
    columns: [
      t('setting_key', 'key', { notNull: true, index: true }),
      i('version', 'version'),
      t('updated_at', 'updatedAt', { index: true })
    ],
    compositeIndexes: [['setting_key', 'version']]
  },
  {
    table: 'feature_flags',
    collection: 'featureFlags',
    key: 'id',
    label: 'Feature flags and kill switches',
    columns: [
      t('kind', 'kind', { notNull: true, index: true }),
      bool('enabled', 'enabled')
    ]
  },
  {
    table: 'approvals',
    collection: 'approvals',
    key: 'id',
    label: 'Two-person approvals',
    columns: [
      t('action', 'action', { notNull: true, index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('requested_by', 'requestedBy', { index: true }),
      t('requested_at', 'requestedAt', { index: true })
    ]
  },
  {
    table: 'idempotency_keys',
    collection: 'idempotencyKeys',
    key: 'id',
    label: 'Idempotency keys',
    columns: [
      t('user_id', 'userId', { index: true }),
      t('route', 'route'),
      t('expires_at', 'expiresAt', { index: true })
    ]
  },
  {
    table: 'device_sessions',
    collection: 'deviceSessions',
    key: 'id',
    label: 'Native device sessions',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true }),
      t('platform', 'platform'),
      t('revoked_at', 'revokedAt')
    ]
  },
  {
    table: 'refresh_tokens',
    collection: 'refreshTokens',
    key: 'id',
    label: 'Refresh tokens',
    columns: [
      t('token_hash', 'tokenHash', { notNull: true, unique: true }),
      t('device_session_id', 'deviceSessionId', { notNull: true, index: true }),
      t('user_id', 'userId', { index: true }),
      t('expires_at', 'expiresAt')
    ]
  },
  {
    table: 'push_devices',
    collection: 'pushDevices',
    key: 'id',
    label: 'Native push devices',
    columns: [
      t('user_id', 'userId', { notNull: true, index: true }),
      t('device_session_id', 'deviceSessionId', { index: true }),
      t('fcm_token', 'fcmToken', { notNull: true, unique: true })
    ]
  },
  {
    table: 'integration_configs',
    collection: 'integrationConfigs',
    key: 'id',
    label: 'Integration configuration',
    columns: [
      bool('enabled', 'enabled'),
      t('mode', 'mode')
    ]
  },
  // Catalogue surface (docs/CATALOG_API_CONTRACT.md).
  {
    table: 'trip_packages',
    collection: 'tripPackages',
    key: 'id',
    label: 'Trip packages (ready-made programmes)',
    columns: [
      t('status', 'status', { notNull: true, index: true }),
      t('supplier_id', 'supplierId', { index: true }),
      t('seed_id', 'seedId', { index: true }),
      t('updated_at', 'updatedAt')
    ]
  },
  {
    table: 'catalog_meta',
    collection: 'catalogMeta',
    key: 'id',
    label: 'Catalogue status and version bookkeeping',
    columns: [
      t('type', 'type', { notNull: true, index: true }),
      t('entity_id', 'entityId', { notNull: true, index: true }),
      t('status', 'status', { notNull: true, index: true }),
      t('updated_at', 'updatedAt')
    ]
  }
];

/** Collections that live in DatabaseState but are scalars, not tables. */
export const SCALAR_STATE_KEYS = ['version', 'fencingSequence', 'lastCheckpoint'] as const;

export const SPEC_BY_COLLECTION = new Map<string, TableSpec>(
  TABLE_SPECS.map(s => [s.collection as string, s])
);

export const SPEC_BY_TABLE = new Map<string, TableSpec>(
  TABLE_SPECS.map(s => [s.table, s])
);
