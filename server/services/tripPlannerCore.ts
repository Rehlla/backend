/**
 * Deterministic fallback body for POST /api/trip/generate when the LLM is
 * unavailable (no key, exhausted quota) or returned unparsable JSON.
 *
 * The route used to title the trip "<durationDays>-Day" while hardcoding the
 * days array to exactly two days — the title lied about the trip length for
 * any duration other than 2. The templates below cover any duration in the
 * 1..14 range: day 1 always arrives, the last day always departs, and the
 * middle days cycle diving → safari → wellness with honest morning reef
 * light for diving and mountain rides before dusk.
 *
 * All estimatedPriceEGP values are budget estimates only; the route passes
 * the result through enrichTripWithAvailability, which replaces them with
 * real database prices and attaches bookability before responding.
 */

export interface DeterministicActivity {
  id: string;
  title: string;
  titleAr: string;
  timeSlot: string;
  location: string;
  category: 'diving' | 'safari' | 'food' | 'relax' | 'transfer' | 'wellness';
  estimatedPriceEGP: number;
  description?: string;
}

export interface DeterministicDay {
  dayNumber: number;
  title: string;
  titleAr: string;
  theme: string;
  activities: DeterministicActivity[];
}

const SLOTS = {
  morning: '09:00 AM',
  lunch: '01:30 PM',
  afternoon: '04:00 PM',
  sunset: '05:00 PM',
};

function arrivalDay(): Omit<DeterministicDay, 'dayNumber'> {
  return {
    title: 'Arrival, Oceanfront Check-in & Sunset Lighthouse Promenade',
    titleAr: 'الوصول، تسجيل الإقامة، وجلسة غروب اللايتهاوس',
    theme: 'Arrival & Acclimatization',
    activities: [
      {
        id: 'act-1-1',
        title: 'Private Airport Transfer from SSH Airport',
        titleAr: 'انتقال خاص ومريح من مطار شرم الشيخ',
        timeSlot: '10:30 AM',
        location: 'SSH Airport → Dahab',
        category: 'transfer',
        estimatedPriceEGP: 1400,
        description: 'Comfortable air-conditioned private vehicle with experienced local driver.',
      },
      {
        id: 'act-1-2',
        title: 'Lighthouse Sunset Snorkel & Habak Tea on Shore',
        titleAr: 'سنوركلينج الغروب باللايتهاوس وشاي بالحبق',
        timeSlot: SLOTS.sunset,
        location: 'Lighthouse Promenade',
        category: 'relax',
        estimatedPriceEGP: 250,
        description: 'Gentle shore entry with vibrant corals and panoramic views of the Saudi mountain silhouette.',
      },
    ],
  };
}

function divingDay(): Omit<DeterministicDay, 'dayNumber'> {
  return {
    title: 'World-Class Diving at The Canyon & Blue Hole',
    titleAr: 'يوم غوص في الكانيون والبلو هول',
    theme: 'World-Class Diving',
    activities: [
      {
        id: 'act-dive-1',
        title: 'Guided Morning Dive at The Canyon & Bells',
        titleAr: 'غطسة صباحية استرشادية بالكانيون والبيلز',
        timeSlot: SLOTS.morning,
        location: 'The Canyon, Dahab',
        category: 'diving',
        estimatedPriceEGP: 1350,
        description: 'Explore the natural light curtains inside the cavern under the guidance of certified PADI instructors.',
      },
      {
        id: 'act-dive-2',
        title: 'Seaside Fresh Catch Lunch at Eel Garden Beach',
        titleAr: 'غداء سمك طازج على شاطئ إيل جاردن',
        timeSlot: SLOTS.lunch,
        location: 'Eel Garden Promenade',
        category: 'food',
        estimatedPriceEGP: 450,
        description: 'Grilled Red Sea fish with Bedouin tahini and fresh local salads.',
      },
    ],
  };
}

function safariDay(): Omit<DeterministicDay, 'dayNumber'> {
  return {
    title: 'Sinai Mountains: Colored Canyon & Starlit Desert',
    titleAr: 'جبال سيناء: الوادي الملون وليلة الصحراء',
    theme: 'Sinai Safari',
    activities: [
      {
        id: 'act-safari-1',
        title: 'Colored Canyon Jeep Safari (Morning Light)',
        titleAr: 'سفاري الوادي الملون بجيب (إضاءة الصباح)',
        timeSlot: SLOTS.morning,
        location: 'Colored Canyon, Nuweiba Road',
        category: 'safari',
        estimatedPriceEGP: 1200,
        description: 'Open-jeep ride through the painted sandstone walls, cooler in the morning before the desert heat.',
      },
      {
        id: 'act-safari-2',
        title: 'Bedouin Mountain Dinner & Stargazing',
        titleAr: 'عشاء بدوي جبلي ورصد النجوم',
        timeSlot: '07:30 PM',
        location: 'Wadi Qnai / Blue Hole Road',
        category: 'food',
        estimatedPriceEGP: 350,
        description: 'Traditional zarb dinner under a very dark Sinai sky with a telescope session.',
      },
    ],
  };
}

function wellnessDay(): Omit<DeterministicDay, 'dayNumber'> {
  return {
    title: 'Slow Dahab: Wellness, Markets & Golden Hour',
    titleAr: 'دهب بهدوء: استشفاء وسوق وساعة ذهبية',
    theme: 'Slow Dahab',
    activities: [
      {
        id: 'act-slow-1',
        title: 'Morning Yoga & Massage by the Sea',
        titleAr: 'يوغا صباحية ومساج على البحر',
        timeSlot: SLOTS.morning,
        location: 'Lighthouse / Laguna',
        category: 'wellness',
        estimatedPriceEGP: 550,
        description: 'Oceanfront yoga flow followed by a locally sourced massage session.',
      },
      {
        id: 'act-slow-2',
        title: 'Assalah Souk Walk & Feteer Break',
        titleAr: 'جولة سوق عسلة وأكل فطير',
        timeSlot: SLOTS.afternoon,
        location: 'Assalah Souk',
        category: 'relax',
        estimatedPriceEGP: 250,
        description: 'Local crafts, spices and handmade feteer, at walking pace.',
      },
    ],
  };
}

function departureDay(): Omit<DeterministicDay, 'dayNumber'> {
  return {
    title: 'Souvenir Morning, Breakfast & Transfer Home',
    titleAr: 'صباح التذكارات والفطور والعودة',
    theme: 'Departure',
    activities: [
      {
        id: 'act-dep-1',
        title: 'Late Breakfast & Last Reef Look',
        titleAr: 'فطور متأخر وآخر نظرة للشعاب',
        timeSlot: SLOTS.morning,
        location: 'Mashraba Beachfront',
        category: 'relax',
        estimatedPriceEGP: 150,
        description: 'A quiet last swim on a calm gulf morning before checkout.',
      },
      {
        id: 'act-dep-2',
        title: 'Private Transfer to SSH Airport',
        titleAr: 'انتقال خاص إلى مطار شرم الشيخ',
        timeSlot: SLOTS.afternoon,
        location: 'Dahab → SSH Airport',
        category: 'transfer',
        estimatedPriceEGP: 1400,
        description: 'Door-to-door transfer timed to your flight window.',
      },
    ],
  };
}

/** Middle-day cycle: diving → safari → wellness. */
const MID_TEMPLATES = [divingDay, safariDay, wellnessDay];

export function buildDeterministicDays(durationDays: number): DeterministicDay[] {
  // 0 and negatives clamp to a single day trip; unparseable values fall back
  // to the route's 5-day default (same default as the destructured param).
  const parsed = Number(durationDays);
  const base = Number.isFinite(parsed) ? Math.floor(parsed) : 5;
  const n = Math.min(14, Math.max(1, base));
  if (n === 1) {
    return [{ ...arrivalDay(), dayNumber: 1 }];
  }
  const days: DeterministicDay[] = [{ ...arrivalDay(), dayNumber: 1 }];
  const midCount = n - 2;
  for (let i = 0; i < midCount; i++) {
    days.push({ ...MID_TEMPLATES[i % MID_TEMPLATES.length](), dayNumber: days.length + 1 });
  }
  days.push({ ...departureDay(), dayNumber: n });
  // Ensure every activity id is unique even when a template repeats.
  for (const day of days) {
    for (const act of day.activities) {
      act.id = `${act.id}-${day.dayNumber}`;
    }
  }
  return days;
}
