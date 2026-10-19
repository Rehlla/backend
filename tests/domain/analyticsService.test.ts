import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import {
  recordAnalyticsEvent,
  recordAnalyticsBatch
} from '../../server/services/analyticsService';
import { isPublicApiPath } from '../../server/middleware/apiAccessPolicy';

describe('analytics ingestion', () => {
  beforeEach(() => {
    db.analyticsEvents.length = 0;
  });

  it('stores a whitelisted event with its payload', () => {
    const saved = recordAnalyticsEvent({
      eventName: 'trip_created',
      sessionId: 'SESS-test',
      payload: { durationDays: 3, budget: 'mid' }
    });
    expect(saved).not.toBeNull();
    expect(db.analyticsEvents).toHaveLength(1);
    expect(db.analyticsEvents[0].eventName).toBe('trip_created');
    expect(db.analyticsEvents[0].payload?.durationDays).toBe(3);
    expect(db.analyticsEvents[0].sessionId).toBe('SESS-test');
  });

  it('rejects event names outside the whitelist', () => {
    const saved = recordAnalyticsEvent({
      eventName: 'arbitrary_injected_event' as any,
      payload: { x: 1 }
    });
    expect(saved).toBeNull();
    expect(db.analyticsEvents).toHaveLength(0);
  });

  it('strips PII keys from the payload before storage', () => {
    recordAnalyticsEvent({
      eventName: 'booking_started',
      payload: {
        email: 'victim@example.com',
        phoneNumber: '+201000000000',
        cardNumber: '4242 4242 4242 4242',
        templateId: 'TPL-1'
      }
    });
    const stored = db.analyticsEvents[0];
    expect(stored.payload?.email).toBeUndefined();
    expect(stored.payload?.phoneNumber).toBeUndefined();
    expect(stored.payload?.cardNumber).toBeUndefined();
    expect(stored.payload?.templateId).toBe('TPL-1');
  });

  it('caps payload size and nested structures', () => {
    const wide: Record<string, any> = { long: 'x'.repeat(10_000), deep: { a: { b: 1 } } };
    for (let i = 0; i < 40; i++) wide[`key_${i}`] = 'v';
    recordAnalyticsEvent({
      eventName: 'trip_entry_viewed',
      payload: wide
    });
    const stored = db.analyticsEvents[0];
    expect(Object.keys(stored.payload || {}).length).toBeLessThanOrEqual(32);
    expect(String(stored.payload?.long).length).toBeLessThanOrEqual(500);
    expect(typeof stored.payload?.deep).toBe('string'); // collapsed
  });

  it('processes batches up to the cap and drops the rest', () => {
    const events = Array.from({ length: 120 }, (_, i) => ({
      eventName: 'option_viewed',
      timestamp: new Date().toISOString(),
      metadata: { index: i }
    }));
    const stored = recordAnalyticsBatch(events, { sessionId: 'SESS-batch' });
    expect(stored).toBe(50);
    expect(db.analyticsEvents).toHaveLength(50);
  });

  it('ignores malformed batch entries', () => {
    const stored = recordAnalyticsBatch([
      { eventName: 'trip_started' },
      { eventName: 'not_a_real_event' },
      'garbage',
      null,
      { eventName: 'departure_completed' }
    ]);
    expect(stored).toBe(2);
  });

  it('exposes the ingestion endpoint as public API', () => {
    expect(isPublicApiPath('/analytics/events', 'POST')).toBe(true);
    expect(isPublicApiPath('/analytics/events', 'GET')).toBe(false);
  });
});