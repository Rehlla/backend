import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SupplierTrustPanel } from '../../src/components/supplier/SupplierTrustPanel';
import { api } from '../../src/services/api';

/**
 * The trust panel mirrors traveler-facing signals into the supplier portal.
 * Its reason to exist is honest measurement: no flattering placeholders when
 * there is no data, and explicit traveler-visibility state around the
 * 3-measured-booking significance threshold (same rule ReliabilityBadge
 * applies on public cards).
 *
 * Note: vitest.ui.config.ts runs without globals, so RTL's automatic cleanup
 * never registers — cleanup() must be called explicitly or DOM from one test
 * leaks into the next.
 */
vi.mock('../../src/services/api', () => ({
  api: {
    getSupplierReliabilityScore: vi.fn(),
    getSupplierReefScore: vi.fn(),
    // ReefActionLogger (mounted in the panel's reef card) fetches on mount.
    getSupplierBookings: vi.fn().mockResolvedValue({ bookings: [] }),
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SupplierTrustPanel', () => {
  it('renders nothing without a supplier id', () => {
    const { container } = render(<SupplierTrustPanel supplierId={null} />);
    expect(container.firstChild).toBeNull();
    expect(mockedApi.getSupplierReliabilityScore).not.toHaveBeenCalled();
  });

  it('shows no invented numbers when the supplier has no metric history', async () => {
    mockedApi.getSupplierReliabilityScore.mockResolvedValue(null);
    mockedApi.getSupplierReefScore.mockResolvedValue(0);

    render(<SupplierTrustPanel supplierId="SUP-X" />);

    await waitFor(() => expect(screen.getByText('supplier.trust.noMetricsYet')).toBeTruthy());
    // No percentage anywhere: the big figures are em dashes, never placeholders.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('marks the score hidden from travelers below 3 measured bookings', async () => {
    mockedApi.getSupplierReliabilityScore.mockResolvedValue({
      overall: 82, sampleSize: 2, acceptanceRate: 90, responseSpeed: 70, cancellationRate: 85,
    });
    mockedApi.getSupplierReefScore.mockResolvedValue(0);

    render(<SupplierTrustPanel supplierId="SUP-X" />);

    await waitFor(() => expect(screen.getByText('supplier.trust.hiddenBelowThreshold')).toBeTruthy());
    // The score is real (it is the supplier's own data)…
    expect(screen.getByText('82%')).toBeTruthy();
    // …but travelers must not be promised visibility.
    expect(screen.queryByText('supplier.trust.visibleOnCards')).toBeNull();
  });

  it('shows the full breakdown and traveler visibility at 3+ bookings', async () => {
    mockedApi.getSupplierReliabilityScore.mockResolvedValue({
      overall: 94, sampleSize: 12, acceptanceRate: 96, responseSpeed: 90, cancellationRate: 95,
    });
    mockedApi.getSupplierReefScore.mockResolvedValue(35);

    render(<SupplierTrustPanel supplierId="SUP-X" />);

    await waitFor(() => expect(screen.getByText('supplier.trust.visibleOnCards')).toBeTruthy());
    expect(screen.getByText('94%')).toBeTruthy();
    expect(screen.getByText('96')).toBeTruthy();  // acceptance
    expect(screen.getByText('90')).toBeTruthy();  // response speed
    expect(screen.getByText('95')).toBeTruthy();  // fulfillment
    // Reef points surface with the real earned value.
    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.getByText('supplier.trust.reefBody')).toBeTruthy();
  });

  it('stays truthful when the score endpoint fails', async () => {
    mockedApi.getSupplierReliabilityScore.mockRejectedValue(new Error('network down'));
    mockedApi.getSupplierReefScore.mockResolvedValue(null);

    render(<SupplierTrustPanel supplierId="SUP-X" />);

    await waitFor(() => expect(screen.getByText('supplier.trust.noMetricsYet')).toBeTruthy());
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
