import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabParties } from '../../server/db/seeds/importDahabParties';
import {
  PartyServiceError,
  adminCreateParty,
  adminDeleteParty,
  adminListParties,
  adminSetLicenseVerified,
  adminUpdateParty,
  getPartyById,
  listParties,
  listTonightParties,
  listZones,
  partyOccursOn,
  recordBookIntent,
  resetPartyCacheForTests
} from '../../server/services/dahabPartyService';
import {
  normalizeWhatsappNumber,
  partyWhatsappMessage,
  partyWhatsappUrl
} from '../../src/shared/dahabParties';
import type { DahabPartyEntity } from '../../server/db/schema';

/**
 * The behaviours that make this DAHAB nightlife and not generic nightlife:
 *
 *   - meeting points + WhatsApp, never hotel pickup or a card gateway;
 *   - the licence gate: unverified rows never reach a public read;
 *   - tonight logic keyed to how Dahab actually parties (daily beach bars,
 *     weekly psytrance, monthly full moons);
 *   - the 6h cache, which is what prices tonight in <2s on Sinai internet.
 */

const FRIDAY = '2026-10-16'; // (today is Thu 2026-10-15)
const SATURDAY = '2026-10-17';
const FULL_MOON_NIGHT = '2026-11-04';

beforeAll(() => {
  importDahabParties();
});

beforeEach(() => {
  // Frozen clock: the 6h cache must be deterministic under test.
  resetPartyCacheForTests(() => 1_000_000_000);
});

const seedRow = (id: string): DahabPartyEntity => {
  const row = db.dahabParties.find(p => p.id === id);
  if (!row) throw new Error(`test expects seeded party ${id}`);
  return row;
};

describe('seed importer', () => {
  it('imports the curated catalogue and is idempotent', () => {
    const before = db.dahabParties.length;
    const result = importDahabParties();
    expect(result.total).toBe(before);
    // A second import converges the same rows: no duplicates, no churn.
    expect(db.dahabParties.length).toBe(before);
    const ids = db.dahabParties.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every party category the product promises', () => {
    const categories = new Set(db.dahabParties.map(p => p.category));
    expect(categories).toContain('full_moon_desert');
    expect(categories).toContain('beach_bar_live');
    expect(categories).toContain('psytrance_weekly');
    expect(categories).toContain('bonfire_community');
    expect(categories).toContain('wellness_party');
    expect(categories).toContain('night_adventure');
    expect(categories).toContain('rooftop_chill');
  });
});

describe('tonight logic (partyOccursOn)', () => {
  it('daily beach bars happen every night', () => {
    expect(partyOccursOn(seedRow('blue_beach_bar_live'), FRIDAY)).toBe(true);
    expect(partyOccursOn(seedRow('blue_beach_bar_live'), SATURDAY)).toBe(true);
  });

  it('weekly parties only on their day', () => {
    expect(partyOccursOn(seedRow('acacia_psytrance_weekly'), FRIDAY)).toBe(true);
    expect(partyOccursOn(seedRow('acacia_psytrance_weekly'), SATURDAY)).toBe(false);
    expect(partyOccursOn(seedRow('bonfire_asala_community'), SATURDAY)).toBe(true);
    expect(partyOccursOn(seedRow('bonfire_asala_community'), FRIDAY)).toBe(false);
  });

  it('monthly full moons only on their nextDate', () => {
    const fullMoon = seedRow('dahab_full_moon_blaze');
    expect(partyOccursOn(fullMoon, FULL_MOON_NIGHT)).toBe(true);
    expect(partyOccursOn(fullMoon, FRIDAY)).toBe(false);
  });

  it('listTonightParties matches the calendar', () => {
    const friday = listTonightParties(FRIDAY);
    expect(friday.parties.map(p => p.id)).toContain('acacia_psytrance_weekly');
    expect(friday.parties.map(p => p.id)).not.toContain('bonfire_asala_community');
    const saturday = listTonightParties(SATURDAY);
    expect(saturday.parties.map(p => p.id)).toContain('bonfire_asala_community');
    expect(saturday.parties.map(p => p.id)).not.toContain('acacia_psytrance_weekly');
  });
});

describe('the licence gate', () => {
  it('public reads only ever serve licenseVerified rows', () => {
    const hidden = adminCreateParty(
      {
        nameEn: 'Secret Rave',
        nameAr: 'ريف مخفي',
        venueName: 'Nowhere',
        category: 'psytrance_weekly',
        zone: 'lagoon',
        frequency: 'weekly',
        days: ['Friday'],
        startTime: '23:00',
        priceModel: 'ticket',
        priceEgp: 100,
        entryType: 'free',
        meetingPointName: 'Lagoon parking',
        meetingPointLat: 28.528,
        meetingPointLng: 34.523,
        bookingType: 'walkin',
        durationHours: 4,
        licenseVerified: false
      },
      'ops-user'
    );
    expect(listParties().parties.map(p => p.id)).not.toContain(hidden.id);
    expect(adminListParties().parties.map(p => p.id)).toContain(hidden.id);
    expect(() => getPartyById(hidden.id)).toThrowError(PartyServiceError);
    adminDeleteParty(hidden.id, 'ops-user');
  });
});

describe('list filters', () => {
  it('filters by zone, category and free entry', () => {
    expect(listParties({ zone: 'wadi_qnai' }).parties.every(p => p.zone === 'wadi_qnai')).toBe(true);
    expect(listParties({ category: 'wellness_party' }).parties.every(p => p.category === 'wellness_party')).toBe(true);
    expect(listParties({ freeOnly: true }).parties.every(p => p.priceModel === 'free')).toBe(true);
    expect(listParties({ priceMaxEgp: 200 }).parties.every(p => p.priceEgp <= 200)).toBe(true);
  });

  it('the full moon carries its separate transport leg', () => {
    const fullMoon = getPartyById('dahab_full_moon_blaze');
    expect(fullMoon.priceEgp).toBe(500);
    expect(fullMoon.transportEgp).toBe(200);
  });

  it('zones come back with live counts', () => {
    const { zones } = listZones();
    const mamsha = zones.find(z => z.id === 'mamsha');
    expect(mamsha?.partyCount).toBeGreaterThan(0);
    expect(zones.length).toBe(6);
  });
});

describe('the 6-hour cache', () => {
  it('serves the second read from cache and expires after 6h', () => {
    const first = listParties();
    expect(first.fromCache).toBe(false);
    const second = listParties();
    expect(second.fromCache).toBe(true);

    // 6 hours + 1ms later: stale, rebuilt.
    resetPartyCacheForTests(() => 1_000_000_000 + 6 * 60 * 60 * 1000 + 1);
    const third = listParties();
    expect(third.fromCache).toBe(false);
  });

  it('an admin write invalidates the cache', () => {
    expect(listParties().fromCache).toBe(false);
    expect(listParties().fromCache).toBe(true);
    adminSetLicenseVerified('ali_baba_rooftop_chill', true, 'ops-user');
    expect(listParties().fromCache).toBe(false);
  });
});

describe('WhatsApp booking', () => {
  it('renders the bilingual message and the wa.me link', () => {
    expect(normalizeWhatsappNumber('+20 100 123 4567')).toBe('+201001234567');
    const message = partyWhatsappMessage(
      { nameEn: 'Full Moon Party', nameAr: 'حفلة اكتمال القمر' },
      'ar',
      { date: FRIDAY, persons: 2 }
    );
    expect(message).toContain('حفلة اكتمال القمر');
    expect(message).toContain(FRIDAY);
    expect(message).toContain('2 أشخاص');
    const url = partyWhatsappUrl('+201001234567', message);
    expect(url.startsWith('https://wa.me/201001234567?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent(message));
  });

  it('records the intent, increments the counter and logs the row', () => {
    const before = seedRow('acacia_psytrance_weekly').bookingIntentCount;
    const intentsBefore = db.dahabPartyIntents.length;
    const res = recordBookIntent('acacia_psytrance_weekly', {
      targetDate: FRIDAY,
      persons: 3,
      language: 'en',
      userId: 'traveler-1'
    });
    expect(res.intentCount).toBe(before + 1);
    expect(db.dahabPartyIntents.length).toBe(intentsBefore + 1);
    const logged = db.dahabPartyIntents[db.dahabPartyIntents.length - 1];
    expect(logged.partyId).toBe('acacia_psytrance_weekly');
    expect(logged.persons).toBe(3);
    expect(logged.userId).toBe('traveler-1');
    expect(res.whatsappUrl).toMatch(/wa\.me\/\d+\?text=/);
  });

  it('refuses walk-in parties', () => {
    expect(() =>
      recordBookIntent('blue_beach_bar_live', { targetDate: FRIDAY, persons: 1, language: 'en' })
    ).toThrowError(PartyServiceError);
  });
});

describe('admin CRUD', () => {
  it('creates, updates, verifies and deletes with an audit trail', () => {
    const created = adminCreateParty(
      {
        nameEn: 'Test Rooftop',
        nameAr: 'روف تجريبي',
        venueName: 'Test venue',
        category: 'rooftop_chill',
        zone: 'lighthouse',
        frequency: 'daily',
        startTime: '19:00',
        priceModel: 'free',
        priceEgp: 0,
        entryType: 'free',
        meetingPointName: 'Test bridge',
        meetingPointLat: 28.5,
        meetingPointLng: 34.5,
        bookingType: 'walkin',
        durationHours: 3,
        licenseVerified: false
      },
      'ops-user'
    );
    expect(created.id.startsWith('party_admin_')).toBe(true);
    expect(created.updatedBy).toBe('ops-user');

    adminSetLicenseVerified(created.id, true, 'ops-user');
    expect(getPartyById(created.id).licenseVerified).toBe(true);

    const updated = adminUpdateParty(created.id, { priceEgp: 150, priceModel: 'ticket' }, 'ops-user');
    expect(updated.priceEgp).toBe(150);
    expect(updated.updatedBy).toBe('ops-user');

    adminDeleteParty(created.id, 'ops-user');
    expect(db.dahabParties.some(p => p.id === created.id)).toBe(false);
  });

  it('rejects malformed payloads at the gate', () => {
    expect(() =>
      adminCreateParty({ nameEn: '', nameAr: 'x', venueName: 'x', meetingPointName: 'x' }, 'ops-user')
    ).toThrowError(PartyServiceError);
    expect(() =>
      adminCreateParty(
        {
          nameEn: 'No meeting point coords',
          nameAr: 'بدون إحداثيات',
          venueName: 'x',
          category: 'beach_bar_live',
          zone: 'mamsha',
          frequency: 'daily',
          startTime: '20:00',
          priceModel: 'free',
          priceEgp: 0,
          entryType: 'free',
          meetingPointName: 'x',
          meetingPointLat: 999, // not a latitude
          meetingPointLng: 34.5,
          bookingType: 'walkin',
          durationHours: 2
        },
        'ops-user'
      )
    ).toThrowError(PartyServiceError);
  });
});
