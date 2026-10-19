import { BaseRepository } from './BaseRepository';
import { LedgerEntryEntity } from '../schema';
import { db } from '../database';

export class LedgerRepository extends BaseRepository<LedgerEntryEntity> {
  constructor() {
    super(database => database.ledgerEntries);
  }

  public async findByBookingRef(bookingRef: string): Promise<LedgerEntryEntity[]> {
    return this.findMany(e => e.bookingRef === bookingRef);
  }

  public async findByTripId(tripId: string): Promise<LedgerEntryEntity[]> {
    return this.findMany(e => e.tripId === tripId);
  }

  public async getLatestEntry(): Promise<LedgerEntryEntity | null> {
    const entries = this.collection;
    if (entries.length === 0) return null;
    return JSON.parse(JSON.stringify(entries[entries.length - 1]));
  }
}

export const ledgerRepository = new LedgerRepository();
