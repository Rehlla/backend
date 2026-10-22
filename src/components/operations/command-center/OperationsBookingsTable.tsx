import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package,
  Search,
  RefreshCw,
  Filter,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { api } from "../../../services/api";
import { useLanguage } from "../../../i18n/LanguageContext";
import { RequireRole } from "../../auth/RequireRole";
import {
  SectionHeader,
  StatusBadge,
  EmptyState,
  DashCard,
  Skeleton,
  TablePagination,
} from "./ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpsBooking {
  id: string;
  bookingRef: string;
  tripId: string;
  supplierId: string;
  supplierState: string;
  paymentState: string;
  serviceType: string;
  amountEGP: number;
  status: string;
  createdAt: string;
  travelerName?: string;
  travelerPhone?: string;
}

interface BookingsResponse {
  bookings: OpsBooking[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  transfer: "cmd.bookings.transfer",
  accommodation: "cmd.bookings.accommodation",
  activity: "cmd.bookings.activity",
  dining: "cmd.bookings.dining",
  tour: "cmd.bookings.tour",
  insurance: "cmd.bookings.insurance",
};

function BookingRow({
  booking,
  language,
  t,
}: {
  booking: OpsBooking;
  language: string;
  t: (k: string) => string;
}) {
  const statusColor = useMemo(() => {
    const s = booking.supplierState?.toLowerCase();
    if (s === "confirmed" || s === "completed") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (s === "pending_confirmation") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (s === "rejected") return "bg-red-500/20 text-red-300 border-red-500/30";
    if (s === "cancelled") return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    return "bg-[var(--text-muted)]/10 text-[var(--text-muted)] border-[var(--text-muted)]/20";
  }, [booking.supplierState]);

  const paymentIcon = useMemo(() => {
    const p = booking.paymentState?.toLowerCase();
    if (p === "captured") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (p === "failed" || p === "refunded") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (p === "pending") return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    return <AlertCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
  }, [booking.paymentState]);

  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]/30 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
          <span className="text-xs font-mono text-[var(--text-muted)]">{booking.id}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{booking.bookingRef}</span>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">{booking.travelerName || "-"}</td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">{booking.travelerPhone || "-"}</td>
      <td className="py-3 px-4">
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColor}`}>
          {t(`cmd.bookings.${booking.supplierState?.replace(/_/g, "") || "unknown"}`)}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          {paymentIcon}
          <span className="text-[11px] text-[var(--text-muted)]">
            {language === "ar"
              ? booking.paymentState?.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || booking.paymentState
              : booking.paymentState || "Unknown"}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-[11px] text-[var(--text-muted)]">
          {t(SERVICE_TYPE_LABELS[booking.serviceType] || "cmd.common.service")}
        </span>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          <span className="font-mono">{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : "-"}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3" />
          <span className="font-mono">{booking.supplierId.slice(0, 8)}…</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 text-[var(--accent-secondary)]" />
          <span className="font-bold text-[var(--accent-secondary)]">{booking.amountEGP.toLocaleString()}</span>
          <span className="text-[var(--text-muted)]/60">EGP</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsBookingsTable() {
  const { language, t } = useLanguage();
  const [bookings, setBookings] = useState<OpsBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 15;

  const fetchBookings = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (paymentFilter !== "all") params.paymentState = paymentFilter;
      const data = await api.getOperationsBookings(params) as BookingsResponse;
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
      setLastUpdated(new Date());
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    void fetchBookings();
    const interval = setInterval(fetchBookings, 30_000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.bookingRef.toLowerCase().includes(q) ||
        (b.travelerName || "").toLowerCase().includes(q),
    );
  }, [bookings, search]);

  const pagedBookings = filteredBookings.slice(0, page * pageSize);

  const statusOptions = [
    { value: "all", label: "cmd.common.all" },
    { value: "CONFIRMED", label: "cmd.bookings.confirmed" },
    { value: "PENDING_CONFIRMATION", label: "cmd.bookings.pending" },
    { value: "REJECTED", label: "cmd.bookings.rejected" },
    { value: "CANCELLED", label: "cmd.bookings.cancelled" },
    { value: "COMPLETED", label: "cmd.bookings.completed" },
  ];

  const paymentOptions = [
    { value: "all", label: "cmd.common.all" },
    { value: "CAPTURED", label: "cmd.bookings.paid" },
    { value: "PENDING", label: "cmd.bookings.pendingPayment" },
    { value: "FAILED", label: "cmd.bookings.failed" },
    { value: "REFUNDED", label: "cmd.bookings.refunded" },
  ];

  return (
    <RequireRole roles={["Admin", "Operations"]}>
      <div className="space-y-4">
        <SectionHeader
          icon={Package}
          title={t("cmd.bookings.title")}
          subtitle={
            lastUpdated
              ? t("cmd.overview.updatedSecondsAgo").replace(
                  "${s}",
                  String(Math.round((Date.now() - lastUpdated.getTime()) / 1000)),
                )
              : undefined
          }
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder={t("cmd.common.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 pl-7 pr-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent-primary)]/40 cursor-pointer"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] cursor-pointer appearance-none pr-6"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] cursor-pointer appearance-none pr-6"
              >
                {paymentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchBookings}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] text-xs flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("cmd.overview.refresh")}
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} variant="table-row" />
            ))}
          </div>
        ) : pagedBookings.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("cmd.bookings.noBookings")}
            description={t("cmd.bookings.noBookingsDesc")}
          />
        ) : (
          <>
            <DashCard padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--btn-util-bg)]/30">
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.id")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.bookings.bookingRef")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.bookings.traveler")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">
                        {t("cmd.bookings.phone")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.status")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.bookings.payment")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.bookings.service")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider hidden sm:table-cell">
                        {t("cmd.common.date")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">
                        {t("cmd.bookings.supplier")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookings.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} language={language} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredBookings.length > pageSize && (
                <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t("cmd.common.showing")} {pagedBookings.length} {t("cmd.common.of")} {filteredBookings.length}
                  </span>
                  <TablePagination
                    page={page}
                    totalPages={Math.ceil(filteredBookings.length / pageSize)}
                    onPageChange={(p: number) => setPage(p)}
                    t={t}
                  />
                </div>
              )}
            </DashCard>
          </>
        )}
      </div>
    </RequireRole>
  );
}
