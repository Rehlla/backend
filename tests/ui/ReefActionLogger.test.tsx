import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ReefActionLogger } from '../../src/components/supplier/ReefActionLogger';
import { REEF_ACTION_OPTIONS } from '../../src/components/common/ReefActionForm';
import { api } from '../../src/services/api';

/**
 * ReefActionLogger turns the reef score from a read-only mirror into a real
 * operational loop: suppliers record delivered eco-actions against completed
 * bookings. These tests pin the truth rules:
 *  - only completed/captured bookings are offered (server enforces too),
 *  - the full booking→trip payload is sent (server resolves ownership),
 *  - server errors surface verbatim instead of being swallowed,
 *  - the submit button can't fire an incomplete action.
 *
 * Note: vitest.ui.config.ts runs without globals — cleanup() is explicit here
 * or DOM from one test leaks into the next.
 */
vi.mock('../../src/services/api', () => ({
  api: {
    getSupplierBookings: vi.fn(),
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
  id: 'BK-1', bookingRef: 'DAH-1001', tripId: 'TRIP-1', supplierId: 'SUP-1', serviceType: 'diving',
  scheduledDate: '2026-09-01', paymentState: 'CAPTURED', supplierState: 'COMPLETED',
};
const pendingBooking = {
  id: 'BK-2', bookingRef: 'DAH-1002', tripId: 'TRIP-2', supplierId: 'SUP-2', serviceType: 'transfer',
  scheduledDate: '2026-09-05', paymentState: 'PENDING', supplierState: 'PENDING_CONFIRMATION',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const openForm = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'reefLogger.title' }));
  await waitFor(() => expect(screen.getByLabelText('reefLogger.bookingLabel')).toBeTruthy());
};

describe('ReefActionLogger', () => {
  it('renders nothing without a supplier id', () => {
    const { container } = render(<ReefActionLogger supplierId={null} />);
    expect(container.firstChild).toBeNull();
    expect(mockedApi.getSupplierBookings).not.toHaveBeenCalled();
  });

  it('is collapsed until opened, then loads eligible bookings only', async () => {
    mockedApi.getSupplierBookings.mockResolvedValue({ bookings: [completedBooking, pendingBooking] });

    render(<ReefActionLogger supplierId="SUP-1" />);
    expect(screen.queryByLabelText('reefLogger.bookingLabel')).toBeNull();

    await openForm();

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /DAH-1001/ })).toBeTruthy(),
    );
    // Pending booking must not be offered as eligible.
    expect(screen.queryByRole('option', { name: /DAH-1002/ })).toBeNull();
    expect(mockedApi.getSupplierBookings).toHaveBeenCalledWith('SUP-1');
  });

  it('says honestly when there are no completed bookings', async () => {
    mockedApi.getSupplierBookings.mockResolvedValue({ bookings: [pendingBooking] });

    render(<ReefActionLogger supplierId="SUP-1" />);
    await openForm();

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'reefLogger.noBookings' })).toBeTruthy(),
    );
  });

  it('keeps submit disabled until a booking and description are provided', async () => {
    mockedApi.getSupplierBookings.mockResolvedValue({ bookings: [completedBooking] });

    render(<ReefActionLogger supplierId="SUP-1" />);
    await openForm();

    const submit = await waitFor(() => screen.getByRole('button', { name: 'reefLogger.submit' }));
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-1001/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('reefLogger.bookingLabel'), { target: { value: 'BK-1' } });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('reefLogger.descriptionLabel'), { target: { value: 'Reef-safe briefing + cleanup dive' } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(mockedApi.logReefAction).not.toHaveBeenCalled();
  });

  it('submits the full booking→trip payload and shows the awarded points', async () => {
    mockedApi.getSupplierBookings.mockResolvedValue({ bookings: [completedBooking] });
    mockedApi.logReefAction.mockResolvedValue({ log: { id: 'REEF-1', pointsAwarded: 20, loggedBy: 'supplier' } });

    render(<ReefActionLogger supplierId="SUP-1" />);
    await openForm();

    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-1001/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('reefLogger.bookingLabel'), { target: { value: 'BK-1' } });
    fireEvent.change(screen.getByLabelText('reefLogger.actionLabel'), { target: { value: 'coral_planting' } });
    fireEvent.change(screen.getByLabelText('reefLogger.descriptionLabel'), { target: { value: 'Planted 10 coral fragments' } });
    fireEvent.click(screen.getByRole('button', { name: 'reefLogger.submit' }));

    await waitFor(() => expect(screen.getByText('reefLogger.success')).toBeTruthy());
    expect(mockedApi.logReefAction).toHaveBeenCalledWith({
      bookingId: 'BK-1',
      tripId: 'TRIP-1',
      supplierId: 'SUP-1',
      actionType: 'coral_planting',
      description: 'Planted 10 coral fragments',
    });
    // Form resets after success.
    expect((screen.getByLabelText('reefLogger.bookingLabel') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('reefLogger.descriptionLabel') as HTMLTextAreaElement).value).toBe('');
  });

  it('surfaces server errors verbatim instead of swallowing them', async () => {
    mockedApi.getSupplierBookings.mockResolvedValue({ bookings: [completedBooking] });
    mockedApi.logReefAction.mockRejectedValue(new Error('Reef actions can only be logged against completed or captured bookings.'));

    render(<ReefActionLogger supplierId="SUP-1" />);
    await openForm();

    await waitFor(() => expect(screen.getByRole('option', { name: /DAH-1001/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('reefLogger.bookingLabel'), { target: { value: 'BK-1' } });
    fireEvent.change(screen.getByLabelText('reefLogger.descriptionLabel'), { target: { value: 'Cleanup' } });
    fireEvent.click(screen.getByRole('button', { name: 'reefLogger.submit' }));

    await waitFor(() =>
      expect(screen.getByText('Reef actions can only be logged against completed or captured bookings.')).toBeTruthy(),
    );
    expect(screen.queryByText('reefLogger.success')).toBeNull();
  });

  it('offers every action type with its real point value', () => {
    expect(REEF_ACTION_OPTIONS.map(o => o.points)).toEqual([20, 20, 15, 10, 5, 5, 5]);
    expect(REEF_ACTION_OPTIONS.map(o => o.value)).toEqual([
      'coral_planting', 'dive_against_debris', 'beach_cleanup',
      'marine_education', 'reef_safe_sunscreen', 'plastic_free_day', 'other',
    ]);
  });
});
