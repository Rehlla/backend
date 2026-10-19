import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertyStaysPanel } from '../../src/components/supplier/PropertyStaysPanel';
import { api } from '../../src/services/api';
import { translate } from '../../src/i18n/translations';

/**
 * The hotel owner's portal tab: answer waiting guests, close nights on the
 * calendar. The server scopes everything to the account's supplier; this
 * covers what the owner sees and that each control calls the right endpoint.
 */

vi.mock('../../src/services/api', () => ({
  api: {
    getPropertyStays: vi.fn(),
    respondPropertyStay: vi.fn(),
    getPropertyRoomTypes: vi.fn(),
    getPropertyCalendar: vi.fn(),
    setPropertyNightsClosed: vi.fn(),
  },
}));

// The real provider hands out a stable t(); the panel's loaders depend on it.
const stableT = vi.hoisted(() => ({ fn: null as null | ((key: string, vars?: Record<string, string | number>) => string) }));
vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => {
    stableT.fn ??= (key, vars) => translate(key, 'en', vars);
    return { language: 'en', isRTL: false, t: stableT.fn };
  },
}));

const mockedApi = vi.mocked(api, true);

const stay = (ref: string, status: string) => ({
  bookingRef: ref, status, roomTypeId: 'RT-1', checkIn: '2026-11-02', checkOut: '2026-11-05', nights: 3, rooms: 1,
  adults: 2, children: 0, travelerName: `Guest ${ref}`, travelerPhone: '+201000000001', paymentMethod: 'CASH_ON_ARRIVAL',
  depositEGP: 0, balanceDueEGP: 3000, totalEGP: 3000, balanceSettled: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getPropertyStays.mockResolvedValue({ stays: [stay('HTL-W', 'PENDING_CONFIRMATION'), stay('HTL-C', 'CONFIRMED')] } as any);
  mockedApi.respondPropertyStay.mockResolvedValue({} as any);
  mockedApi.getPropertyRoomTypes.mockResolvedValue({ roomTypes: [{ id: 'RT-1', name: 'Garden room', nameAr: 'غرفة', totalUnits: 3 }] } as any);
  const nights = Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, closed: i === 9, booked: 1 }));
  mockedApi.getPropertyCalendar.mockResolvedValue({ nights, totalUnits: 3 } as any);
  mockedApi.setPropertyNightsClosed.mockResolvedValue({ changed: 2 } as any);
});

afterEach(() => {
  cleanup();
});

describe('PropertyStaysPanel', () => {
  it('lists the waiting guest with what is due at the desk, and confirms it', async () => {
    render(<PropertyStaysPanel />);
    expect(await screen.findByText(translate('propertyStays.waiting', 'en', { count: 1 }))).toBeTruthy();
    expect(screen.getAllByText('Guest HTL-W').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translate('propertyStays.confirm', 'en')) })[0]);
    await waitFor(() => expect(mockedApi.respondPropertyStay).toHaveBeenCalledWith('HTL-W', true, undefined));
    expect(mockedApi.getPropertyStays).toHaveBeenCalledTimes(2);
  });

  it('closes a picked run of nights, end night inclusive', async () => {
    render(<PropertyStaysPanel />);
    await waitFor(() => expect(mockedApi.getPropertyCalendar).toHaveBeenCalled());
    expect(await screen.findByText(translate('opsRooms.closed', 'en'))).toBeTruthy();

    fireEvent.click(screen.getByText('3').closest('button')!);
    fireEvent.click(screen.getByText('4').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translate('opsRooms.closeNights', 'en')) }));

    await waitFor(() => expect(mockedApi.setPropertyNightsClosed).toHaveBeenCalled());
    const [roomTypeId, body] = mockedApi.setPropertyNightsClosed.mock.calls[0];
    expect(roomTypeId).toBe('RT-1');
    expect(body).toEqual({ from: '2026-11-03', to: '2026-11-05', closed: true, reason: undefined });
  });
});
