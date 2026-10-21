import { db } from '../db/database';
import { TripEntity, TripItemEntity } from '../db/schema';
import { groupPlanningService } from './groupPlanningService';

export class TripService {
  public getTrip(tripId: string): { trip: TripEntity | null; items: TripItemEntity[] } {
    const trip = db.trips.find(t => t.id === tripId) || null;
    const items = db.tripItems.filter(i => i.tripId === tripId);
    return { trip, items };
  }

  public getTripsForUser(userId: string): TripEntity[] {
    return db.trips.filter(t => t.userId === userId);
  }

  public createOrUpdateTrip(tripData: Partial<TripEntity> & { id: string; userId: string }): TripEntity {
    let trip = db.trips.find(t => t.id === tripData.id);
    const now = new Date().toISOString();

    db.runInTransaction(() => {
      if (trip) {
        Object.assign(trip, tripData, { updatedAt: now });
      } else {
        trip = {
          id: tripData.id,
          userId: tripData.userId,
          title: tripData.title || 'Dahab Personalized Trip',
          status: tripData.status || 'PLANNED',
          lengthDays: tripData.lengthDays || 5,
          travelersCount: tripData.travelersCount || 2,
          budget: tripData.budget || 'Moderate',
          pace: tripData.pace || 'Balanced',
          interests: tripData.interests || ['Diving', 'Adventure'],
          // These two were simply not carried, so no trip could ever be
          // created with dates — which is why every trip in the store has
          // none, and why the my-trip header shipped a hardcoded
          // "Oct 12 – 16, 2026" instead of reading them.
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          totalEstimatedEGP: tripData.totalEstimatedEGP || 0,
          totalPaidEGP: tripData.totalPaidEGP || 0,
          createdAt: now,
          updatedAt: now
        };
        db.trips.push(trip);
        // The owner is the first member with role='owner' by design
        // (groupPlanningService), but trip creation was the one path that
        // never wrote that row — so the real creator could never pass
        // isOwner, read their members list, or create splits. Seed it here,
        // idempotently, in the same transaction as the trip row.
        groupPlanningService.addMember(trip.id, tripData.userId, tripData.userId, 'owner');
      }

      db.logAudit(tripData.userId, 'User', 'TRIP_MUTATED', 'Trip', trip.id, {
        title: trip.title,
        status: trip.status
      });
    });

    return trip!;
  }
}

export const tripService = new TripService();
