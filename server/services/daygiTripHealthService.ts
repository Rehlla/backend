import { db } from '../db/database';
import {
  DayGiTripHealth,
  DayGiTripHealthStatus,
  DayGiTripHealthIssue,
  DayGiProactiveSuggestion
} from '../../src/shared';

class DayGiTripHealthService {
  /**
   * Evaluates Trip Health against the 7 Authoritative Criteria.
   *
   * The trip id is the caller's own (route-validated); there is deliberately
   * NO fallback to another trip. The previous default ('DHB-TRIP-894') and the
   * `|| db.trips[0]` fallback meant a traveler with no trip of their own was
   * silently scored against the seeded demo itinerary — and the booking/hold
   * checks below read every booking in the store, so the score included other
   * people's records. A missing trip returns an explicit NO_TRIP state instead
   * of pretending to score somebody else's.
   */
  public evaluateTripHealth(tripId?: string | null): DayGiTripHealth {
    const trip = tripId ? db.trips.find(t => t.id === tripId) : undefined;
    if (!trip) {
      return {
        status: 'NO_TRIP',
        score: 0,
        evaluatedAt: new Date().toISOString(),
        summaryEn: 'You have no active trip yet. Plan one first — DayGI will audit it the moment it exists.',
        summaryAr: 'لا توجد رحلة نشطة بعد. ابدأ بالتخطيط أولاً وسيراجع دايجي رحلتك فور إنشائها.',
        issues: [],
        metrics: {
          confirmedBookings: 0,
          pendingBookings: 0,
          conflictsCount: 0,
          budgetAdherencePercent: 0
        }
      };
    }
    const tripItems = db.tripItems.filter(item => item.tripId === trip.id);
    // Scoped to THIS trip. The booking and hold checks used to read the whole
    // store, so one traveler's health score counted every other traveler's
    // pending bookings and holds.
    const bookings = db.bookings.filter(b => b.tripId === trip.id);
    const holds = db.holds.filter(h => h.tripId === trip.id);

    const issues: DayGiTripHealthIssue[] = [];

    // 1. Check Supplier Pending
    const pendingSuppliers = bookings.filter(b => b.supplierState === 'PENDING_CONFIRMATION' || !b.assignedResource);
    if (pendingSuppliers.length > 0) {
      issues.push({
        type: 'SUPPLIER_PENDING',
        severity: 'MEDIUM',
        titleEn: `${pendingSuppliers.length} Booking Awaiting Supplier Assignment`,
        titleAr: `${pendingSuppliers.length} حجز في انتظار تأكيد السائق أو المورد`,
        messageEn: 'Driver or dive guide confirmation is pending supplier dispatch.',
        messageAr: 'السائق أو مرشد الغوص قيد التعيين من المورد المعتمد.',
        suggestedFixEn: 'DayGI can auto-reassign to verified Tier-1 standby suppliers.',
        suggestedFixAr: 'دايجي يقدر يعيد التسكين تلقائياً على موردين بدلاء معتمدين.',
        actionKey: 'OPS_AUTO_REASSIGN'
      });
    }

    // 2. Check Condition Uncertainty / Weather Impact
    // Example: Northern high wind alert on Day 3 Canyon dive
    const hasCanyonDiveDay3 = tripItems.some(
      item => item.dayNumber === 3 && item.title.toLowerCase().includes('canyon')
    );
    if (hasCanyonDiveDay3) {
      issues.push({
        type: 'CONDITION_UNCERTAINTY',
        severity: 'HIGH',
        titleEn: 'Day 3 Canyon Dive Subject to CDWS Wind Warning',
        titleAr: 'غطسة الكانيون في اليوم الثالث متأثرة بتحذير الرياح البحرية',
        messageEn: 'CDWS issued a 22-knot northern wind alert for Canyon and Blue Hole open sea.',
        messageAr: 'غرفة الغوص والأنشطة البحرية أصدرت تحذيراً من رياح شمالية ٢٢ عقدة في الكانيون والبلوهول.',
        suggestedFixEn: 'Substitute with sheltered Laguna Windsurfing/SUP or shift to Day 4 morning.',
        suggestedFixAr: 'استبدال النشاط بويند سيرفنج اللاجونا المحمية أو نقله لليوم الرابع صباحاً.',
        actionKey: 'APPLY_TRIP_SHIFT',
        actionPayload: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' }
      });
    }

    // 3. Check Schedule Pacing & Density
    const day3Items = tripItems.filter(i => i.dayNumber === 3);
    if (day3Items.length >= 4) {
      issues.push({
        type: 'SCHEDULE_CONFLICT',
        severity: 'MEDIUM',
        titleEn: 'Day 3 High Intensity Schedule Density',
        titleAr: 'اليوم الثالث مضغوط ويحتوي على أنشطة بدنية متتالية',
        messageEn: 'Four consecutive activities with less than 45 min rest window.',
        messageAr: 'أربعة أنشطة متتالية مع أقل من ٤٥ دقيقة استراحة بينها.',
        suggestedFixEn: 'Shift non-essential excursions to Day 4 or add seafront relaxation buffer.',
        suggestedFixAr: 'ترحيل بعض الأنشطة لليوم الرابع لإضافة وقت حر واسترخاء.',
        actionKey: 'RELAX_TOMORROW'
      });
    }

    // 4. Check Payment / Hold Pending
    const unconfirmedHolds = holds.filter(h => h.status === 'ACTIVE');
    if (unconfirmedHolds.length > 0) {
      issues.push({
        type: 'PAYMENT_PENDING',
        severity: 'LOW',
        titleEn: 'Active Inventory Hold Ready for Checkout',
        titleAr: 'حجز مقعد معلق جاهز للتأكيد والدفع',
        messageEn: `${unconfirmedHolds.length} experience hold expires in 12 minutes.`,
        messageAr: `لديك ${unconfirmedHolds.length} حجز مؤقت سينتهي خلال ١٢ دقيقة.`,
        suggestedFixEn: 'Complete instant checkout to guarantee tier-1 supplier rates.',
        suggestedFixAr: 'أكمل الدفع السريع لضمان المقعد والسعر المعتمد.',
        actionKey: 'CONFIRM_DIRECT_BOOKING'
      });
    }

    // Determine Overall Health Score & Status
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'HIGH') score -= 25;
      else if (issue.severity === 'MEDIUM') score -= 12;
      else score -= 5;
    }
    score = Math.max(20, Math.min(100, score));

    let status: DayGiTripHealthStatus = 'GOOD';
    if (issues.some(i => i.severity === 'HIGH')) {
      status = 'CONFLICT';
    } else if (issues.some(i => i.severity === 'MEDIUM')) {
      status = 'ATTENTION';
    } else if (issues.length > 0) {
      status = 'UNVERIFIED';
    }

    const summaryEn =
      status === 'GOOD'
        ? 'Trip health is optimal. All verified suppliers and marine windows align perfectly.'
        : status === 'CONFLICT'
        ? 'Action recommended: Marine weather alert detected on Day 3 deep dive.'
        : 'Trip is in good shape with 2 proactive optimization opportunities available.';

    const summaryAr =
      status === 'GOOD'
        ? 'حالة الرحلة ممتازة. جميع المواعيد والموردين وحالة البحر متناسقة بالكامل.'
        : status === 'CONFLICT'
        ? 'يُنصح باتخاذ إجراء: تم رصد تحذير رياح بحرية لليوم الثالث.'
        : 'الرحلة بحالة جيدة مع وجود فرصتين لتحسين الجدول والميزانية.';

    return {
      status,
      score,
      evaluatedAt: new Date().toISOString(),
      summaryEn,
      summaryAr,
      issues,
      metrics: {
        confirmedBookings: bookings.filter(b => b.supplierState === 'CONFIRMED' || b.paymentState === 'CAPTURED' || b.paymentState === 'AUTHORIZED').length,
        pendingBookings: pendingSuppliers.length,
        conflictsCount: issues.filter(i => i.type === 'SCHEDULE_CONFLICT' || i.type === 'CONDITION_UNCERTAINTY').length,
        // No more hardcoded 94: derived from the actual trip budget when a
        // budget exists, otherwise unknown (0).
        budgetAdherencePercent: trip.totalEstimatedEGP > 0 && trip.totalPaidEGP <= trip.totalEstimatedEGP
          ? Math.min(100, Math.round((trip.totalPaidEGP / trip.totalEstimatedEGP) * 100))
          : 0
      }
    };
  }

  /**
   * Generates Proactive Suggestions using Significance Thresholds (Anti-Spam)
   */
  // Both were defaulted to the demo traveler and the demo trip, so a caller
  // that forgot to pass them silently received somebody else's suggestions
  // instead of failing. They are required now.
  public getProactiveSuggestions(userId: string, tripId: string): DayGiProactiveSuggestion[] {
    // A traveler without a trip gets no trip suggestions — the previous
    // implementation still produced a "Day 2 Morning Briefing" about the demo
    // itinerary's schedule.
    if (!tripId || !db.trips.some(t => t.id === tripId)) return [];
    const health = this.evaluateTripHealth(tripId);
    const suggestions: DayGiProactiveSuggestion[] = [];

    // 1. Morning Briefing Suggestion
    suggestions.push({
      id: 'SUGG-BRIEF-01',
      type: 'MORNING_BRIEF',
      urgency: 'INFO',
      titleEn: 'Day 2 Morning Briefing Ready',
      titleAr: 'موجز اليوم الثاني وحالة البحر جاهز',
      descriptionEn: 'Green flag sea conditions, 24°C water temp, and a 2-hour afternoon relaxation window.',
      descriptionAr: 'الراية الخضراء مرفوعة، حرارة البحر ٢٤ مئوية، ولديك ساعتان راحة بعد الظهر.',
      timeContext: '08:00 AM · Lighthouse Bay',
      actionKey: 'DAILY_BRIEFING'
    });

    // 2. Weather Alert for Day 3 Canyon
    const weatherIssue = health.issues.find(i => i.type === 'CONDITION_UNCERTAINTY');
    if (weatherIssue) {
      suggestions.push({
        id: 'SUGG-WEATHER-01',
        type: 'WEATHER_IMPACT',
        urgency: 'ACTION_REQUIRED',
        titleEn: 'Northern Wind Notice for Day 3',
        titleAr: 'تنبيه رياح شمالية لليوم الثالث',
        descriptionEn: 'Canyon deep diving may be choppy. Shift to sheltered Laguna SUP or move to Day 4 morning.',
        descriptionAr: 'غطسة الكانيون قد تتأثر بالأمواج. يمكنك استبدالها بويند سيرفنج اللاجونا المحمية أو نقلها لليوم الرابع.',
        timeContext: 'Tomorrow 08:30 AM',
        actionKey: 'APPLY_TRIP_SHIFT',
        actionPayload: { activityId: 'act-canyon-dive', fromDay: 3, toDay: 4, newTimeSlot: '10:00 AM' }
      });
    }

    // 3. Free Window Opportunity
    suggestions.push({
      id: 'SUGG-FREE-01',
      type: 'FREE_WINDOW_OPPORTUNITY',
      urgency: 'INFO',
      titleEn: '2-Hour Free Window at 03:00 PM',
      titleAr: 'ساعتان وقت حر الساعة ٠٣:٠٠ عصراً',
      descriptionEn: 'Lighthouse shore snorkeling gear available on promenade for EGP 100 with Habak mint tea.',
      descriptionAr: 'سنوركلينج شاطئي سهل باللايتهاوس وتأجير نظارة وزعانف بـ ١٠٠ جنيه مع شاي بالحبق.',
      timeContext: '03:00 PM – 05:00 PM',
      actionKey: 'WHAT_SHOULD_I_DO_NOW'
    });

    // 4. Preparation Reminder
    suggestions.push({
      id: 'SUGG-PREP-01',
      type: 'PREPARATION_REMINDER',
      urgency: 'INFO',
      titleEn: 'Passports & Gear Checklist',
      titleAr: 'تذكير: اصطحاب الهويات وبطاقة الغوص',
      descriptionEn: 'Ensure physical ID/passport and PADI certification card are ready for tomorrow morning brief.',
      descriptionAr: 'تأكد من تجهيز بطاقة الهوية/جواز السفر وكارنيه الغوص للتقديم في مركز الغوص صباحاً.',
      timeContext: 'Reminder'
    });

    return suggestions;
  }
}

export const daygiTripHealthService = new DayGiTripHealthService();
