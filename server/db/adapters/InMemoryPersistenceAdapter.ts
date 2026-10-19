import { IPersistenceAdapter } from './IPersistenceAdapter';
import { DatabaseState } from '../database';

export class InMemoryPersistenceAdapter implements IPersistenceAdapter {
  private state: DatabaseState;
  private isTransactionActive = false;
  private transactionBackup: string | null = null;
  private transactionDepth = 0;

  constructor(initialState?: Partial<DatabaseState>) {
    this.state = {
      version: 1,
      users: [],
      sessions: [],
      trips: [],
      tripItems: [],
      tripMembers: [],
      tripItemVotes: [],
      tripSplits: [],
      suppliers: [],
      productSkus: [],
      hotels: [],
      accommodations: [],
      propertySources: [],
      inventorySlots: [],
      holds: [],
      payments: [],
      bookings: [],
      ledgerEntries: [],
      transferTelemetry: [],
      notifications: [],
      ambientNudges: [],
      pushSubscriptions: [],
      supplierMetrics: [],
      supplierAvailabilityBlocks: [],
      payoutSchedule: [],
      reviews: [],
      supportMessages: [],
      auditEvents: [],
      opportunities: [],
      rentalListings: [],
      rentalExtras: [],
      rentalBookings: [],
      rentalMaintenanceBlocks: [],
      roomTypes: [],
      roomRateNights: [],
      hotelBookings: [],
      locks: [],
      fencingSequence: 1000,
      researchSources: [],
      temporalFacts: [],
      evidenceNodes: [],
      conflictSets: [],
      areaProfiles: [],
      places: [],
      activities: [],
      diningVenues: [],
      diningMenuItems: [],
      diningOrders: [],
      emergencyResources: [],
      regulatoryDecrees: [],
      knowledgeSnapshots: [],
      placeDiscoveries: [],
      resolutionCandidates: [],
      reefPositiveLogs: [],
      bundles: [],
      tripJournalEntries: [],
      tripPlacesVisited: [],
      fraudSignals: [],
      fraudRules: [],
      fraudUserStats: [],
      roles: [],
      userPermissionOverrides: [],
      settings: [],
      settingsHistory: [],
      featureFlags: [],
      approvals: [],
      idempotencyKeys: [],
      deviceSessions: [],
      refreshTokens: [],
      pushDevices: [],
      integrationConfigs: [],
      tripPackages: [],
      catalogMeta: [],
      lastCheckpoint: new Date().toISOString(),
      ...(initialState || {})
    };
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public async save(): Promise<void> {
    this.state.lastCheckpoint = new Date().toISOString();
  }

  public beginTransaction(): void {
    if (this.transactionDepth === 0) {
      this.isTransactionActive = true;
      this.transactionBackup = JSON.stringify(this.state);
    }
    this.transactionDepth++;
  }

  public commit(): void {
    if (this.transactionDepth === 0) {
      throw new Error('No active transaction to commit.');
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.isTransactionActive = false;
      this.transactionBackup = null;
      this.state.lastCheckpoint = new Date().toISOString();
    }
  }

  public rollback(): void {
    if (this.transactionBackup) {
      this.state = JSON.parse(this.transactionBackup);
    }
    this.isTransactionActive = false;
    this.transactionBackup = null;
    this.transactionDepth = 0;
  }

  public runInTransaction<R>(work: () => R): R {
    this.beginTransaction();
    try {
      const result = work();
      this.commit();
      return result;
    } catch (err) {
      this.rollback();
      throw err;
    }
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}
