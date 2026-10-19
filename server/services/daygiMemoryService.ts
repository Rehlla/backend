import { db } from '../db/database';
import { DayGiStructuredMemory } from '../../src/shared';

class DayGiMemoryService {
  private memoryStore: Map<string, DayGiStructuredMemory> = new Map();

  constructor() {
    // Seed initial structured memory for default traveler USR-AHMED-01
    this.memoryStore.set('USR-AHMED-01', {
      userId: 'USR-AHMED-01',
      preferences: {
        pace: 'Relaxed',
        morningPreference: 'Late_Start',
        divingLevel: 'Advanced',
        dietaryPreferences: ['Fresh Seafood', 'Bedouin Herb Tea'],
        budgetBand: 'Moderate',
        transferPreference: 'Shared',
        seafoodPreference: true,
        avoidsLongTransfers: true
      },
      learnedInsights: [
        'Prefers diving sessions after 10:00 AM for warmer water and rested mornings.',
        'Loves Habak mint tea and oceanfront cushion seating (Everyday Cafe / Ralphs).',
        'Consistently targets budget under 15,000 EGP with shared airport transfers.'
      ],
      learnedInsightsAr: [
        'يفضل الغطس بعد العاشرة صباحاً لدفء المياه وبدء اليوم براحة.',
        'يحب شاي الحبق البدوي والجلسات الشاطئية على الوسائد (إيفري داي / رالفز).',
        'يحرص على البقاء ضمن ميزانية ١٥,٠٠٠ جنيه عبر استخدام الشاتل المشترك.'
      ],
      recentIntents: ['WHAT_SHOULD_I_DO_NOW', 'RELAX_TOMORROW', 'BUDGET_OPTIMIZE'],
      updatedAt: new Date().toISOString()
    });
  }

  public getMemory(userId: string): DayGiStructuredMemory {
    const existing = this.memoryStore.get(userId);
    if (existing) {
      return existing;
    }

    // Default structure for new/first-time traveler
    const defaultMemory: DayGiStructuredMemory = {
      userId,
      preferences: {
        pace: 'Balanced',
        morningPreference: 'Late_Start',
        divingLevel: 'Open_Water',
        dietaryPreferences: ['Seafood'],
        budgetBand: 'Moderate',
        transferPreference: 'Private',
        seafoodPreference: true,
        avoidsLongTransfers: false
      },
      learnedInsights: ['First-time Dahab explorer — favors verified recommendations and seamless transfers.'],
      learnedInsightsAr: ['مستكشف جديد لدهب — يفضل الترشيحات الموثقة وخدمات النقل المريحة.'],
      recentIntents: [],
      updatedAt: new Date().toISOString()
    };

    this.memoryStore.set(userId, defaultMemory);
    return defaultMemory;
  }

  public updatePreferences(
    userId: string,
    updates: Partial<DayGiStructuredMemory['preferences']>
  ): DayGiStructuredMemory {
    const mem = this.getMemory(userId);
    mem.preferences = { ...mem.preferences, ...updates };
    mem.updatedAt = new Date().toISOString();
    this.memoryStore.set(userId, mem);

    db.logAudit(userId, 'Traveler', 'DAYGI_MEMORY_PREFERENCES_UPDATED', 'DayGiMemory', `MEM-${Date.now()}`, {
      preferences: mem.preferences
    });

    return mem;
  }

  public recordIntent(userId: string, intent: string, insightEn?: string, insightAr?: string): void {
    const mem = this.getMemory(userId);
    if (!mem.recentIntents.includes(intent)) {
      mem.recentIntents.unshift(intent);
      if (mem.recentIntents.length > 5) mem.recentIntents.pop();
    }

    if (insightEn && !mem.learnedInsights.includes(insightEn)) {
      mem.learnedInsights.unshift(insightEn);
      if (mem.learnedInsights.length > 6) mem.learnedInsights.pop();
    }

    if (insightAr && !mem.learnedInsightsAr.includes(insightAr)) {
      mem.learnedInsightsAr.unshift(insightAr);
      if (mem.learnedInsightsAr.length > 6) mem.learnedInsightsAr.pop();
    }

    mem.updatedAt = new Date().toISOString();
    this.memoryStore.set(userId, mem);
  }
}

export const daygiMemoryService = new DayGiMemoryService();
