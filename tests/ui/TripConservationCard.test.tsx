import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TripConservationCard } from '../../src/components/mytrip/sections/TripConservationCard';
import { api } from '../../src/services/api';

/**
 * TripConservationCard is the traveler's half of the reef loop: their own
 * points, this trip's eco-action history, and the shared logging form. These
 * tests pin the same honesty rules as the supplier side:
 *  - an unreachable record renders an em dash, never an invented zero,
 *  - history is filtered to THIS trip,
 *  - only completed/captured bookings of this trip are offered,
 *  - the payload carries the selected booking's real trip + supplier ids.
 *
 * Note: vitest.ui.config.ts runs without globals — cleanup() must be explicit.
 */
vi.mock('../../src/services/api', () => ({
  api: {
    getMyReefLogs: vi.fn(),
    getTripBookings: vi.fn(),
    logReefAction: vi.fn(),
  },
}));

vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    isRTL: false,
    t: (key: string) => key,
  }),
}));

const mockedApi = vi.mocked(api, true);

const completedBooking = {
  id: 'BK-1', bookingRef: 'DAH-2001', tripId: 'TRIP-1', supplierId: 'SUP-1',
  serviceType: 'diving', scheduledDate: '2026-09-01',
  paymentState: 'CAPTURED', supplierState: 'COMPLETED',
};
const pendingBooking = {
  id: 'BK-2', bookingRef: 'DAH-2002', tripId: 'TRIP-1', supplierId: 'SUP-2',
  serviceType: 'transfer', scheduledDate: '2026-09-05',
  paymentState: 'PENDING', supplierState: 'PENDING_CONFIRMATION',
};

const logForThisTrip = {
  id: 'REEF-1', bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1',
  actionType: 'coral_planting', description: 'Planted corals at Three Pools',
  pointsAwarded: 20, loggedBy: 'supplier', createdAt: '2026-09-02T10:00:00.000Z',
};
const logForOtherTrip = {
  id: 'REEF-2', bookingId: 'BK-9', tripId: 'TRIP-9', supplierId: 'SUP-9',
  actionType: 'beach_cleanup', description: 'Other trip cleanup',
  pointsAwarded: 15, loggedBy: 'traveler', createdAt: '2026-08-01T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TripConservationCard', () => {
  it('renders nothing without a trip id', () => {
    const { container } = render(<TripConservationCard />);
    expect(container.firstChild).toBeNull();
    expect(mockedApi.getMyReefLogs).not.toHaveBeenCalled();
  });

  it('shows total points and only this trip\'s eco-action history', async () => {
    mockedApi.getMyReefLogs.mockResolvedValue({ logs: [logForThisTrip, logForOtherTrip], totalPoints: 35 });
    mockedApi.getTripBookings.mockResolvedValue({ tripId: 'TRIP-1', bookings: [completedBooking, pendingBooking], items: [] });

    render(<TripConservationCard tripId="TRIP-1" />);

    await waitFor(() => expect(screen.getByText('35')).toBeTruthy());
    expect(screen.getByText('Planted corals at Three Pools')).toBeTruthy();
    // A log from another trip must not appear in this trip's history.
    expect(screen.queryByText('Other trip cleanup')).toBeNull();
  });

  it('renders an em dash, not an invented zero, when the record is unreachable', async () => {
    mockedApi.getMyReefLogs.mockResolvedValue(null);
    mockedApi.getTripBookings.mockResolvedValue({ tripId: 'TRIP-1', bookings: [completedBooking], items: [] });

    render(<TripConservationCard tripId="TRIP-1" />);

    await waitFor(() => expect(screen.getByText('trip.conservation.unavailable')).toBeTruthy());
    // No zero anywhere: points render as an em dash until the server answers.
    expect(screen.queryByText(/^0$/)).toBeNull();
  });

  it('offers only completed/captured bookings of this trip for logging', async () => {
    mockedApi.getMyReefLogs.mockResolvedValue({ logs: [], totalPoints: 0 });
    mockedApi.getTripBookings.mockResolvedValue({ tripId: 'TRIP-1', bookings: [completedBooking, pendingBooking], items: [] });

    render(<TripConservationCard tripId="TRIP-1" />);

    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'reefLogger.title' })));
    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-2001/ })).toBeTruthy());
    // The pending booking of the SAME trip is not eligible yet.
    expect(screen.queryByRole('option', { name: /DAH-2002/ })).toBeNull();
  });

  it('submits the selected booking\'s real trip and supplier ids', async () => {
    mockedApi.getMyReefLogs.mockResolvedValue({ logs: [], totalPoints: 0 });
    mockedApi.getTripBookings.mockResolvedValue({ tripId: 'TRIP-1', bookings: [completedBooking], items: [] });
    mockedApi.logReefAction.mockResolvedValue({ log: { id: 'REEF-3', pointsAwarded: 20, loggedBy: 'traveler' } });

    render(<TripConservationCard tripId="TRIP-1" />);

    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'reefLogger.title' })));
    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-2001/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('reefLogger.bookingLabel'), { target: { value: 'BK-1' } });
    fireEvent.change(screen.getByLabelText('reefLogger.descriptionLabel'), { target: { value: 'Reef-safe briefing + cleanup dive' } });
    fireEvent.click(screen.getByRole('button', { name: 'reefLogger.submit' }));

    await waitFor(() => expect(mockedApi.logReefAction).toHaveBeenCalledWith({
      bookingId: 'BK-1',
      tripId: 'TRIP-1',
      supplierId: 'SUP-1',
      actionType: 'coral_planting',
      description: 'Reef-safe briefing + cleanup dive',
    }));
    // Success banner confirms the awarded points.
    await waitFor(() => expect(screen.getByText('reefLogger.success')).toBeTruthy());
  });

  it('reloads the record after a successful log', async () => {
    mockedApi.getMyReefLogs
      .mockResolvedValueOnce({ logs: [], totalPoints: 0 })
      .mockResolvedValueOnce({ logs: [logForThisTrip], totalPoints: 20 });
    mockedApi.getTripBookings.mockResolvedValue({ tripId: 'TRIP-1', bookings: [completedBooking], items: [] });
    mockedApi.logReefAction.mockResolvedValue({ log: { id: 'REEF-3', pointsAwarded: 20, loggedBy: 'traveler' } });

    render(<TripConservationCard tripId="TRIP-1" />);

    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'reefLogger.title' })));
    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-2001/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('reefLogger.bookingLabel'), { target: { value: 'BK-1' } });
    fireEvent.change(screen.getByLabelText('reefLogger.descriptionLabel'), { target: { value: 'Planted corals' } });
    fireEvent.click(screen.getByRole('button', { name: 'reefLogger.submit' }));

    // After logging, the card refetches: the new log appears in history.
    await waitFor(() => expect(screen.getByText('Planted corals at Three Pools')).toBeTruthy());
    expect(mockedApi.getMyReefLogs).toHaveBeenCalledTimes(2);
  });
});