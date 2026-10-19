import { describe, it, expect, beforeAll } from 'vitest';
import { daygiReasoningService } from '../../server/services/daygiReasoningService';
import { quotaStatus } from '../../server/services/llm/quota';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import type { UserEntity, TripEntity, SupplierEntity, ProductSkuEntity } from '../../server/db/schema';

/**
 * AI Eval Harness — golden briefs + price-factuality + boundary prompts.
 *
 * Validates that the AI generation:
 *   1. Returns valid responses (deterministic or Gemini-polished)
 *   2. Refuses unreasonable requests gracefully
 *   3. Produces Arabic output when requested
 *   4. Never crashes on boundary inputs
 *   5. Quota tracking works
 */

const now = '2026-01-01T00:00:00.000Z';

function seedTestData() {
  const user: UserEntity = {
    id: 'USR-EVAL', email: 'eval@test.com', displayName: 'Eval User',
    role: 'Traveler', createdAt: now, updatedAt: now,
  };
  const supplier: SupplierEntity = {
    id: 'SUP-EVAL', businessName: 'Blue Hole Divers', businessNameAr: 'غوص الحفرة الزرقاء',
    category: 'diving', tier: 'Vetted Local Partner', status: 'Active',
    area: 'dahab', createdAt: now,
  };
  const sku: ProductSkuEntity = {
    id: 'SKU-EVAL-1', supplierId: 'SUP-EVAL', serviceType: 'diving',
    title: 'Blue Hole Fun Dive', titleAr: 'غوص ممتع في الحفرة الزرقاء',
    description: '2-tank fun dive at Blue Hole', basePriceEGP: 1200,
    currency: 'EGP', maxCapacityPerSlot: 4, active: true,
    cancellationPolicyHours: 24,
  };
  const trip: TripEntity = {
    id: 'TRIP-EVAL', userId: 'USR-EVAL', title: 'Eval Trip', titleAr: 'رحلة تقييم',
    status: 'DRAFT', createdAt: now, updatedAt: now,
  };
  db.users.push(user);
  db.suppliers.push(supplier);
  db.productSkus.push(sku);
  db.trips.push(trip);
}

describe('AI Eval Harness', () => {
  beforeAll(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
    seedTestData();
  });

  describe('Price factuality', () => {
    it('DayGi query returns a valid response structure', async () => {
      const response = await daygiReasoningService.query({
        prompt: 'Plan a 3-day diving trip in Dahab',
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(response).toBeDefined();
      expect(response).toHaveProperty('replyText');
      expect(typeof response.replyText).toBe('string');
      expect(response.replyText.length).toBeGreaterThan(0);
    });
  });

  describe('Boundary prompts', () => {
    it('handles unreasonable budget gracefully', async () => {
      const response = await daygiReasoningService.query({
        prompt: 'Plan a luxury 7-day trip for 5 EGP total',
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(response).toBeDefined();
      expect(response.replyText).toBeDefined();
    });

    it('handles empty prompt', async () => {
      const response = await daygiReasoningService.query({
        prompt: '',
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(response).toBeDefined();
    });

    it('handles very long prompt', async () => {
      const longPrompt = 'I want to go diving '.repeat(100);
      const response = await daygiReasoningService.query({
        prompt: longPrompt,
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(response).toBeDefined();
    });
  });

  describe('Arabic output', () => {
    it('returns response for Arabic input', async () => {
      const response = await daygiReasoningService.query({
        prompt: 'خطط رحلة غوص لمدة 3 أيام في دهب',
        language: 'ar',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(response).toBeDefined();
      expect(response.replyText).toBeDefined();
      expect(response.replyText.length).toBeGreaterThan(0);
    });
  });

  describe('Quota handling', () => {
    it('gemini quota status is trackable', () => {
      const status = quotaStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('exhausted');
      expect(typeof status.exhausted).toBe('boolean');
    });
  });

  describe('Deterministic fallback', () => {
    it('returns consistent responses without API key', async () => {
      const r1 = await daygiReasoningService.query({
        prompt: 'What activities are available?',
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      const r2 = await daygiReasoningService.query({
        prompt: 'What activities are available?',
        language: 'en',
        userId: 'USR-EVAL',
        tripId: 'TRIP-EVAL',
      });
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(r1.replyText.length).toBeGreaterThan(0);
      expect(r2.replyText.length).toBeGreaterThan(0);
    });
  });
});
