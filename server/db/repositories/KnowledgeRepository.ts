import { BaseRepository } from './BaseRepository';
import { PlaceEntity, ActivityDetailEntity, DiningVenueEntity, TemporalFactEntity, AreaProfileEntity } from '../schema';
import { db } from '../database';

export class KnowledgeRepository {
  public async getPlaces(): Promise<PlaceEntity[]> {
    return JSON.parse(JSON.stringify(db.places));
  }

  public async getPlaceById(id: string): Promise<PlaceEntity | null> {
    const place = db.places.find(p => p.id === id);
    return place ? JSON.parse(JSON.stringify(place)) : null;
  }

  public async getActivities(): Promise<ActivityDetailEntity[]> {
    return JSON.parse(JSON.stringify(db.activities));
  }

  public async getActivityById(id: string): Promise<ActivityDetailEntity | null> {
    const act = db.activities.find(a => a.id === id);
    return act ? JSON.parse(JSON.stringify(act)) : null;
  }

  public async getDiningVenues(): Promise<DiningVenueEntity[]> {
    return JSON.parse(JSON.stringify(db.diningVenues));
  }

  public async getAreaProfiles(): Promise<AreaProfileEntity[]> {
    return JSON.parse(JSON.stringify(db.areaProfiles));
  }

  public async getTemporalFacts(): Promise<TemporalFactEntity[]> {
    return JSON.parse(JSON.stringify(db.temporalFacts));
  }
}

export const knowledgeRepository = new KnowledgeRepository();
