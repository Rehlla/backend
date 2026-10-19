import crypto from 'crypto';
import { db } from '../db/database';
import type { AmbientNudgeEntity } from '../db/schema';
import { notificationService } from './notificationService';
import { weatherService } from './weatherService';
import { marineService } from './marineService';

/**
 * Ambient nudge engine (blueprint row #15).
 *
 * Proactive, context-aware suggestions pushed to travelers without them
 * asking. The engine evaluates weather, trip health, time windows, and
 * location to generate timely nudges. Runs on a 5-minute sweep interval.
 *
 * Nudge types:
 * - WEATHER_SHIFT: wind/rain/temperature change affects planned activities
 * - FREE_WINDOW: traveler has unstructured time, suggest something
 * - PREPARATION: upcoming activity needs prep (gear, timing, documents)
 * - SUPPLIER_ALERT: supplier status change (confirmed, delayed, etc.)
 * - BUDGET_TIP: spending insight or savings opportunity
 * - SAFETY: safety-relevant conditions (high wind, rough seas, etc.)
 * - DISCOVERY: nearby point of interest or flash deal
 */

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let sweepTimer: ReturnType<typeof setInterval> | null = null;

/** Cooldown: don't send the same nudge type to the same user within this window. */
const NUDGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ----- Nudge generators -----

function checkWeatherNudges(userId: string, tripId: string, conditions: { windKnots: number; windDirection: string; airTemperatureC: number; feelsLikeC: number } | null): AmbientNudgeEntity[] {
  const nudges: AmbientNudgeEntity[] = [];
  if (!conditions) return nudges;

  // High wind advisory
  if (conditions.windKnots >= 18) {
    nudges.push(createNudge({
      userId, tripId,
      nudgeType: 'SAFETY',
      title: 'High wind advisory',
      titleAr: 'تحذير من الرياح العالية',
      body: `Wind is at ${conditions.windKnots} knots from ${conditions.windDirection}. Consider sheltered activities today.`,
      bodyAr: `الرياح بسرعة ${conditions.windKnots} عقدة من ${conditions.windDirection}. فكّر في أنشطة محمية اليوم.`,
      priority: 'high',
      context: { windKnots: conditions.windKnots, windDirection: conditions.windDirection },
    }));
  }

  // Temperature shift
  if (conditions.airTemperatureC >= 38) {
    nudges.push(createNudge({
      userId, tripId,
      nudgeType: 'PREPARATION',
      title: 'Hot day ahead',
      titleAr: 'يوم حار أمامك',
      body: `It's ${conditions.airTemperatureC}°C (feels like ${conditions.feelsLikeC}°C). Bring extra water and sunscreen.`,
      bodyAr: `الحرارة ${conditions.airTemperatureC}°م (تُشعر بـ ${conditions.feelsLikeC}°م). أحضر ماء إضافي وواقي شمس.`,
      priority: 'medium',
      context: { temperatureC: conditions.airTemperatureC, feelsLikeC: conditions.feelsLikeC },
    }));
  }

  return nudges;
}

function checkMarineNudges(userId: string, tripId: string, reading: { waveHeightM: number | null; swellPeriodSeconds: number | null } | null): AmbientNudgeEntity[] {
  const nudges: AmbientNudgeEntity[] = [];
  if (!reading) return nudges;

  if (reading.waveHeightM != null && reading.waveHeightM >= 1.5) {
    nudges.push(createNudge({
      userId, tripId,
      nudgeType: 'SAFETY',
      title: 'Rough seas today',
      titleAr: 'بحر هائج اليوم',
      body: `Wave height is ${reading.waveHeightM}m. Shore dives are fine, but boat dives may be cancelled.`,
      bodyAr: `ارتفاع الأمواج ${reading.waveHeightM}م. الغوص الساحلي جيد، لكن رحلات القوارب قد تُلغى.`,
      priority: 'high',
      context: { waveHeightM: reading.waveHeightM, swellPeriod: reading.swellPeriodSeconds },
    }));
  }

  return nudges;
}

function checkFreeWindowNudges(userId: string, tripId: string): AmbientNudgeEntity[] {
  const nudges: AmbientNudgeEntity[] = [];
  const trip = db.trips.find(t => t.id === tripId);
  if (!trip) return nudges;

  // Check if there are no bookings for the current time window.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();

  const todayBookings = db.bookings.filter(
    b => b.tripId === tripId && b.scheduledDate === today && b.supplierState !== 'CANCELLED'
  );

  // If no bookings today and it's before 2pm, suggest something.
  if (todayBookings.length === 0 && currentHour < 14) {
    nudges.push(createNudge({
      userId, tripId,
      nudgeType: 'FREE_WINDOW',
      title: 'Free day — what sounds good?',
      titleAr: 'يوم فاضي — وش يعجبك؟',
      body: 'No activities scheduled today. Want me to suggest something based on your interests?',
      bodyAr: 'ما في أنشطة مجدولة اليوم. تبي أقترح شيء حسب اهتماماتك؟',
      priority: 'low',
      context: { currentHour, bookingCount: 0 },
    }));
  }

  return nudges;
}

// ----- Helpers -----

function createNudge(params: {
  userId: string;
  tripId: string;
  nudgeType: AmbientNudgeEntity['nudgeType'];
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  priority: AmbientNudgeEntity['priority'];
  context: Record<string, any>;
}): AmbientNudgeEntity {
  return {
    id: `NUDGE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    userId: params.userId,
    tripId: params.tripId,
    nudgeType: params.nudgeType,
    title: params.title,
    titleAr: params.titleAr,
    body: params.body,
    bodyAr: params.bodyAr,
    priority: params.priority,
    context: params.context,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };
}

function isInCooldown(userId: string, nudgeType: string): boolean {
  const cutoff = new Date(Date.now() - NUDGE_COOLDOWN_MS).toISOString();
  return db.ambientNudges.some(
    n => n.userId === userId && n.nudgeType === nudgeType && n.createdAt > cutoff
  );
}

// ----- Public API -----

/**
 * Evaluates context for a user+trip and generates applicable nudges.
 * Respects cooldowns: won't send the same nudge type within 1 hour.
 * Accepts pre-fetched weather/marine data to avoid redundant API calls.
 */
export async function evaluateNudges(
  userId: string,
  tripId: string,
  context?: {
    weather?: { windKnots: number; windDirection: string; airTemperatureC: number; feelsLikeC: number } | null;
    marine?: { waveHeightM: number | null; swellPeriodSeconds: number | null } | null;
  },
): Promise<AmbientNudgeEntity[]> {
  // Fetch live data if not provided.
  const weather = context?.weather ?? await weatherService.getCurrentConditions().catch(() => null);
  const marine = context?.marine ?? await marineService.getCurrentReading().catch(() => null);

  const generators: Array<() => AmbientNudgeEntity[]> = [
    () => checkWeatherNudges(userId, tripId, weather),
    () => checkMarineNudges(userId, tripId, marine),
    () => checkFreeWindowNudges(userId, tripId),
  ];

  const newNudges: AmbientNudgeEntity[] = [];
  for (const gen of generators) {
    const candidates = gen();
    for (const nudge of candidates) {
      if (!isInCooldown(userId, nudge.nudgeType)) {
        db.ambientNudges.push(nudge);
        newNudges.push(nudge);
      }
    }
  }

  return newNudges;
}

/**
 * Delivers a queued nudge: sends in-app notification + optional push.
 */
export function deliverNudge(nudgeId: string): boolean {
  const nudge = db.ambientNudges.find(n => n.id === nudgeId && n.status === 'QUEUED');
  if (!nudge) return false;

  // Send in-app notification.
  notificationService.sendNotification({
    userId: nudge.userId,
    type: 'SYSTEM',
    title: nudge.title,
    message: nudge.body,
    channel: 'IN_APP',
    metadata: { nudgeId: nudge.id, nudgeType: nudge.nudgeType, priority: nudge.priority },
  });

  nudge.status = 'DELIVERED';
  nudge.deliveredAt = new Date().toISOString();
  return true;
}

/** Marks a nudge as dismissed by the user. */
export function dismissNudge(nudgeId: string, userId: string): boolean {
  const nudge = db.ambientNudges.find(n => n.id === nudgeId && n.userId === userId);
  if (!nudge || nudge.status === 'DISMISSED') return false;
  nudge.status = 'DISMISSED';
  nudge.dismissedAt = new Date().toISOString();
  return true;
}

/** Marks a nudge as acted upon (user clicked the CTA). */
export function actOnNudge(nudgeId: string, userId: string): boolean {
  const nudge = db.ambientNudges.find(n => n.id === nudgeId && n.userId === userId);
  if (!nudge || nudge.status === 'ACTED') return false;
  nudge.status = 'ACTED';
  return true;
}

/** Returns all nudges for a user, newest first. */
export function nudgesForUser(userId: string): AmbientNudgeEntity[] {
  return db.ambientNudges
    .filter(n => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns queued (undelivered) nudges for a user. */
export function queuedNudges(userId: string): AmbientNudgeEntity[] {
  return db.ambientNudges.filter(n => n.userId === userId && n.status === 'QUEUED');
}

// ----- Sweep -----

async function sweep(): Promise<void> {
  // Evaluate nudges for all active trips.
  const activeTrips = db.trips.filter(
    t => t.status === 'CONFIRMED' || t.status === 'IN_DESTINATION'
  );

  for (const trip of activeTrips) {
    try {
      const newNudges = await evaluateNudges(trip.userId, trip.id);
      // Auto-deliver high-priority nudges.
      for (const nudge of newNudges) {
        if (nudge.priority === 'high') {
          deliverNudge(nudge.id);
        }
      }
    } catch {
      // Silently skip failed evaluations — don't crash the sweep.
    }
  }
}

export function startAmbientSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
}

export function stopAmbientSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

export const ambientNudgeService = {
  evaluateNudges,
  deliverNudge,
  dismissNudge,
  actOnNudge,
  nudgesForUser,
  queuedNudges,
  startAmbientSweep,
  stopAmbientSweep,
};
