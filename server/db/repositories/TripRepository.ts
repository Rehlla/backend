import { BaseRepository } from './BaseRepository';
import { TripEntity, TripItemEntity } from '../schema';
import { db } from '../database';

export class TripRepository extends BaseRepository<TripEntity> {
  constructor() {
    super(database => database.trips);
  }

  public async findByUserId(userId: string): Promise<TripEntity[]> {
    return this.findMany(t => t.userId === userId);
  }

  public async getTripItems(tripId: string): Promise<TripItemEntity[]> {
    const items = db.tripItems.filter(item => item.tripId === tripId);
    return JSON.parse(JSON.stringify(items));
  }

  public async addTripItem(item: TripItemEntity): Promise<TripItemEntity> {
    db.tripItems.push(item);
    db.saveToDisk();
    return JSON.parse(JSON.stringify(item));
  }

  public async updateTripItem(id: string, patch: Partial<TripItemEntity>): Promise<TripItemEntity | null> {
    const idx = db.tripItems.findIndex(i => i.id === id);
    if (idx < 0) return null;
    db.tripItems[idx] = { ...db.tripItems[idx], ...patch };
    db.saveToDisk();
    return JSON.parse(JSON.stringify(db.tripItems[idx]));
  }

  public async removeTripItem(id: string): Promise<boolean> {
    const idx = db.tripItems.findIndex(i => i.id === id);
    if (idx < 0) return false;
    db.tripItems.splice(idx, 1);
    db.saveToDisk();
    return true;
  }
}

export const tripRepository = new TripRepository();
