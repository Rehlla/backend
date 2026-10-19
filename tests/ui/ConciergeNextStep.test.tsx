import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ConciergeNextStep } from '../../src/components/home/concierge/ConciergeNextStep';
import { deriveTravelerLifecycle } from '../../src/services/travelerLifecycleResolver';
import { AHMED_TRIP_DAYS, AHMED_BOOKINGS } from '../../src/components/mytrip/myTripData';

/**
 * The gate's only untestable-in-the-node-project half is the wiring: it must
 * paint whatever `resolveHomeNextStep` decided — no hardcoded English, no
 * second decision — and its buttons must navigate to the route the resolver
 * named.
 *
 * A non-anonymous lifecycle cannot be produced in the browser without a
 * session, and the brief forbids creating one. So the real trip state is
 * injected through TripContext here instead: the app's own demo trip days and
 * bookings go through the app's own lifecycle resolver, and the resulting
 * snapshot is what the component reads.
 *
 * LanguageContext is mocked with an identity `t`, so a rendered dotted key is
 * positive proof the copy came from the resolver rather than this file.
 */

const navigateTo = vi.fn();
let injected: { lifecycle: unknown; activeTrip: { title?: string } | null };

vi.mock('../../src/context/TripContext', () => ({
  useTrip: () => ({
    lifecycle: injected.lifecycle,
    activeTrip: injected.activeTrip,
    navigateTo
  })
}));

vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', isRTL: false, t: (key: string) => key })
}));

afterEach(() => {
  cleanup();
  navigateTo.mockReset();
});

describe('ConciergeNextStep', () => {
  it('renders the booked-trip gate from an injected real trip', () => {
    injected = {
      lifecycle: deriveTravelerLifecycle({
        journeyStage: 'prepare',
        isAuthenticated: true,
        tripDays: AHMED_TRIP_DAYS,
        bookings: AHMED_BOOKINGS
      }),
      activeTrip: { title: 'Dahab, South Sinai' }
    };

    render(<ConciergeNextStep />);

    const card = document.getElementById('concierge-nextstep');
    expect(card?.getAttribute('data-nextstep')).toBe('PRE_TRIP');
    expect(screen.getByText('home.nextStep.preTrip.title')).toBeTruthy();
    expect(screen.getByText('home.nextStep.preTrip.primary')).toBeTruthy();
    // The reading is the real trip title, since no activity is running.
    expect(screen.getByText('Dahab, South Sinai')).toBeTruthy();

    fireEvent.click(screen.getByText('home.nextStep.preTrip.primary'));
    expect(navigateTo).toHaveBeenCalledWith('/my-trip');

    fireEvent.click(screen.getByText('home.nextStep.preTrip.secondary'));
    expect(navigateTo).toHaveBeenCalledWith('/help');
  });

  it('shows the running activity and its own actions mid-trip', () => {
    injected = {
      lifecycle: {
        lifecyclePhase: 'ACTIVE_TRIP',
        locationSignal: { state: 'IN_DAHAB', source: 'INFERRED_SCHEDULE', confidence: 0.85, freshness: 'RECENT' },
        bookingState: 'BOOKING_CONFIRMED',
        timeContext: 'MIDDAY',
        isDisrupted: false,
        hasActiveActivity: true,
        activeActivityTitle: 'Lighthouse reef snorkel',
        hasRecentFinishedActivity: false,
        freeWindowMinutes: 30,
        explanation: 'test'
      },
      activeTrip: { title: 'Dahab, South Sinai' }
    };

    render(<ConciergeNextStep />);

    expect(document.getElementById('concierge-nextstep')?.getAttribute('data-nextstep')).toBe('ACTIVE_TRIP');
    expect(screen.getByText('home.nextStep.activeTrip.body')).toBeTruthy();
    // Activity name outranks the trip title.
    expect(screen.getByText('Lighthouse reef snorkel')).toBeTruthy();

    fireEvent.click(screen.getByText('home.nextStep.activeTrip.secondary'));
    expect(navigateTo).toHaveBeenCalledWith('/food');
  });
});
