import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import { ambientNudgeService } from '../../server/services/ambientNudgeService';

/**
 * Ambient nudge engine (blueprint row #15).
 *
 * Tests weather, marine, free-window nudge generation, cooldowns,
 * delivery, dismiss/act lifecycle.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

function seedUser(id: string) {
  db.users.push({
    id, email: `${id.toLowerCase()}@test.com`, name: 'Test', role: 'Traveler',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
}

function seedTrip(tripId: string, userId: string, status: 'CONFIRMED' | 'IN_DESTINATION' = 'CONFIRMED') {
  db.trips.push({
    id: tripId, userId, title: 'Trip', status,
    lengthDays: 5, travelersCount: 2, budget: 'Moderate', pace: 'Balanced',
    interests: ['diving'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-nudge-'));
  adapter = new SqlitePersistenceAdapter(path.join(dir, 'test.sqlite'));
  db.setAdapter(adapter);
  initializeCmsSchema();

  seedUser('USR-T1');
  seedTrip('TRIP-1', 'USR-T1');
});

afterEach(() => {
  ambientNudgeService.stopAmbientSweep();
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ambientNudgeService', () => {
  describe('evaluateNudges', () => {
    it('generates SAFETY nudge on high wind', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(nudges.length).toBeGreaterThanOrEqual(1);
      const safety = nudges.find(n => n.nudgeType === 'SAFETY');
      expect(safety).toBeDefined();
      expect(safety!.priority).toBe('high');
      expect(safety!.title).toMatch(/wind/i);
    });

    it('generates PREPARATION nudge on extreme heat', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 5, windDirection: 'N', airTemperatureC: 40, feelsLikeC: 44 },
        marine: null,
      });
      const prep = nudges.find(n => n.nudgeType === 'PREPARATION');
      expect(prep).toBeDefined();
      expect(prep!.priority).toBe('medium');
    });

    it('generates SAFETY nudge on rough seas', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: null,
        marine: { waveHeightM: 2.0, swellPeriodSeconds: 8 },
      });
      const safety = nudges.find(n => n.nudgeType === 'SAFETY');
      expect(safety).toBeDefined();
      expect(safety!.title).toMatch(/sea/i);
    });

    it('generates FREE_WINDOW nudge when no bookings today', async () => {
      // The service only suggests a free window before 2pm (currentHour < 14),
      // so pin the clock to a morning hour — otherwise this test fails every
      // afternoon. Restored in the finally so the cooldown tests keep real time.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-09T10:00:00'));
      try {
        const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
          weather: { windKnots: 5, windDirection: 'N', airTemperatureC: 28, feelsLikeC: 29 },
          marine: null,
        });
        const free = nudges.find(n => n.nudgeType === 'FREE_WINDOW');
        expect(free).toBeDefined();
        expect(free!.priority).toBe('low');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not generate weather nudge when conditions are calm', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 8, windDirection: 'N', airTemperatureC: 28, feelsLikeC: 29 },
        marine: { waveHeightM: 0.5, swellPeriodSeconds: 4 },
      });
      expect(nudges.filter(n => n.nudgeType === 'SAFETY')).toHaveLength(0);
    });

    it('respects cooldown: same nudge type not sent within 1 hour', async () => {
      // First evaluation creates the nudge.
      await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      // Second evaluation within cooldown window.
      const second = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 22, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(second.filter(n => n.nudgeType === 'SAFETY')).toHaveLength(0);
    });

    it('stores nudges in the database', async () => {
      await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(db.ambientNudges.length).toBeGreaterThanOrEqual(1);
      expect(db.ambientNudges[0].userId).toBe('USR-T1');
    });
  });

  describe('deliverNudge', () => {
    it('delivers a queued nudge and creates in-app notification', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      const nudge = nudges[0];
      expect(ambientNudgeService.deliverNudge(nudge.id)).toBe(true);
      expect(nudge.status).toBe('DELIVERED');
      expect(nudge.deliveredAt).toBeDefined();

      // In-app notification was created.
      const notif = db.notifications.find(n => n.metadata?.nudgeId === nudge.id);
      expect(notif).toBeDefined();
      expect(notif!.type).toBe('SYSTEM');
    });

    it('returns false for already-delivered nudge', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      ambientNudgeService.deliverNudge(nudges[0].id);
      expect(ambientNudgeService.deliverNudge(nudges[0].id)).toBe(false);
    });

    it('returns false for unknown nudge id', () => {
      expect(ambientNudgeService.deliverNudge('NUDGE-FAKE')).toBe(false);
    });
  });

  describe('dismiss / act', () => {
    it('dismiss marks nudge as DISMISSED', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(ambientNudgeService.dismissNudge(nudges[0].id, 'USR-T1')).toBe(true);
      expect(nudges[0].status).toBe('DISMISSED');
      expect(nudges[0].dismissedAt).toBeDefined();
    });

    it('act marks nudge as ACTED', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(ambientNudgeService.actOnNudge(nudges[0].id, 'USR-T1')).toBe(true);
      expect(nudges[0].status).toBe('ACTED');
    });

    it('dismiss returns false for wrong user', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      expect(ambientNudgeService.dismissNudge(nudges[0].id, 'USR-OTHER')).toBe(false);
    });
  });

  describe('queries', () => {
    it('nudgesForUser returns newest first', async () => {
      await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      const result = ambientNudgeService.nudgesForUser('USR-T1');
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Verify sorted newest first.
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].createdAt.localeCompare(result[i].createdAt)).toBeLessThanOrEqual(0);
      }
    });

    it('queuedNudges returns only QUEUED', async () => {
      const nudges = await ambientNudgeService.evaluateNudges('USR-T1', 'TRIP-1', {
        weather: { windKnots: 20, windDirection: 'NW', airTemperatureC: 30, feelsLikeC: 32 },
        marine: null,
      });
      ambientNudgeService.deliverNudge(nudges[0].id);
      const queued = ambientNudgeService.queuedNudges('USR-T1');
      expect(queued.every(n => n.status === 'QUEUED')).toBe(true);
    });
  });
});
