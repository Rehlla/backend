import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserEntity,
  SessionEntity,
  TripEntity,
  TripItemEntity,
  TripMemberEntity,
  TripItemVoteEntity,
  TripSplitEntity,
  SupplierEntity,
  ProductSkuEntity,
  HotelEntity,
  AccommodationEntity,
  PropertySourceEntity,
  InventorySlotEntity,
  HoldEntity,
  PaymentEntity,
  BookingEntity,
  LedgerEntryEntity,
  TransferTelemetryEntity,
  TransferZonePriceEntity,
  TransferBusScheduleEntity,
  TransferDriverEntity,
  NotificationEntity,
  AmbientNudgeEntity,
  PushSubscriptionEntity,
  SupplierMetricEntity,
  SupplierAvailabilityBlockEntity,
  PayoutScheduleEntity,
  ReviewEntity,
  AnalyticsEventEntity,
  AuditEventEntity,
  PlaceDiscoveryEntity,
  EntityResolutionCandidateEntity,
  SpatialRouteCacheEntity,
  ResearchSourceEntity,
  TemporalFactEntity,
  EvidenceNodeEntity,
  ConflictSetEntity,
  AreaProfileEntity,
  PlaceEntity,
  ActivityDetailEntity,
  DiningVenueEntity,
  DiningMenuItemEntity,
  DiningOrderEntity,
  DahabPartyEntity,
  DahabPartyIntentEntity,
  EmergencyResourceEntity,
  RegulatoryDecreeEntity,
  KnowledgeSnapshotEntity,
  DistributedLockEntity,
  RawSupplierSourceEntity,
  RawOfferSourceEntity,
  SupplierOfferEntity,
  MarketPriceStatEntity,
  SocialAccountEntity,
  SourceRecordEntity,
  PriceObservationEntity,
  MarketChangeEventEntity,
  MarketSnapshotEntity,
  SourceFreshnessEntity,
  ContactHistoryEntity,
  MarketRefreshRunEntity,
  MarketReviewQueueEntity,
  SourceHealthEntity,
  RefreshSchedulePolicyEntity,
  MarketAlertEntity,
  SupportMessageEntity,
  RentalListingEntity,
  RentalExtraEntity,
  RentalBookingEntity,
  RentalMaintenanceBlockEntity,
  RoomTypeEntity,
  RoomRateNightEntity,
  HotelBookingEntity,
  SiteSettingsEntity,
  ReefPositiveLogEntity,
  BundleEntity,
  TripJournalEntryEntity,
  TripPlaceVisitedEntity,
  FraudSignalEntity,
  FraudRuleEntity,
  FraudUserStatsEntity,
  RoleEntity,
  UserPermissionOverrideEntity,
  SettingEntity,
  SettingHistoryEntity,
  FeatureFlagEntity,
  ApprovalEntity,
  IdempotencyKeyEntity,
  DeviceSessionEntity,
  RefreshTokenEntity,
  PushDeviceEntity,
  IntegrationConfigEntity,
  TripPackageEntity,
  CatalogMetaEntity
} from './schema';
import { ProductOpportunity } from '../../src/types/intelligence';
import { IPersistenceAdapter } from './adapters/IPersistenceAdapter';
import { selectAdapter } from './selectAdapter';

export interface DatabaseState {
  version: number;
  users: UserEntity[];
  sessions: SessionEntity[];
  trips: TripEntity[];
  tripItems: TripItemEntity[];
  tripMembers: TripMemberEntity[];
  tripItemVotes: TripItemVoteEntity[];
  tripSplits: TripSplitEntity[];
  suppliers: SupplierEntity[];
  productSkus: ProductSkuEntity[];
  hotels: HotelEntity[];
  accommodations: AccommodationEntity[];
  propertySources: PropertySourceEntity[];
  inventorySlots: InventorySlotEntity[];
  holds: HoldEntity[];
  payments: PaymentEntity[];
  bookings: BookingEntity[];
  ledgerEntries: LedgerEntryEntity[];
  transferTelemetry: TransferTelemetryEntity[];
  /** Future-ride zone matrix. Seeded once; operations edits persist. */
  transferZonePrices?: TransferZonePriceEntity[];
  /** Seeded intercity timetable. Operations edits persist. */
  transferBusSchedules?: TransferBusScheduleEntity[];
  /** Verified driver roster for the 12-hour assignment. */
  transferDrivers?: TransferDriverEntity[];
  notifications: NotificationEntity[];
  ambientNudges: AmbientNudgeEntity[];
  /** Web Push subscriptions, one row per browser endpoint (see schema.ts). */
  pushSubscriptions: PushSubscriptionEntity[];
  /** Supplier reliability metric events (see reliabilityService.ts). */
  supplierMetrics: SupplierMetricEntity[];
  /** Verified-stay reviews (see reviewService.ts). */
  reviews: ReviewEntity[];
  /** Supplier availability blocks (see supplierCalendarService.ts). */
  supplierAvailabilityBlocks: SupplierAvailabilityBlockEntity[];
  /** Pending 24h payout schedule (see payoutService.ts). */
  payoutSchedule: PayoutScheduleEntity[];
  analyticsEvents?: AnalyticsEventEntity[];
  supportMessages: SupportMessageEntity[];
  auditEvents: AuditEventEntity[];
  opportunities: ProductOpportunity[];
  // Distributed Concurrency & Locks
  locks?: DistributedLockEntity[];
  fencingSequence?: number;
  // Local Commerce & Provenance Engine
  rawSupplierSources?: RawSupplierSourceEntity[];
  rawOfferSources?: RawOfferSourceEntity[];
  supplierOffers?: SupplierOfferEntity[];
  marketPriceStats?: MarketPriceStatEntity[];
  socialAccounts?: SocialAccountEntity[];
  sourceRecords?: SourceRecordEntity[];
  priceObservations?: PriceObservationEntity[];
  marketChangeEvents?: MarketChangeEventEntity[];
  marketSnapshots?: MarketSnapshotEntity[];
  sourceFreshnessRecords?: SourceFreshnessEntity[];
  contactHistory?: ContactHistoryEntity[];
  marketRefreshRuns?: MarketRefreshRunEntity[];
  marketReviewQueue?: MarketReviewQueueEntity[];
  sourceHealthRecords?: SourceHealthEntity[];
  refreshSchedulePolicies?: RefreshSchedulePolicyEntity[];
  marketAlerts?: MarketAlertEntity[];
  // Site Settings
  siteSettings?: SiteSettingsEntity[];
  // Rentals (bikes MVP; category-agnostic domain)
  rentalListings?: RentalListingEntity[];
  rentalExtras?: RentalExtraEntity[];
  rentalBookings?: RentalBookingEntity[];
  rentalMaintenanceBlocks?: RentalMaintenanceBlockEntity[];
  /** Hotel booking. Non-optional on purpose: these are declared required so the
   *  compiler lists every adapter literal that has to learn about them, rather
   *  than leaving three of four adapters silently without a stay table. */
  roomTypes: RoomTypeEntity[];
  /** Sparse per-date rate/closure overrides. See RoomRateNightEntity. */
  roomRateNights: RoomRateNightEntity[];
  hotelBookings: HotelBookingEntity[];
  // DKOS Tables
  researchSources: ResearchSourceEntity[];
  temporalFacts: TemporalFactEntity[];
  evidenceNodes: EvidenceNodeEntity[];
  conflictSets: ConflictSetEntity[];
  areaProfiles: AreaProfileEntity[];
  places: PlaceEntity[];
  activities: ActivityDetailEntity[];
  diningVenues: DiningVenueEntity[];
  /** Dish-level catalogue for ordering. Non-optional on purpose: a missing
   *  default here is exactly the failure the rentals collections have (they
   *  are optional, and two of the three adapter literals never learned about
   *  them). Declaring these required makes the compiler list every place that
   *  has to learn. */
  diningMenuItems: DiningMenuItemEntity[];
  /** Placed food orders. See DiningOrderEntity for what Phase 4 still owes. */
  diningOrders: DiningOrderEntity[];
  /** Dahab parties & nightlife catalogue (seeded from data/dahab_parties.json). */
  dahabParties?: DahabPartyEntity[];
  /** Append-only WhatsApp booking-intent log for parties. */
  dahabPartyIntents?: DahabPartyIntentEntity[];
  emergencyResources: EmergencyResourceEntity[];
  regulatoryDecrees: RegulatoryDecreeEntity[];
  knowledgeSnapshots: KnowledgeSnapshotEntity[];
  placeDiscoveries: PlaceDiscoveryEntity[];
  resolutionCandidates: EntityResolutionCandidateEntity[];
  /** Reef-positive conservation logs (see reefPositiveService.ts). */
  reefPositiveLogs: ReefPositiveLogEntity[];
  /** Dynamic bundle definitions (see bundleService.ts). */
  bundles: BundleEntity[];
  /** Trip journal entries (see tripJournalService.ts). */
  tripJournalEntries: TripJournalEntryEntity[];
  /** Trip places visited (see tripJournalService.ts). */
  tripPlacesVisited: TripPlaceVisitedEntity[];
  /** Fraud detection signals (see fraudDetectionService.ts). */
  fraudSignals: FraudSignalEntity[];
  /** Fraud detection rules configuration. */
  fraudRules: FraudRuleEntity[];
  /** Per-user fraud stats aggregation. */
  fraudUserStats: FraudUserStatsEntity[];
  // Staff control plane (docs/OPS_API_CONTRACT.md). Required, so every
  // adapter literal has to learn about them.
  roles: RoleEntity[];
  userPermissionOverrides: UserPermissionOverrideEntity[];
  settings: SettingEntity[];
  settingsHistory: SettingHistoryEntity[];
  featureFlags: FeatureFlagEntity[];
  approvals: ApprovalEntity[];
  idempotencyKeys: IdempotencyKeyEntity[];
  deviceSessions: DeviceSessionEntity[];
  refreshTokens: RefreshTokenEntity[];
  pushDevices: PushDeviceEntity[];
  integrationConfigs: IntegrationConfigEntity[];
  // Catalogue surface (docs/CATALOG_API_CONTRACT.md).
  tripPackages: TripPackageEntity[];
  catalogMeta: CatalogMetaEntity[];
  lastCheckpoint: string;
}

export class Database {
  private adapter: IPersistenceAdapter;

  constructor(customAdapter?: IPersistenceAdapter) {
    this.adapter = customAdapter ?? selectAdapter();
  }

  public setAdapter(adapter: IPersistenceAdapter) {
    this.adapter = adapter;
  }

  public getAdapter(): IPersistenceAdapter {
    return this.adapter;
  }

  public get state(): DatabaseState {
    return this.adapter.getState();
  }

  public saveToDisk(customState?: DatabaseState) {
    if (customState) {
      // Overwrite local state reference if supplied
      Object.assign(this.adapter.getState(), customState);
    }
    this.adapter.save();
  }

  // -------------------------------------------------------------------------
  // Transaction Support
  // -------------------------------------------------------------------------
  public beginTransaction() {
    this.adapter.beginTransaction();
  }

  public commit() {
    this.adapter.commit();
  }

  public rollback() {
    this.adapter.rollback();
  }

  public runInTransaction<T>(work: () => T): T {
    return this.adapter.runInTransaction(work) as T;
  }

  // -------------------------------------------------------------------------
  // Getters for Tables
  // -------------------------------------------------------------------------
  public get users() { return this.state.users; }
  public get sessions() { return this.state.sessions; }
  public get trips() { return this.state.trips; }
  public get tripItems() { return this.state.tripItems; }
  public get tripMembers() {
    if (!this.state.tripMembers) this.state.tripMembers = [];
    return this.state.tripMembers;
  }
  public get tripItemVotes() {
    if (!this.state.tripItemVotes) this.state.tripItemVotes = [];
    return this.state.tripItemVotes;
  }
  public get tripSplits() {
    if (!this.state.tripSplits) this.state.tripSplits = [];
    return this.state.tripSplits;
  }
  public get suppliers() { return this.state.suppliers; }
  public get productSkus() { return this.state.productSkus; }
  public get hotels() { return this.state.hotels || (this.state.hotels = []); }
  public get accommodations() { return this.state.accommodations || (this.state.accommodations = []); }
  public get propertySources() { return this.state.propertySources || (this.state.propertySources = []); }
  public get inventorySlots() { return this.state.inventorySlots; }
  public get holds() { return this.state.holds; }
  public get payments() { return this.state.payments; }
  public get bookings() { return this.state.bookings; }
  public get ledgerEntries() { return this.state.ledgerEntries; }
  public get transferTelemetry() { return this.state.transferTelemetry; }
  public get transferZonePrices() { return this.state.transferZonePrices || (this.state.transferZonePrices = []); }
  public get transferBusSchedules() { return this.state.transferBusSchedules || (this.state.transferBusSchedules = []); }
  public get transferDrivers() { return this.state.transferDrivers || (this.state.transferDrivers = []); }
  public get notifications() { return this.state.notifications; }
  public get ambientNudges() {
    if (!this.state.ambientNudges) this.state.ambientNudges = [];
    return this.state.ambientNudges;
  }
  public get pushSubscriptions() {
    // Defaulted here as well as in the adapters, so a store written before this
    // collection existed loads without crashing on an undefined array.
    if (!this.state.pushSubscriptions) this.state.pushSubscriptions = [];
    return this.state.pushSubscriptions;
  }
  public get supplierMetrics() {
    if (!this.state.supplierMetrics) this.state.supplierMetrics = [];
    return this.state.supplierMetrics;
  }
  public get reviews() {
    if (!this.state.reviews) this.state.reviews = [];
    return this.state.reviews;
  }
  public get supplierAvailabilityBlocks() {
    if (!this.state.supplierAvailabilityBlocks) this.state.supplierAvailabilityBlocks = [];
    return this.state.supplierAvailabilityBlocks;
  }
  public get payoutSchedule() {
    if (!this.state.payoutSchedule) this.state.payoutSchedule = [];
    return this.state.payoutSchedule;
  }
  public get analyticsEvents() { return this.state.analyticsEvents || (this.state.analyticsEvents = []); }
  public get supportMessages() {
    // Defaulted here as well as in the adapters, so a store written before this
    // collection existed loads without crashing on an undefined array.
    if (!this.state.supportMessages) this.state.supportMessages = [];
    return this.state.supportMessages;
  }
  public get auditEvents() { return this.state.auditEvents; }
  public get opportunities() { return this.state.opportunities; }
  public get rawSupplierSources() { return this.state.rawSupplierSources || (this.state.rawSupplierSources = []); }
  public get rawOfferSources() { return this.state.rawOfferSources || (this.state.rawOfferSources = []); }
  public get supplierOffers() { return this.state.supplierOffers || (this.state.supplierOffers = []); }
  public get marketPriceStats() { return this.state.marketPriceStats || (this.state.marketPriceStats = []); }
  public get socialAccounts() { return this.state.socialAccounts || (this.state.socialAccounts = []); }
  public get sourceRecords() { return this.state.sourceRecords || (this.state.sourceRecords = []); }
  public get priceObservations() { return this.state.priceObservations || (this.state.priceObservations = []); }
  public get marketChangeEvents() { return this.state.marketChangeEvents || (this.state.marketChangeEvents = []); }
  public get marketSnapshots() { return this.state.marketSnapshots || (this.state.marketSnapshots = []); }
  public get sourceFreshnessRecords() { return this.state.sourceFreshnessRecords || (this.state.sourceFreshnessRecords = []); }
  public get contactHistory() { return this.state.contactHistory || (this.state.contactHistory = []); }
  public get marketRefreshRuns() { return this.state.marketRefreshRuns || (this.state.marketRefreshRuns = []); }
  public get marketReviewQueue() { return this.state.marketReviewQueue || (this.state.marketReviewQueue = []); }
  public get sourceHealthRecords() { return this.state.sourceHealthRecords || (this.state.sourceHealthRecords = []); }
  public get refreshSchedulePolicies() { return this.state.refreshSchedulePolicies || (this.state.refreshSchedulePolicies = []); }
  public get marketAlerts() { return this.state.marketAlerts || (this.state.marketAlerts = []); }
  public get researchSources() { return this.state.researchSources || (this.state.researchSources = []); }
  public get temporalFacts() { return this.state.temporalFacts || (this.state.temporalFacts = []); }
  public get evidenceNodes() { return this.state.evidenceNodes || (this.state.evidenceNodes = []); }
  public get conflictSets() { return this.state.conflictSets || (this.state.conflictSets = []); }
  public get areaProfiles() { return this.state.areaProfiles || (this.state.areaProfiles = []); }
  public get places() { return this.state.places || (this.state.places = []); }
  public get activities() { return this.state.activities || (this.state.activities = []); }
  public get diningVenues() { return this.state.diningVenues || (this.state.diningVenues = []); }
  public get diningMenuItems() { return this.state.diningMenuItems || (this.state.diningMenuItems = []); }
  public get diningOrders() { return this.state.diningOrders || (this.state.diningOrders = []); }
  public get dahabParties() { return this.state.dahabParties || (this.state.dahabParties = []); }
  public get dahabPartyIntents() { return this.state.dahabPartyIntents || (this.state.dahabPartyIntents = []); }
  public get emergencyResources() { return this.state.emergencyResources || (this.state.emergencyResources = []); }
  public get regulatoryDecrees() { return this.state.regulatoryDecrees || (this.state.regulatoryDecrees = []); }
  public get knowledgeSnapshots() { return this.state.knowledgeSnapshots || (this.state.knowledgeSnapshots = []); }
  public get placeDiscoveries() { return this.state.placeDiscoveries || (this.state.placeDiscoveries = []); }
  public get resolutionCandidates() { return this.state.resolutionCandidates || (this.state.resolutionCandidates = []); }
  public get siteSettings() { return this.state.siteSettings || (this.state.siteSettings = []); }
  public get rentalListings() { return this.state.rentalListings || (this.state.rentalListings = []); }
  public get rentalExtras() { return this.state.rentalExtras || (this.state.rentalExtras = []); }
  public get rentalBookings() { return this.state.rentalBookings || (this.state.rentalBookings = []); }
  public get rentalMaintenanceBlocks() { return this.state.rentalMaintenanceBlocks || (this.state.rentalMaintenanceBlocks = []); }
  // Defensive on read as well as in the adapter literals: a store written
  // before the hotel-booking tables existed must load without crashing, and
  // the same getter is what the backfill uses to create the first row.
  public get roomTypes() { return this.state.roomTypes || (this.state.roomTypes = []); }
  public get roomRateNights() { return this.state.roomRateNights || (this.state.roomRateNights = []); }
  public get hotelBookings() { return this.state.hotelBookings || (this.state.hotelBookings = []); }
  public get reefPositiveLogs() {
    if (!this.state.reefPositiveLogs) this.state.reefPositiveLogs = [];
    return this.state.reefPositiveLogs;
  }
  public get bundles() {
    if (!this.state.bundles) this.state.bundles = [];
    return this.state.bundles;
  }
  public get tripJournalEntries() {
    if (!this.state.tripJournalEntries) this.state.tripJournalEntries = [];
    return this.state.tripJournalEntries;
  }
  public get tripPlacesVisited() {
    if (!this.state.tripPlacesVisited) this.state.tripPlacesVisited = [];
    return this.state.tripPlacesVisited;
  }
  public get fraudSignals() {
    if (!this.state.fraudSignals) this.state.fraudSignals = [];
    return this.state.fraudSignals;
  }
  public get fraudRules() {
    if (!this.state.fraudRules) this.state.fraudRules = [];
    return this.state.fraudRules;
  }
  public get fraudUserStats() {
    if (!this.state.fraudUserStats) this.state.fraudUserStats = [];
    return this.state.fraudUserStats;
  }
  // Staff control plane. Defensive on read: a store written before these
  // collections existed must load without crashing.
  public get roles() { return this.state.roles || (this.state.roles = []); }
  public get userPermissionOverrides() { return this.state.userPermissionOverrides || (this.state.userPermissionOverrides = []); }
  public get settings() { return this.state.settings || (this.state.settings = []); }
  public get settingsHistory() { return this.state.settingsHistory || (this.state.settingsHistory = []); }
  public get featureFlags() { return this.state.featureFlags || (this.state.featureFlags = []); }
  public get approvals() { return this.state.approvals || (this.state.approvals = []); }
  public get idempotencyKeys() { return this.state.idempotencyKeys || (this.state.idempotencyKeys = []); }
  public get deviceSessions() { return this.state.deviceSessions || (this.state.deviceSessions = []); }
  public get refreshTokens() { return this.state.refreshTokens || (this.state.refreshTokens = []); }
  public get pushDevices() { return this.state.pushDevices || (this.state.pushDevices = []); }
  public get integrationConfigs() { return this.state.integrationConfigs || (this.state.integrationConfigs = []); }
  public get tripPackages() { return this.state.tripPackages || (this.state.tripPackages = []); }
  public get catalogMeta() { return this.state.catalogMeta || (this.state.catalogMeta = []); }
  public get locks() { return this.state.locks || (this.state.locks = []); }
  public get lastCheckpoint() { return this.state.lastCheckpoint; }

  public nextFencingToken(): number {
    // The SQLite adapter can do this atomically across processes; the file
    // fallback below cannot. Prefer the real one whenever it is in use.
    const adapter = this.adapter as IPersistenceAdapter & { nextFencingToken?: () => number };
    if (typeof adapter.nextFencingToken === 'function') {
      return adapter.nextFencingToken();
    }

    const seqFile = path.join(process.cwd(), 'data', 'fencing_sequence.seq');
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      let currentSeq = 1000;
      if (fs.existsSync(seqFile)) {
        const raw = fs.readFileSync(seqFile, 'utf-8').trim();
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed >= 1000) {
          currentSeq = parsed;
        }
      }
      const nextSeq = Math.max(currentSeq + 1, (this.state.fencingSequence || 1000) + 1);
      fs.writeFileSync(seqFile, nextSeq.toString(), 'utf-8');
      this.state.fencingSequence = nextSeq;
      return nextSeq;
    } catch {
      if (typeof this.state.fencingSequence !== 'number') {
        this.state.fencingSequence = 1000;
      }
      this.state.fencingSequence += 1;
      return this.state.fencingSequence;
    }
  }

  // -------------------------------------------------------------------------
  // Audit Logger
  // -------------------------------------------------------------------------
  public logAudit(actor: string, actorRole: string, action: string, entityType: string, entityId: string, payload: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const signature = crypto.createHash('sha256').update(`${actor}:${action}:${entityId}:${timestamp}`).digest('hex');
    const entry: AuditEventEntity = {
      id: `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actor,
      actorRole,
      action,
      entityType,
      entityId,
      payload,
      timestamp,
      signature
    };
    this.state.auditEvents.unshift(entry);
    this.adapter.save();
    return entry;
  }
}

// Global Singleton Instance
export const db = new Database();
