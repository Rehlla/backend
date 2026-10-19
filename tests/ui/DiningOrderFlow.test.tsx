import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { DiningCartProvider, useDiningCart } from '../../src/context/DiningCartContext';
import {
  DeliveryLocationProvider,
  useDeliveryLocation
} from '../../src/context/DeliveryLocationContext';
import { DiningLocationPrompt } from '../../src/components/restaurants/DiningLocationPrompt';

/**
 * The two pieces of client state the order stands on: the basket and the
 * destination. Both are exercised through the app's own providers rather than
 * a mock, because the failure modes are in the persistence and the scoping —
 * a cart that merges two kitchens, or a location that survives a refresh —
 * which only exist when the real reducers run.
 *
 * LanguageContext is mocked with an identity t: a rendered dotted key proves
 * the copy came from the component, not this file.
 */

vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', isRTL: false, t: (key: string, vars?: Record<string, string>) => (vars ? `${key}:${JSON.stringify(vars)}` : key) })
}));

vi.mock('../../src/context/CurrencyContext', () => ({
  useCurrency: () => ({ formatEGP: (n: number) => `EGP ${n}`, formatDisplay: () => null, approximate: false })
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// the cart
// ---------------------------------------------------------------------------

const ZONES = [
  { zoneId: 'lighthouse', labelEn: 'Lighthouse', labelAr: 'الفانوس', latitude: 28.502, longitude: 34.5192, feeEGP: 20, etaMinutes: 8 },
  { zoneId: 'masbat', labelEn: 'Masbat', labelAr: 'المشباط', latitude: 28.4972, longitude: 34.5161, feeEGP: 30, etaMinutes: 16 }
];

function CartProbe({ onState }: { onState: (s: ReturnType<typeof useDiningCart>) => void }) {
  const cart = useDiningCart();
  onState(cart);
  return null;
}

describe('the dining cart', () => {
  let state: ReturnType<typeof useDiningCart>;

  const renderCart = () => {
    render(
      <DiningCartProvider>
        <CartProbe onState={s => (state = s)} />
      </DiningCartProvider>
    );
  };

  it('starts empty with no venue', () => {
    renderCart();
    expect(state.venueId).toBeNull();
    expect(state.lines).toEqual([]);
    expect(state.itemCount).toBe(0);
  });

  it('keys the basket to the venue it was filled from', () => {
    renderCart();
    act(() => state.add('dining_ali_baba_seafood', 'AB-05', 2));
    expect(state.venueId).toBe('dining_ali_baba_seafood');
    expect(state.lines).toEqual([{ menuItemId: 'AB-05', quantity: 2, notes: undefined }]);
  });

  it('accumulates the same dish instead of adding a second line', () => {
    renderCart();
    act(() => {
      state.add('dining_ali_baba_seafood', 'AB-05', 1);
      state.add('dining_ali_baba_seafood', 'AB-05', 2);
    });
    expect(state.lines).toHaveLength(1);
    expect(state.itemCount).toBe(3);
  });

  it('REPLACES the basket rather than merging when a second kitchen is tapped', () => {
    // A cart holding two kitchens is an order one kitchen must refuse. Scoping
    // the cart to the venue makes that unrepresentable instead of validated.
    renderCart();
    act(() => {
      state.add('dining_ali_baba_seafood', 'AB-05', 2);
      state.add('dining_red_cat_italian', 'RC-01', 1);
    });
    expect(state.venueId).toBe('dining_red_cat_italian');
    expect(state.lines).toEqual([{ menuItemId: 'RC-01', quantity: 1, notes: undefined }]);
  });

  it('drops a line whose last unit is decremented', () => {
    renderCart();
    act(() => state.add('dining_ali_baba_seafood', 'AB-05', 1));
    act(() => state.decrement('AB-05'));
    expect(state.lines).toEqual([]);
    expect(state.venueId).toBe('dining_ali_baba_seafood');
  });

  it('removing every line empties the cart', () => {
    renderCart();
    act(() => state.add('dining_ali_baba_seafood', 'AB-05', 3));
    act(() => state.remove('AB-05'));
    expect(state.lines).toEqual([]);
  });

  it('survives a refresh through localStorage', () => {
    renderCart();
    act(() => state.add('dining_ali_baba_seafood', 'AB-05', 2));
    expect(window.localStorage.getItem('rehla_dining_cart_v1')).toContain('AB-05');

    // A fresh provider instance reads the same store — that is the refresh.
    let rehydrated: ReturnType<typeof useDiningCart> | undefined;
    cleanup();
    render(
      <DiningCartProvider>
        <CartProbe onState={s => (rehydrated = s)} />
      </DiningCartProvider>
    );
    expect(rehydrated!.venueId).toBe('dining_ali_baba_seafood');
    expect(rehydrated!.itemCount).toBe(2);
  });

  it('caps a quantity a runaway stepper would produce', () => {
    renderCart();
    act(() => state.add('dining_ali_baba_seafood', 'AB-05', 1));
    act(() => {
      for (let i = 0; i < 40; i++) state.increment('AB-05');
    });
    expect(state.quantityOf('AB-05')).toBe(20);
  });

  it('ignores a corrupt store instead of crashing the menu', () => {
    window.localStorage.setItem('rehla_dining_cart_v1', '{not json');
    expect(() => renderCart()).not.toThrow();
    expect(state.lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the location
// ---------------------------------------------------------------------------

function LocationProbe({ onState }: { onState: (s: ReturnType<typeof useDeliveryLocation>) => void }) {
  const loc = useDeliveryLocation();
  onState(loc);
  return null;
}

function renderLocation() {
  let loc: ReturnType<typeof useDeliveryLocation> | undefined;
  render(
    <DeliveryLocationProvider>
      <LocationProbe onState={s => (loc = s)} />
    </DeliveryLocationProvider>
  );
  return () => loc!;
}

describe('the delivery location', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom has no geolocation; the app's TransfersHubView is the only other
    // consumer and stubs nothing, so each test installs the fixture it needs.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: () => {} }
    });
  });

  it('starts idle with nothing chosen', () => {
    const get = renderLocation();
    expect(get()!.state).toBe('idle');
    expect(get()!.location).toBeNull();
  });

  it('keeps the manual zone as the chosen destination', () => {
    const get = renderLocation();
    act(() => get()!.chooseZone('lighthouse', 'blue door'));
    expect(get()!.state).toBe('detected');
    expect(get()!.location).toMatchObject({ zoneId: 'lighthouse', addressText: 'blue door', source: 'manual' });
  });

  it('drops a stored destination that can no longer be priced', () => {
    // A value with neither zone nor coordinate is not a destination; carrying
    // it into a quote would be refused at the last step instead of now.
    window.localStorage.setItem('rehla_delivery_location', JSON.stringify({ source: 'geo' }));
    const get = renderLocation();
    expect(get()!.location).toBeNull();
  });

  it('survives a refresh through localStorage', () => {
    const get = renderLocation();
    act(() => get()!.chooseZone('masbat'));
    cleanup();
    const get2 = renderLocation();
    expect(get2()!.location).toMatchObject({ zoneId: 'masbat' });
    expect(get2()!.state).toBe('detected');
  });

  it('clear forgets the destination entirely', () => {
    const get = renderLocation();
    act(() => get()!.chooseZone('masbat'));
    act(() => get()!.clear());
    expect(get()!.location).toBeNull();
    expect(get()!.state).toBe('idle');
    expect(window.localStorage.getItem('rehla_delivery_location')).toBeNull();
  });

  it('reports a refused permission as denied, not failed', async () => {
    const denied = { code: 1, message: 'denied' } as unknown as GeolocationPositionError;
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(((
      _ok: PositionCallback,
      err: PositionErrorCallback
    ) => err(denied)) as never);
    const get = renderLocation();
    let result: string | undefined;
    await act(async () => {
      result = await get()!.detect();
    });
    expect(result).toBe('denied');
    expect(get()!.state).toBe('denied');
  });

  it('reports a timeout as failed and keeps the manual path open', async () => {
    const timeout = { code: 3, message: 'timeout' } as unknown as GeolocationPositionError;
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(((
      _ok: PositionCallback,
      err: PositionErrorCallback
    ) => err(timeout)) as never);
    const get = renderLocation();
    let result: string | undefined;
    await act(async () => {
      result = await get()!.detect();
    });
    expect(result).toBe('failed');
    // The whole point: a slow GPS must not remove the alternative.
    expect(get()!.location).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// the prompt
// ---------------------------------------------------------------------------

describe('the location prompt', () => {
  it('renders the zone list with per-kitchen fees, before any detection', () => {
    render(
      <DeliveryLocationProvider>
        <DiningLocationPrompt
          zones={ZONES}
          venueName="Ali Baba"
          onZoneChosen={() => {}}
        />
      </DeliveryLocationProvider>
    );
    // The list is the primary control, not a fallback: it is present before
    // any geolocation has been offered, let alone granted.
    expect(screen.getByText('Lighthouse')).toBeTruthy();
    expect(screen.getByText('Masbat')).toBeTruthy();
    // Fees are per KITCHEN, so the same zone can carry two prices and the pair
    // must both be visible for the traveler to compare.
    expect(screen.getByText(/EGP 20/)).toBeTruthy();
    expect(screen.getByText(/EGP 30/)).toBeTruthy();
  });

  it('choosing a zone calls back with that zone', () => {
    const onZoneChosen = vi.fn();
    render(
      <DeliveryLocationProvider>
        <DiningLocationPrompt zones={ZONES} venueName="Ali Baba" onZoneChosen={onZoneChosen} />
      </DeliveryLocationProvider>
    );
    fireEvent.click(screen.getByText('Masbat'));
    expect(onZoneChosen).toHaveBeenCalledWith('masbat');
  });

  it('says pickup-only honestly and offers no geolocation for it', () => {
    render(
      <DeliveryLocationProvider>
        <DiningLocationPrompt zones={[]} venueName="Three Pools" onZoneChosen={() => {}} />
      </DeliveryLocationProvider>
    );
    expect(screen.getByText('dining.pickupOnly')).toBeTruthy();
    // A kitchen that delivers nowhere has no destination to resolve; offering
    // a browser permission would be noise on top of a refusal.
    expect(screen.queryByText('dining.useMyLocation')).toBeNull();
  });

  it('carries the address text into the stored location', async () => {
    const onZoneChosen = vi.fn();
    render(
      <DeliveryLocationProvider>
        <DiningLocationPrompt zones={ZONES} venueName="Ali Baba" onZoneChosen={onZoneChosen} />
      </DeliveryLocationProvider>
    );
    fireEvent.change(screen.getByPlaceholderText('dining.addressPlaceholder'), {
      target: { value: 'blue door behind the mosque' }
    });
    fireEvent.click(screen.getByText('Lighthouse'));
    await waitFor(() => {
      const stored = window.localStorage.getItem('rehla_delivery_location');
      expect(stored).toContain('blue door behind the mosque');
    });
  });
});