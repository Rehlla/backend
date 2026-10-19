import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveHomeNextStep } from '../../src/services/homeNextStepResolver';
import type { AppRoute } from '../../src/types';
import {
  deriveTravelerLifecycle,
  type TravelerLifecyclePhase,
  type TravelerLifecycleSnapshot
} from '../../src/services/travelerLifecycleResolver';
import { TRANSLATIONS } from '../../src/i18n/translations';

/**
 * The homepage gate is one pure decision, so it can be asserted exhaustively
 * here — every phase, every key, every route — instead of being eyeballed in
 * a browser.
 *
 * Two guards below are the point of this file, not the copy:
 *   - every key the resolver emits must exist in the catalog in BOTH languages
 *     (a missing key renders the raw key on the homepage);
 *   - every route it emits must exist as a `case` in App.tsx's router. A route
 *     that is not routed is a CTA that dead-ends, which is exactly the kind of
 *     invented destination the phase brief forbids.
 */

const PHASES: TravelerLifecyclePhase[] = [
  'DISCOVERY',
  'BOOKING',
  'PRE_TRIP',
  'IN_TRANSIT',
  'ARRIVAL',
  'IN_DAHAB',
  'ACTIVE_TRIP',
  'DISRUPTED',
  'DEPARTURE',
  'POST_TRIP'
];

/** A structurally valid snapshot for a phase, with nothing else filled in. */
const snapshotFor = (lifecyclePhase: TravelerLifecyclePhase): TravelerLifecycleSnapshot => ({
  lifecyclePhase,
  locationSignal: { state: 'UNKNOWN', source: 'UNKNOWN', confidence: 0.2, freshness: 'UNKNOWN' },
  bookingState: 'NO_BOOKING',
  timeContext: 'BEFORE_TRIP',
  isDisrupted: lifecyclePhase === 'DISRUPTED',
  hasActiveActivity: false,
  hasRecentFinishedActivity: false,
  freeWindowMinutes: 0,
  explanation: 'test'
});

const ROUTES = (): AppRoute[] =>
  PHASES.flatMap((phase) => {
    const step = resolveHomeNextStep(snapshotFor(phase));
    return [step.primaryRoute, step.secondaryRoute].filter((r): r is AppRoute => Boolean(r));
  });

describe('resolveHomeNextStep', () => {
  it('covers every lifecycle phase with distinct copy', () => {
    const seen = PHASES.map((phase) => {
      const step = resolveHomeNextStep(snapshotFor(phase));
      expect(step.mode).toBe(phase);
      expect(step.eyebrowKey).not.toBe('');
      expect(step.titleKey).not.toBe('');
      expect(step.bodyKey).not.toBe('');
      expect(step.primaryKey).not.toBe('');
      return step.titleKey;
    });

    // Distinct titles: two phases sharing a title would mean the card does not
    // actually tell the traveler which state they are in.
    expect(new Set(seen).size).toBe(PHASES.length);
  });

  it('emits only keys that exist in the catalog in both languages', () => {
    for (const phase of PHASES) {
      const step = resolveHomeNextStep(snapshotFor(phase));
      const keys = [
        step.eyebrowKey,
        step.titleKey,
        step.bodyKey,
        step.primaryKey,
        step.secondaryKey
      ].filter((k): k is string => Boolean(k));

      for (const key of keys) {
        const entry = TRANSLATIONS[key];
        expect(entry, `missing catalog key: ${key}`).toBeDefined();
        expect(entry.en.trim(), `missing EN copy: ${key}`).not.toBe('');
        expect(entry.ar.trim(), `missing AR copy: ${key}`).not.toBe('');
      }
    }
  });

  it('emits only routes the router actually handles', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    for (const route of ROUTES()) {
      expect(app.includes(`case '${route}':`), `no router case for ${route}`).toBe(true);
    }
  });

  it('does not call a trip "set" while an operator has yet to confirm', () => {
    const settled = resolveHomeNextStep(snapshotFor('PRE_TRIP'), { pendingBookings: 0 });
    expect(settled.titleKey).toBe('home.nextStep.preTrip.title');

    const waiting = resolveHomeNextStep(snapshotFor('PRE_TRIP'), { pendingBookings: 2 });
    expect(waiting.titleKey).toBe('home.nextStep.preTrip.titlePending');
    expect(waiting.bodyKey).toBe('home.nextStep.preTrip.bodyPending');
    expect(waiting.primaryRoute).toBe('/my-trip');
    for (const key of [waiting.titleKey, waiting.bodyKey]) {
      expect(TRANSLATIONS[key]?.en.trim()).toBeTruthy();
      expect(TRANSLATIONS[key]?.ar.trim()).toBeTruthy();
    }

    // Other phases keep their own copy whatever is pending.
    expect(resolveHomeNextStep(snapshotFor('IN_DAHAB'), { pendingBookings: 2 }).titleKey).toBe(
      'home.nextStep.inDahab.title'
    );
  });

  it('omits liveValue when there is no real reading', () => {
    const step = resolveHomeNextStep(snapshotFor('DISCOVERY'), { activeTrip: null });
    expect(step.liveValue).toBeUndefined();
    expect('liveValue' in step).toBe(false);
  });

  it('uses the running activity as the reading, and the trip title only as fallback', () => {
    const withActivity: TravelerLifecycleSnapshot = {
      ...snapshotFor('IN_DAHAB'),
      activeActivityTitle: 'Lighthouse reef snorkel'
    };
    expect(
      resolveHomeNextStep(withActivity, { activeTrip: { title: 'Dahab week' } }).liveValue
    ).toBe('Lighthouse reef snorkel');

    // Whitespace is not a reading.
    expect(
      resolveHomeNextStep({ ...withActivity, activeActivityTitle: '   ' }, {
        activeTrip: { title: 'Dahab week' }
      }).liveValue
    ).toBe('Dahab week');

    expect(
      resolveHomeNextStep(snapshotFor('PRE_TRIP'), { activeTrip: { title: '  ' } }).liveValue
    ).toBeUndefined();
  });
});

describe('lifecycle → gate integration', () => {
  it('keeps an anonymous visitor in DISCOVERY even mid-trip flags', () => {
    const lifecycle = deriveTravelerLifecycle({
      journeyStage: 'experience',
      isAuthenticated: false
    });
    expect(resolveHomeNextStep(lifecycle).mode).toBe('DISCOVERY');
  });

  it('maps real derived snapshots to their phases', () => {
    const cases: Array<{ params: Parameters<typeof deriveTravelerLifecycle>[0]; phase: TravelerLifecyclePhase }> = [
      { params: { journeyStage: 'plan', isAuthenticated: true }, phase: 'BOOKING' },
      { params: { journeyStage: 'prepare', isAuthenticated: true }, phase: 'PRE_TRIP' },
      { params: { journeyStage: 'arrive', isAuthenticated: true }, phase: 'ARRIVAL' },
      { params: { journeyStage: 'experience', isAuthenticated: true }, phase: 'IN_DAHAB' },
      { params: { journeyStage: 'recovery', isAuthenticated: true }, phase: 'DISRUPTED' },
      { params: { journeyStage: 'departure', isAuthenticated: true }, phase: 'DEPARTURE' },
      { params: { journeyStage: 'post_trip', isAuthenticated: true }, phase: 'POST_TRIP' }
    ];

    for (const { params, phase } of cases) {
      const lifecycle = deriveTravelerLifecycle(params);
      expect(lifecycle.lifecyclePhase, `derivation for ${JSON.stringify(params)}`).toBe(phase);
      expect(resolveHomeNextStep(lifecycle).mode).toBe(phase);
    }
  });
});
