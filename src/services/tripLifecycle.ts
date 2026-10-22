import { api } from './api';
import type { TripEntity } from '../shared/types/trip';

/**
 * Creating the trip a traveler is about to plan into.
 *
 * Adding an experience to "my trip" only means something once a trip exists,
 * and until now only ProgramDetailView knew how to make one. Everywhere else
 * silently assumed a trip was already there: ItineraryContext.addActivityToDay
 * wrote into an empty `tripDays` array, matched no day, dropped the activity,
 * and still reported success. Extracted here so the second and third caller
 * cannot each invent their own idea of what a new trip looks like.
 */

export interface NewTripDetails {
  title: string;
  lengthDays?: number;
  travelersCount?: number;
  budget?: TripEntity['budget'];
  pace?: TripEntity['pace'];
  interests?: string[];
  totalEstimatedEGP?: number;
  /** Days from today to the first day of the trip. */
  startsInDays?: number;
  /** Supply one to make the id meaningful; otherwise it is generated. */
  idPrefix?: string;
}

const isoDate = (date: Date): string => date.toISOString().split('T')[0];

/**
 * Creates a PLANNED trip owned by the signed-in traveler.
 *
 * PLANNED rather than DRAFT because the server only accepts items on a trip in
 * PLANNED, CONFIRMED or IN_DESTINATION — a DRAFT would be created and then
 * immediately refuse the very item that caused it to be created.
 *
 * The caller is expected to be signed in; the server takes the owner from the
 * session and rejects anonymous writes.
 */
export async function createPlanningTrip(
  details: NewTripDetails,
  signal?: AbortSignal
): Promise<TripEntity> {
  const lengthDays = details.lengthDays && details.lengthDays > 0 ? details.lengthDays : 5;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + (details.startsInDays ?? 1));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + lengthDays - 1);

  const prefix = (details.idPrefix || 'TRIP').toUpperCase().replace(/[^A-Z0-9-]/g, '');

  const { trip } = await api.saveTrip(
    {
      id: `${prefix}-${Date.now()}`,
      title: details.title,
      status: 'PLANNED',
      lengthDays,
      travelersCount: details.travelersCount && details.travelersCount > 0 ? details.travelersCount : 2,
      budget: details.budget || 'Moderate',
      pace: details.pace || 'Balanced',
      interests: details.interests || [],
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      totalEstimatedEGP: details.totalEstimatedEGP ?? 0,
      totalPaidEGP: 0
    },
    signal
  );

  return trip;
}
