import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plane,
  Search,
  RefreshCw,
  Filter,
  ChevronDown,
  MapPin,
  Calendar,
  Users,
  DollarSign,
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

interface OpsTrip {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string | null;
  travelersCount: number;
  lengthDays: number;
  totalPaidEGP: number;
  totalEstimatedEGP: number;
  budget: string;
  pace: string;
  bookingCount: number;
  activeTransfers: number;
}

interface TripsResponse {
  trips: OpsTrip[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TripRow({ trip, language, t }: { trip: OpsTrip; language: string; t: (k: string) => string }) {
  const statusColor = useMemo(() => {
    const s = trip.status?.toLowerCase();
    if (s === "active" || s === "in_progress") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (s === "pending") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (s === "completed") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    return "bg-[var(--text-muted)]/10 text-[var(--text-muted)] border-[var(--text-muted)]/20";
  }, [trip.status]);

  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]/30 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
          <span className="text-xs font-mono text-[var(--text-muted)]">{trip.id}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="max-w-[200px] truncate">
          <div className="text-sm font-bold text-[var(--text-primary)]">{trip.title}</div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">{trip.id}</div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColor}`}>
          {language === "ar" ? trip.status?.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1, 3)).join(" ") || trip.status : trip.status}
        </span>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        {trip.startDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>{trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : ""}</span>
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span className="truncate max-w-[150px] Block">{(trip as any).origin || (trip as any).destination || "Dahab"}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          <span>{trip.travelersCount}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3" />
          <span className="font-bold text-[var(--accent-secondary)]">{trip.totalPaidEGP.toLocaleString()}</span>
          <span className="text-[var(--text-muted)]/60">/{trip.totalEstimatedEGP.toLocaleString()}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {trip.activeTransfers > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-bold">
              {trip.activeTransfers} {t("cmd.transfers.active")}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-muted)] font-mono">{trip.bookingCount} bookings</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsTripsTable() {
  const { language, t } = useLanguage();
  const [trips, setTrips] = useState<OpsTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 15;

  const fetchTrips = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await api.getOperationsTrips(params) as TripsResponse;
      setTrips(data.trips || []);
      setTotal(data.total || 0);
      setLastUpdated(new Date());
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    void fetchTrips();
    const interval = setInterval(fetchTrips, 30_000);
    return () => clearInterval(interval);
  }, [fetchTrips]);

  const filteredTrips = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter(
      (trip) =>
        trip.id.toLowerCase().includes(q) ||
        trip.title.toLowerCase().includes(q),
    );
  }, [trips, search]);

  const pagedTrips = filteredTrips.slice(0, page * pageSize);

  const statusOptions = [
    { value: "all", label: "cmd.common.all" },
    { value: "active", label: "cmd.trips.statusActive" },
    { value: "pending", label: "cmd.trips.statusPending" },
    { value: "completed", label: "cmd.trips.statusCompleted" },
  ];

  return (
    <RequireRole roles={["Admin", "Operations"]}>
      <div className="space-y-4">
        <SectionHeader
          icon={Plane}
          title={t("cmd.trips.title")}
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
              <button
                type="button"
                onClick={fetchTrips}
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
        ) : pagedTrips.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={t("cmd.trips.noTrips")}
            description={t("cmd.trips.noTripsDesc")}
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
                        {t("cmd.common.name")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.status")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.dates")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.location")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.trips.travelers")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.revenue")}
                      </th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t("cmd.common.activity")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTrips.map((trip) => (
                      <TripRow key={trip.id} trip={trip} language={language} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredTrips.length > pageSize && (
                <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t("cmd.common.showing")} {pagedTrips.length} {t("cmd.common.of")} {filteredTrips.length}
                  </span>
                  <TablePagination
                    page={page}
                    totalPages={Math.ceil(filteredTrips.length / pageSize)}
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
