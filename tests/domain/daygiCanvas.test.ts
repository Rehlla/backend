import { describe, expect, it } from 'vitest';
import {
  buildCanvasDocument,
  attachCanvasDocument,
  spotFor,
  matchVenueMedia
} from '../../server/services/daygiCanvasService';
import type { DayGiResponse } from '../../src/shared';

/**
 * The plan canvas is a lift of plan-shaped action data into a day-grouped
 * document rendered beside the chat. These tests pin the derivation rules:
 * which payloads produce a canvas, which produce none, and that the response
 * is never mutated in place.
 */

function multiOptionsResponse(): DayGiResponse {
  return {
    replyText: 'Three calm options after your dive.',
    replyTextAr: 'ثلاثة خيارات هادية بعد غطستك.',
    whyThis: 'Grounded on dive exit time.',
    whyThisAr: 'مبني على وقت نهاية الغوص.',
    actionType: 'MULTI_STEP_OPTIONS',
    actionRisk: 'COMMERCE',
    actionTitle: 'Post-dive calm options',
    actionTitleAr: 'خيارات هادية بعد الغوص',
    multiOptions: {
      postActivityContext: {
        originalActivity: 'Canyon dive',
        originalActivityAr: 'غطسة الكانيون',
        endTime: '01:30 PM',
        location: 'your dive site',
        availableWindowMins: 180
      },
      options: [
        {
          id: 'OPT-RELAX-01',
          titleEn: 'Ali Baba Seafood',
          titleAr: 'علي بابا للسمك',
          category: 'FOOD',
          location: 'Lighthouse Promenade',
          travelTimeMins: 15,
          priceEGP: 350,
          whyItFitsEn: 'Zero delay from dive exit.',
          whyItFitsAr: 'صفر تأخير من نهاية الغوص.',
          skuId: 'SKU-FOOD-001',
          actionKey: 'CONFIRM_DIRECT_BOOKING'
        },
        {
          id: 'OPT-RELAX-02',
          titleEn: 'Bedouin tea lounge',
          titleAr: 'جلسة شاي بدوي',
          category: 'RELAX',
          location: 'Lighthouse Promenade',
          travelTimeMins: 12,
          priceEGP: 80,
          whyItFitsEn: 'Shaded cushions by the water.',
          whyItFitsAr: 'وسائد مظللة على البحر.'
        }
      ]
    }
  };
}

function briefingResponse(): DayGiResponse {
  return {
    replyText: 'Good morning.',
    replyTextAr: 'صباح الخير.',
    whyThis: 'From your itinerary.',
    whyThisAr: 'من جدولك.',
    actionType: 'DAILY_BRIEFING',
    actionRisk: 'READ_ONLY',
    actionTitle: 'Daily briefing',
    actionTitleAr: 'موجز اليوم',
    actionData: {
      dailyBriefing: {
        dateFormatted: 'Today · Dahab Coastal Zone',
        timeline: [
          { time: '08:30 AM', title: 'Bedouin breakfast', titleAr: 'إفطار بدوي', type: 'MEAL' },
          { time: '10:30 AM', title: 'Lighthouse snorkeling', titleAr: 'سنوركلينج اللايتهاوس', type: 'ACTIVITY' }
        ],
        freeWindows: [
          { start: '03:00 PM', end: '05:00 PM', durationMins: 120, location: 'Lighthouse Promenade' }
        ],
        conditionsNote: 'CDWS Green Flag.',
        conditionsNoteAr: 'الراية الخضراء مرفوعة.'
      }
    }
  };
}

function proseOnlyResponse(): DayGiResponse {
  return {
    replyText: 'The reef is calm today.',
    replyTextAr: 'الشعاب هادية النهاردة.',
    whyThis: 'Marine feed.',
    whyThisAr: 'تقرير بحري.',
    actionType: 'RECOMMENDATION',
    actionRisk: 'READ_ONLY',
    actionData: {
      practicalTips: ['Walk in from the sandy entrance.']
    }
  };
}

describe('buildCanvasDocument', () => {
  it('builds one Options group from multi-step options with bilingual cards', () => {
    const canvas = buildCanvasDocument(multiOptionsResponse(), 'هات حاجة هادية بعد الغوص');
    expect(canvas).not.toBeNull();
    expect(canvas!.days).toHaveLength(1);
    const group = canvas!.days[0];
    expect(group.label).toBe('Options');
    expect(group.labelAr).toBe('خيارات');
    expect(group.title).toBe('Post-dive calm options');
    expect(group.items).toHaveLength(2);

    const first = group.items[0];
    expect(first.id).toBe('OPT-RELAX-01');
    expect(first.name).toBe('Ali Baba Seafood');
    expect(first.nameAr).toBe('علي بابا للسمك');
    expect(first.kind).toBe('FOOD');
    expect(first.priceEGP).toBe(350);
    expect(first.blurb).toBe('Zero delay from dive exit.');
    expect(first.blurbAr).toBe('صفر تأخير من نهاية الغوص.');
    expect(first.skuId).toBe('SKU-FOOD-001');
    expect(first.actionKey).toBe('CONFIRM_DIRECT_BOOKING');
    // Known spot text on the option resolves to a mappable canvas spot.
    expect(first.spot?.key).toBe('LIGHTHOUSE');
  });

  it('builds a Today group from a daily briefing with timeline, free windows and conditions', () => {
    const canvas = buildCanvasDocument(briefingResponse(), 'موجز اليوم');
    expect(canvas).not.toBeNull();
    const group = canvas!.days[0];
    expect(group.label).toBe('Today');
    expect(group.labelAr).toBe('اليوم');
    expect(group.title).toBe('Today · Dahab Coastal Zone');
    // Two timeline entries + one free window + one conditions note.
    expect(group.items).toHaveLength(4);
    expect(group.items[0].kind).toBe('FOOD');
    expect(group.items[0].time).toBe('08:30 AM');
    expect(group.items[2].kind).toBe('RELAX');
    expect(group.items[2].name).toContain('03:00 PM');
    expect(group.items[3].kind).toBe('NOTE');
    expect(group.items[3].nameAr).toBe('الراية الخضراء مرفوعة.');
  });

  it('builds a Nearby group from dining recommendation items', () => {
    const response: DayGiResponse = {
      ...proseOnlyResponse(),
      actionTitle: 'Seafood tonight',
      actionTitleAr: 'سمك الليلة',
      actionData: {
        recommendationItems: [
          {
            id: 'REC-1',
            name: 'Ali Baba',
            nameAr: 'علي بابا',
            distanceWalk: '10 min walk',
            priceTier: 'EGP',
            specialty: 'Grilled calamari',
            specialtyAr: 'كاليماري مشوي',
            openingHours: '12:00 – 23:00'
          }
        ]
      }
    };
    const canvas = buildCanvasDocument(response, 'ناكل سمك فين');
    expect(canvas).not.toBeNull();
    expect(canvas!.days[0].label).toBe('Nearby');
    expect(canvas!.days[0].items[0].kind).toBe('FOOD');
    expect(canvas!.days[0].items[0].blurb).toContain('Grilled calamari');
  });

  it('builds an Alternatives group from recovery alternatives', () => {
    const response: DayGiResponse = {
      ...proseOnlyResponse(),
      actionTitle: 'Recovery options',
      actionTitleAr: 'خيارات التعافي',
      actionData: {
        recoveryProposal: {
          whatChanged: 'High wind on open canyons.',
          whatChangedAr: 'رياح قوية على الكانيون.',
          whatItAffects: 'Canyon dive',
          whatItAffectsAr: 'غطسة الكانيون',
          originalItemId: 'act-canyon-dive',
          alternatives: [
            {
              id: 'SKU-SAF-002',
              title: 'Laguna windsurfing',
              titleAr: 'ويند سيرفنج اللاجونا',
              priceVarianceEGP: -900,
              scheduleImpact: 'Same time slot · EGP 900 credited.',
              scheduleImpactAr: 'نفس التوقيت · استرداد ٩٠٠ جنيه.',
              serviceType: 'safari'
            }
          ]
        }
      }
    };
    const canvas = buildCanvasDocument(response, 'الغطسة اتلغت');
    expect(canvas).not.toBeNull();
    expect(canvas!.days[0].label).toBe('Alternatives');
    expect(canvas!.days[0].labelAr).toBe('البدائل');
    expect(canvas!.days[0].items[0].name).toBe('Laguna windsurfing');
  });

  it('returns null for prose-only responses with no plan-shaped data', () => {
    expect(buildCanvasDocument(proseOnlyResponse(), 'any')).toBeNull();
  });

  it('returns null when the only plan source has no items', () => {
    const response = multiOptionsResponse();
    response.multiOptions = { options: [] };
    expect(buildCanvasDocument(response, 'any')).toBeNull();
  });

  it('produces unique document ids across builds', () => {
    const a = buildCanvasDocument(multiOptionsResponse(), 'q1');
    const b = buildCanvasDocument(multiOptionsResponse(), 'q2');
    expect(a!.id).not.toBe(b!.id);
  });
});

describe('spotFor', () => {
  it('resolves the free-text locations the action data actually uses', () => {
    expect(spotFor('Lighthouse Promenade')?.key).toBe('LIGHTHOUSE');
    expect(spotFor('Lighthouse Bay')?.key).toBe('LIGHTHOUSE');
    expect(spotFor('Canyon Marine Sanctuary')?.key).toBe('CANYON');
    expect(spotFor('Eel Garden Cushions')?.key).toBe('EEL_GARDEN');
    expect(spotFor('The Laguna')?.key).toBe('LAGUNA');
    expect(spotFor('Blue Hole circuit')?.key).toBe('BLUE_HOLE');
  });

  it('returns undefined for unknown spots and carries coordinates for known ones', () => {
    expect(spotFor('Somewhere else entirely')).toBeUndefined();
    expect(spotFor(undefined)).toBeUndefined();
    const spot = spotFor('Blue Hole');
    expect(spot!.lat).toBeGreaterThan(28.5);
    expect(spot!.lng).toBeGreaterThan(34.5);
  });

  it('is case-insensitive', () => {
    expect(spotFor('LIGHTHOUSE PROMENADE')?.key).toBe('LIGHTHOUSE');
    expect(spotFor('blue hole')?.key).toBe('BLUE_HOLE');
  });
});

describe('matchVenueMedia', () => {
  const records = [
    { tokens: ['ali', 'baba', 'restaurant'], media: { imageUrl: '/images/ali.jpg', rating: 4.6, reviewCount: 1367 } },
    { tokens: ['eel', 'garden', 'view', 'restaurant'], media: { imageUrl: '/images/eel.jpg', rating: 4.4, reviewCount: 212 } }
  ];

  it('matches on the record head appearing in a longer item name', () => {
    const hit = matchVenueMedia('Ali Baba Waterfront Fresh Seafood Catch', records);
    expect(hit?.imageUrl).toBe('/images/ali.jpg');
    expect(hit?.rating).toBe(4.6);
    expect(hit?.reviewCount).toBe(1367);
  });

  it('matches Arabic heads in Arabic item names', () => {
    const arRecords = [{ tokens: ['علي', 'بابا', 'للمأكولات'], media: { imageUrl: '/images/ali.jpg' } }];
    expect(matchVenueMedia('غداء سمك في علي بابا على الممشى', arRecords)?.imageUrl).toBe('/images/ali.jpg');
  });

  it('refuses generic single-word and short-name matches', () => {
    expect(matchVenueMedia('Seafood dinner', records)).toBeUndefined();
    expect(matchVenueMedia('Dahab', records)).toBeUndefined();
    expect(matchVenueMedia('A', records)).toBeUndefined();
    expect(matchVenueMedia(undefined, records)).toBeUndefined();
  });

  it('returns undefined when nothing matches, leaving the item imageless', () => {
    expect(matchVenueMedia('Sunset Gathering at Eel Garden Cushions', records)?.imageUrl).toBe('/images/eel.jpg');
    expect(matchVenueMedia('Glass Bottom Boat Trip in Dahab', records)).toBeUndefined();
  });
});

describe('attachCanvasDocument', () => {
  it('attaches a canvas immutably when the response carries plan data', () => {
    const response = multiOptionsResponse();
    const attached = attachCanvasDocument(response, 'هات حاجة هادية');
    expect(attached).not.toBe(response);
    expect(attached.canvas).not.toBeNull();
    expect(attached.canvas!.sourcePrompt).toBe('هات حاجة هادية');
    expect(response.canvas).toBeUndefined();
  });

  it('returns the same response untouched when no canvas can be derived', () => {
    const response = proseOnlyResponse();
    const result = attachCanvasDocument(response, 'any');
    expect(result).toBe(response);
    expect(result.canvas).toBeUndefined();
  });
});
