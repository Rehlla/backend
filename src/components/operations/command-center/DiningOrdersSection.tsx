import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Utensils, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { SectionHeader, DataTable, StatusBadge, EmptyState, SkeletonList } from './ui';
import { api } from '../../../services/api';
import type { DiningOrder, DiningOrderStatus } from '../../../types/dining';

/**
 * The kitchen's side of the counter.
 *
 * This panel is the ONLY thing that can advance an order — the same authority
 * the server enforces with its Operations/Admin role rule. It exists because
 * the surface it replaces was four "simulate status" buttons in the traveler's
 * own UI: the traveler was driving the progress bar they were anxiously
 * watching. Here, the buttons are the operator's, and every press hits
 * POST /api/dining/orders/:id/status and re-reads the result.
 *
 * The transition list shown per order is the server's own state machine,
 * mirrored as a display filter: the server still rejects an illegal move with
 * 409, and this panel surfaces that refusal rather than pretending it worked.
 */

/** The next legal states per current state — a display mirror of the server's
 *  TRANSITIONS map. The server remains the authority; an outdated mirror here
 *  costs a 409, not a wrong state. */
const NEXT_STATUS: Partial<Record<DiningOrderStatus, DiningOrderStatus[]>> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED']
};

const ACTIVE: readonly DiningOrderStatus[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY'
];

const BADGE_TONE: Record<string, string> = {
  // Kept only as documentation of the intended colours; StatusBadge renders
  // its `status` prop as both label and style key, so the readable labels in
  // badgeLabel() below win. States with an exact key in the kit's style map
  // (CONFIRMED, DELIVERED, CANCELLED, REJECTED, FAILED) keep their colour.
};

/** `venueId` narrows the list to one restaurant (the catalogue's Orders tab). */
export const DiningOrdersSection: React.FC<{ venueId?: string }> = ({ venueId }) => {
  const [orders, setOrders] = useState<DiningOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getDiningOrders();
      setOrders(venueId ? res.orders.filter(o => o.venueId === venueId) : res.orders);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live orders move without anyone touching this page, so the list re-reads
  // itself while anything is in flight — the same poll cadence the traveler's
  // tracking screen uses, so both sides of the counter agree.
  // It also polls while the list is EMPTY: the empty state promises orders
  // "appear here the moment they are placed", and gating the poll on an
  // active order meant the first order of the day never showed up.
  useEffect(() => {
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const advance = useCallback(async (order: DiningOrder, next: DiningOrderStatus) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      const updated = await api.advanceDiningOrder(order.id, next);
      setOrders(prev => prev?.map(o => (o.id === updated.id ? { ...updated, venue: o.venue } : o)) ?? prev);
    } catch (err: any) {
      // 409 ILLEGAL_TRANSITION means another operator moved it first, or this
      // mirror is stale. Re-reading is the recovery; the message explains.
      setActionError(err?.message ?? 'The status could not be updated.');
      void load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const visible = useMemo(() => {
    const list = orders ?? [];
    if (showTerminal) return list;
    return list.filter(o => ACTIVE.includes(o.status) || !TERMINAL.has(o.status));
  }, [orders, showTerminal]);

  const activeCount = useMemo(() => (orders ?? []).filter(o => ACTIVE.includes(o.status)).length, [orders]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Dining orders"
        subtitle={activeCount > 0 ? `${activeCount} in the kitchen right now` : 'No live orders'}
        icon={Utensils}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {error && (
        <p className="p-3 rounded-xl bg-rose-500/10 text-sm text-rose-600" role="alert">{error}</p>
      )}
      {actionError && (
        <p className="p-3 rounded-xl bg-amber-500/10 text-sm text-amber-700" role="status">
          {actionError}
          {/* The refusal is not necessarily an error: another operator may have
              advanced the order first. The list re-read, so the truth is above. */}
        </p>
      )}

      {loading && !orders ? (
        <SkeletonList count={3} />
      ) : (orders ?? []).length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No dining orders yet"
          description="Orders placed from /restaurants appear here the moment they are placed."
        />
      ) : (
        <>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={showTerminal}
              onChange={e => setShowTerminal(e.target.checked)}
              className="accent-[var(--accent-primary)]"
            />
            Show delivered, cancelled and declined ({(orders ?? []).filter(o => TERMINAL.has(o.status)).length})
          </label>

          <div className="space-y-2">
            {visible.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                busy={busyId === order.id}
                onAdvance={next => void advance(order, next)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TERMINAL: ReadonlySet<DiningOrderStatus> = new Set(['DELIVERED', 'CANCELLED', 'REJECTED', 'FAILED']);

const OrderRow: React.FC<{
  order: DiningOrder;
  busy: boolean;
  onAdvance: (next: DiningOrderStatus) => void;
}> = ({ order, busy, onAdvance }) => {
  const [expanded, setExpanded] = useState(false);
  const nextStates = NEXT_STATUS[order.status] ?? [];
  const canAct = nextStates.length > 0 && !busy;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-8 h-8 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--btn-util-bg)]"
          aria-expanded={expanded}
          aria-label="Order details"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold">{order.orderRef}</span>
            <span className="text-xs text-[var(--text-muted)] truncate">{order.venue?.nameEn ?? order.venueId}</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {order.fulfillment === 'DELIVERY'
              ? `To ${order.deliveryLocation?.labelEn ?? 'delivery'}`
              : 'Collect at restaurant'}
            {order.etaMinutes != null && ` · promised ~${order.etaMinutes} min`}
            {` · ${order.lines.reduce((n, l) => n + l.quantity, 0)} items`}
          </p>
        </div>

        {/* StatusBadge doubles as label and style key: states the kit knows
            render with their colour and uppercase label; dining-specific ones
            get a readable label on the kit's neutral fallback. A tone key was
            briefly passed here instead and the badge read "active" where the
            operator needed "Preparing" — the E2E walk caught it. */}
        <StatusBadge status={badgeLabel(order.status)} />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />}
          {nextStates.map(next => (
            <button
              key={next}
              type="button"
              disabled={!canAct}
              onClick={() => onAdvance(next)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 ${
                next === 'REJECTED' || next === 'CANCELLED'
                  ? 'border border-rose-400/60 text-rose-600 hover:bg-rose-500/10'
                  : 'bg-[var(--accent-primary)] text-white hover:opacity-90'
              }`}
            >
              {label(next)}
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <dl className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2 text-xs">
          <div>
            <dt className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Lines</dt>
            <dd>
              <ul className="space-y-0.5">
                {order.lines.map(l => (
                  <li key={l.menuItemId} className="flex justify-between gap-3">
                    <span className="truncate">{l.quantity}× {l.nameEn}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">{l.lineTotalEGP} EGP</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Total</dt>
            <dd className="tabular-nums font-bold">{order.priceBreakdown.totalEGP} EGP · {order.paymentMethod.replace(/_/g, ' ').toLowerCase()}</dd>
          </div>
          {order.deliveryLocation?.addressText && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-muted)] flex-shrink-0">Address</dt>
              <dd className="text-end">{order.deliveryLocation.addressText}</dd>
            </div>
          )}
          {order.notes && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-muted)] flex-shrink-0">Kitchen notes</dt>
              <dd className="text-end">{order.notes}</dd>
            </div>
          )}
          {order.cancellationReason && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-muted)] flex-shrink-0">Reason</dt>
              <dd className="text-end">{order.cancellationReason}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
};

/** Human label for a badge. States the badge kit styles by exact key keep that
 *  key as their label; the rest read as words. */
function badgeLabel(status: DiningOrderStatus): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'Pending';
    case 'READY_FOR_PICKUP': return 'Ready';
    case 'OUT_FOR_DELIVERY': return 'Out for delivery';
    case 'PREPARING': return 'Preparing';
    default: return status; // CONFIRMED / DELIVERED / CANCELLED / REJECTED / FAILED
  }
}

function label(status: DiningOrderStatus): string {
  return status === 'READY_FOR_PICKUP' ? 'Ready' : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

// The shell lazy-loads this section with `import('./DiningOrdersSection')` and
// needs a default export to render it (same shape as Overview/CommerceControl).
export default DiningOrdersSection;