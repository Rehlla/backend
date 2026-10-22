import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * A food cart that survives a refresh and belongs to exactly one kitchen.
 *
 * Keyed by venue, not global. A single global cart is the tempting design and
 * the wrong one: adding a dish from Red Cat to a cart holding Ali Baba's grill
 * produces an order one kitchen has to refuse, and the traveler finds out at the
 * last step. Scoping the cart to the venue makes that class of bug unrepresentable
 * rather than validated.
 *
 * Quantities live here; PRICES do not. Nothing in this file knows what a dish
 * costs — the only numbers it holds are quantities and the item ids. The total
 * always comes from a server quote. A cart that could compute its own total is a
 * cart whose total a tampered client would send back, and the server would be
 * the only thing standing between that and a wrong price.
 */

const STORAGE_KEY = 'rehla_dining_cart_v1';
const MAX_LINES = 25;
const MAX_QUANTITY = 20;

export interface CartLine {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

interface CartState {
  venueId: string | null;
  lines: CartLine[];
}

interface DiningCartValue {
  /** The kitchen this cart belongs to, or null when it is empty. */
  venueId: string | null;
  lines: CartLine[];
  itemCount: number;
  /** Distinct dishes, which is what a kitchen can actually refuse. */
  lineCount: number;
  quantityOf: (menuItemId: string) => number;
  /**
   * Add a dish. The venueId is a PARAMETER, not read from context, because the
   * cart holds one kitchen at a time and the caller knows which menu the tap
   * came from.
   */
  add: (venueId: string, menuItemId: string, quantity?: number, notes?: string) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  increment: (menuItemId: string) => void;
  decrement: (menuItemId: string) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  /** True when the cart holds rows for a kitchen other than this one, which
   *  happens when the traveler taps "add" on another venue's page. */
  isFor: (venueId: string) => boolean;
  /** Swap the whole cart. Used when the traveler switches kitchen and is told
   *  the previous basket was dropped. */
  replace: (venueId: string | null, lines: CartLine[]) => void;
}

const DiningCartContext = createContext<DiningCartValue | null>(null);

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

function readStored(): CartState {
  if (typeof window === 'undefined') return { venueId: null, lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { venueId: null, lines: [] };
    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!parsed || !Array.isArray(parsed.lines)) return { venueId: null, lines: [] };
    const lines = parsed.lines
      .filter((l): l is CartLine => Boolean(l) && typeof l.menuItemId === 'string' && l.menuItemId.length > 0)
      .slice(0, MAX_LINES)
      .map(l => ({ ...l, quantity: clampQuantity(l.quantity) }));
    if (lines.length === 0) return { venueId: null, lines: [] };
    // A stored cart with no venue cannot be quoted, so it is dropped rather
    // than resurrected into a screen that cannot price it.
    return typeof parsed.venueId === 'string' && parsed.venueId ? { venueId: parsed.venueId, lines } : { venueId: null, lines: [] };
  } catch {
    return { venueId: null, lines: [] };
  }
}

export const DiningCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CartState>(readStored);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (state.venueId && state.lines.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // A blocked or full localStorage costs persistence across a refresh, not
      // the ability to order.
    }
  }, [state]);

  /** Swapping venue REPLACES the cart rather than merging into it. */
  const replace = useCallback((venueId: string | null, lines: CartLine[]) => {
    setState({ venueId, lines });
  }, []);

  const add = useCallback((venueId: string, menuItemId: string, quantity = 1, notes?: string) => {
    if (!menuItemId || !venueId) return;
    const qty = clampQuantity(quantity);
    setState((prev) => {
      if (prev.venueId && prev.venueId !== venueId) {
        // Another kitchen's cart: start clean so the order cannot mix venues.
        return { venueId, lines: [{ menuItemId, quantity: qty, notes }] };
      }
      const existing = prev.lines.find(l => l.menuItemId === menuItemId);
      if (existing) {
        return {
          venueId,
          lines: prev.lines.map(l =>
            l.menuItemId === menuItemId
              ? { ...l, quantity: clampQuantity(l.quantity + qty), notes: notes ?? l.notes }
              : l
          )
        };
      }
      if (prev.lines.length >= MAX_LINES) return prev;
      return { venueId, lines: [...prev.lines, { menuItemId, quantity: qty, notes }] };
    });
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setState((prev) => {
      if (quantity < 1) {
        return { ...prev, lines: prev.lines.filter(l => l.menuItemId !== menuItemId) };
      }
      return {
        ...prev,
        lines: prev.lines.map(l =>
          l.menuItemId === menuItemId ? { ...l, quantity: clampQuantity(quantity) } : l
        )
      };
    });
  }, []);

  const increment = useCallback((menuItemId: string) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.map(l =>
        l.menuItemId === menuItemId ? { ...l, quantity: clampQuantity(l.quantity + 1) } : l
      )
    }));
  }, []);

  const decrement = useCallback((menuItemId: string) => {
    setState((prev) => ({
      ...prev,
      // Decrementing the last unit removes the line: a cart row at quantity 0
      // is a row a kitchen would be asked to cook nothing of.
      lines: prev.lines
        .map(l => (l.menuItemId === menuItemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter(l => l.quantity > 0)
    }));
  }, []);

  const remove = useCallback((menuItemId: string) => {
    setState((prev => ({ ...prev, lines: prev.lines.filter(l => l.menuItemId !== menuItemId) })));
  }, []);

  const clear = useCallback(() => {
    setState({ venueId: null, lines: [] });
  }, []);

  const value = useMemo<DiningCartValue>(
    () => ({
      venueId: state.venueId,
      lines: state.lines,
      lineCount: state.lines.length,
      itemCount: state.lines.reduce((sum, l) => sum + l.quantity, 0),
      quantityOf: (menuItemId: string) =>
        state.lines.find(l => l.menuItemId === menuItemId)?.quantity ?? 0,
      add,
      setQuantity,
      increment,
      decrement,
      remove,
      clear,
      replace,
      isFor: (id: string) => state.venueId === id
    }),
    [state, add, setQuantity, increment, decrement, remove, clear, replace]
  );

  return <DiningCartContext.Provider value={value}>{children}</DiningCartContext.Provider>;
};

export function useDiningCart(): DiningCartValue {
  const ctx = useContext(DiningCartContext);
  if (!ctx) throw new Error('useDiningCart must be used inside DiningCartProvider.');
  return ctx;
}