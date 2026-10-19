-- ============================================================================
-- DAHAB COMMERCIAL PLATFORM & KNOWLEDGE OPERATING SYSTEM
-- CANONICAL POSTGRESQL / CLOUD SQL RELATIONAL SCHEMA (v4.0)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. USERS & IDENTITY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64),
    password_algorithm VARCHAR(32) NOT NULL DEFAULT 'scrypt',
    role VARCHAR(32) NOT NULL CHECK (role IN ('Traveler', 'Supplier', 'Operations', 'Product', 'Admin')),
    firebase_uid VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(32) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ----------------------------------------------------------------------------
-- 2. TRIPS & TIMELINES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PLANNED', 'CONFIRMED', 'IN_DESTINATION', 'COMPLETED', 'CANCELLED')),
    length_days INTEGER NOT NULL DEFAULT 3,
    travelers_count INTEGER NOT NULL DEFAULT 1,
    budget VARCHAR(32) NOT NULL DEFAULT 'Moderate',
    pace VARCHAR(32) NOT NULL DEFAULT 'Balanced',
    interests TEXT[] NOT NULL DEFAULT '{}',
    start_date DATE,
    end_date DATE,
    total_estimated_egp NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_paid_egp NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);

CREATE TABLE IF NOT EXISTS trip_items (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    service_type VARCHAR(32) NOT NULL,
    sku_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    day_number INTEGER NOT NULL,
    time_slot VARCHAR(64),
    price_egp NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUGGESTED',
    booking_id VARCHAR(64),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items(trip_id);

-- ----------------------------------------------------------------------------
-- 3. SUPPLIERS, SKUS & INVENTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    business_name_ar VARCHAR(255),
    category VARCHAR(64) NOT NULL,
    tier VARCHAR(64) NOT NULL DEFAULT 'Tier 1 Certified',
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    lead_contact VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    area VARCHAR(128) NOT NULL,
    license_number VARCHAR(128) NOT NULL,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
    review_count INTEGER NOT NULL DEFAULT 0,
    onboarded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    approved_by VARCHAR(255),
    payout_account_number VARCHAR(128),
    commission_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.150,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS product_skus (
    id VARCHAR(64) PRIMARY KEY,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    service_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    route_from VARCHAR(128),
    route_to VARCHAR(128),
    duration_minutes INTEGER,
    base_price_egp NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    max_capacity_per_slot INTEGER NOT NULL DEFAULT 10,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    included_items TEXT[] NOT NULL DEFAULT '{}',
    cancellation_policy_hours INTEGER NOT NULL DEFAULT 24
);

CREATE INDEX IF NOT EXISTS idx_skus_supplier ON product_skus(supplier_id);

CREATE TABLE IF NOT EXISTS inventory_slots (
    id VARCHAR(64) PRIMARY KEY,
    sku_id VARCHAR(64) NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    time_slot VARCHAR(64) NOT NULL,
    total_capacity INTEGER NOT NULL,
    reserved_capacity INTEGER NOT NULL DEFAULT 0,
    held_capacity INTEGER NOT NULL DEFAULT 0,
    price_egp NUMERIC(12, 2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT unq_slot UNIQUE (sku_id, slot_date, time_slot)
);

CREATE TABLE IF NOT EXISTS holds (
    id VARCHAR(64) PRIMARY KEY,
    hold_token VARCHAR(128) UNIQUE NOT NULL,
    sku_id VARCHAR(64) NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
    slot_id VARCHAR(64) REFERENCES inventory_slots(id) ON DELETE SET NULL,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    traveler_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(64) NOT NULL,
    passengers_count INTEGER NOT NULL DEFAULT 1,
    amount_egp NUMERIC(12, 2) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED')),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holds_token ON holds(hold_token);
CREATE INDEX IF NOT EXISTS idx_holds_expiry ON holds(expires_at) WHERE status = 'ACTIVE';

-- ----------------------------------------------------------------------------
-- 4. BOOKINGS, PAYMENTS & COMMERCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(64) PRIMARY KEY,
    booking_ref VARCHAR(64) UNIQUE NOT NULL,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    trip_item_id VARCHAR(64) REFERENCES trip_items(id) ON DELETE SET NULL,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    sku_id VARCHAR(64) NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
    service_type VARCHAR(64) NOT NULL,
    amount_egp NUMERIC(12, 2) NOT NULL,
    payment_state VARCHAR(32) NOT NULL DEFAULT 'CAPTURED',
    supplier_state VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    traveler_name VARCHAR(255) NOT NULL,
    traveler_phone VARCHAR(64) NOT NULL,
    traveler_email VARCHAR(255) NOT NULL,
    passengers_count INTEGER NOT NULL DEFAULT 1,
    pickup_location VARCHAR(255) NOT NULL,
    dropoff_location VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(64) NOT NULL,
    flight_number VARCHAR(64),
    special_requests TEXT,
    confirmation_code VARCHAR(64) UNIQUE NOT NULL,
    assigned_resource JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier ON bookings(supplier_id);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(128) UNIQUE NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    hold_token VARCHAR(128) REFERENCES holds(hold_token) ON DELETE SET NULL,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    booking_id VARCHAR(64) REFERENCES bookings(id) ON DELETE SET NULL,
    amount_egp NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    provider VARCHAR(32) NOT NULL,
    payment_method_type VARCHAR(32) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'INITIATED',
    auth_code VARCHAR(64),
    signature_hash VARCHAR(255) NOT NULL,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(32),
    payer_name VARCHAR(255),
    payer_email VARCHAR(255),
    payer_phone VARCHAR(64),
    webhook_events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tx ON payments(transaction_id);

-- ----------------------------------------------------------------------------
-- 5. AUDITABLE DOUBLE-ENTRY FINANCIAL LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    booking_ref VARCHAR(64) NOT NULL,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    amount_egp NUMERIC(12, 2) NOT NULL,
    debit_account VARCHAR(128) NOT NULL,
    credit_account VARCHAR(128) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'SETTLED',
    signature_hash VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ledger_booking ON ledger_entries(booking_ref);
CREATE INDEX IF NOT EXISTS idx_ledger_trip ON ledger_entries(trip_id);

-- ----------------------------------------------------------------------------
-- 6. AUDIT TRAILS & SYSTEM EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    actor VARCHAR(255) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 7. DAHAB KNOWLEDGE OPERATING SYSTEM (DKOS) ENTITIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS area_profiles (
    id VARCHAR(64) PRIMARY KEY,
    name_en VARCHAR(128) NOT NULL,
    name_ar VARCHAR(128) NOT NULL,
    character_summary_en TEXT NOT NULL,
    character_summary_ar TEXT NOT NULL,
    center_lat NUMERIC(10, 6) NOT NULL,
    center_lng NUMERIC(10, 6) NOT NULL,
    best_time_of_day VARCHAR(64),
    typical_traveler_personas TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS places (
    id VARCHAR(64) PRIMARY KEY,
    area_id VARCHAR(64) NOT NULL REFERENCES area_profiles(id) ON DELETE CASCADE,
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    description_en TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    marine_sensitivities JSONB DEFAULT '{}'::jsonb,
    nomad_perks JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS temporal_facts (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL,
    fact_type VARCHAR(64) NOT NULL,
    claim_en TEXT NOT NULL,
    claim_ar TEXT NOT NULL,
    confidence_tier VARCHAR(32) NOT NULL DEFAULT 'VERY_HIGH',
    source VARCHAR(128) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ,
    last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facts_subject ON temporal_facts(subject_id);

-- ----------------------------------------------------------------------------
-- 8. DISTRIBUTED CONCURRENCY & FENCING LEASES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distributed_locks (
    lock_key VARCHAR(255) PRIMARY KEY,
    lease_id VARCHAR(64) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    acquired_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    fencing_token BIGINT NOT NULL,
    version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires ON distributed_locks(expires_at);
