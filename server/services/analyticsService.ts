import { db } from '../db/database';
import { AnalyticsEventEntity } from '../db/schema';

/**
 * Server-side product analytics.
 *
 * Previously `track()` only wrote to localStorage on the client, so the
 * business never saw a single event. The client now batch-ships events to
 * POST /api/analytics/events, which lands here.
 *
 * The endpoint is intentionally public (anonymous visitors are the majority of
 * the funnel), so everything entering this module is untrusted input:
 *  - event names are validated against the whitelist below,
 *  - the payload is truncated and stripped of known PII keys before storage,
 *  - the whole batch is capped by size and count.
 */

/** Mirrors the client-side AnalyticsEventType whitelist. */
const ALLOWED_EVENT_NAMES = new Set([
  // Trip entry / planning funnel
  'trip_entry_viewed',
  'quickstart_opened',
  'first_time_selected',
  'vibe_selected',
  'ready_trip_recommended',
  'ready_trip_started',
  'ready_trip_customized',
  'ready_trip_rejected',
  'build_myself_selected',
  'ready_trip_selected',
  'ready_trip_previewed',
  'plan_it_for_me_selected',
  'planner_started',
  'planner_completed',
  'ai_plan_generated',
  'trip_created',
  'trip_entry_mode_switched',
  'entry_mode_switched',
  'trip_entry_abandoned',
  'ready_trip_compared',
  'smart_match_quiz_started',
  'smart_match_quiz_completed',
  'unpro_wizard_matched',
  // Unified Traveler Journey Lifecycle
  'arrival_started',
  'trip_started',
  'book_now_opened',
  'option_viewed',
  'booking_started',
  'booking_completed',
  'activity_completed',
  'post_activity_action',
  'food_action',
  'recovery_started',
  'recovery_completed',
  'trip_completed',
  'departure_completed',
  'next_best_action_clicked',
  // P4 booking-trust funnel: hold urgency, sold-out recovery, price clarity
  'hold_countdown_viewed',
  'hold_expired',
  'alternative_selected',
  'price_explainer_opened',
  // Dahab Intelligence Core — admin control-plane telemetry. These are
  // server-recorded (never client-ingested) so the allowlist gate keeps
  // applying; without entries here recordAnalyticsEvent() drops them.
  'intel.query',
  'intel.tool',
  'intel.deny',
  'intel.confirm',
  'intel.mutation',
  'intel.error',
]);

/** Events only the server may record (Core control-plane telemetry). */
const SERVER_ONLY_EVENT_NAMES = new Set([
  'intel.query',
  'intel.tool',
  'intel.deny',
  'intel.confirm',
  'intel.mutation',
  'intel.error',
]);

/** Keys that must never be persisted, whatever the client claims to send. The
 * set is lowercase because the incoming key is lowered before the check. */
const STRIPPED_PAYLOAD_KEYS = new Set([
  'email', 'phone', 'phonenumber', 'whatsapp', 'name', 'fullname',
  'firstname', 'lastname', 'passport', 'nationalid', 'token', 'password',
  'sessiontoken', 'authorization', 'paymentcard', 'cardnumber', 'cvv'
]);

const MAX_BATCH_SIZE = 50;
const MAX_PAYLOAD_KEYS = 32;
const MAX_STRING_LENGTH = 500;

function sanitizePayload(raw: unknown): Record<string, any> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, any> = {};
  let keys = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (keys >= MAX_PAYLOAD_KEYS) break;
    if (STRIPPED_PAYLOAD_KEYS.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 8).map(v =>
        typeof v === 'string' ? v.slice(0, MAX_STRING_LENGTH) : v
      );
    } else {
      // Nested objects are collapsed to their JSON form — deep inspection of
      // untrusted shapes is not worth the risk surface.
      try {
        out[key] = JSON.stringify(value).slice(0, MAX_STRING_LENGTH);
      } catch {
        // drop
      }
    }
    keys += 1;
  }
  return keys > 0 ? out : undefined;
}

function makeId(): string {
  return `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export interface RecordEventInput {
  eventName: string;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  payload?: unknown;
}

export function recordAnalyticsEvent(input: RecordEventInput): AnalyticsEventEntity | null {
  if (!ALLOWED_EVENT_NAMES.has(input.eventName)) return null;

  const entity: AnalyticsEventEntity = {
    id: makeId(),
    userId: input.userId || undefined,
    sessionId: input.sessionId ? String(input.sessionId).slice(0, 128) : undefined,
    eventName: input.eventName,
    timestamp: input.timestamp && !Number.isNaN(Date.parse(input.timestamp))
      ? input.timestamp
      : new Date().toISOString(),
    payload: sanitizePayload(input.payload)
  };

  db.analyticsEvents.push(entity);
  return entity;
}

/** Batch entry point for POST /api/analytics/events. Returns the count stored. */
export function recordAnalyticsBatch(
  raw: unknown,
  context: { userId?: string; sessionId?: string } = {}
): number {
  if (!Array.isArray(raw)) return 0;
  const events = raw.slice(0, MAX_BATCH_SIZE);
  let stored = 0;
  for (const evt of events) {
    if (!evt || typeof evt !== 'object') continue;
    const e = evt as Record<string, any>;
    if (typeof e.eventName !== 'string') continue;
    // Server-recorded telemetry (intel.*) must never be client-forgeable:
    // the Core writes those via recordAnalyticsEvent() directly.
    if (SERVER_ONLY_EVENT_NAMES.has(e.eventName)) continue;
    const saved = recordAnalyticsEvent({
      eventName: e.eventName,
      timestamp: typeof e.timestamp === 'string' ? e.timestamp : undefined,
      userId: context.userId || (typeof e.userId === 'string' ? e.userId : undefined),
      sessionId: context.sessionId || (typeof e.sessionId === 'string' ? e.sessionId : undefined),
      payload: e.payload ?? e.metadata
    });
    if (saved) stored += 1;
  }
  return stored;
}