import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutIssuePanel } from '../../src/components/commerce/CheckoutIssuePanel';
import { DriverAssignmentStatus } from '../../src/components/transfers/DriverAssignmentStatus';
import { api } from '../../src/services/api';
import { ApiError } from '../../src/services/apiError';
import { checkoutIssueFrom } from '../../src/services/checkoutError';
import { translate } from '../../src/i18n/translations';

/**
 * The shared panel every booking surface shows when a hold or checkout does
 * not go through. vitest.ui.config.ts runs without globals, so cleanup() is
 * explicit.
 */

const lang = vi.hoisted(() => ({ current: 'en' as 'en' | 'ar' }));

vi.mock('../../src/services/api', () => ({
  api: { findAlternatives: vi.fn() },
}));

vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: lang.current,
    isRTL: lang.current === 'ar',
    t: (key: string, vars?: Record<string, string | number> | string) =>
      translate(key, lang.current, typeof vars === 'object' ? vars : undefined),
  }),
}));

vi.mock('../../src/context/CurrencyContext', () => ({
  useCurrency: () => ({
    formatEGP: (n: number) => `EGP ${n.toLocaleString('en-US')}`,
    formatDisplay: () => null,
    approximate: false,
  }),
}));

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
  lang.current = 'en';
});

afterEach(() => {
  cleanup();
});

describe('CheckoutIssuePanel', () => {
  it('shows the new price and confirms on the same holds', () => {
    lang.current = 'ar';
    const onConfirmPrice = vi.fn();
    render(<CheckoutIssuePanel priceChange={{ shownTotalEGP: 1200, currentTotalEGP: 1500 }} onConfirmPrice={onConfirmPrice} onDismiss={() => {}} />);

    expect(screen.getByText('السعر اتغيّر من ساعة ما بدأت. السعر الجديد EGP 1,500، تحب تكمّل؟')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'احجز بـ EGP 1,500' }));
    expect(onConfirmPrice).toHaveBeenCalledTimes(1);
  });

  it('offers to hold again when the hold expired', () => {
    const onRehold = vi.fn();
    const issue = checkoutIssueFrom(new ApiError('expired', 409, undefined, { code: 'HOLD_EXPIRED' }));
    render(<CheckoutIssuePanel issue={issue} onRehold={onRehold} />);
    fireEvent.click(screen.getByRole('button', { name: translate('checkout.action.rehold', 'en') }));
    expect(onRehold).toHaveBeenCalledTimes(1);
  });

  it('looks up real alternatives when the supplier is unavailable', async () => {
    mockedApi.findAlternatives.mockResolvedValue({
      alternatives: [{
        skuId: 'SKU-DIV-002', title: 'Lighthouse shore dive', titleAr: 'غطسة اللايتهاوس', serviceType: 'diving',
        supplierId: 'SUP-2', basePriceEGP: 1100, currency: 'EGP', timeSlot: '11:00 AM', available: 6,
        status: 'AVAILABLE', reason: 'Same activity, nearby', reasonAr: 'نفس النشاط',
      }],
    });
    const onPick = vi.fn();
    const issue = checkoutIssueFrom(new ApiError('suspended', 409, undefined, { code: 'SUPPLIER_UNAVAILABLE', details: { skuId: 'SKU-DIV-001' } }));
    render(
      <CheckoutIssuePanel
        issue={issue}
        alternativesQuery={{ tripId: 'TRIP-1', skuId: 'SKU-DIV-001', date: '2026-11-12', timeSlot: '09:00 AM', passengersCount: 2 }}
        onPickAlternative={onPick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: translate('checkout.action.seeAlternatives', 'en') }));
    await waitFor(() => expect(screen.getByText('Lighthouse shore dive')).toBeTruthy());
    expect(mockedApi.findAlternatives).toHaveBeenCalledWith({
      tripId: 'TRIP-1', skuId: 'SKU-DIV-001', date: '2026-11-12', timeSlot: '09:00 AM', passengersCount: 2, limit: 3,
    });
    fireEvent.click(screen.getByRole('button', { name: translate('checkout.action.chooseAlternative', 'en') }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ skuId: 'SKU-DIV-002' }));
  });
});

describe('DriverAssignmentStatus', () => {
  it('says plainly that no driver is assigned yet (NOT_ASSIGNED)', () => {
    lang.current = 'ar';
    render(
      <DriverAssignmentStatus
        telemetry={{
          bookingId: 'B1', referenceCode: 'DHB-1', assigned: false, status: 'NOT_ASSIGNED',
          driverName: null, driverPhone: null, vehicleModel: null, vehiclePlate: null,
          pickupLocation: null, dropoffLocation: null, scheduledTime: null, flightStatus: null, lastGpsUpdate: null,
        }}
      />
    );
    expect(screen.getByText('السواق لسه ماتحددش، هنبعتلك أول ما يتأكد.')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the driver once one is assigned', () => {
    render(
      <DriverAssignmentStatus
        telemetry={{
          bookingId: 'B1', referenceCode: 'DHB-1', assigned: true, status: 'ASSIGNED',
          driverName: 'Salem', driverPhone: '+20 100 111 2222', vehicleModel: 'HiAce', vehiclePlate: 'ABC 123',
          pickupLocation: null, dropoffLocation: null, scheduledTime: null, flightStatus: null, lastGpsUpdate: null,
        }}
      />
    );
    expect(screen.getByText('Salem')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('tel:+201001112222');
  });
});
