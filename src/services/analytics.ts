export type AnalyticsEventType =
  | 'trip_entry_viewed'
  | 'quickstart_opened'
  | 'first_time_selected'
  | 'vibe_selected'
  | 'ready_trip_recommended'
  | 'ready_trip_started'
  | 'ready_trip_customized'
  | 'ready_trip_rejected'
  | 'build_myself_selected'
  | 'ready_trip_selected'
  | 'ready_trip_previewed'
  | 'plan_it_for_me_selected'
  | 'planner_started'
  | 'planner_completed'
  | 'ai_plan_generated'
  | 'trip_created'
  | 'trip_entry_mode_switched'
  | 'entry_mode_switched'
  | 'trip_entry_abandoned'
  | 'ready_trip_compared'
  | 'smart_match_quiz_started'
  | 'smart_match_quiz_completed'
  | 'unpro_wizard_matched'
  // Unified Traveler Journey Lifecycle Events
  | 'arrival_started'
  | 'trip_started'
  | 'book_now_opened'
  | 'option_viewed'
  | 'booking_started'
  | 'booking_completed'
  | 'activity_completed'
  | 'post_activity_action'
  | 'food_action'
  | 'recovery_started'
  | 'recovery_completed'
  | 'trip_completed'
  | 'departure_completed'
  | 'next_best_action_clicked'
  // P4 booking-trust funnel: hold urgency, sold-out recovery, price clarity
  | 'hold_countdown_viewed'
  | 'hold_expired'
  | 'alternative_selected'
  | 'price_explainer_opened';

export interface AnalyticsPayload {
  eventName: AnalyticsEventType;
  timestamp: string;
  templateId?: string;
  sourceMode?: string;
  targetMode?: string;
  durationDays?: number;
  travelersCount?: number;
  budget?: string;
  pace?: string;
  interests?: string[];
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'dahab_telemetry_events';
const SESSION_KEY = 'dahab_telemetry_session';
const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_THRESHOLD = 20;

function makeSessionId(): string {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = `SESS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `SESS-${Date.now().toString(36)}`;
  }
}

/**
 * Client analytics.
 *
 * Events are written to localStorage first (durable, works offline), then
 * batch-shipped to POST /api/analytics/events. Shipping is fire-and-forget:
 * a failed request keeps the batch in the buffer for the next flush, and
 * nothing here ever blocks the UI thread or the caller.
 */
class AnalyticsService {
  private events: AnalyticsPayload[] = [];
  private readonly sessionId = makeSessionId();
  private flushing = false;

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.events = JSON.parse(saved).slice(-100); // keep last 100
      }
    } catch {
      this.events = [];
    }

    // Flush periodically while the tab is alive.
    window.setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    // Flush when the tab is backgrounded/hidden — the last reliable chance
    // before a mobile browser suspends the page.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  public track(eventName: AnalyticsEventType, data: Partial<AnalyticsPayload> = {}): void {
    const payload: AnalyticsPayload = {
      eventName,
      timestamp: new Date().toISOString(),
      ...data
    };

    this.events.push(payload);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events.slice(-100)));
    } catch {
      // storage quota or private mode ignore
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Dahab Analytics] ${eventName}`, payload);
    }

    if (this.events.length >= FLUSH_THRESHOLD) this.flush();
  }

  public getRecentEvents(): AnalyticsPayload[] {
    return [...this.events];
  }

  /** Ship the pending buffer to the server. Keeps events on failure. */
  public flush(): void {
    if (this.flushing || this.events.length === 0) return;
    const batch = this.events.splice(0);
    const body = JSON.stringify({ sessionId: this.sessionId, events: batch });

    const ship = (): void => {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // sendBeacon survives page unload where fetch does not.
        if (navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }))) {
          return;
        }
      }
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {
        // Re-queue on failure; the periodic flush will retry.
        this.events.unshift(...batch);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events.slice(-100)));
        } catch {
          // ignore
        }
      });
    };

    this.flushing = true;
    try {
      ship();
    } finally {
      this.flushing = false;
    }
  }
}

export const analytics = new AnalyticsService();