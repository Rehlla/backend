-- GENERATED from server/db/sqlite/tableSpecs.ts. Do not edit by hand.
-- Regenerate with: npm run db:schema

-- Users (DatabaseState.users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  email TEXT NOT NULL UNIQUE,
  firebase_uid TEXT UNIQUE,
  role TEXT NOT NULL,
  supplier_id TEXT,
  phone TEXT,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_seq ON users(seq);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_supplier_id ON users(supplier_id);

-- Suppliers (DatabaseState.suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  business_name TEXT,
  vertical TEXT,
  status TEXT,
  email TEXT,
  phone TEXT,
  commission_rate REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_seq ON suppliers(seq);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_name ON suppliers(business_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_vertical ON suppliers(vertical);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- Sessions (DatabaseState.sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_seq ON sessions(seq);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Trips (DatabaseState.trips)
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  length_days INTEGER,
  travelers_count INTEGER,
  total_estimated_egp REAL,
  total_paid_egp REAL,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_seq ON trips(seq);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON trips(start_date);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);

-- Product SKUs (DatabaseState.productSkus)
CREATE TABLE IF NOT EXISTS product_skus (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  title TEXT,
  base_price_egp REAL,
  active INTEGER,
  max_capacity_per_slot INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_skus_seq ON product_skus(seq);
CREATE INDEX IF NOT EXISTS idx_product_skus_supplier_id ON product_skus(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_skus_service_type ON product_skus(service_type);
CREATE INDEX IF NOT EXISTS idx_product_skus_service_type_active ON product_skus(service_type, active);

-- Hotels (DatabaseState.hotels)
CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  sku_id TEXT,
  slug TEXT UNIQUE,
  category TEXT,
  price_band TEXT,
  area TEXT,
  rating REAL,
  review_count INTEGER,
  per_night_egp REAL,
  active INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotels_seq ON hotels(seq);
CREATE INDEX IF NOT EXISTS idx_hotels_sku_id ON hotels(sku_id);
CREATE INDEX IF NOT EXISTS idx_hotels_category ON hotels(category);
CREATE INDEX IF NOT EXISTS idx_hotels_price_band ON hotels(price_band);
CREATE INDEX IF NOT EXISTS idx_hotels_area ON hotels(area);
CREATE INDEX IF NOT EXISTS idx_hotels_created_at ON hotels(created_at);
CREATE INDEX IF NOT EXISTS idx_hotels_category_area ON hotels(category, area);

-- Area profiles (DatabaseState.areaProfiles)
CREATE TABLE IF NOT EXISTS area_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  name_en TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_area_profiles_seq ON area_profiles(seq);
CREATE INDEX IF NOT EXISTS idx_area_profiles_name_en ON area_profiles(name_en);

-- Accommodations (DatabaseState.accommodations)
CREATE TABLE IF NOT EXISTS accommodations (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  sku_id TEXT,
  slug TEXT UNIQUE,
  property_type TEXT NOT NULL,
  category TEXT,
  price_band TEXT,
  area_id TEXT NOT NULL REFERENCES area_profiles(id) ON DELETE RESTRICT,
  area TEXT,
  rating REAL,
  review_count INTEGER,
  per_night_egp REAL,
  latitude REAL,
  longitude REAL,
  active INTEGER,
  featured INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accommodations_seq ON accommodations(seq);
CREATE INDEX IF NOT EXISTS idx_accommodations_sku_id ON accommodations(sku_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_property_type ON accommodations(property_type);
CREATE INDEX IF NOT EXISTS idx_accommodations_category ON accommodations(category);
CREATE INDEX IF NOT EXISTS idx_accommodations_price_band ON accommodations(price_band);
CREATE INDEX IF NOT EXISTS idx_accommodations_area_id ON accommodations(area_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_area ON accommodations(area);
CREATE INDEX IF NOT EXISTS idx_accommodations_created_at ON accommodations(created_at);
CREATE INDEX IF NOT EXISTS idx_accommodations_property_type_area_id ON accommodations(property_type, area_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_property_type_active ON accommodations(property_type, active);
CREATE INDEX IF NOT EXISTS idx_accommodations_category_area_id ON accommodations(category, area_id);

-- Property external reference links (DatabaseState.propertySources)
CREATE TABLE IF NOT EXISTS property_sources (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  accommodation_id TEXT NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  active INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_property_sources_seq ON property_sources(seq);
CREATE INDEX IF NOT EXISTS idx_property_sources_accommodation_id ON property_sources(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_property_sources_source_type ON property_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_property_sources_created_at ON property_sources(created_at);
CREATE INDEX IF NOT EXISTS idx_property_sources_accommodation_id_source_type ON property_sources(accommodation_id, source_type);

-- Rental listings (DatabaseState.rentalListings)
CREATE TABLE IF NOT EXISTS rental_listings (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku_id TEXT,
  slug TEXT UNIQUE,
  category TEXT,
  subcategory TEXT,
  quantity INTEGER,
  daily_rate_egp REAL,
  status TEXT,
  active INTEGER,
  featured INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rental_listings_seq ON rental_listings(seq);
CREATE INDEX IF NOT EXISTS idx_rental_listings_supplier_id ON rental_listings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rental_listings_sku_id ON rental_listings(sku_id);
CREATE INDEX IF NOT EXISTS idx_rental_listings_category ON rental_listings(category);
CREATE INDEX IF NOT EXISTS idx_rental_listings_subcategory ON rental_listings(subcategory);
CREATE INDEX IF NOT EXISTS idx_rental_listings_status ON rental_listings(status);
CREATE INDEX IF NOT EXISTS idx_rental_listings_created_at ON rental_listings(created_at);
CREATE INDEX IF NOT EXISTS idx_rental_listings_category_active ON rental_listings(category, active);

-- Rental extras (DatabaseState.rentalExtras)
CREATE TABLE IF NOT EXISTS rental_extras (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  name TEXT,
  name_ar TEXT,
  price_egp REAL,
  pricing_basis TEXT,
  active INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rental_extras_seq ON rental_extras(seq);
CREATE INDEX IF NOT EXISTS idx_rental_extras_listing_id ON rental_extras(listing_id);

-- Inventory slots (DatabaseState.inventorySlots)
CREATE TABLE IF NOT EXISTS inventory_slots (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  date TEXT,
  time_slot TEXT,
  status TEXT,
  total_capacity INTEGER,
  reserved_capacity INTEGER,
  held_capacity INTEGER,
  price_egp REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_slots_seq ON inventory_slots(seq);
CREATE INDEX IF NOT EXISTS idx_inventory_slots_sku_id ON inventory_slots(sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_slots_date ON inventory_slots(date);
CREATE INDEX IF NOT EXISTS idx_inventory_slots_status ON inventory_slots(status);
CREATE INDEX IF NOT EXISTS idx_inventory_slots_sku_id_date ON inventory_slots(sku_id, date);

-- Trip items (DatabaseState.tripItems)
CREATE TABLE IF NOT EXISTS trip_items (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sku_id TEXT,
  booking_id TEXT,
  service_type TEXT,
  status TEXT,
  day_number INTEGER,
  price_egp REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_items_seq ON trip_items(seq);
CREATE INDEX IF NOT EXISTS idx_trip_items_trip_id ON trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_sku_id ON trip_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_booking_id ON trip_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_status ON trip_items(status);

-- Trip members (DatabaseState.tripMembers)
CREATE TABLE IF NOT EXISTS trip_members (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_by TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_members_seq ON trip_members(seq);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_role ON trip_members(role);
CREATE INDEX IF NOT EXISTS idx_trip_members_status ON trip_members(status);
CREATE INDEX IF NOT EXISTS idx_trip_members_created_at ON trip_members(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id_user_id ON trip_members(trip_id, user_id);

-- Trip item votes (DatabaseState.tripItemVotes)
CREATE TABLE IF NOT EXISTS trip_item_votes (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_seq ON trip_item_votes(seq);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_trip_id ON trip_item_votes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_trip_item_id ON trip_item_votes(trip_item_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_user_id ON trip_item_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_created_at ON trip_item_votes(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_item_votes_trip_item_id_user_id ON trip_item_votes(trip_item_id, user_id);

-- Trip splits (DatabaseState.tripSplits)
CREATE TABLE IF NOT EXISTS trip_splits (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  share_egp REAL,
  paid_egp REAL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_splits_seq ON trip_splits(seq);
CREATE INDEX IF NOT EXISTS idx_trip_splits_trip_id ON trip_splits(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_splits_user_id ON trip_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_splits_status ON trip_splits(status);
CREATE INDEX IF NOT EXISTS idx_trip_splits_created_at ON trip_splits(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_splits_trip_id_user_id ON trip_splits(trip_id, user_id);

-- Holds (DatabaseState.holds)
CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  hold_token TEXT NOT NULL UNIQUE,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  slot_id TEXT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  traveler_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  expires_at TEXT,
  idempotency_key TEXT UNIQUE,
  amount_egp REAL,
  passengers_count INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_holds_seq ON holds(seq);
CREATE INDEX IF NOT EXISTS idx_holds_sku_id ON holds(sku_id);
CREATE INDEX IF NOT EXISTS idx_holds_slot_id ON holds(slot_id);
CREATE INDEX IF NOT EXISTS idx_holds_trip_id ON holds(trip_id);
CREATE INDEX IF NOT EXISTS idx_holds_traveler_id ON holds(traveler_id);
CREATE INDEX IF NOT EXISTS idx_holds_status ON holds(status);
CREATE INDEX IF NOT EXISTS idx_holds_expires_at ON holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_holds_status_expires_at ON holds(status, expires_at);

-- Bookings (DatabaseState.bookings)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  booking_ref TEXT NOT NULL UNIQUE,
  trip_id TEXT NOT NULL,
  trip_item_id TEXT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  service_type TEXT,
  payment_state TEXT,
  supplier_state TEXT,
  traveler_email TEXT,
  traveler_phone TEXT,
  scheduled_date TEXT,
  confirmation_code TEXT,
  amount_egp REAL,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_seq ON bookings(seq);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_item_id ON bookings(trip_item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_sku_id ON bookings(sku_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_type ON bookings(service_type);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_state ON bookings(payment_state);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_state ON bookings(supplier_state);
CREATE INDEX IF NOT EXISTS idx_bookings_traveler_email ON bookings(traveler_email);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id_supplier_state ON bookings(supplier_id, supplier_state);

-- Rental bookings (DatabaseState.rentalBookings)
CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  booking_ref TEXT NOT NULL UNIQUE,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE RESTRICT,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  trip_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL,
  payment_state TEXT,
  start_date TEXT,
  end_date TEXT,
  quantity INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_seq ON rental_bookings(seq);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_listing_id ON rental_bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_sku_id ON rental_bookings(sku_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_supplier_id ON rental_bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_trip_id ON rental_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_user_id ON rental_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_status ON rental_bookings(status);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_payment_state ON rental_bookings(payment_state);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_start_date ON rental_bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_end_date ON rental_bookings(end_date);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_created_at ON rental_bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_listing_id_status ON rental_bookings(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_listing_id_start_date_end_date ON rental_bookings(listing_id, start_date, end_date);

-- Rental maintenance blocks (DatabaseState.rentalMaintenanceBlocks)
CREATE TABLE IF NOT EXISTS rental_maintenance_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  start_date TEXT,
  end_date TEXT,
  quantity_blocked INTEGER,
  reason TEXT,
  created_by TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_blocks_seq ON rental_maintenance_blocks(seq);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_blocks_listing_id ON rental_maintenance_blocks(listing_id);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_blocks_start_date ON rental_maintenance_blocks(start_date);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_blocks_end_date ON rental_maintenance_blocks(end_date);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_blocks_listing_id_start_date_end_date ON rental_maintenance_blocks(listing_id, start_date, end_date);

-- Room types (DatabaseState.roomTypes)
CREATE TABLE IF NOT EXISTS room_types (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  accommodation_id TEXT NOT NULL,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT,
  name_ar TEXT,
  max_guests_per_unit INTEGER NOT NULL,
  base_nightly_egp INTEGER NOT NULL,
  weekly_rate_egp INTEGER,
  monthly_rate_egp INTEGER,
  min_nights INTEGER NOT NULL,
  max_nights INTEGER NOT NULL,
  total_units INTEGER NOT NULL,
  inventory_source TEXT NOT NULL,
  cancellation_policy_hours INTEGER NOT NULL,
  active INTEGER,
  display_order INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_types_seq ON room_types(seq);
CREATE INDEX IF NOT EXISTS idx_room_types_accommodation_id ON room_types(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_room_types_sku_id ON room_types(sku_id);
CREATE INDEX IF NOT EXISTS idx_room_types_supplier_id ON room_types(supplier_id);
CREATE INDEX IF NOT EXISTS idx_room_types_code ON room_types(code);
CREATE INDEX IF NOT EXISTS idx_room_types_total_units ON room_types(total_units);
CREATE INDEX IF NOT EXISTS idx_room_types_inventory_source ON room_types(inventory_source);
CREATE INDEX IF NOT EXISTS idx_room_types_accommodation_id_active ON room_types(accommodation_id, active);
CREATE INDEX IF NOT EXISTS idx_room_types_accommodation_id_code ON room_types(accommodation_id, code);

-- Room rate calendar (DatabaseState.roomRateNights)
CREATE TABLE IF NOT EXISTS room_rate_nights (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  accommodation_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  nightly_egp INTEGER,
  min_nights INTEGER,
  closed INTEGER,
  closed_reason TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_rate_nights_seq ON room_rate_nights(seq);
CREATE INDEX IF NOT EXISTS idx_room_rate_nights_accommodation_id ON room_rate_nights(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_room_rate_nights_room_type_id ON room_rate_nights(room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_rate_nights_date ON room_rate_nights(date);
CREATE INDEX IF NOT EXISTS idx_room_rate_nights_room_type_id_date ON room_rate_nights(room_type_id, date);

-- Hotel bookings (DatabaseState.hotelBookings)
CREATE TABLE IF NOT EXISTS hotel_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  booking_ref TEXT NOT NULL UNIQUE,
  accommodation_id TEXT NOT NULL REFERENCES accommodations(id) ON DELETE RESTRICT,
  room_type_id TEXT NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  sku_id TEXT NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  booking_ref_linked TEXT,
  trip_id TEXT NOT NULL,
  user_id TEXT,
  traveler_name TEXT,
  traveler_phone TEXT,
  traveler_email TEXT,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL,
  rooms INTEGER NOT NULL,
  adults INTEGER,
  children INTEGER,
  status TEXT NOT NULL,
  payment_state TEXT,
  deposit_egp INTEGER NOT NULL,
  balance_due_egp INTEGER NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  payment_proof_url TEXT,
  hold_expires_at TEXT,
  idempotency_key TEXT UNIQUE,
  free_cancellation_until TEXT,
  confirmation_code TEXT,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_seq ON hotel_bookings(seq);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_accommodation_id ON hotel_bookings(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_room_type_id ON hotel_bookings(room_type_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_sku_id ON hotel_bookings(sku_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_supplier_id ON hotel_bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_booking_ref_linked ON hotel_bookings(booking_ref_linked);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_trip_id ON hotel_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_user_id ON hotel_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_check_in ON hotel_bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_check_out ON hotel_bookings(check_out);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_status ON hotel_bookings(status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_payment_state ON hotel_bookings(payment_state);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_payment_method ON hotel_bookings(payment_method);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_hold_expires_at ON hotel_bookings(hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_created_at ON hotel_bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_room_type_id_status_check_in_check_out ON hotel_bookings(room_type_id, status, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_trip_id_status ON hotel_bookings(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_supplier_id_status ON hotel_bookings(supplier_id, status);

-- Payments (DatabaseState.payments)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  transaction_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  hold_token TEXT,
  trip_id TEXT NOT NULL,
  booking_id TEXT,
  state TEXT,
  provider TEXT,
  amount_egp REAL,
  simulated INTEGER,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_seq ON payments(seq);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_hold_token ON payments(hold_token);
CREATE INDEX IF NOT EXISTS idx_payments_trip_id ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_state ON payments(state);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Ledger entries (DatabaseState.ledgerEntries)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  transaction_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  booking_ref TEXT,
  trip_id TEXT NOT NULL,
  type TEXT,
  status TEXT,
  debit_account TEXT,
  credit_account TEXT,
  amount_egp REAL,
  timestamp TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_seq ON ledger_entries(seq);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_booking_ref ON ledger_entries(booking_ref);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_trip_id ON ledger_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type ON ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_debit_account ON ledger_entries(debit_account);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_credit_account ON ledger_entries(credit_account);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_timestamp ON ledger_entries(timestamp);

-- Transfer telemetry (DatabaseState.transferTelemetry)
CREATE TABLE IF NOT EXISTS transfer_telemetry (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  reference_code TEXT,
  status TEXT,
  flight_status TEXT,
  driver_phone TEXT,
  latitude REAL,
  longitude REAL,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfer_telemetry_seq ON transfer_telemetry(seq);
CREATE INDEX IF NOT EXISTS idx_transfer_telemetry_reference_code ON transfer_telemetry(reference_code);
CREATE INDEX IF NOT EXISTS idx_transfer_telemetry_status ON transfer_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_transfer_telemetry_updated_at ON transfer_telemetry(updated_at);

-- Notifications (DatabaseState.notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT,
  status TEXT,
  channel TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_seq ON notifications(seq);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Ambient nudges (DatabaseState.ambientNudges)
CREATE TABLE IF NOT EXISTS ambient_nudges (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  nudge_type TEXT NOT NULL,
  priority TEXT,
  status TEXT NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_seq ON ambient_nudges(seq);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_user_id ON ambient_nudges(user_id);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_trip_id ON ambient_nudges(trip_id);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_nudge_type ON ambient_nudges(nudge_type);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_priority ON ambient_nudges(priority);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_status ON ambient_nudges(status);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_created_at ON ambient_nudges(created_at);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_user_id_status ON ambient_nudges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ambient_nudges_trip_id_nudge_type ON ambient_nudges(trip_id, nudge_type);

-- Push subscriptions (DatabaseState.pushSubscriptions)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_seq ON push_subscriptions(seq);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at ON push_subscriptions(created_at);

-- Supplier metrics (DatabaseState.supplierMetrics)
CREATE TABLE IF NOT EXISTS supplier_metrics (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT NOT NULL,
  booking_ref TEXT NOT NULL,
  event TEXT NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_seq ON supplier_metrics(seq);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_supplier_id ON supplier_metrics(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_booking_ref ON supplier_metrics(booking_ref);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_event ON supplier_metrics(event);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_created_at ON supplier_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_supplier_id_event ON supplier_metrics(supplier_id, event);

-- Reviews (DatabaseState.reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  booking_ref TEXT NOT NULL,
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  moderation_status TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_seq ON reviews(seq);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_ref ON reviews(booking_ref);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_supplier_id ON reviews(supplier_id);
CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_supplier_id_moderation_status ON reviews(supplier_id, moderation_status);

-- Supplier availability blocks (DatabaseState.supplierAvailabilityBlocks)
CREATE TABLE IF NOT EXISTS supplier_availability_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_seq ON supplier_availability_blocks(seq);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_supplier_id ON supplier_availability_blocks(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_start_date ON supplier_availability_blocks(start_date);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_end_date ON supplier_availability_blocks(end_date);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_created_at ON supplier_availability_blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_availability_blocks_supplier_id_start_date_end_date ON supplier_availability_blocks(supplier_id, start_date, end_date);

-- Payout schedule (DatabaseState.payoutSchedule)
CREATE TABLE IF NOT EXISTS payout_schedule (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT NOT NULL,
  booking_ref TEXT NOT NULL,
  payout_state TEXT NOT NULL,
  settle_after TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_seq ON payout_schedule(seq);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_supplier_id ON payout_schedule(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_booking_ref ON payout_schedule(booking_ref);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_payout_state ON payout_schedule(payout_state);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_settle_after ON payout_schedule(settle_after);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_created_at ON payout_schedule(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_schedule_payout_state_settle_after ON payout_schedule(payout_state, settle_after);

-- Analytics events (DatabaseState.analyticsEvents)
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT,
  session_id TEXT,
  event_name TEXT NOT NULL,
  timestamp TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_seq ON analytics_events(seq);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_timestamp ON analytics_events(event_name, timestamp);

-- Support messages (DatabaseState.supportMessages)
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT,
  booking_ref TEXT,
  status TEXT,
  urgent INTEGER,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_messages_seq ON support_messages(seq);
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_trip_id ON support_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);

-- Audit events (DatabaseState.auditEvents)
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  actor TEXT,
  actor_role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  timestamp TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_seq ON audit_events(seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_type_entity_id ON audit_events(entity_type, entity_id);

-- Product opportunities (DatabaseState.opportunities)
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT,
  product_area TEXT,
  confidence_score REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opportunities_seq ON opportunities(seq);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_product_area ON opportunities(product_area);

-- Distributed locks (DatabaseState.locks)
CREATE TABLE IF NOT EXISTS distributed_locks (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  owner_id TEXT,
  expires_at TEXT,
  fencing_token INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_distributed_locks_seq ON distributed_locks(seq);
CREATE INDEX IF NOT EXISTS idx_distributed_locks_owner_id ON distributed_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON distributed_locks(expires_at);

-- Raw supplier sources (DatabaseState.rawSupplierSources)
CREATE TABLE IF NOT EXISTS raw_supplier_sources (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_type TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_supplier_sources_seq ON raw_supplier_sources(seq);
CREATE INDEX IF NOT EXISTS idx_raw_supplier_sources_source_type ON raw_supplier_sources(source_type);

-- Raw offer sources (DatabaseState.rawOfferSources)
CREATE TABLE IF NOT EXISTS raw_offer_sources (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_type TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_offer_sources_seq ON raw_offer_sources(seq);
CREATE INDEX IF NOT EXISTS idx_raw_offer_sources_source_type ON raw_offer_sources(source_type);

-- Supplier offers (DatabaseState.supplierOffers)
CREATE TABLE IF NOT EXISTS supplier_offers (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT,
  activity_id TEXT,
  canonical_category TEXT,
  currency TEXT,
  price REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_seq ON supplier_offers(seq);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_supplier_id ON supplier_offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_activity_id ON supplier_offers(activity_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_canonical_category ON supplier_offers(canonical_category);

-- Market price stats (DatabaseState.marketPriceStats)
CREATE TABLE IF NOT EXISTS market_price_stats (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  lowest_observed_price REAL,
  highest_observed_price REAL,
  median_observed_price REAL,
  observed_offer_count INTEGER,
  last_calculated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_price_stats_seq ON market_price_stats(seq);
CREATE INDEX IF NOT EXISTS idx_market_price_stats_last_calculated_at ON market_price_stats(last_calculated_at);

-- Social accounts (DatabaseState.socialAccounts)
CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  platform TEXT,
  username TEXT,
  supplier_id TEXT,
  ownership_status TEXT,
  category TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_seq ON social_accounts(seq);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_username ON social_accounts(username);
CREATE INDEX IF NOT EXISTS idx_social_accounts_supplier_id ON social_accounts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_ownership_status ON social_accounts(ownership_status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_category ON social_accounts(category);

-- Source records (DatabaseState.sourceRecords)
CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_type TEXT,
  supplier_id TEXT,
  verification_status TEXT,
  captured_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_records_seq ON source_records(seq);
CREATE INDEX IF NOT EXISTS idx_source_records_source_type ON source_records(source_type);
CREATE INDEX IF NOT EXISTS idx_source_records_supplier_id ON source_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_source_records_verification_status ON source_records(verification_status);
CREATE INDEX IF NOT EXISTS idx_source_records_captured_at ON source_records(captured_at);

-- Price observations (DatabaseState.priceObservations)
CREATE TABLE IF NOT EXISTS price_observations (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  offer_id TEXT,
  supplier_id TEXT,
  activity_id TEXT,
  freshness_status TEXT,
  verification_status TEXT,
  amount REAL,
  observed_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_observations_seq ON price_observations(seq);
CREATE INDEX IF NOT EXISTS idx_price_observations_offer_id ON price_observations(offer_id);
CREATE INDEX IF NOT EXISTS idx_price_observations_supplier_id ON price_observations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_observations_activity_id ON price_observations(activity_id);
CREATE INDEX IF NOT EXISTS idx_price_observations_freshness_status ON price_observations(freshness_status);
CREATE INDEX IF NOT EXISTS idx_price_observations_observed_at ON price_observations(observed_at);

-- Market change events (DatabaseState.marketChangeEvents)
CREATE TABLE IF NOT EXISTS market_change_events (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  event_type TEXT,
  supplier_id TEXT,
  detected_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_change_events_seq ON market_change_events(seq);
CREATE INDEX IF NOT EXISTS idx_market_change_events_event_type ON market_change_events(event_type);
CREATE INDEX IF NOT EXISTS idx_market_change_events_supplier_id ON market_change_events(supplier_id);
CREATE INDEX IF NOT EXISTS idx_market_change_events_detected_at ON market_change_events(detected_at);

-- Market snapshots (DatabaseState.marketSnapshots)
CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_seq ON market_snapshots(seq);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_created_at ON market_snapshots(created_at);

-- Source freshness (DatabaseState.sourceFreshnessRecords)
CREATE TABLE IF NOT EXISTS source_freshness (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_id TEXT,
  freshness_status TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_freshness_seq ON source_freshness(seq);
CREATE INDEX IF NOT EXISTS idx_source_freshness_source_id ON source_freshness(source_id);
CREATE INDEX IF NOT EXISTS idx_source_freshness_freshness_status ON source_freshness(freshness_status);

-- Contact history (DatabaseState.contactHistory)
CREATE TABLE IF NOT EXISTS contact_history (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  supplier_id TEXT,
  contacted_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_history_seq ON contact_history(seq);
CREATE INDEX IF NOT EXISTS idx_contact_history_supplier_id ON contact_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_contacted_at ON contact_history(contacted_at);

-- Market refresh runs (DatabaseState.marketRefreshRuns)
CREATE TABLE IF NOT EXISTS market_refresh_runs (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  run_id TEXT,
  source_id TEXT,
  status TEXT,
  started_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_refresh_runs_seq ON market_refresh_runs(seq);
CREATE INDEX IF NOT EXISTS idx_market_refresh_runs_run_id ON market_refresh_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_market_refresh_runs_source_id ON market_refresh_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_market_refresh_runs_status ON market_refresh_runs(status);
CREATE INDEX IF NOT EXISTS idx_market_refresh_runs_started_at ON market_refresh_runs(started_at);

-- Market review queue (DatabaseState.marketReviewQueue)
CREATE TABLE IF NOT EXISTS market_review_queue (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT,
  supplier_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_review_queue_seq ON market_review_queue(seq);
CREATE INDEX IF NOT EXISTS idx_market_review_queue_status ON market_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_market_review_queue_supplier_id ON market_review_queue(supplier_id);

-- Source health (DatabaseState.sourceHealthRecords)
CREATE TABLE IF NOT EXISTS source_health (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_id TEXT,
  status TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_health_seq ON source_health(seq);
CREATE INDEX IF NOT EXISTS idx_source_health_source_id ON source_health(source_id);
CREATE INDEX IF NOT EXISTS idx_source_health_status ON source_health(status);

-- Refresh schedule policies (DatabaseState.refreshSchedulePolicies)
CREATE TABLE IF NOT EXISTS refresh_schedule_policies (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_id TEXT,
  interval TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_schedule_policies_seq ON refresh_schedule_policies(seq);
CREATE INDEX IF NOT EXISTS idx_refresh_schedule_policies_source_id ON refresh_schedule_policies(source_id);

-- Market alerts (DatabaseState.marketAlerts)
CREATE TABLE IF NOT EXISTS market_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  alert_type TEXT,
  severity TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_alerts_seq ON market_alerts(seq);
CREATE INDEX IF NOT EXISTS idx_market_alerts_alert_type ON market_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_market_alerts_severity ON market_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_market_alerts_created_at ON market_alerts(created_at);

-- Research sources (DatabaseState.researchSources)
CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  source_type TEXT,
  authority_weight REAL,
  last_audited TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_sources_seq ON research_sources(seq);
CREATE INDEX IF NOT EXISTS idx_research_sources_source_type ON research_sources(source_type);

-- Places (DatabaseState.places)
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  area_id TEXT NOT NULL REFERENCES area_profiles(id) ON DELETE CASCADE,
  name_en TEXT,
  category TEXT,
  operational_status TEXT,
  google_place_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_places_seq ON places(seq);
CREATE INDEX IF NOT EXISTS idx_places_area_id ON places(area_id);
CREATE INDEX IF NOT EXISTS idx_places_name_en ON places(name_en);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_operational_status ON places(operational_status);
CREATE INDEX IF NOT EXISTS idx_places_google_place_id ON places(google_place_id);

-- Temporal facts (DatabaseState.temporalFacts)
CREATE TABLE IF NOT EXISTS temporal_facts (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  subject_id TEXT,
  subject_type TEXT,
  predicate TEXT,
  confidence_tier TEXT,
  status TEXT,
  valid_from TEXT,
  valid_until TEXT,
  verified_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_seq ON temporal_facts(seq);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_subject_id ON temporal_facts(subject_id);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_subject_type ON temporal_facts(subject_type);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_predicate ON temporal_facts(predicate);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_confidence_tier ON temporal_facts(confidence_tier);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_status ON temporal_facts(status);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_valid_until ON temporal_facts(valid_until);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_verified_at ON temporal_facts(verified_at);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_subject_id_predicate ON temporal_facts(subject_id, predicate);

-- Evidence nodes (DatabaseState.evidenceNodes)
CREATE TABLE IF NOT EXISTS evidence_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  fact_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_nodes_seq ON evidence_nodes(seq);
CREATE INDEX IF NOT EXISTS idx_evidence_nodes_fact_id ON evidence_nodes(fact_id);

-- Conflict sets (DatabaseState.conflictSets)
CREATE TABLE IF NOT EXISTS conflict_sets (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  subject_id TEXT,
  status TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conflict_sets_seq ON conflict_sets(seq);
CREATE INDEX IF NOT EXISTS idx_conflict_sets_subject_id ON conflict_sets(subject_id);
CREATE INDEX IF NOT EXISTS idx_conflict_sets_status ON conflict_sets(status);

-- Activity details (DatabaseState.activities)
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  sku_id TEXT,
  supplier_id TEXT,
  place_id TEXT,
  area_id TEXT,
  category TEXT,
  base_price_egp REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_seq ON activities(seq);
CREATE INDEX IF NOT EXISTS idx_activities_sku_id ON activities(sku_id);
CREATE INDEX IF NOT EXISTS idx_activities_supplier_id ON activities(supplier_id);
CREATE INDEX IF NOT EXISTS idx_activities_place_id ON activities(place_id);
CREATE INDEX IF NOT EXISTS idx_activities_area_id ON activities(area_id);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);

-- Dining venues (DatabaseState.diningVenues)
CREATE TABLE IF NOT EXISTS dining_venues (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  place_id TEXT,
  area_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dining_venues_seq ON dining_venues(seq);
CREATE INDEX IF NOT EXISTS idx_dining_venues_place_id ON dining_venues(place_id);
CREATE INDEX IF NOT EXISTS idx_dining_venues_area_id ON dining_venues(area_id);

-- Emergency resources (DatabaseState.emergencyResources)
CREATE TABLE IF NOT EXISTS emergency_resources (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  resource_type TEXT,
  area_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_seq ON emergency_resources(seq);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_resource_type ON emergency_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_area_id ON emergency_resources(area_id);

-- Regulatory decrees (DatabaseState.regulatoryDecrees)
CREATE TABLE IF NOT EXISTS regulatory_decrees (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regulatory_decrees_seq ON regulatory_decrees(seq);
CREATE INDEX IF NOT EXISTS idx_regulatory_decrees_status ON regulatory_decrees(status);

-- Knowledge snapshots (DatabaseState.knowledgeSnapshots)
CREATE TABLE IF NOT EXISTS knowledge_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  version_id TEXT,
  created_at TEXT,
  total_facts INTEGER,
  quality_score_overall REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_snapshots_seq ON knowledge_snapshots(seq);
CREATE INDEX IF NOT EXISTS idx_knowledge_snapshots_version_id ON knowledge_snapshots(version_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_snapshots_created_at ON knowledge_snapshots(created_at);

-- Place discoveries (DatabaseState.placeDiscoveries)
CREATE TABLE IF NOT EXISTS place_discoveries (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT,
  area_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_place_discoveries_seq ON place_discoveries(seq);
CREATE INDEX IF NOT EXISTS idx_place_discoveries_status ON place_discoveries(status);
CREATE INDEX IF NOT EXISTS idx_place_discoveries_area_id ON place_discoveries(area_id);

-- Entity resolution candidates (DatabaseState.resolutionCandidates)
CREATE TABLE IF NOT EXISTS resolution_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT,
  score REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resolution_candidates_seq ON resolution_candidates(seq);
CREATE INDEX IF NOT EXISTS idx_resolution_candidates_status ON resolution_candidates(status);

-- Reef-positive conservation logs (DatabaseState.reefPositiveLogs)
CREATE TABLE IF NOT EXISTS reef_positive_logs (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  booking_id TEXT,
  trip_id TEXT,
  supplier_id TEXT,
  user_id TEXT,
  action_type TEXT,
  points_awarded INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_seq ON reef_positive_logs(seq);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_booking_id ON reef_positive_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_trip_id ON reef_positive_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_supplier_id ON reef_positive_logs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_user_id ON reef_positive_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reef_positive_logs_action_type ON reef_positive_logs(action_type);

-- Dynamic bundles (DatabaseState.bundles)
CREATE TABLE IF NOT EXISTS bundles (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  active INTEGER,
  service_types TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bundles_seq ON bundles(seq);

-- Trip journal entries (DatabaseState.tripJournalEntries)
CREATE TABLE IF NOT EXISTS trip_journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT,
  user_id TEXT,
  auto_captured INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_journal_entries_seq ON trip_journal_entries(seq);
CREATE INDEX IF NOT EXISTS idx_trip_journal_entries_trip_id ON trip_journal_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_journal_entries_user_id ON trip_journal_entries(user_id);

-- Trip places visited (DatabaseState.tripPlacesVisited)
CREATE TABLE IF NOT EXISTS trip_places_visited (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  trip_id TEXT,
  user_id TEXT,
  booking_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_places_visited_seq ON trip_places_visited(seq);
CREATE INDEX IF NOT EXISTS idx_trip_places_visited_trip_id ON trip_places_visited(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_places_visited_user_id ON trip_places_visited(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_places_visited_booking_id ON trip_places_visited(booking_id);

-- Fraud detection signals (DatabaseState.fraudSignals)
CREATE TABLE IF NOT EXISTS fraud_signals (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  transaction_id TEXT,
  user_id TEXT,
  signal_type TEXT,
  action TEXT,
  risk_score INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_seq ON fraud_signals(seq);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_transaction_id ON fraud_signals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_user_id ON fraud_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_signal_type ON fraud_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_action ON fraud_signals(action);

-- Fraud detection rules (DatabaseState.fraudRules)
CREATE TABLE IF NOT EXISTS fraud_rules (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  rule_name TEXT UNIQUE,
  enabled INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_seq ON fraud_rules(seq);

-- Per-user fraud stats (DatabaseState.fraudUserStats)
CREATE TABLE IF NOT EXISTS fraud_user_stats (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT,
  blocked INTEGER,
  cumulative_risk_score INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fraud_user_stats_seq ON fraud_user_stats(seq);
CREATE INDEX IF NOT EXISTS idx_fraud_user_stats_user_id ON fraud_user_stats(user_id);

-- Dining menu items (DatabaseState.diningMenuItems)
CREATE TABLE IF NOT EXISTS dining_menu_items (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  venue_id TEXT NOT NULL REFERENCES dining_venues(id) ON DELETE RESTRICT,
  category TEXT,
  price_egp REAL,
  available INTEGER,
  sort_order INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dining_menu_items_seq ON dining_menu_items(seq);
CREATE INDEX IF NOT EXISTS idx_dining_menu_items_venue_id ON dining_menu_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_dining_menu_items_category ON dining_menu_items(category);
CREATE INDEX IF NOT EXISTS idx_dining_menu_items_venue_id_category ON dining_menu_items(venue_id, category);

-- Dining orders (DatabaseState.diningOrders)
CREATE TABLE IF NOT EXISTS dining_orders (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  order_ref TEXT NOT NULL UNIQUE,
  venue_id TEXT NOT NULL REFERENCES dining_venues(id) ON DELETE RESTRICT,
  supplier_id TEXT,
  user_id TEXT,
  status TEXT NOT NULL,
  fulfillment TEXT NOT NULL,
  payment_method TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dining_orders_seq ON dining_orders(seq);
CREATE INDEX IF NOT EXISTS idx_dining_orders_venue_id ON dining_orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_dining_orders_supplier_id ON dining_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dining_orders_user_id ON dining_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_dining_orders_status ON dining_orders(status);
CREATE INDEX IF NOT EXISTS idx_dining_orders_fulfillment ON dining_orders(fulfillment);
CREATE INDEX IF NOT EXISTS idx_dining_orders_payment_method ON dining_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_dining_orders_created_at ON dining_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_dining_orders_venue_id_status ON dining_orders(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_dining_orders_user_id_created_at ON dining_orders(user_id, created_at);

-- Dahab parties (DatabaseState.dahabParties)
CREATE TABLE IF NOT EXISTS dahab_parties (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  category TEXT,
  zone TEXT,
  frequency TEXT,
  start_time TEXT,
  price_egp REAL,
  transport_egp REAL,
  price_usd REAL,
  is_featured INTEGER,
  license_verified INTEGER,
  booking_intent_count INTEGER,
  created_at TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_seq ON dahab_parties(seq);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_category ON dahab_parties(category);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_zone ON dahab_parties(zone);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_frequency ON dahab_parties(frequency);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_start_time ON dahab_parties(start_time);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_license_verified ON dahab_parties(license_verified);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_created_at ON dahab_parties(created_at);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_zone_category ON dahab_parties(zone, category);
CREATE INDEX IF NOT EXISTS idx_dahab_parties_license_verified_is_featured ON dahab_parties(license_verified, is_featured);

-- Dahab party booking intents (DatabaseState.dahabPartyIntents)
CREATE TABLE IF NOT EXISTS dahab_party_intents (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  party_id TEXT NOT NULL,
  target_date TEXT,
  persons INTEGER,
  language TEXT,
  user_id TEXT,
  created_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_seq ON dahab_party_intents(seq);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_party_id ON dahab_party_intents(party_id);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_target_date ON dahab_party_intents(target_date);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_language ON dahab_party_intents(language);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_user_id ON dahab_party_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_created_at ON dahab_party_intents(created_at);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_party_id_created_at ON dahab_party_intents(party_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dahab_party_intents_target_date_created_at ON dahab_party_intents(target_date, created_at);

-- Transfer hub zone prices (DatabaseState.transferZonePrices)
CREATE TABLE IF NOT EXISTS transfer_zone_prices (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  haul TEXT,
  active INTEGER,
  private_egp REAL,
  supplier_private_egp REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfer_zone_prices_seq ON transfer_zone_prices(seq);
CREATE INDEX IF NOT EXISTS idx_transfer_zone_prices_haul ON transfer_zone_prices(haul);

-- Transfer hub bus timetable (DatabaseState.transferBusSchedules)
CREATE TABLE IF NOT EXISTS transfer_bus_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  origin_id TEXT NOT NULL,
  operator_id TEXT,
  seats INTEGER,
  price_egp REAL,
  active INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfer_bus_schedules_seq ON transfer_bus_schedules(seq);
CREATE INDEX IF NOT EXISTS idx_transfer_bus_schedules_origin_id ON transfer_bus_schedules(origin_id);
CREATE INDEX IF NOT EXISTS idx_transfer_bus_schedules_operator_id ON transfer_bus_schedules(operator_id);

-- Transfer hub drivers (DatabaseState.transferDrivers)
CREATE TABLE IF NOT EXISTS transfer_drivers (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  name_en TEXT,
  active INTEGER,
  verified INTEGER,
  rating REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfer_drivers_seq ON transfer_drivers(seq);

-- Staff roles (DatabaseState.roles)
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL UNIQUE,
  is_system INTEGER,
  base_role TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roles_seq ON roles(seq);
CREATE INDEX IF NOT EXISTS idx_roles_base_role ON roles(base_role);

-- User permission overrides (DatabaseState.userPermissionOverrides)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  effect TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_seq ON user_permission_overrides(seq);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id_permission ON user_permission_overrides(user_id, permission);

-- Platform settings (DatabaseState.settings)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  version INTEGER,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settings_seq ON settings(seq);

-- Platform settings history (DatabaseState.settingsHistory)
CREATE TABLE IF NOT EXISTS settings_history (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  version INTEGER,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settings_history_seq ON settings_history(seq);
CREATE INDEX IF NOT EXISTS idx_settings_history_setting_key ON settings_history(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_history_updated_at ON settings_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_settings_history_setting_key_version ON settings_history(setting_key, version);

-- Feature flags and kill switches (DatabaseState.featureFlags)
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  enabled INTEGER,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feature_flags_seq ON feature_flags(seq);
CREATE INDEX IF NOT EXISTS idx_feature_flags_kind ON feature_flags(kind);

-- Two-person approvals (DatabaseState.approvals)
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT,
  requested_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_seq ON approvals(seq);
CREATE INDEX IF NOT EXISTS idx_approvals_action ON approvals(action);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_at ON approvals(requested_at);

-- Idempotency keys (DatabaseState.idempotencyKeys)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT,
  route TEXT,
  expires_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_seq ON idempotency_keys(seq);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id ON idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- Native device sessions (DatabaseState.deviceSessions)
CREATE TABLE IF NOT EXISTS device_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT,
  revoked_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_seq ON device_sessions(seq);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON device_sessions(user_id);

-- Refresh tokens (DatabaseState.refreshTokens)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_session_id TEXT NOT NULL,
  user_id TEXT,
  expires_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_seq ON refresh_tokens(seq);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_session_id ON refresh_tokens(device_session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Native push devices (DatabaseState.pushDevices)
CREATE TABLE IF NOT EXISTS push_devices (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  device_session_id TEXT,
  fcm_token TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_devices_seq ON push_devices(seq);
CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_device_session_id ON push_devices(device_session_id);

-- Integration configuration (DatabaseState.integrationConfigs)
CREATE TABLE IF NOT EXISTS integration_configs (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  enabled INTEGER,
  mode TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_integration_configs_seq ON integration_configs(seq);

-- Trip packages (ready-made programmes) (DatabaseState.tripPackages)
CREATE TABLE IF NOT EXISTS trip_packages (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT NOT NULL,
  supplier_id TEXT,
  seed_id TEXT,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_packages_seq ON trip_packages(seq);
CREATE INDEX IF NOT EXISTS idx_trip_packages_status ON trip_packages(status);
CREATE INDEX IF NOT EXISTS idx_trip_packages_supplier_id ON trip_packages(supplier_id);
CREATE INDEX IF NOT EXISTS idx_trip_packages_seed_id ON trip_packages(seed_id);

-- Catalogue status and version bookkeeping (DatabaseState.catalogMeta)
CREATE TABLE IF NOT EXISTS catalog_meta (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_meta_seq ON catalog_meta(seq);
CREATE INDEX IF NOT EXISTS idx_catalog_meta_type ON catalog_meta(type);
CREATE INDEX IF NOT EXISTS idx_catalog_meta_entity_id ON catalog_meta(entity_id);
CREATE INDEX IF NOT EXISTS idx_catalog_meta_status ON catalog_meta(status);

-- Store-level scalars (version, fencingSequence, lastCheckpoint)
CREATE TABLE IF NOT EXISTS store_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Rows that failed a constraint during migration. Never written by the app.
CREATE TABLE IF NOT EXISTS _quarantine (
  id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  reason TEXT NOT NULL,
  quarantined_at TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (source_table, id)
);
