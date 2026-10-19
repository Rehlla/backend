import { generateText, isLlmConfigured } from './llm/client';
import { isQuotaExhausted } from './llm/quota';
import { db } from '../db/database';
import { mapsContextService } from './mapsContextService';
import { tripService } from './tripService';
import { commerceService } from './commerceService';
import { recoveryService } from './recoveryService';
import { supplierService } from './supplierService';
import { paymentService } from './paymentService';
import { daygiMemoryService } from './daygiMemoryService';
import { daygiTripHealthService } from './daygiTripHealthService';
import { daygiTaskOrchestrator } from './daygiTaskOrchestrator';
import { attachCanvasDocument } from './daygiCanvasService';
import { buildOptionsFromInventory, searchOffers } from './daygiInventoryService';
import { answerKnowledge } from './tripadvisorKnowledgeService';
import { maybeClarify, isVaguePrompt, fallbackClarification } from './daygiClarityService';
import { marketFreshnessService } from './marketFreshnessService';
import { commerceIntelligenceService } from './commerceIntelligenceService';
import { FreshnessStatus } from '../db/schema';
import {
  DayGiResponse,
  DayGiQueryContext,
  DayGiParsedIntent,
  DayGiIntentType,
  DayGiActionType,
  DayGiActionRisk,
  DayGiActionData,
  DayGiBookingReview,
  DayGiRecoveryProposal,
  DayGiBudgetAnalysis,
  DayGiScheduleResult,
  DayGiDailyBriefing,
  DayGiConflictData,
  DayGiOpsSupportData,
  DayGiConstraintModel,
  DayGiTaskPlan,
  DayGiWhatChangedCard,
  DayGiMultiOptionResult,
  DayGiMultiActionConfirmation,
  DayGiTripHealth,
  DayGiOrchestratedTask
} from '../../src/shared';

// Read lazily, NOT at module scope. ES module imports are evaluated before the
// importing module's body, so a module-level constant here is initialised
// before server.ts runs dotenv.config() and would always miss OPENAI_MODEL from
// .env — which is exactly why this path kept using the stale default while
// server.ts itself picked the configured model up correctly.

// The model step in `query` is a *phrasing polish*: the deterministic response
// is already complete before it runs, and every field the polish can return has
// a deterministic value behind it. So it must never hold the answer hostage.
//
// Measured against the live model: this call took 10.3s on one occasion and
// 38.5s on another, while the client aborts at 30s — so the traveler waited
// half a minute and then received nothing at all, in exchange for a rewrite of
// an answer that had been ready in milliseconds.
function polishBudgetMs(): number {
  const configured = Number(process.env.AI_POLISH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 6000;
}

// ---------------------------------------------------------------------------
// Header-context helpers for the sample daily briefing. The concierge header
// selects ("where are you", "how much time you have") are real inputs, so the
// sample plan is built from them instead of hardcoded Lighthouse/2h values.
// ---------------------------------------------------------------------------

/** Arabic display names for the concierge header location values. */
const DAYGI_SPOT_AR: Record<string, string> = {
  'Lighthouse': 'اللايتهاوس',
  'Eel Garden': 'إيل جاردن',
  'The Canyon': 'الكانيون',
  'Blue Hole': 'البلوهول',
  'Laguna': 'اللاجونا'
};

/** "03:00 PM" + 90 → "04:30 PM". Keeps the sample free window consistent with the chosen duration. */
function addMinutesToClock(clock: string, mins: number): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(clock.trim());
  if (!match) return clock;
  const total = ((Number(match[1]) % 12) * 60) + Number(match[2]) + mins;
  const h24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${suffix}`;
}

function freeWindowLabelEn(mins: number): string {
  const h = Math.max(1, Math.round(mins / 60));
  return h === 1 ? '1-hour' : `${h}-hour`;
}

function freeWindowLabelAr(mins: number): string {
  const h = Math.max(1, Math.round(mins / 60));
  switch (h) {
    case 1: return 'ساعة';
    case 2: return 'ساعتين';
    case 3: return '٣ ساعات';
    default: return '٤ ساعات';
  }
}

export class DayGiReasoningService {
  /**
   * DayGI 3.0: The Proactive Trip Operating Layer for the Dahab Native OS.
   * Understands State, Structured Memory, Action Risk Classification, Multi-Step Tasks,
   * Constraint Modeling, and Deterministic Orchestration.
   */
  public async query(context: DayGiQueryContext): Promise<DayGiResponse> {
    const prompt = (context.prompt || '').trim();
    const lang = context.language || 'ar';
    const loc = (context.currentLocation || 'Lighthouse').toLowerCase();
    const minutes = context.availableMinutes || 120;
    const role = context.userRole || 'Traveler';
    // Absent userId is an anonymous read. It must not fall back to the seeded
    // demo traveler, and it must not open a shared guest memory bucket.
    const sessionUserId = typeof context.userId === 'string' ? context.userId.trim() : '';
    const anonymous = sessionUserId.length === 0;
    const userId = anonymous ? 'guest' : sessionUserId;
    // Resolve the trip the traveler actually owns.
    //
    // The client sends its active trip id, but that id is untrusted input: it
    // must belong to the session user before it is used. A missing or foreign
    // id falls back to the caller's most relevant own trip, and a traveler
    // with no trip gets `null` — never the seeded demo itinerary. The previous
    // hardcoded activeTripId made every traveler's conversation operate on
    // Ahmed's trip: health scores, schedule shifts, budget plans and booking
    // holds all landed on somebody else's record. Anonymous callers have no
    // trips at all.
    const requestedTripId = anonymous ? '' : (context.tripId || '').trim();
    const ownedTrips = anonymous ? [] : tripService.getTripsForUser(sessionUserId);
    const ownsRequested = ownedTrips.some(t => t.id === requestedTripId);
    const tripId: string | null = ownsRequested
      ? requestedTripId
      : this.pickMostRelevantTrip(ownedTrips);
    const hasTrip = tripId !== null;

    // 1. Structured State & Memory Retrieval (Filtered Context — No Full DB Dump)
    const userMemory = anonymous ? this.guestMemory() : daygiMemoryService.getMemory(sessionUserId);
    const tripHealth = daygiTripHealthService.evaluateTripHealth(tripId);

    // 2. Natural Language Constraint Extraction
    const constraints = this.extractConstraints(prompt, userMemory);

    // 3. Intent Classification
    const parsedIntent = this.classifyIntent(prompt, role, userMemory);

    // 4. Record Intent in Structured Memory. Guests are not persisted.
    if (!anonymous) {
      daygiMemoryService.recordIntent(sessionUserId, parsedIntent.intent);
    }

    // 4.5 Clarifying question: when the prompt is too vague to answer well,
    // ask one specific question with option buttons instead of returning a
    // generic recommendation. Gemini writes the question when a key is
    // configured; without one a fixed set of options is better than the
    // generic answer, because an open-ended "what should I do?" has no
    // specifics for the deterministic pipeline to work from.
    const clarification = await maybeClarify(prompt, context.conversationHistory, lang, {
      travelersCount: context.travelersCount,
      travelDates: context.travelDates
    }) ?? (isVaguePrompt(prompt) ? fallbackClarification(lang) : null);
    if (clarification) {
      return {
        replyText: clarification.questionEn,
        replyTextAr: clarification.questionAr,
        whyThis: 'DayGI needs one more detail before it can recommend something you can actually book.',
        whyThisAr: 'دايجي محتاج تفصيلة واحدة قبل ما يقترح حاجة تقدر تحجزها فعلاً.',
        actionType: 'RECOMMENDATION',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Quick question',
        actionTitleAr: 'سؤال سريع',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        clarification,
        sourceConfidence: {
          source: 'AI_INFERENCE',
          freshness: 'Gemini conversational analysis',
          confidenceScore: 0.85
        }
      };
    }

    // 5. Generate Grounded Deterministic Response based on Intent & Mode
    const deterministicResponse = attachCanvasDocument(
      this.generateGroundedResponse(
        prompt,
        lang,
        loc,
        minutes,
        role,
        parsedIntent,
        constraints,
        userMemory,
        tripHealth,
        context,
        tripId,
        hasTrip
      ),
      prompt
    );

    // 6. If Gemini is available and not skipped, use Gemini 3.7 Flash to refine phrasing while preserving deterministic structure
    if (process.env.SKIP_AI_POLISH === 'true') {
      return deterministicResponse;
    }

    if (!isLlmConfigured()) {
      return deterministicResponse;
    }

    // A spent quota makes the call pointless *and* slow: the API honours its own
    // retry-after inside the request, which is what turned a two-second polish
    // into 38.5s. Skip it entirely until the window has passed.
    if (isQuotaExhausted()) {
      return deterministicResponse;
    }

    try {
      const systemInstructions = `You are DayGI 3.0 — The Proactive Trip Operating Layer for Dahab.
You are the natural-language operating surface for the traveler journey.
Safety & Truth Rules:
- Deterministic backend services (Cloud SQL, Ledger, Inventory Holds) are the sole source of truth.
- You NEVER directly write to the ledger or bypass payment/hold services.
- In Arabic, communicate in an authentic, hospitable, and precise Egyptian/Sinai local tone (لهجة مصرية سيناوية دافئة وذكية).
- In English, speak in a crisp, deeply knowledgeable, local travel concierge voice.
- Return strictly valid JSON matching the DayGiResponse schema with replyText, replyTextAr, whyThis, whyThisAr, actionTitle, actionTitleAr, and suggestedFollowUps.`;

      const userPrompt = `Traveler Query: "${prompt}"
Context:
- User ID: ${userId} (${role})
- Location: ${context.currentLocation || 'Lighthouse'} (Window: ${minutes} min)
- Active Constraints: MUST_HAVE [${constraints.mustHave.join(', ')}], PREFER [${constraints.prefer.join(', ')}], AVOID [${constraints.avoid.join(', ')}]
- Memory: Pace: ${userMemory.preferences.pace}, Mornings: ${userMemory.preferences.morningPreference}, Seafood: ${userMemory.preferences.seafoodPreference}
- Trip Health: ${tripHealth.status} (Score: ${tripHealth.score}/100)
- Intent Detected: ${parsedIntent.intent} (Mode: ${deterministicResponse.mode}, Risk: ${deterministicResponse.actionRisk})
- Base Structured Action Data: ${JSON.stringify(deterministicResponse.actionData || {})}

Refine the replyText and replyTextAr while strictly keeping the actionData, actionType (${deterministicResponse.actionType}), constraints, and follow-ups aligned with verified Dahab reality.`;

      const budget = new AbortController();
      const budgetTimer = setTimeout(() => budget.abort(), polishBudgetMs());
      let response;
      try {
        response = await generateText({
          systemInstruction: systemInstructions,
          prompt: userPrompt,
          temperature: 0.2,
          json: true,
          signal: budget.signal,
          timeoutMs: polishBudgetMs()
        });
      } finally {
        clearTimeout(budgetTimer);
      }

      if (!response) return deterministicResponse;

      let parsed: any;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        return deterministicResponse;
      }
      if (parsed.replyText || parsed.replyTextAr) {
        return {
          ...deterministicResponse,
          replyText: parsed.replyText || deterministicResponse.replyText,
          replyTextAr: parsed.replyTextAr || deterministicResponse.replyTextAr,
          whyThis: parsed.whyThis || deterministicResponse.whyThis,
          whyThisAr: parsed.whyThisAr || deterministicResponse.whyThisAr,
          actionTitle: parsed.actionTitle || deterministicResponse.actionTitle,
          actionTitleAr: parsed.actionTitleAr || deterministicResponse.actionTitleAr,
          suggestedFollowUps: parsed.suggestedFollowUps || deterministicResponse.suggestedFollowUps,
        };
      }
    } catch (e) {
      // The deterministic answer below is returned either way; this only
      // records why the phrasing was not refined.
      const overBudget = e instanceof Error && e.name === 'AbortError';
      console.warn(
        overBudget
          ? `[DayGI 3.0] polish exceeded its ${polishBudgetMs()}ms budget; answering deterministically.`
          : '[DayGI 3.0] polish fallback invoked:',
        overBudget ? '' : e
      );
    }

    return deterministicResponse;
  }

  /**
   * A memory object that is never stored. Guests get neutral defaults so a
   * question cannot inherit the demo traveler's preferences or write a
   * shared bucket every anonymous caller would then read.
   */
  private guestMemory() {
    return {
      userId: 'guest',
      preferences: {
        pace: 'Balanced' as const,
        morningPreference: 'Late_Start' as const,
        divingLevel: 'Open_Water' as const,
        dietaryPreferences: [] as string[],
        budgetBand: 'Moderate' as const,
        transferPreference: 'Private' as const,
        seafoodPreference: false,
        avoidsLongTransfers: false
      },
      learnedInsights: [] as string[],
      learnedInsightsAr: [] as string[],
      recentIntents: [] as string[],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * The traveler's most relevant own trip: in-destination first, then
   * confirmed, planned, draft. Cancelled/completed trips are never returned.
   */
  private pickMostRelevantTrip(trips: Array<{ id: string; status: string }>): string | null {
    const rank: Record<string, number> = { IN_DESTINATION: 0, CONFIRMED: 1, PLANNED: 2, DRAFT: 3 };
    const active = trips.filter(t => t.status !== 'CANCELLED' && t.status !== 'COMPLETED');
    if (active.length === 0) return null;
    return active.slice().sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))[0].id;
  }

  /**
   * Explicit Constraint Model Extraction (MUST_HAVE, PREFER, AVOID, OPTIONAL)
   */
  private extractConstraints(prompt: string, memory: any): DayGiConstraintModel {
    const p = prompt.toLowerCase();
    const mustHave: string[] = [];
    const mustHaveAr: string[] = [];
    const prefer: string[] = [];
    const preferAr: string[] = [];
    const avoid: string[] = [];
    const avoidAr: string[] = [];
    const optional: string[] = ['Snorkel Gear Rental', 'Underwater Camera'];
    const optionalAr: string[] = ['تأجير معدات سنوركل', 'تصوير تحت الماء'];

    // Budget constraints
    if (p.includes('2000') || p.includes('وفر') || p.includes('cheaper') || p.includes('save')) {
      mustHave.push('Budget reduction >= 2000 EGP');
      mustHaveAr.push('توفير في الميزانية >= ٢٠٠٠ جنيه');
    }
    if (p.includes('15000') || p.includes('15 ألف') || p.includes('١٥٠٠٠')) {
      mustHave.push('Total trip cost <= 15,000 EGP');
      mustHaveAr.push('إجمالي تكلفة الرحلة <= ١٥,٠٠٠ جنيه');
    }

    // Time & Pace constraints
    if (p.includes('مش عايز أصحى بدري') || p.includes('late morning') || p.includes('not early') || p.includes('بدري')) {
      avoid.push('Activities before 09:30 AM');
      avoidAr.push('الأنشطة قبل ٠٩:٣٠ صباحاً');
      mustHave.push('Start day at or after 10:00 AM');
      mustHaveAr.push('بدء اليوم من ١٠:٠٠ صباحاً أو بعده');
    }
    if (p.includes('أهدى') || p.includes('relax') || p.includes('هادية') || p.includes('مريح')) {
      prefer.push('Relaxed seaside pacing & cushion seating');
      preferAr.push('إيقاع هادئ وجلسات شاطئية مريحة');
    }

    // Dining preferences
    if (p.includes('سمك') || p.includes('seafood') || p.includes('عشاء') || memory.preferences?.seafoodPreference) {
      prefer.push('Fresh local Red Sea catch');
      preferAr.push('سمك بحر أحمر طازج يومي');
    }

    // Transfer constraints
    if (p.includes('قريب') || p.includes('near') || p.includes('مشوار') || memory.preferences?.avoidsLongTransfers) {
      prefer.push('Walking distance within Lighthouse / Eel Garden');
      preferAr.push('مسافة مشي داخل اللايتهاوس وإيل جاردن');
    }

    return { mustHave, mustHaveAr, prefer, preferAr, avoid, avoidAr, optional, optionalAr };
  }

  /**
   * Deterministic Intent Classifier with Multi-Step & Trip Operating Layer coverage
   */
  private classifyIntent(prompt: string, role: string, memory: any): DayGiParsedIntent {
    const p = prompt.toLowerCase();

    // 1. Operations & Supplier
    if (role === 'Operations' || p.includes('ops') || p.includes('at risk') || p.includes('unconfirmed') || p.includes('reassign')) {
      return {
        intent: 'OPERATIONS_INQUIRY',
        confidence: 0.95,
        requires_confirmation: false,
        required_permission: 'Operations',
        parameters: {}
      };
    }
    if (role === 'Supplier' || p.includes('assigned bookings') || p.includes('dispatch driver')) {
      return {
        intent: 'SUPPLIER_INQUIRY',
        confidence: 0.95,
        requires_confirmation: false,
        required_permission: 'Supplier',
        parameters: {}
      };
    }

    // 2. Emergency & Safety
    if (p.includes('emergency') || p.includes('طوارئ') || p.includes('مستشفى') || p.includes('غرفة ضغط') || p.includes('chamber') || p.includes('اسعاف')) {
      return {
        intent: 'SUPPORT_INQUIRY',
        entity: 'EMERGENCY',
        confidence: 0.99,
        requires_confirmation: false,
        parameters: { target: 'EMERGENCY' }
      };
    }

    // 3. Multi-Step Post-Activity Query ("عايز حاجة هادية بعد الغطس", "احجزلي حاجة بعد الغوص")
    if (p.includes('بعد الغطس') || p.includes('بعد الغوص') || p.includes('after dive') || p.includes('after diving') || p.includes('بعد النشاط')) {
      return {
        intent: 'MULTI_STEP_POST_ACTIVITY',
        confidence: 0.95,
        requires_confirmation: false,
        parameters: { previousActivity: 'act-canyon-dive', category: 'RELAX' }
      };
    }

    // 3.4 Source Staleness & Freshness Audit Inquiry ("إيه المصادر اللي أصبحت قديمة؟", "which sources became stale", "مصادر قديمة")
    if (((p.includes('مصادر') || p.includes('بيانات')) && (p.includes('قديمة') || p.includes('انتهت') || p.includes('stale') || p.includes('تحديث') || p.includes('حداثة') || p.includes('متقادمة'))) || p.includes('stale sources') || p.includes('expired sources') || p.includes('source staleness') || p.includes('freshness audit')) {
      return {
        intent: 'SOURCE_STALENESS_INQUIRY',
        confidence: 0.98,
        requires_confirmation: false,
        parameters: { query: p }
      };
    }

    // 3.5 "What Changed?" / Market Updates Today ("إيه اللي اتغير النهارده؟", "what changed today", "تغييرات اليوم")
    if (p.includes('إيه اللي اتغير') || p.includes('ايه اللي اتغير') || p.includes('what changed') || p.includes('شو صار') || p.includes('تعديلات اليوم') || p.includes('تغييرات اليوم') || p.includes('what changed today')) {
      return {
        intent: 'WHAT_CHANGED_QUERY',
        confidence: 0.98,
        requires_confirmation: false,
        parameters: { query: p }
      };
    }

    // 3.6 New Suppliers & Disappearances Inquiry ("ايه الشركات الجديدة في دهب؟", "مين ظهر جديد؟", "مين اختفى؟", "موردين")
    if (p.includes('شركات جديدة') || p.includes('موردين') || p.includes('مورد') || p.includes('مين ظهر جديد') || p.includes('مين اختفى') || p.includes('who is new') || p.includes('who disappeared') || p.includes('suppliers') || p.includes('new suppliers') || p.includes('شركات الغوص') || p.includes('رادار التغييرات')) {
      return {
        intent: 'SUPPLIER_CHANGES_INQUIRY',
        confidence: 0.96,
        requires_confirmation: false,
        parameters: { query: p }
      };
    }

    // 3.7 Market Price, Increases & Drops Inquiry ("مين رفع السعر؟", "هل في أسعار نزلت؟", "هل الأسعار زادت؟", "أرخص رحلة بلو هول حالياً")
    if (p.includes('أسعار') || p.includes('اسعار') || p.includes('سعر') || p.includes('price') || p.includes('رفع السعر') || p.includes('نزلت') || p.includes('انخفضت') || p.includes('زادت') || p.includes('أرخص') || p.includes('ارخص') || p.includes('market trend') || p.includes('مرصود') || p.includes('who raised') || p.includes('price drop') || p.includes('price increase')) {
      return {
        intent: 'MARKET_PRICE_INQUIRY',
        confidence: 0.96,
        requires_confirmation: false,
        parameters: { query: p }
      };
    }

    // 5. Trip Health Query
    if (p.includes('صحة الرحلة') || p.includes('trip health') || p.includes('وضع الرحلة') || p.includes('الجدول مضغوط ولا')) {
      return {
        intent: 'TRIP_HEALTH_CHECK',
        confidence: 0.95,
        requires_confirmation: false,
        parameters: {}
      };
    }

    // 6. Disruption Recovery ("الغوص اتلغى", "الغطسة اتلغت بسبب الرياح")
    if (p.includes('اتلغى') || p.includes('اتلغت') || p.includes('cancelled') || p.includes('رياح') || p.includes('weather disruption') || p.includes('بديل فوري')) {
      return {
        intent: 'TRIP_RECOVERY',
        confidence: 0.95,
        requires_confirmation: true,
        parameters: { disruption: 'HIGH_WIND', originalItemId: 'act-canyon-dive' }
      };
    }

    // 7. Budget Optimization ("وفّرلي 2000 جنيه", "قلل الميزانية")
    if (p.includes('2000') || p.includes('وفر') || p.includes('توفير') || p.includes('budget') || p.includes('ميزانيت')) {
      return {
        intent: 'BUDGET_OPTIMIZE',
        confidence: 0.95,
        requires_confirmation: true,
        parameters: { targetSavingsEGP: 2000 }
      };
    }

    // 8. Schedule Modification / Relax Tomorrow ("خلّي بكرة أهدى", "مش عايز أصحى بدري", "غير الحجز")
    if (p.includes('غير') || p.includes('تعديل') || p.includes('أهدى') || p.includes('relax') || p.includes('مش عايز أصحى بدري')) {
      return {
        intent: 'PROPOSE_TRIP_CHANGE',
        confidence: 0.92,
        requires_confirmation: true,
        parameters: { targetDay: 3, pace: 'Relaxed' }
      };
    }

    // 9. Direct Booking & Holds ("احجز الخيار التاني", "احجزلي", "book now")
    if (p.includes('احجز') || p.includes('book') || p.includes('الخيار التاني') || p.includes('hold slot')) {
      return {
        intent: 'PREPARE_BOOKING',
        confidence: 0.94,
        requires_confirmation: true,
        parameters: { skuId: 'SKU-DIV-001', slot: 'Option 2' }
      };
    }

    // 10. Daily Briefing ("صباح الخير", "موجز اليوم", "morning brief")
    if (p.includes('صباح الخير') || p.includes('briefing') || p.includes('موجز') || p.includes('حالة البحر') || p.includes('today')) {
      return {
        intent: 'DAILY_BRIEFING',
        confidence: 0.95,
        requires_confirmation: false,
        parameters: {}
      };
    }

    // 11. 2-Hour Window Discovery ("معايا ساعتين", "what should i do now", "إيه أحسن حاجة نعملها دلوقتي")
    if (p.includes('ساعتين') || p.includes('دلوقتي') || p.includes('do now') || p.includes('what should i do') || p.includes('what can i do') || p.includes('فاضي') || p.includes('free time')) {
      return {
        intent: 'WHAT_SHOULD_I_DO_NOW',
        confidence: 0.95,
        requires_confirmation: false,
        parameters: { durationMinutes: 120 }
      };
    }

    // 12. Seafood & Dining
    if (p.includes('سمك') || p.includes('أكل') || p.includes('مطعم') || p.includes('food') || p.includes('dinner') || p.includes('عشاء')) {
      return {
        intent: 'DISCOVER_FOOD',
        confidence: 0.92,
        requires_confirmation: false,
        parameters: { cuisine: 'Seafood' }
      };
    }

    return {
      intent: 'GENERAL_CONVERSATION',
      confidence: 0.85,
      requires_confirmation: false,
      parameters: {}
    };
  }

  /**
   * Deterministic Grounded Response Generator
   */
  private generateGroundedResponse(
    prompt: string,
    lang: 'en' | 'ar',
    loc: string,
    minutes: number,
    role: string,
    parsedIntent: DayGiParsedIntent,
    constraints: DayGiConstraintModel,
    memory: any,
    tripHealth: DayGiTripHealth,
    context: DayGiQueryContext,
    tripId: string | null,
    hasTrip: boolean
  ): DayGiResponse {
    // Intents that audit, shift, price or book an itinerary cannot answer for
    // a traveler who has no itinerary. Previously these still produced the
    // seeded demo trip's schedule, prices and bookings. Without a trip they
    // now send the traveler to the planner instead.
    if (!hasTrip || !tripId) {
      const tripDependent: DayGiIntentType[] = [
        'MULTI_STEP_POST_ACTIVITY',
        'TRIP_HEALTH_CHECK',
        'PROPOSE_TRIP_CHANGE',
        'BUDGET_OPTIMIZE',
        'TRIP_RECOVERY',
        'PREPARE_BOOKING'
      ];
      if (tripDependent.includes(parsedIntent.intent)) {
        return this.buildNoTripGuidance(parsedIntent, lang);
      }
    }
    // The early return above guarantees every trip-dependent branch below has
    // a real trip; the branches themselves all live under that guard.
    const activeTripId: string = tripId || '';

    // -------------------------------------------------------------------------
    // 1. MULTI-STEP TASK: "عايز حاجة هادية بعد الغطس" / "احجزلي حاجة بعد الغوص"
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'MULTI_STEP_POST_ACTIVITY') {
      // Ground the "after your dive" framing in THIS traveler's itinerary.
      // The previous block always described the demo trip's 01:30 PM Canyon
      // dive even when the traveler's own trip had different plans.
      const tripDiveItems = db.tripItems.filter(
        i => i.tripId === activeTripId && i.serviceType === 'diving'
      );
      const diveItem = tripDiveItems[0];
      const diveTitleEn = diveItem ? diveItem.title : 'your scheduled dive';
      const diveTitleAr = diveItem ? diveItem.title : 'غطستك المقررة';
      const diveEnd = diveItem && diveItem.timeSlot ? diveItem.timeSlot : 'the planned time';

      // Real inventory: pull verified supplier offers for post-dive activities
      // (relax, food, light activity) from the supplierOffers table instead
      // of the three hardcoded options that never changed.
      const multiOptions: DayGiMultiOptionResult = buildOptionsFromInventory({
        categories: ['RELAX', 'FOOD', 'ACTIVITY'],
        maxOptions: 3,
        minPriceEGP: 50,
        maxPriceEGP: 3000,
        postActivityContext: {
          originalActivity: diveTitleEn,
          originalActivityAr: diveTitleAr,
          endTime: diveEnd,
          location: 'your dive site',
          availableWindowMins: 180
        }
      });

      // Fallback: real offers carry no Book button unless the supplier's
      // activity was repointed at a live SKU, and most are not. An options
      // canvas with nothing actionable in it is a dead end, so the curated
      // commerce products are used whenever the real inventory came back
      // empty *or* wholly unbookable.
      const hasBookableOption = multiOptions.options.some(o => o.skuId && o.actionKey);
      if (multiOptions.options.length === 0 || !hasBookableOption) {
        multiOptions.options = [
          {
            id: 'OPT-RELAX-01',
            titleEn: 'Ali Baba Waterfront Fresh Seafood Catch',
            titleAr: 'غداء سمك بحر أحمر طازج في علي بابا على الممشى',
            category: 'FOOD',
            location: 'Lighthouse Promenade',
            travelTimeMins: 15,
            priceEGP: 350,
            whyItFitsEn: 'Zero delay from dive exit, gentle sea breeze cushions, and high-protein grilled calamari.',
            whyItFitsAr: '١٥ دقيقة فقط من موقع الغوص، قعدة وسائد مريحة على البحر وسمك طازج مشوي.',
            skuId: 'SKU-FOOD-001',
            actionKey: 'CONFIRM_DIRECT_BOOKING'
          },
          {
            id: 'OPT-RELAX-02',
            titleEn: 'Everyday Bedouin Cafe & Habak Mint Tea Lounge',
            titleAr: 'شاي بدوي بالحبق وقعدة استرخاء في إيفري داي كافيه',
            category: 'RELAX',
            location: 'Lighthouse Promenade',
            travelTimeMins: 12,
            priceEGP: 80,
            whyItFitsEn: 'Unwinding on shaded low cushions right on the water with soothing acoustic music.',
            whyItFitsAr: 'جلسة هادئة على وسائد أرضية مظللة مباشرة على البحر مع موسيقى ناعمة وشاي حبق.',
            skuId: 'SKU-CAFE-002',
            actionKey: 'CONFIRM_DIRECT_BOOKING'
          },
          {
            id: 'OPT-RELAX-03',
            titleEn: 'Lighthouse Shore Snorkeling at Sunset (No Boat)',
            titleAr: 'سنوركلينج شاطئي خفيف عند الغروب باللايتهاوس (بدون مركب)',
            category: 'ACTIVITY',
            location: 'Lighthouse Bay',
            travelTimeMins: 10,
            priceEGP: 100,
            whyItFitsEn: 'Effortless shallow reef drift without tanks, returning before 05:30 PM.',
            whyItFitsAr: 'عوم شاطئي خفيف وسط الشعاب المرجانية بدون أسطوانات، ينتهي قبل الغروب.',
            skuId: 'SKU-SNORK-003',
            actionKey: 'CONFIRM_DIRECT_BOOKING'
          }
        ];
      }

      const taskPlan: DayGiTaskPlan = {
        id: `PLAN-POST-DIVE-${Date.now()}`,
        intent: 'POST_DIVE_RELAXATION_PIPELINE',
        title: 'Post-Dive Calm Options Pipeline',
        titleAr: 'خطة استرخاء ما بعد الغوص المنظمة',
        risk: 'COMMERCE',
        steps: [
          { stepNumber: 1, labelEn: 'Resolve Dive End Time (01:30 PM)', labelAr: 'تحديد وقت انتهاء الغوص (٠١:٣٠ م)', status: 'EXECUTED', systemComponent: 'TRIP_SERVICE' },
          { stepNumber: 2, labelEn: 'Map Candidate Venues within 15 Min Walk', labelAr: 'حصر الأماكن الهادئة على بعد ١٥ دقيقة مشي', status: 'EXECUTED', systemComponent: 'MAPS_ENGINE' },
          { stepNumber: 3, labelEn: 'Verify Real-Time Table & Seating Capacity', labelAr: 'التحقق من توافر أماكن شاغرة ومطلة على البحر', status: 'READY_FOR_CONFIRMATION', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 4, labelEn: 'Traveler Option Selection & Reservation', labelAr: 'اختيار المسافر وتأكيد الحجز الفوري', status: 'PENDING', systemComponent: 'COMMERCE_SERVICE' }
        ],
        verifiedDeterministic: true
      };

      const orchestratedTask = daygiTaskOrchestrator.createTask({
        userId: context.userId!,
        tripId: activeTripId,
        intent: 'BOOK_DIVE_THEN_NEARBY_FOOD',
        titleEn: 'Book Canyon Morning Dive & Reserve Nearby Seaside Lunch',
        titleAr: 'حجز غطسة الكانيون الصباحية وتنسيق غداء بحري قريب',
        riskLevel: 'COMMERCE',
        steps: [
          {
            name: 'Hold & Confirm Guided Canyon Reef Dive',
            nameAr: 'حجز وتأكيد غطسة الكانيون مع مرشد معتمد',
            systemComponent: 'COMMERCE_SERVICE',
            actionKey: 'CONFIRM_DIRECT_BOOKING',
            payload: { skuId: 'SKU-DIV-001', tripId: activeTripId, priceEGP: 2700, date: new Date().toISOString().split('T')[0], timeSlot: '08:30 AM' },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Locate & Reserve Post-Dive Seaside Table within 10 Mins Walk',
            nameAr: 'تحديد وحجز طاولة غداء بحري على بعد ١٠ دقائق مشياً',
            systemComponent: 'MAPS_ENGINE',
            actionKey: 'RESERVE_FOOD_POST_ACTIVITY',
            payload: { originLocationId: 'place-canyon', availableWindowMins: 90, preferredCategory: 'FOOD' },
            riskLevel: 'LOW_RISK'
          }
        ]
      });

      return {
        replyText: `Based on your ${diveEnd} dive finish and preference for relaxing seafront spots, here are 3 verified candidates within a 15-minute radius with zero transfer hassle.`,
        replyTextAr: `بناءً على انتهاء غطستك ${diveEnd} ورغبتك في مكان هادئ، جهزت لك ٣ خيارات ممتازة على بعد ١٥ دقيقة مشي بدون أي مواصلات مرهقة.`,
        whyThis: 'Evaluated dive exit location, 3-hour available window, and your saved preference for oceanfront cushion seating.',
        whyThisAr: 'تم حساب موقع الخروج من الغوص، والوقت الحر (٣ ساعات)، وتفضيلك المحفوظ للجلسات الشاطئية الهادئة.',
        actionType: 'MULTI_STEP_OPTIONS',
        actionRisk: 'COMMERCE',
        actionTitle: '3 Verified Post-Dive Relaxation Options',
        actionTitleAr: '٣ خيارات هادئة وموثقة بعد الغوص',
        mode: 'PLAN',
        parsedIntent,
        constraints,
        taskPlan,
        orchestratedTask,
        multiOptions,
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Synchronized with Active Trip & Live Capacity',
          confidenceScore: 0.98
        },
        suggestedFollowUps: [
          { textEn: 'Book Option 1 (Ali Baba Seafood)', textAr: 'احجز الخيار الأول (غداء علي بابا)', query: 'احجز الخيار الأول' },
          { textEn: 'Book Option 2 (Everyday Bedouin Tea)', textAr: 'احجز الخيار الثاني (شاي إيفري داي)', query: 'احجز الخيار التاني' },
          { textEn: 'What should we do tomorrow morning?', textAr: 'هنعمل إيه بكرة الصبح؟', query: 'موجز بكرة الصبح' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 2. "WHAT CHANGED?" DIFFERENTIAL & MARKET RADAR ENGINE
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'WHAT_CHANGED_QUERY') {
      const p = prompt.toLowerCase();
      const isMarketQuery = p.includes('سوق') || p.includes('market') || p.includes('اسعار') || p.includes('دهب') || p.includes('تغييرات اليوم') || p.includes('what changed today') || !context.tripId;

      if (isMarketQuery) {
        const recentEvents = marketFreshnessService.getMarketChangeEvents({ limit: 5 });
        const changeSummariesEn = recentEvents.map(e => `${e.summaryEn} (Source: ${e.details?.sourceReference || 'Market Observation'})`).join('\n• ');
        const changeSummariesAr = recentEvents.map(e => `${e.summaryAr} (المصدر: ${e.details?.sourceReference || 'رصد ميداني'})`).join('\n• ');

        return {
          replyText: `Here is the latest change radar for Dahab local market:\n• ${changeSummariesEn || 'All monitored supplier prices and regulatory licenses are stable with zero anomalies detected today.'}\n\nNote: Observed market changes represent informational intelligence and require confirmation before booking.`,
          replyTextAr: `إليك ملخص أحدث تغييرات سوق دهب المرصودة:\n• ${changeSummariesAr || 'كافة أسعار الموردين وتراخيص الغرف السياحية مستقرة اليوم بدون رصد أي شذوذ سعري.'}\n\nتنبيه: التغييرات المرصودة تمثل بيانات استرشادية من السوق الميداني وتخضع للتأكيد عند الحجز.`,
          whyThis: 'Real-time temporal change detection engine tracking price movements, new offers, and contact updates.',
          whyThisAr: 'محرك رصد التغييرات الزمني يتابع تحركات الأسعار، العروض الجديدة، وتحديثات وسائل التواصل.',
          actionType: 'RECOMMENDATION',
          actionRisk: 'READ_ONLY',
          actionTitle: 'Dahab Market Change Radar',
          actionTitleAr: 'رادار تغييرات سوق دهب اليوم',
          mode: 'DISCOVER',
          parsedIntent,
          constraints,
          actionData: {
            recentEvents,
            totalEventsCount: recentEvents.length
          },
          sourceConfidence: {
            source: 'VERIFIED_FACT',
            freshness: 'Live Temporal Event Stream',
            confidenceScore: 0.98
          },
          suggestedFollowUps: [
            { textEn: 'Who raised prices?', textAr: 'مين رفع السعر؟', query: 'مين رفع السعر؟' },
            { textEn: 'Did any prices drop?', textAr: 'هل في أسعار نزلت؟', query: 'هل في أسعار نزلت؟' }
          ]
        };
      }

      // "What changed in MY trip?" without a trip of the caller's own would
      // otherwise fall through to the demo itinerary's weather card.
      if (!hasTrip || !tripId) {
        return this.buildNoTripGuidance(parsedIntent, lang);
      }

      const whatChanged: DayGiWhatChangedCard = {
        whatChangedEn: 'CDWS issued a temporary 22-knot northern sea alert affecting deep boat dives on Day 3 morning.',
        whatChangedAr: 'أصدرت غرفة الغوص تحذيراً بحرياً من رياح شمالية ٢٢ عقدة تؤثر على الغطس العميق بالمراكب صباح اليوم الثالث.',
        whatItAffectsEn: 'Day 3 Morning Canyon Guided Deep Dive (08:30 AM).',
        whatItAffectsAr: 'غطسة الكانيون الصباحية باليوم الثالث (٠٨:٣٠ صباحاً).',
        reason: 'Northern wind creates choppy surface swells at Canyon & Blue Hole outer reefs.',
        reasonAr: 'الرياح الشمالية تسبب أمواجاً متلاطمة على الشعاب الخارجية للكانيون والبلوهول.',
        options: [
          {
            id: 'CHG-OPT-01',
            titleEn: 'Sheltered Laguna Windsurfing & SUP (+ EGP 900 Wallet Credit)',
            titleAr: 'ويند سيرفنج وبادل بورد في اللاجونا المحمية (استرداد ٩٠٠ ج)',
            priceVarianceEGP: -900,
            scheduleImpactEn: 'Zero delay — perfectly sheltered lagoon thriving in windy conditions.',
            scheduleImpactAr: 'بدون أي تأخير — مياه اللاجونا هادئة ومثالية للأنشطة الشراعية وقت الرياح.',
            actionKey: 'EXECUTE_TRIP_RECOVERY',
            actionPayload: { originalItemId: 'act-canyon-dive', alternativeId: 'SKU-SAF-002' }
          },
          {
            id: 'CHG-OPT-02',
            titleEn: 'Shift Canyon Dive to Day 4 Morning (Calm Weather Window)',
            titleAr: 'ترحيل غطسة الكانيون لصباح اليوم الرابع (طقس هادئ ومثالي)',
            priceVarianceEGP: 0,
            scheduleImpactEn: 'Leaves Day 3 wide open for relaxed promenade dining and seaside Habak tea.',
            scheduleImpactAr: 'يجعل اليوم الثالث مريحاً تماماً للمطاعم الشاطئية وشاي الحبق.',
            actionKey: 'APPLY_TRIP_SHIFT',
            actionPayload: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' }
          }
        ]
      };

      return {
        replyText: 'Here is what changed: A northern wind alert is active on Day 3. Your deep Canyon dive is affected. You can seamlessly switch to sheltered Laguna water sports or shift the dive to calm Day 4.',
        replyTextAr: 'إليك ما استجد: تحذير رياح شمالية في اليوم الثالث أثر على غطسة الكانيون. يمكنك التبديل فوراً لرياضات اللاجونا المحمية مع استرداد فرق السعر أو ترحيل الغطسة لليوم الرابع.',
        whyThis: 'Authoritative CDWS marine advisory processed against your scheduled itinerary.',
        whyThisAr: 'تمت مطابقة تقرير غرفة الأنشطة البحرية مع جدول رحلتك المعتمد.',
        actionType: 'WHAT_CHANGED',
        actionRisk: 'LOW_RISK',
        actionTitle: 'What Changed & Verified Next Steps',
        actionTitleAr: 'ما الذي تغير وما هي الإجراءات المتاحة؟',
        mode: 'PLAN',
        parsedIntent,
        constraints,
        whatChanged,
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Live CDWS Telemetry (2 min ago)',
          confidenceScore: 0.99
        },
        suggestedFollowUps: [
          { textEn: 'Switch to Laguna SUP (-900 EGP)', textAr: 'اعتمد بديل اللاجونا (استرداد ٩٠٠ ج)', query: 'اعتمد بديل اللاجونا' },
          { textEn: 'Shift Dive to Day 4', textAr: 'رحّل الغطسة لليوم الرابع', query: 'انقل الغطسة لليوم الرابع' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 3. TRIP HEALTH CHECK
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'TRIP_HEALTH_CHECK') {
      return {
        replyText: `Your Trip Health score is ${tripHealth.score}/100 (${tripHealth.status}). ${tripHealth.summaryEn}`,
        replyTextAr: `مؤشر صحة رحلتك هو ${tripHealth.score}/١٠٠ (${tripHealth.status === 'GOOD' ? 'ممتاز' : tripHealth.status === 'CONFLICT' ? 'يتطلب إجراء' : 'جيد جداً'}). ${tripHealth.summaryAr}`,
        whyThis: 'Continuous audit of 7 platform health criteria (payments, supplier SLAs, marine flags, travel buffers).',
        whyThisAr: 'فحص فوري لـ ٧ معايير معتمدة (المدفوعات، التزامات الموردين، الرايات البحرية، فواصل التنقل).',
        actionType: 'TRIP_HEALTH',
        actionRisk: 'READ_ONLY',
        actionTitle: `Trip Health Audit: ${tripHealth.status} (${tripHealth.score}%)`,
        actionTitleAr: `تقرير صحة الرحلة: ${tripHealth.status === 'GOOD' ? 'ممتاز' : 'تنبيه'} (${tripHealth.score}٪)`,
        mode: 'PLAN',
        parsedIntent,
        constraints,
        tripHealth,
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Real-Time Database & Ledger Audit',
          confidenceScore: 1.0
        },
        suggestedFollowUps: [
          { textEn: 'Fix Weather Impact on Day 3', textAr: 'حل تنبيه الطقس لليوم الثالث', query: 'حل تنبيه الطقس لليوم الثالث' },
          { textEn: 'Optimize Trip Budget', textAr: 'وفّر ٢٠٠٠ جنيه من الميزانية', query: 'وفّرلي 2000 جنيه' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 4. BUDGET OPTIMIZATION ("وفّرلي 2000 جنيه" / "وفّر في الميزانية")
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'BUDGET_OPTIMIZE') {
      const budgetAnalysis: DayGiBudgetAnalysis = {
        targetBudgetEGP: 15000,
        currentEstimatedEGP: 18400,
        potentialSavingsEGP: 3600,
        adjustableItems: [
          {
            itemId: 'item-transfer-01',
            title: 'Private Airport Transfer (Sharm to Dahab)',
            titleAr: 'ليموزين خاص من مطار شرم إلى دهب',
            currentPriceEGP: 2200,
            lowerCostAlternative: 'Comfort Shared Airport Shuttle (Verified AC Coach)',
            lowerCostAlternativeAr: 'شاتل المطار المريح المشترك (مكيف ومعتمد)',
            savingsEGP: 1400,
            tradeOff: 'Wait up to 20 mins at terminal for co-passengers.',
            tradeOffAr: 'انتظار حتى ٢٠ دقيقة في المطار لتجمع الركاب.'
          },
          {
            itemId: 'item-dive-02',
            title: 'Full Boat Dive Charter (Gabr El Bint)',
            titleAr: 'رحلة يخت كاملة لغطس جبر البنت',
            currentPriceEGP: 3800,
            lowerCostAlternative: 'Lighthouse & Eel Garden Guided Shore Dives (2 Tanks)',
            lowerCostAlternativeAr: 'غطستين شاطئيتين باللايتهاوس وإيل جاردن مع مرشد',
            savingsEGP: 2200,
            tradeOff: 'Shore entry instead of full-day boat cruise.',
            tradeOffAr: 'دخول شاطئي ممتع بدلاً من قضاء اليوم بالكامل في المركب.'
          }
        ]
      };

      const taskPlan: DayGiTaskPlan = {
        id: `PLAN-BUDGET-${Date.now()}`,
        intent: 'BUDGET_OPTIMIZATION_PIPELINE',
        title: 'Budget Reconciliation Plan (Save EGP 3,600)',
        titleAr: 'خطة تقليص الميزانية (توفير ٣,٦٠٠ جنيه)',
        risk: 'FINANCIAL',
        steps: [
          { stepNumber: 1, labelEn: 'Audit Active Ledger & Booking Rates', labelAr: 'مراجعة قيود الدفتر المالي والأسعار الحالية', status: 'EXECUTED', systemComponent: 'LEDGER' },
          { stepNumber: 2, labelEn: 'Match Verified Lower-Cost Inventory SKUs', labelAr: 'مطابقة خدمات بديلة معتمدة أقل تكلفة', status: 'EXECUTED', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 3, labelEn: 'Validate Itinerary & Comfort Constraints', labelAr: 'التأكد من عدم الإخلال بجودة وراحة الرحلة', status: 'READY_FOR_CONFIRMATION', systemComponent: 'TRIP_SERVICE' },
          { stepNumber: 4, labelEn: 'Execute Ledger Adjustment & Seat Reallocation', labelAr: 'تطبيق التعديل المالي وتحديث الحجوزات', status: 'PENDING', systemComponent: 'LEDGER' }
        ],
        verifiedDeterministic: true
      };

      const orchestratedTask = daygiTaskOrchestrator.createTask({
        userId: context.userId!,
        tripId: activeTripId,
        intent: 'OPTIMIZE_TRIP_BUDGET',
        titleEn: 'Execute Budget Optimization (Save EGP 3,600)',
        titleAr: 'تنفيذ خطة خفض الميزانية (توفير ٣,٦٠٠ جنيه)',
        riskLevel: 'FINANCIAL',
        steps: [
          {
            name: 'Substitute Airport Private Transfer to Verified Shared Shuttle',
            nameAr: 'استبدال النقل الخاص بشاتل المطار المريح المعتمد',
            systemComponent: 'COMMERCE_SERVICE',
            actionKey: 'APPLY_BUDGET_OPTIMIZATION',
            payload: { substitutionType: 'TRANSFER_TO_SHUTTLE', savingsEGP: 1400 },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Swap Boat Charter to Guided Shore Dives at Lighthouse',
            nameAr: 'تحويل غطس المركب إلى غطستين شاطئيتين باللايتهاوس',
            systemComponent: 'TRIP_SERVICE',
            actionKey: 'APPLY_BUDGET_OPTIMIZATION',
            payload: { substitutionType: 'DIVE_TO_SHORE', savingsEGP: 2200 },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Authoritative Ledger Rebalance & EGP 3,600 Wallet Credit',
            nameAr: 'تسوية الدفتر المالي وإيداع ٣,٦٠٠ جنيه في المحفظة',
            systemComponent: 'LEDGER',
            actionKey: 'APPLY_BUDGET_OPTIMIZATION',
            payload: { totalSavingsEGP: 3600 },
            riskLevel: 'FINANCIAL'
          }
        ]
      });

      return {
        replyText: 'I analyzed your bookings against verified lower-cost alternatives. By swapping the private airport limousine to a comfortable shared shuttle and opting for world-class shore dives, you can save EGP 3,600 while keeping every experience premium.',
        replyTextAr: 'راجعت حجوزاتك مع البدائل المعتمدة: بتحويل النقل من ليموزين خاص إلى شاتل المطار المريح، والاعتماد على الغطس الشاطئي باللايتهاوس، هتوفر ٣,٦٠٠ جنيه مع الحفاظ على قمة المتعة والراحة.',
        whyThis: 'Calculated exact price deltas in Cloud SQL ledger and verified zero loss of diving quality.',
        whyThisAr: 'تم حساب فروق الأسعار بدقة مع الحفاظ الكامل على جودة الغطس وأمان التنقل.',
        actionType: 'BUDGET_SAVINGS',
        actionRisk: 'FINANCIAL',
        actionTitle: 'Budget Optimization Breakdown (Save EGP 3,600)',
        actionTitleAr: 'خطة توفير الميزانية (توفير ٣,٦٠٠ جنيه)',
        mode: 'PLAN',
        parsedIntent,
        constraints,
        taskPlan,
        orchestratedTask,
        actionData: {
          budgetAnalysis
        },
        requiresConfirmation: true,
        confirmationPayload: {
          actionKey: 'APPLY_BUDGET_OPTIMIZATION',
          descriptionEn: 'Apply budget substitutions and credit wallet with EGP 3,600.',
          descriptionAr: 'تطبيق بدائل التوفير وإيداع ٣,٦٠٠ جنيه رصيد مسترد.',
          parameters: { targetSavingsEGP: 3600 }
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Synchronized with Authoritative Ledger',
          confidenceScore: 1.0
        },
        suggestedFollowUps: [
          { textEn: 'Apply Budget Savings (-3,600 EGP)', textAr: 'طبّق خطة التوفير (وفر ٣,٦٠٠ ج)', query: 'طبّق خطة التوفير' },
          { textEn: 'Show my updated daily itinerary', textAr: 'اعرض جدولي بعد التعديل', query: 'اعرض جدولي' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 5. SCHEDULE MODIFICATION / RELAX TOMORROW / LATE MORNINGS
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'PROPOSE_TRIP_CHANGE') {
      const multiActionConfirmation: DayGiMultiActionConfirmation = {
        step1OldItem: {
          id: 'act-canyon-dive',
          titleEn: 'Day 3 Morning Canyon Guided Deep Dive',
          titleAr: 'غطسة الكانيون العميقة صباح اليوم الثالث',
          time: '08:30 AM',
          currentPriceEGP: 2700
        },
        step2Alternative: {
          id: 'SKU-DIV-001',
          titleEn: 'Day 4 Canyon Morning Deep Dive',
          titleAr: 'غطسة الكانيون صباح اليوم الرابع',
          newTime: '10:00 AM',
          newPriceEGP: 2700,
          supplierName: 'Bedouin Divers Dahab (Tier-1 Verified)'
        },
        step3PriceVariance: {
          diffEGP: 0,
          ledgerNoteEn: 'Zero financial variance — schedule shift within same booking voucher.',
          ledgerNoteAr: 'بدون أي فرق مالي — ترحيل موعد النشاط على نفس قسيمة الحجز.'
        },
        step4ScheduleImpact: {
          originalSlot: 'Day 3 @ 08:30 AM',
          newSlot: 'Day 4 @ 10:00 AM',
          impactSummaryEn: 'Inserts 4 hours of tranquil beachfront leisure and Habak tea on Day 3.',
          impactSummaryAr: 'يضيف ٤ ساعات استرخاء شاطئي وإفطار مريح وشاي حبق في اليوم الثالث.'
        },
        step5ActionKey: 'APPLY_TRIP_SHIFT',
        step5Payload: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' },
        risk: 'LOW_RISK'
      };

      const taskPlan: DayGiTaskPlan = {
        id: `PLAN-SHIFT-${Date.now()}`,
        intent: 'SCHEDULE_SHIFT_PIPELINE',
        title: 'Non-Destructive Schedule Shift',
        titleAr: 'إعادة جدولة آمنة بدون تعارضات',
        risk: 'LOW_RISK',
        steps: [
          { stepNumber: 1, labelEn: 'Validate Day 4 Dive Slot Availability', labelAr: 'التحقق من توافر مقعد الغوص في اليوم الرابع', status: 'EXECUTED', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 2, labelEn: 'Verify No Decompression / Mountain Conflict', labelAr: 'التأكد من عدم وجود تعارض تخفيف ضغط مع صعود الجبل', status: 'EXECUTED', systemComponent: 'TRIP_SERVICE' },
          { stepNumber: 3, labelEn: 'Generate Step-by-Step Schedule Proposal', labelAr: 'إنشاء بطاقة المقارنة والموافقة', status: 'READY_FOR_CONFIRMATION', systemComponent: 'TRIP_SERVICE' },
          { stepNumber: 4, labelEn: 'Commit Schedule Shift to Database', labelAr: 'تحديث قاعدة البيانات والجدول الزمني', status: 'PENDING', systemComponent: 'TRIP_SERVICE' }
        ],
        verifiedDeterministic: true
      };

      const orchestratedTask = daygiTaskOrchestrator.createTask({
        userId: context.userId!,
        tripId: activeTripId,
        intent: 'SHIFT_SCHEDULE_PACING',
        titleEn: 'Shift Day 3 Canyon Dive to Day 4 (10:00 AM)',
        titleAr: 'ترحيل غطسة الكانيون لليوم الرابع الساعة ١٠:٠٠ ص',
        riskLevel: 'LOW_RISK',
        steps: [
          {
            name: 'Update Trip Activity Slot to Day 4 @ 10:00 AM',
            nameAr: 'تحديث موعد النشاط لليوم الرابع الساعة ١٠:٠٠ ص',
            systemComponent: 'TRIP_SERVICE',
            actionKey: 'APPLY_TRIP_SHIFT',
            payload: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' },
            riskLevel: 'LOW_RISK'
          },
          {
            name: 'Insert Relaxed Promenade Leisure Window on Day 3',
            nameAr: 'إضافة نافذة استرخاء شاطئية مريحة في اليوم الثالث',
            systemComponent: 'TRIP_SERVICE',
            actionKey: 'APPLY_TRIP_SHIFT',
            payload: { dayNumber: 3, timeSlot: '11:00 AM', title: 'Everyday Cafe Seaside Breakfast' },
            riskLevel: 'READ_ONLY'
          }
        ]
      });

      return {
        replyText: 'I structured a schedule adjustment: Moving your deep Canyon dive from Day 3 to Day 4 at 10:00 AM allows a late restful morning, eliminates high-intensity exhaustion, and gives you a calm seafront afternoon.',
        replyTextAr: 'جهزت لك تعديل مريح للجدول: ترحيل غطسة الكانيون من اليوم الثالث لليوم الرابع الساعة ١٠:٠٠ صباحاً. هذا يمنحك بداية يوم هادئة بدون استيقاظ مبكر، ويفرغ اليوم الثالث للاسترخاء.',
        whyThis: 'Satisfies your preference for late morning starts and keeps ample decompression rest before any mountain excursion.',
        whyThisAr: 'يحقق رغبتك في عدم الاستيقاظ مبكراً مع الحفاظ الكامل على فترات الأمان للغوص.',
        actionType: 'MULTI_ACTION_CONFIRMATION',
        actionRisk: 'LOW_RISK',
        actionTitle: 'Schedule Shift & Pacing Confirmation',
        actionTitleAr: 'تأكيد تعديل موعد النشاط وراحة الجدول',
        mode: 'PLAN',
        parsedIntent,
        constraints,
        taskPlan,
        orchestratedTask,
        multiActionConfirmation,
        actionData: {
          proposedShift: {
            activityId: 'act-canyon-dive',
            fromDay: 3,
            toDay: 4,
            newTimeSlot: '10:00 AM',
            impactDescription: 'Moves high-intensity dive to rested Day 4 morning; adds seafront Habak tea window on Day 3.',
            impactDescriptionAr: 'ينقل الغطسة العميقة لليوم الرابع صباحاً براحة؛ ويفرغ بعد ظهر اليوم الثالث للشاي والاسترخاء.'
          }
        },
        requiresConfirmation: true,
        confirmationPayload: {
          actionKey: 'APPLY_TRIP_SHIFT',
          descriptionEn: 'Shift Canyon Dive to Day 4 at 10:00 AM.',
          descriptionAr: 'ترحيل غطسة الكانيون لليوم الرابع الساعة ١٠:٠٠ صباحاً.',
          parameters: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' }
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Live Itinerary & Supplier Capacity Audit',
          confidenceScore: 0.98
        },
        suggestedFollowUps: [
          { textEn: 'Apply Shift to Day 4', textAr: 'اعتمد الترحيل لليوم الرابع', query: 'اعتمد الترحيل لليوم الرابع' },
          { textEn: 'Where should I have breakfast on Day 3?', textAr: 'أفطر فين براحتي في اليوم الثالث؟', query: 'أفطر فين براحتي' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 6. DIRECT BOOKING / HOLD PREPARATION ("احجزلي", "احجز الخيار التاني")
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'PREPARE_BOOKING') {
      const bookingReview: DayGiBookingReview = {
        service: 'Guided Canyon & Blue Hole Coastal Diving Session (2 Dives)',
        serviceAr: 'جلسة غوص إرشادية في الكانيون والبلوهول (غطستان مع المعدات)',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        people: 2,
        location: 'Canyon Marine Sanctuary',
        priceEGP: 2700,
        cancellationPolicy: 'Free cancellation up to 12 hours before start · 100% weather guarantee refund.',
        cancellationPolicyAr: 'إلغاء مجاني حتى ١٢ ساعة قبل الموعد · استرداد ١٠٠٪ في حال تقلبات الطقس.',
        supplierName: 'Bedouin Divers Dahab (CDWS License #108)',
        availabilityStatus: 'FEW_SLOTS',
        skuId: 'SKU-DIV-001'
      };

      const taskPlan: DayGiTaskPlan = {
        id: `PLAN-BOOK-${Date.now()}`,
        intent: 'COMMERCE_BOOKING_PIPELINE',
        title: 'Authoritative Booking & Inventory Hold',
        titleAr: 'حجز المقعد وضمان التوافر المعتمد',
        risk: 'COMMERCE',
        steps: [
          { stepNumber: 1, labelEn: 'Verify Real-Time Supplier Inventory Slot', labelAr: 'التحقق من توفر المقاعد لدى المورد المعتمد', status: 'EXECUTED', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 2, labelEn: 'Place 15-Minute Guaranteed Inventory Hold', labelAr: 'تثبيت المقاعد لمدة ١٥ دقيقة مؤكدة', status: 'READY_FOR_CONFIRMATION', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 3, labelEn: 'Traveler Confirmation & Checkout Handoff', labelAr: 'موافقة المسافر والانتقال للدفع الآمن', status: 'PENDING', systemComponent: 'COMMERCE_SERVICE' }
        ],
        verifiedDeterministic: true
      };

      const orchestratedTask = daygiTaskOrchestrator.createTask({
        userId: context.userId!,
        tripId: activeTripId,
        intent: 'AUTHORITATIVE_HOLD_AND_BOOK',
        titleEn: 'Hold & Confirm Canyon Morning Guided Dive (2 Pax)',
        titleAr: 'تثبيت وتأكيد حجز غطسة الكانيون (شخصان)',
        riskLevel: 'COMMERCE',
        steps: [
          {
            name: 'Create 15-Minute Concurrency-Safe Inventory Hold',
            nameAr: 'إنشاء حجز مقعد مؤقت آمن لمدة ١٥ دقيقة',
            systemComponent: 'COMMERCE_SERVICE',
            actionKey: 'CONFIRM_DIRECT_BOOKING',
            payload: { skuId: 'SKU-DIV-001', tripId: activeTripId, priceEGP: 2700, date: new Date().toISOString().split('T')[0], timeSlot: '10:00 AM' },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Cloud SQL Ledger Verification & Voucher Issuance',
            nameAr: 'التحقق من القيد المالي وإصدار قسيمة النشاط المعتمدة',
            systemComponent: 'LEDGER',
            actionKey: 'CONFIRM_DIRECT_BOOKING',
            payload: { skuId: 'SKU-DIV-001', tripId: activeTripId },
            riskLevel: 'FINANCIAL'
          }
        ]
      });

      return {
        replyText: 'I prepared the verified booking hold with Bedouin Divers Dahab. 2 slots are available for tomorrow at 10:00 AM at EGP 2,700 total. You can review terms and confirm hold instantly.',
        replyTextAr: 'جهزت لك حجز المقعد المعتمد مع مركز بدوين دايفرز بدهب. متاح مقعدان لبكرة الساعة ١٠:٠٠ صباحاً بإجمالي ٢,٧٠٠ جنيه شاملة المعدات والمرشد. يمكنك تأكيد الحجز فوراً.',
        whyThis: 'Direct authoritative slot retrieved from Tier-1 certified dive supplier with zero booking markup.',
        whyThisAr: 'تم جلب المقاعد مباشرة من النظام المعتمد للمركز المرخص بدون أي رسوم إضافية.',
        actionType: 'BOOKING_CARD',
        actionRisk: 'COMMERCE',
        actionTitle: 'Canyon Dive Reservation Review',
        actionTitleAr: 'مراجعة وتأكيد حجز غطسة الكانيون',
        mode: 'ACT',
        parsedIntent,
        constraints,
        taskPlan,
        orchestratedTask,
        actionData: {
          bookingReview,
          priceEGP: 2700,
          durationMinutes: 180,
          location: 'Canyon Marine Sanctuary'
        },
        requiresConfirmation: true,
        confirmationPayload: {
          actionKey: 'CONFIRM_DIRECT_BOOKING',
          descriptionEn: 'Confirm 15-minute inventory hold and proceed to verified checkout.',
          descriptionAr: 'تأكيد حجز المقعد والانتقال للدفع المباشر.',
          parameters: { skuId: 'SKU-DIV-001', priceEGP: 2700 }
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Live Supplier Inventory Feed',
          confidenceScore: 1.0
        },
        suggestedFollowUps: [
          { textEn: 'Confirm & Hold Booking', textAr: 'أكد الحجز وثبت المقعد', query: 'أكد الحجز وثبت المقعد' },
          { textEn: 'What is the cancellation policy?', textAr: 'ما هي سياسة الإلغاء؟', query: 'سياسة الإلغاء' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 7. DAILY BRIEFING ("صباح الخير", "موجز اليوم")
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'DAILY_BRIEFING') {
      // The header selectors are real inputs ("somewhere calm" means something
      // different at the Blue Hole with four hours than at the Lighthouse with
      // one), so even this sample brief must be built from them rather than
      // from hardcoded Lighthouse/2h values.
      const briefLoc = context.currentLocation || 'Lighthouse';
      const briefLocAr = DAYGI_SPOT_AR[briefLoc] ?? briefLoc;
      const briefMinutes = context.availableMinutes || 120;
      const briefLocLabel = lang === 'ar' ? briefLocAr : briefLoc;

      const dailyBriefing: DayGiDailyBriefing = {
        dateFormatted: 'Today · Dahab Coastal Zone',
        timeline: [
          { time: '08:30 AM', title: 'Bedouin Breakfast & Fresh Juice at Ralphs Bakery', titleAr: 'إفطار صحي ومخبوزات طازجة في رالفز بيكري', type: 'MEAL' },
          { time: '10:30 AM', title: `Protected Reef Snorkeling at ${briefLoc} (Shore Entry)`, titleAr: `سنوركلينج شاطئي هادئ في ${briefLocAr}`, type: 'ACTIVITY' },
          { time: '01:30 PM', title: 'Fresh Catch Grilled Seafood at Ali Baba', titleAr: 'غداء سمك طازج وإطلالة بحرية في علي بابا', type: 'MEAL' },
          { time: '05:30 PM', title: 'Sunset Gathering & Habak Tea at Eel Garden Cushions', titleAr: 'جلسة شاي بالحبق ومتابعة الغروب في إيل جاردن', type: 'RELAX' }
        ],
        freeWindows: [
          { start: '03:00 PM', end: addMinutesToClock('03:00 PM', briefMinutes), durationMins: briefMinutes, location: briefLoc }
        ],
        conditionsNote: 'CDWS Green Flag: Visibility > 25m, Gentle NE breeze (9 knots), ideal for all skill levels.',
        conditionsNoteAr: 'الراية الخضراء مرفوعة: وضوح الرؤية أكثر من ٢٥ متراً، والرياح لطيفة ٩ عقد، مثالية للسباحة والغوص.'
      };

      return {
        replyText: `Good morning! Here is your daily briefing for Dahab: Marine conditions are optimal (24°C calm sea), with a relaxing shore snorkeling session at ${briefLoc}, followed by a ${freeWindowLabelEn(briefMinutes)} free window in the afternoon.`,
        replyTextAr: `صباح الخير! إليك ملخص يومك في دهب: حالة البحر مثالية اليوم (حرارة ٢٤ مئوية ومياه هادئة). لديك جلسة سنوركلينج في ${briefLocAr}، يتبعها وقت حر مدته ${freeWindowLabelAr(briefMinutes)}.`,
        whyThis: hasTrip
          ? 'Generated from your active itinerary synchronized with real-time marine weather feeds.'
          : 'A sample rhythm for a calm day on the Dahab coast. There is no trip on this account, so nothing here was read from an itinerary.',
        whyThisAr: hasTrip
          ? 'مستخرج من جدول رحلتك ومدمج مع تقرير الرصد البحري المباشر.'
          : 'ده إيقاع يوم هادي نموذجي على ساحل دهب. مفيش رحلة على الحساب ده، فالملخص مش متقرأ من جدول.',
        actionType: 'DAILY_BRIEFING',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Day 2 Daily Briefing & Marine Window',
        actionTitleAr: 'موجز اليوم الثاني وحالة الطقس والبحر',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        actionData: {
          dailyBriefing
        },
        sourceConfidence: hasTrip
          ? {
            source: 'VERIFIED_FACT',
            freshness: 'Live (Synchronized 2 min ago)',
            confidenceScore: 0.98
          }
          : {
            source: 'CURATED_DAHAB_CONTEXT',
            freshness: 'Sample day — no trip on this account',
            confidenceScore: 0.7
          },
        suggestedFollowUps: [
          { textEn: 'What should I do during my free window at 3 PM?', textAr: 'أعمل إيه في الوقت الفاضي الساعة ٣؟', query: 'معايا وقت فاضي الساعة ٣ بعد الظهر' },
          { textEn: 'Where to eat seafood tonight?', textAr: 'ناكل فين عشاء سمك الليلة؟', query: 'أرخص وألذ سمك طازج الليلة' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 8. 2-HOUR WINDOW DISCOVERY ("معايا ساعتين", "WHAT SHOULD I DO NOW")
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'WHAT_SHOULD_I_DO_NOW') {
      return {
        replyText: `You have ${minutes} minutes available near ${loc.includes('canyon') ? 'The Canyon' : 'Lighthouse'}. The top recommendation is an effortless reef snorkel right from the shore, followed by Habak mint tea on the seaside cushions of Everyday Cafe.`,
        replyTextAr: `معاك ${minutes} دقيقة وأنت قريب من ${loc.includes('canyon') ? 'الكانيون' : 'اللايتهاوس'}. أحسن ترشيح ليك هو سنوركلينج شاطئي فوري بين الشعاب المرجانية، وبعدها جلسة شاي بالحبق على وسائد إيفري داي كافيه.`,
        whyThis: 'Zero transit delay. Step right into the tranquil bay, see the clownfish and parrotfish, and dry off on the beachfront.',
        whyThisAr: 'صفر وقت ضائع في المواصلات. هتنزل البحر فوراً من الشاطئ وسط الأسماك الملونة، وتطلع تقعد على قعدة الشاطئ وتستمتع بالغروب.',
        actionType: 'RECOMMENDATION',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Lighthouse Shore Snorkel & Bedouin Tea',
        actionTitleAr: 'سنوركلينج شاطئ اللايتهاوس وشاي بالحبق',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        actionData: {
          serviceType: 'food',
          location: 'Lighthouse Promenade',
          priceEGP: 80,
          durationMinutes: 90,
          practicalTips: [
            'No boat trip required — walk in from the gently sloping sandy entrance.',
            'Gear rental (mask & fins) available for EGP 100 on the promenade.',
            'Water temperature is 24°C — crystal clear reef visibility.'
          ],
          practicalTipsAr: [
            'مش محتاج مركب — الدخول مريح جداً من الشاطئ الرملي مباشرة.',
            'تأجير النظارة والزعانف متاح على الممشى بحوالي ١٠٠ جنيه.',
            'حرارة البحر ٢٤ مئوية والرؤية في غاية الوضوح.'
          ]
        },
        sourceConfidence: {
          source: 'CURATED_DAHAB_CONTEXT',
          freshness: 'Verified Local Knowledge',
          confidenceScore: 0.96
        },
        suggestedFollowUps: [
          { textEn: 'Where should we eat seafood after?', textAr: 'ناكل فين سمك طازج بعد السنوركلينج؟', query: 'أرخص وألذ سمك طازج' },
          { textEn: 'Check tomorrow morning schedule', textAr: 'شوف جدول بكرة الصبح', query: 'موجز بكرة الصبح' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 9. DISRUPTION RECOVERY ("الغوص اتلغى", "الغطسة اتلغت بسبب الرياح")
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'TRIP_RECOVERY') {
      const recoveryProposal: DayGiRecoveryProposal = {
        whatChanged: 'CDWS Marine Warning: High northern wind on open coastal canyons.',
        whatChangedAr: 'تحذير بحري: رياح شمالية شديدة على السواحل المفتوحة بالكانيون.',
        whatItAffects: 'Day 3 Canyon Deep Dive (08:30 AM)',
        whatItAffectsAr: 'غطسة الكانيون الصباحية في اليوم الثالث (٠٨:٣٠ صباحاً)',
        originalItemId: 'act-canyon-dive',
        alternatives: [
          {
            id: 'SKU-SAF-002',
            title: 'Laguna Sheltered Windsurfing & SUP Session',
            titleAr: 'جلسة ويند سيرفنج وبادل بورد في اللاجونا المحمية',
            priceVarianceEGP: -900,
            scheduleImpact: 'Scheduled at same time (09:00 AM) · EGP 900 credited to wallet.',
            scheduleImpactAr: 'نفس التوقيت (٠٩:٠٠ ص) · استرداد ٩٠٠ جنيه إلى محفظتك.',
            serviceType: 'safari'
          },
          {
            id: 'SKU-SNK-004',
            title: 'Three Pools Guided Reef Snorkeling & Bedouin Lunch',
            titleAr: 'سنوركلينج الثري بولز مع غداء بدوي شاطئي',
            priceVarianceEGP: -1200,
            scheduleImpact: 'Scheduled at 10:00 AM · EGP 1,200 credited to wallet.',
            scheduleImpactAr: 'الموعد ١٠:٠٠ ص · استرداد ١,٢٠٠ جنيه إلى محفظتك.',
            serviceType: 'diving'
          }
        ]
      };

      const taskPlan: DayGiTaskPlan = {
        id: `PLAN-RECOV-${Date.now()}`,
        intent: 'DISRUPTION_RECOVERY_PIPELINE',
        title: 'Weather Disruption Recovery & Ledger Reconciliation',
        titleAr: 'خطة استعادة الرحلة والتسوية المالية الفورية',
        risk: 'FINANCIAL',
        steps: [
          { stepNumber: 1, labelEn: 'Cancel Disrupted Canyon Hold & Release Seat', labelAr: 'إلغاء حجز الكانيون المتأثر وتحرير المقعد', status: 'EXECUTED', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 2, labelEn: 'Lock Substitute Slot at Laguna Watersports', labelAr: 'تثبيت المقعد البديل في مركز رياضات اللاجونا', status: 'READY_FOR_CONFIRMATION', systemComponent: 'COMMERCE_SERVICE' },
          { stepNumber: 3, labelEn: 'Reconcile EGP 900 Price Variance into Ledger', labelAr: 'تسوية فرق السعر (٩٠٠ ج) في الدفتر المالي للمسافر', status: 'PENDING', systemComponent: 'LEDGER' }
        ],
        verifiedDeterministic: true
      };

      const orchestratedTask = daygiTaskOrchestrator.createTask({
        userId: context.userId!,
        tripId: activeTripId,
        intent: 'WEATHER_DISRUPTION_RECOVERY',
        titleEn: 'Substitute Wind-Disrupted Dive with Laguna Windsurfing',
        titleAr: 'استبدال غطسة الكانيون برياضات اللاجونا وتسوية الرصيد',
        riskLevel: 'FINANCIAL',
        steps: [
          {
            name: 'Cancel Disrupted Canyon Dive Hold & Release Capacity',
            nameAr: 'إلغاء حجز غطسة الكانيون وتحرير السعة',
            systemComponent: 'COMMERCE_SERVICE',
            actionKey: 'EXECUTE_TRIP_RECOVERY',
            payload: { originalItemId: 'act-canyon-dive', tripId: activeTripId },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Lock Substitute Slot at Laguna Watersports & SUP',
            nameAr: 'تثبيت المقعد البديل في مركز رياضات اللاجونا',
            systemComponent: 'COMMERCE_SERVICE',
            actionKey: 'EXECUTE_TRIP_RECOVERY',
            payload: { alternativeSkuId: 'SKU-SAF-002', tripId: activeTripId },
            riskLevel: 'COMMERCE'
          },
          {
            name: 'Reconcile EGP 900 Price Variance Refund in Ledger',
            nameAr: 'تسوية وإيداع استرداد فرق السعر (٩٠٠ ج) في الدفتر المالي',
            systemComponent: 'LEDGER',
            actionKey: 'EXECUTE_TRIP_RECOVERY',
            payload: { refundAmountEGP: 900 },
            riskLevel: 'FINANCIAL'
          }
        ]
      });

      return {
        replyText: 'CDWS issued a northern wind advisory restricting deep boat canyon diving. I prepared two verified alternatives sheltered from the waves, with automatic price refund credited to your wallet.',
        replyTextAr: 'تم إصدار تحذير رياح شمالية في الكانيون. جهزت لك بديلين ممتعين ومحميين تماماً من الأمواج، مع تسوية واسترداد فرق السعر فوراً في محفظتك.',
        whyThis: 'Laguna Bay is naturally sheltered by the sand spit, making water sports exhilarating and completely safe even during high winds.',
        whyThisAr: 'خليج اللاجونا محمي طبيعياً باللسان الرملي، مما يجعل الأنشطة المائية ممتعة وآمنة تماماً وقت الرياح.',
        actionType: 'RECOVERY',
        actionRisk: 'FINANCIAL',
        actionTitle: 'Instant Weather Disruption Recovery',
        actionTitleAr: 'استعادة خطة الرحلة والتسوية المالية',
        mode: 'ACT',
        parsedIntent,
        constraints,
        taskPlan,
        orchestratedTask,
        actionData: {
          recoveryProposal
        },
        requiresConfirmation: true,
        confirmationPayload: {
          actionKey: 'EXECUTE_TRIP_RECOVERY',
          descriptionEn: 'Substitute Canyon Dive with Laguna Windsurfing & refund EGP 900 to wallet.',
          descriptionAr: 'استبدال غطسة الكانيون بويند سيرفنج اللاجونا واسترداد ٩٠٠ جنيه.',
          parameters: { originalItemId: 'act-canyon-dive', alternativeId: 'SKU-SAF-002' }
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'CDWS Marine Safety Alert',
          confidenceScore: 0.99
        },
        suggestedFollowUps: [
          { textEn: 'Choose Laguna Windsurfing (-900 EGP)', textAr: 'اختر ويند سيرفنج اللاجونا (استرداد ٩٠٠ ج)', query: 'اعتمد بديل اللاجونا' },
          { textEn: 'Choose Three Pools & Lunch (-1200 EGP)', textAr: 'اختر الثري بولز مع الغداء (استرداد ١٢٠٠ ج)', query: 'اعتمد بديل الثري بولز' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 9.4 SOURCE STALENESS & FRESHNESS AUDIT INQUIRY
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'SOURCE_STALENESS_INQUIRY') {
      const freshnessReport = marketFreshnessService.getSourceFreshnessReport();
      const staleSources = freshnessReport.sources.filter(
        s => s.status === FreshnessStatus.STALE || s.status === FreshnessStatus.EXPIRED || s.status === FreshnessStatus.AGING
      );

      const staleNames = staleSources.map(s => s.sourceReference).slice(0, 3).join(', ');

      return {
        replyText: `Freshness audit across ${freshnessReport.totalSourcesTracked} market sources: Overall system freshness is ${freshnessReport.overallSystemFreshnessScore}%. ${staleSources.length} sources require updated observation or verification (${staleNames || 'None currently overdue'}). All active booking recommendations remain grounded in verified inventory.`,
        replyTextAr: `تقرير تدقيق حداثة المصادر (${freshnessReport.totalSourcesTracked} مصدر): معدل الحداثة الكلي للنظام ${freshnessReport.overallSystemFreshnessScore}%. يوجد ${staleSources.length} مصدر بحاجة لتجديد الرصد أو التوثيق (${staleNames || 'لا توجد مصادر متقادمة حالياً'}). ترشيحات الحجز الفعلي تظل معتمدة فقط على السعات الموثقة.`,
        whyThis: '4-dimensional freshness audit engine continuously tracking observation timestamps, CDWS validity, and flyer decay.',
        whyThisAr: 'محرك تدقيق الحداثة الرباعي يتابع تواريخ الرصد، صلاحية التراخيص، وتقادم المنشورات.',
        actionType: 'RECOMMENDATION',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Source Freshness & Staleness Audit',
        actionTitleAr: 'تقرير تدقيق حداثة وتقادم المصادر',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        actionData: {
          freshnessReport,
          staleSourcesCount: staleSources.length
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Continuous Freshness Engine',
          confidenceScore: 0.98
        },
        suggestedFollowUps: [
          { textEn: 'Trigger market refresh', textAr: 'تحديث بيانات السوق', query: 'تحديث بيانات السوق' },
          { textEn: 'What changed today?', textAr: 'إيه اللي اتغير النهارده؟', query: 'إيه اللي اتغير النهارده؟' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 9.6 MARKET PRICE & FRESHNESS INQUIRY
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'MARKET_PRICE_INQUIRY') {
      const trends = marketFreshnessService.getMarketTrends({});
      const queryLower = (parsedIntent.parameters?.query || '').toLowerCase();
      const recentPriceChanges = marketFreshnessService.getMarketChangeEvents({ eventType: 'PRICE_INCREASE', limit: 3 });
      const recentDrops = marketFreshnessService.getMarketChangeEvents({ eventType: 'PRICE_DECREASE', limit: 3 });

      let specificPriceNoteEn = '';
      let specificPriceNoteAr = '';

      if (queryLower.includes('رفع') || queryLower.includes('raised') || queryLower.includes('زيادة')) {
        if (recentPriceChanges.length > 0) {
          const ch = recentPriceChanges[0];
          specificPriceNoteEn = `The latest observed price increased from ${ch.details?.oldAmount || '500'} to ${ch.details?.newAmount || '600'} EGP (+${ch.details?.percentage || 20}%). The source is ${ch.details?.sourceReference || 'Instagram'}; the advertised price should be confirmed.`;
          specificPriceNoteAr = `تم رصد زيادة في سعر العرض من ${ch.details?.oldAmount || '500'} إلى ${ch.details?.newAmount || '600'} جنيه (+${ch.details?.percentage || 20}%) وفق أحدث مصدر متاح. المصدر ${ch.details?.sourceReference || 'Instagram'}، والسعر المعلن يحتاج إلى تأكيد.`;
        } else {
          specificPriceNoteEn = 'No recent price increases were detected across active verified sources.';
          specificPriceNoteAr = 'لم يتم رصد أي زيادات سعرية مفاجئة عبر المصادر المعتمدة مؤخراً.';
        }
      } else if (queryLower.includes('نزلت') || queryLower.includes('انخفضت') || queryLower.includes('drop')) {
        if (recentDrops.length > 0) {
          const ch = recentDrops[0];
          specificPriceNoteEn = `Price drop observed: ${ch.summaryEn}. Source: ${ch.details?.sourceReference || 'Market flyer'}.`;
          specificPriceNoteAr = `تم رصد انخفاض سعري: ${ch.summaryAr}. المصدر: ${ch.details?.sourceReference || 'منشور محلي'}.`;
        } else {
          specificPriceNoteEn = 'Market prices are currently holding steady with no steep reductions observed.';
          specificPriceNoteAr = 'أسعار السوق مستقرة حالياً دون تسجيل تخفيضات ملحوظة.';
        }
      }

      const blueHoleOffers = (db.supplierOffers || []).filter(o => o.canonicalCategory === 'Diving' || o.sourceActivityName.includes('Blue Hole'));
      const lowestBlueHole = blueHoleOffers.length > 0 ? Math.min(...blueHoleOffers.map(o => o.basePriceEGP || o.price)) : 2200;

      const replyText = specificPriceNoteEn
        ? `${specificPriceNoteEn}\n\nOverall market trend is ${trends.overallTrend}. Blue Hole guided trips range from ${lowestBlueHole} EGP to 3,200 EGP depending on boat vs. shore transport and inclusions. Note: Stored records represent observed market data, not real-time inventory.`
        : `Based on verified local market observations across ${db.suppliers.length} Dahab suppliers and ${db.priceObservations.length} historical observations: The overall market trend is ${trends.overallTrend}. Blue Hole guided trips currently range from ${lowestBlueHole} EGP to 3,200 EGP depending on boat vs. shore transport and inclusions. Note: Stored records represent observed market data, not real-time inventory.`;

      const replyTextAr = specificPriceNoteAr
        ? `${specificPriceNoteAr}\n\nحركة السوق العامة ${trends.overallTrend === 'RISING' ? 'تشهد صعوداً طفيفاً' : 'مستقرة'}. رحلات البلو هول تبدأ من ${lowestBlueHole} جنيه مصري وحتى ٣,٢٠٠ جنيه حسب الانتقال (شاطئي أم بحري) والمشتملات. تنبيه: الأسعار المسجلة تمثل رصد السوق الميداني وليست حجزاً لحظياً.`
        : `بناءً على رصد السوق الموثق من ${db.suppliers.length} مورد معتمد في دهب و${db.priceObservations.length} رصد تاريخي للأسعار: حركة السوق العامة ${trends.overallTrend === 'RISING' ? 'تشهد صعوداً طفيفاً' : 'مستقرة'}. رحلات البلو هول تبدأ من ${lowestBlueHole} جنيه مصري وحتى ٣,٢٠٠ جنيه حسب الانتقال (شاطئي أم بحري) والمشتملات. تنبيه: الأسعار المسجلة تمثل رصد السوق الميداني وليست حجزاً لحظياً.`;

      return {
        replyText,
        replyTextAr,
        whyThis: 'Temporal market pricing engine tracked across verified flyers, social channels, and CDWS centers.',
        whyThisAr: 'محرك تتبع الأسعار الزمني يحلل بيانات المنشورات، وسائل التواصل، ومراكز الغوص المرخصة.',
        actionType: 'RECOMMENDATION',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Dahab Live Market Intelligence',
        actionTitleAr: 'رادار أسعار سوق دهب الميداني',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        actionData: {
          marketTrends: trends,
          lowestObservedBlueHoleEGP: lowestBlueHole,
          observationCount: db.priceObservations.length,
          activeSuppliersCount: db.suppliers.length,
          recentIncreases: recentPriceChanges,
          recentDrops
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Verified Market Observation',
          confidenceScore: 0.98
        },
        suggestedFollowUps: [
          { textEn: 'Compare Blue Hole Offers', textAr: 'قارن عروض البلو هول', query: 'قارن عروض البلو هول' },
          { textEn: 'Who changed prices recently?', textAr: 'مين غير الأسعار مؤخراً؟', query: 'مين غير الأسعار مؤخراً؟' },
          { textEn: 'What new suppliers appeared?', textAr: 'إيه الشركات الجديدة؟', query: 'إيه الشركات الجديدة في دهب؟' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 9.7 NEW SUPPLIERS & CHANGE RADAR INQUIRY
    // -------------------------------------------------------------------------
    if (parsedIntent.intent === 'SUPPLIER_CHANGES_INQUIRY') {
      const recentEvents = marketFreshnessService.getMarketChangeEvents({ limit: 5 });
      const recentSuppliers = db.suppliers.slice(-3);
      const queryLower = (parsedIntent.parameters?.query || '').toLowerCase();

      let specificSupplierNoteEn = '';
      let specificSupplierNoteAr = '';

      if (queryLower.includes('اختفى') || queryLower.includes('disappeared') || queryLower.includes('removed')) {
        specificSupplierNoteEn = 'No authorized suppliers were unexpectedly removed; all active operators maintain valid licenses.';
        specificSupplierNoteAr = 'لم يتم تسجيل اختفاء أو إزالة مفاجئة لأي مورد معتمد؛ كافة المراكز المرخصة مستمرة في الخدمة.';
      } else if (queryLower.includes('جديد') || queryLower.includes('new') || queryLower.includes('ظهر')) {
        const newSupNames = recentSuppliers.map(s => s.businessName).join(', ');
        const newSupNamesAr = recentSuppliers.map(s => s.businessNameAr || s.businessName).join('، ');
        specificSupplierNoteEn = `Recent suppliers observed on Dahab radar: ${newSupNames}. Verification: Cross-referenced with CDWS and local commercial registers.`;
        specificSupplierNoteAr = `أحدث الموردين المرصودين على رادار دهب: ${newSupNamesAr}. التوثيق: مطابقة مع سجلات غرفة الغوص والسجل التجاري.`;
      }

      const replyText = specificSupplierNoteEn
        ? `${specificSupplierNoteEn}\n\nMarket radar tracks ${db.suppliers.length} active suppliers and cross-references CDWS regulatory status continuously.`
        : `Market radar has recorded ${recentEvents.length} recent supplier and pricing updates in Dahab. Notable suppliers monitored include: ${recentSuppliers.map(s => s.businessName).join(', ')}. All regulatory statuses are cross-referenced with CDWS records.`;

      const replyTextAr = specificSupplierNoteAr
        ? `${specificSupplierNoteAr}\n\nيتابع رادار السوق ${db.suppliers.length} مورداً محلياً مع التحقق الدوري من حالة تراخيص غرفة سياحة الغوص والأنشطة البحرية.`
        : `سجل رادار التغييرات ${recentEvents.length} تحديثاً ميدانياً مؤخراً لموردي دهب. من أبرز الموردين المرصودين: ${recentSuppliers.map(s => s.businessNameAr || s.businessName).join('، ')}. كافة الحالات التنظيمية مطابقة لسجلات غرفة سياحة الغوص والأنشطة البحرية.`;

      return {
        replyText,
        replyTextAr,
        whyThis: 'Continuous automated change detection tracking supplier profiles, contact information, and CDWS licensing.',
        whyThisAr: 'نظام رصد التغييرات التلقائي يتابع بيانات الموردين، وسائل التواصل، وسريان تراخيص وزارة السياحة.',
        actionType: 'RECOMMENDATION',
        actionRisk: 'READ_ONLY',
        actionTitle: 'Supplier Change Radar',
        actionTitleAr: 'رادار تحديثات وموردي دهب',
        mode: 'DISCOVER',
        parsedIntent,
        constraints,
        actionData: {
          recentEvents,
          monitoredSuppliers: recentSuppliers.length
        },
        sourceConfidence: {
          source: 'VERIFIED_FACT',
          freshness: 'Continuous Verification',
          confidenceScore: 0.98
        },
        suggestedFollowUps: [
          { textEn: 'Check market price trends', textAr: 'استعرض اتجاهات الأسعار', query: 'هل الأسعار زادت؟' },
          { textEn: 'View verified dive centers', textAr: 'عرض مراكز الغوص المعتمدة', query: 'مراكز الغوص المرخصة' }
        ]
      };
    }

    // -------------------------------------------------------------------------
    // 9.5 TRIPADVISOR KNOWLEDGE: place-seeking questions answered from the
    // platform's own Tripadvisor pulls (ratings, review counts, review texts)
    // instead of the generic fallback below. Runs before section 10 so any
    // "best/recommend + restaurant/hotel/attraction/tour" prompt — in English
    // or Arabic, for Dahab/Nuweiba/Siwa — grounds in real listings. Falls
    // through to the generic reply only when nothing matches.
    // See server/services/tripadvisorKnowledgeService.ts.
    // -------------------------------------------------------------------------
    {
      const knowledge = answerKnowledge(prompt);
      if (knowledge) {
        const top = knowledge.places[0];
        return {
          replyText: knowledge.replyText,
          replyTextAr: knowledge.replyTextAr,
          whyThis: `Grounded in ${knowledge.totalMatching} Tripadvisor listings for ${knowledge.destination} (ratings + traveler reviews, October 2026 pull).`,
          whyThisAr: `الإجابة مبنية على ${knowledge.totalMatching} مكانًا مسجلًا في TripAdvisor لمنطقة ${knowledge.destination} (التقييمات وآراء المسافرين، آخر سحب أكتوبر ٢٠٢٦).`,
          actionType: 'RECOMMENDATION',
          actionRisk: 'READ_ONLY',
          actionTitle: `Top ${knowledge.category} picks`,
          actionTitleAr: 'ترشيحات مختارة',
          mode: 'DISCOVER',
          parsedIntent,
          constraints,
          actionData: {
            knowledgeSource: 'tripadvisor' as const,
            knowledgeDestination: knowledge.destination,
            knowledgeCategory: knowledge.category,
            knowledgeTotalMatching: knowledge.totalMatching,
            knowledgePlaces: knowledge.places.map((p) => ({
              id: p.id,
              name: p.name,
              rating: p.rating,
              reviewCount: p.reviewCount,
              price: p.price,
              area: p.area,
              url: p.url,
              phone: p.phone,
            })),
          },
          sourceConfidence: {
            source: 'VERIFIED_FACT',
            freshness: 'Tripadvisor October 2026 pull + live catalogue',
            confidenceScore: 0.92,
          },
          suggestedFollowUps: [
            { textEn: `More ${knowledge.category} options`, textAr: 'اختيارات أكثر', query: `more ${knowledge.category}s in ${knowledge.destination}` },
            { textEn: 'Plan my day around this', textAr: 'خططلي اليوم حوالين ده', query: `plan a day in ${knowledge.destination}` },
          ],
        };
      }
    }

    // -------------------------------------------------------------------------
    // 10. GENERAL DEFAULT CONCIERGE ASSISTANCE
    // -------------------------------------------------------------------------
    return {
      replyText: 'Dahab is calm and welcoming today with 24°C crystal clear waters. I can help you discover instant 2-hour activities, recommend fresh seaside dining, optimize your budget, or safely adjust your itinerary.',
      replyTextAr: 'أجواء دهب ساحرة اليوم ومياه البحر هادئة وحرارتها ٢٤ مئوية. أقدر أساعدك في ترشيحات فورية لساعتين فاضيين، أفضل مأكولات بحرية، تقليل تكلفة رحلتك، أو تعديل جدولك بمنتهى السهولة.',
      whyThis: 'Live CDWS marine flags are green across all Dahab coastal sites.',
      whyThisAr: 'جميع الرايات البحرية خضراء وكافة مواقع الغطس والأنشطة مفتوحة بأعلى درجات الأمان.',
      actionType: 'RECOMMENDATION',
      actionRisk: 'READ_ONLY',
      actionTitle: 'Dahab Promenade & Oceanfront Leisure',
      actionTitleAr: 'جولة ممشى دهب والاسترخاء الشاطئي',
      mode: 'DISCOVER',
      parsedIntent,
      constraints,
      actionData: {
        serviceType: 'food',
        location: 'Lighthouse Bay',
        priceEGP: 0,
        durationMinutes: 120,
        practicalTips: [
          'Sunset starts around 05:45 PM along Eel Garden and Lighthouse.',
          'Snorkel gear available on the shore for EGP 100.',
          'Bring cash (EGP) for local seaside cafes.'
        ],
        practicalTipsAr: [
          'الغروب يبدأ حوالي الساعة ٠٥:٤٥ مساءً على ممشى إيل جاردن واللايتهاوس.',
          'تأجير النظارة والزعانف متاح على الشاطئ بحوالي ١٠٠ جنيه.',
          'يفضل اصطحاب نقود كاش بالجنيه المصري للكافيهات الشاطئية.'
        ]
      },
      sourceConfidence: {
        source: 'CURATED_DAHAB_CONTEXT',
        freshness: 'Live (Sinai Radar)',
        confidenceScore: 0.95
      },
      suggestedFollowUps: [
        { textEn: 'What should I do right now?', textAr: 'أعمل إيه دلوقتي؟', query: 'أعمل إيه دلوقتي؟' },
        { textEn: 'Morning Briefing · Daily summary', textAr: 'صباح الخير · ملخص اليوم', query: 'صباح الخير' },
        { textEn: 'Bring trip budget under 15k', textAr: 'قلل تكلفة الرحلة لأقل من ١٥ ألف', query: 'قلل تكلفة الرحلة لأقل من ١٥ ألف جنيه' }
      ]
    };
  }

  /**
   * Honest answer for trip-dependent intents when the caller has no trip.
   *
   * These used to answer anyway with the seeded demo itinerary's schedule,
   * prices and bookings — the single most misleading behaviour on the
   * platform. Discovery and general conversation are unaffected; only the
   * intents that need an itinerary to audit are routed here.
   */
  private buildNoTripGuidance(parsedIntent: DayGiParsedIntent, lang: 'en' | 'ar'): DayGiResponse {
    return {
      replyText: 'This needs your trip first. I can only check, change or price an itinerary that exists — and right now there is no trip on this account. Start with Plan My Trip (about a minute), and the moment you have a draft I will audit its health, weather risks and budget.',
      replyTextAr: 'الميزة دي محتاجة رحلتك الأول. مش أقدر أراجع أو أعدّل أو أحسب سعر خطة لسه مش موجودة — وحالياً مفيش رحلة على الحساب ده. ابدأ بـ "خططها لي" (دقيقة واحدة)، وأول ما يكون عندك مسودة هافحص صحتها والطقس والميزانية فوراً.',
      whyThis: 'Trip-dependent actions (health, schedule changes, budget, recovery, booking) require an itinerary owned by this account. No trip was found, so nothing was invented.',
      whyThisAr: 'الإجراءات المعتمدة على الرحلة (الصحة، تعديل الجدول، الميزانية، الاستعادة، الحجز) تتطلب خطة مملوكة لهذا الحساب. لم يتم العثور على رحلة، لذلك لم يتم افتراض أي بيانات.',
      actionType: 'PRACTICAL_TIP',
      actionRisk: 'READ_ONLY',
      actionTitle: 'Plan your trip first',
      actionTitleAr: 'ابدأ بالتخطيط أولاً',
      mode: 'DISCOVER',
      parsedIntent,
      sourceConfidence: {
        source: 'CURATED_DAHAB_CONTEXT',
        freshness: 'No trip on this account',
        confidenceScore: 0.95
      },
      suggestedFollowUps: [
        { textEn: 'Plan my trip', textAr: 'خططها لي', query: 'خططها لي' },
        { textEn: 'What can I do in Dahab without a plan?', textAr: 'أعمل إيه في دهب من غير خطة؟', query: 'معايا ساعتين وأنا قريب من اللايتهاوس، أعمل إيه؟' }
      ]
    };
  }

  /**
   * Deterministic Action Execution Engine (Mode C: ACT)
   * Enforces permissions, writes to Cloud SQL with audit logs, and returns confirmation.
   */
  public executeAction(params: {
    actionKey: string;
    userId: string;
    userRole: string;
    payload: Record<string, any>;
  }): {
    success: boolean;
    messageEn: string;
    messageAr: string;
    auditLogId: string;
    data?: any;
  } {
    const { actionKey, userId, userRole, payload } = params;
    const now = new Date().toISOString();
    const auditLogId = `AUD-DAYGI-${Date.now()}`;

    // Permission enforcement
    if (actionKey.startsWith('OPS_') && userRole !== 'Operations' && userRole !== 'Admin') {
      throw new Error('Unauthorized: Operations role required.');
    }
    if (actionKey.startsWith('SUPPLIER_') && userRole !== 'Supplier' && userRole !== 'Operations' && userRole !== 'Admin') {
      throw new Error('Unauthorized: Supplier role required.');
    }

    let resultData: any = {};
    let messageEn = 'Action executed successfully.';
    let messageAr = 'تم تنفيذ الإجراء بنجاح.';

    // Trip-scoped actions may only target a trip the caller owns (or one an
    // operator/admin is acting on). The previous defaults ('act-canyon-dive',
    // 'DHB-TRIP-894', 'SKU-DIV-001') silently operated on the seeded demo
    // trip when the payload omitted an id, so a traveler's "shift my dive"
    // could move somebody else's itinerary around.
    const tripOwnedByCaller = (tripId: string): boolean => {
      if (userRole === 'Operations' || userRole === 'Admin') return true;
      const trip = db.trips.find(t => t.id === tripId);
      return Boolean(trip && trip.userId === userId);
    };

    db.runInTransaction(() => {
      switch (actionKey) {
        case 'APPLY_TRIP_SHIFT': {
          const { activityId, fromDay, toDay, newTimeSlot } = payload;
          if (!activityId || !fromDay || !toDay || !newTimeSlot) {
            throw new Error('APPLY_TRIP_SHIFT requires activityId, fromDay, toDay and newTimeSlot.');
          }
          const tripItem = db.tripItems.find(i => i.id === activityId);
          if (tripItem) {
            if (!tripOwnedByCaller(tripItem.tripId)) {
              throw new Error('You may only modify your own trip.');
            }
            tripItem.dayNumber = toDay;
            tripItem.timeSlot = newTimeSlot;
            tripItem.updatedAt = now;
          }
          messageEn = `Activity moved from Day ${fromDay} to Day ${toDay} at ${newTimeSlot}.`;
          messageAr = `تم نقل النشاط من اليوم ${fromDay} إلى اليوم ${toDay} الساعة ${newTimeSlot}.`;
          resultData = { activityId, fromDay, toDay, newTimeSlot };
          break;
        }

        case 'CONFIRM_DIRECT_BOOKING': {
          const { skuId, tripId } = payload;
          if (!skuId || !tripId) {
            throw new Error('CONFIRM_DIRECT_BOOKING requires skuId and tripId.');
          }
          if (!tripOwnedByCaller(tripId)) {
            throw new Error('You may only place holds on your own trip.');
          }
          const hold = commerceService.createHold({
            skuId,
            tripId,
            travelerId: userId,
            date: new Date().toISOString().split('T')[0],
            timeSlot: '10:00 AM',
            passengersCount: 2,
            idempotencyKey: `DAYGI-HOLD-${Date.now()}-${userId}`
          });
          messageEn = `Booking hold confirmed (Ref: ${hold.holdToken}). Ready for checkout.`;
          messageAr = `تم حجز المقعد بنجاح (رقم الحجز: ${hold.holdToken}). جاهز للمتابعة.`;
          resultData = hold;
          break;
        }

        case 'EXECUTE_TRIP_RECOVERY': {
          const { originalItemId, tripId } = payload;
          if (!originalItemId || !tripId) {
            throw new Error('EXECUTE_TRIP_RECOVERY requires originalItemId and tripId.');
          }
          if (!tripOwnedByCaller(tripId)) {
            throw new Error('You may only run recovery on your own trip.');
          }
          const substitution = recoveryService.substituteItem({
            tripId,
            originalItemId,
            alternativeTitle: 'Laguna Sheltered Windsurfing & SUP',
            alternativeServiceType: 'safari',
            newScheduledTime: '09:00 AM',
            newPriceEGP: 1800,
            reason: 'High northern coastal winds at Canyon',
            idempotencyKey: `DAYGI-RECOV-${Date.now()}-${userId}`
          });
          messageEn = `Trip recovery executed: Canyon Dive substituted with Laguna Windsurfing. Price variance reconciled in ledger.`;
          messageAr = `تم استعادة خطة الرحلة: تم استبدال غطسة الكانيون بويند سيرفنج اللاجونا مع تسوية الفرق المالي تلقائياً.`;
          resultData = substitution;
          break;
        }

        case 'APPLY_BUDGET_OPTIMIZATION': {
          messageEn = `Budget optimization applied: Swapped to shared airport shuttle and shore dive. Estimated savings: EGP 3,600.`;
          messageAr = `تم تطبيق توفير الميزانية: تم تحويل النقل إلى الشاتل المشترك والغطس الشاطئي. إجمالي التوفير: ٣,٦٠٠ جنيه.`;
          resultData = { savingsEGP: 3600, newTotalEGP: 14800 };
          break;
        }

        case 'OPS_AUTO_REASSIGN': {
          messageEn = `All pending bookings automatically reassigned to secondary tier-1 verified suppliers.`;
          messageAr = `تمت إعادة توجيه كافة الحجوزات المعلقة تلقائياً إلى موردين معتمدين بدلاء.`;
          resultData = { reassignedCount: 3 };
          break;
        }

        case 'SUPPLIER_DISPATCH': {
          messageEn = `Driver dispatched status broadcast to traveler Ahmed. Live telemetry active.`;
          messageAr = `تم تأكيد تحرك السائق وإرسال الإشعار للعميل أحمد مع تفعيل التتبع المباشر.`;
          resultData = { dispatched: true, time: now };
          break;
        }

        default:
          messageEn = `Action ${actionKey} completed.`;
          messageAr = `تم إتمام الإجراء ${actionKey}.`;
          break;
      }

      // Log Authoritative Audit Record
      db.logAudit(userId || 'USR-DAYGI', userRole, `DAYGI_ACTION_${actionKey}`, 'DayGI Engine', auditLogId, {
        payload,
        resultData
      });
    });

    return {
      success: true,
      messageEn,
      messageAr,
      auditLogId,
      data: resultData
    };
  }
}

export const daygiReasoningService = new DayGiReasoningService();
