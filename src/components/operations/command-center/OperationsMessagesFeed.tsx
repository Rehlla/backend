import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Search,
  RefreshCw,
  Filter,
  ArrowUpRight,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
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
  Pagination,
  TablePagination,
} from "./ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpsMessage {
  id: string;
  status: string;
  category: string;
  message: string;
  createdAt: string;
  travelerName?: string;
  travelerPhone?: string;
  urgent: boolean;
  assignee?: string;
}

interface MessagesResponse {
  messages: OpsMessage[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(minutes: number, t: (key: string) => string): string {
  if (minutes < 1) return t("cmd.overview.justNow");
  if (minutes < 60) return t("cmd.overview.minutesAgo").replace("${minutes}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("cmd.overview.hoursAgo").replace("${hours}", String(hours));
  return t("cmd.overview.daysAgo").replace("${days}", String(Math.floor(hours / 24)));
}

function MessageRow({
  message,
  language,
  t,
  onClick,
}: {
  message: OpsMessage;
  language: string;
  t: (k: string) => string;
  onClick: () => void;
}) {
  const ageMinutes = useMemo(() => {
    return Math.round((Date.now() - new Date(message.createdAt).getTime()) / 60000);
  }, [message.createdAt]);

  const priorityColor = message.urgent
    ? "bg-red-500/20 text-red-300 border-red-500/30"
    : message.status === "OPEN"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : message.status === "RESOLVED"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
        : "bg-[var(--text-muted)]/10 text-[var(--text-muted)] border-[var(--text-muted)]/20";

  return (
    <div
      className="p-4 border-b border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]/30 transition-colors cursor-pointer rounded-lg mb-2 last:mb-0 last:border-b-0"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityColor}`}>
              {message.urgent ? t("cmd.messages.urgent") : t(`cmd.messages.${message.status?.toLowerCase()}`)}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">{message.id}</span>
            {message.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--btn-util-bg)] text-[var(--text-muted)]">
                {message.category}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-primary)] line-clamp-2 leading-relaxed">{message.message}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-muted)]">
            {message.travelerName && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{message.travelerName}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatAge(ageMinutes, t)}</span>
            </div>
            <span className="font-mono">{message.createdAt.slice(0, 10)}</span>
          </div>
        </div>
        <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsMessagesFeed() {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<OpsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const fetchMessages = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (urgentOnly) params.category = "URGENT";
      const data = await api.getOperationsMessages(params) as MessagesResponse;
      setMessages(data.messages || []);
      setTotal(data.total || 0);
      setLastUpdated(new Date());
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgentOnly]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    void fetchMessages();
    const interval = setInterval(fetchMessages, 30_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const filteredMessages = useMemo(() => {
    let filtered = messages;
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.message || "").toLowerCase().includes(q) ||
        (m.travelerName || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q),
    );
    return filtered;
  }, [messages, search]);

  const pagedMessages = filteredMessages.slice(0, page * pageSize);

  const statusOptions = [
    { value: "all", label: "cmd.common.all" },
    { value: "OPEN", label: "cmd.messages.open" },
    { value: "IN_PROGRESS", label: "cmd.messages.inProgress" },
    { value: "RESOLVED", label: "cmd.messages.resolved" },
    { value: "ESCALATED", label: "cmd.messages.escalated" },
  ];

  return (
    <RequireRole roles={["Admin", "Operations"]}>
      <div className="space-y-4">
        <SectionHeader
          icon={MessageSquare}
          title={t("cmd.messages.title")}
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
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={urgentOnly}
                  onChange={(e) => setUrgentOnly(e.target.checked)}
                  className="w-3 h-3 rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/30"
                />
                {t("cmd.messages.urgentOnly")}
              </label>
              <button
                type="button"
                onClick={fetchMessages}
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
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : pagedMessages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t("cmd.messages.noMessages")}
            description={t("cmd.messages.noMessagesDesc")}
          />
        ) : (
          <div className="space-y-1">
            {pagedMessages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                language={language}
                t={t}
                onClick={() => {}}
              />
            ))}
          </div>
        )}

        {filteredMessages.length > pageSize && (
          <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              {t("cmd.common.showing")} {pagedMessages.length} {t("cmd.common.of")} {filteredMessages.length}
            </span>
            <TablePagination
              page={page}
              totalPages={Math.ceil(filteredMessages.length / pageSize)}
              onPageChange={(p: number) => setPage(p)}
              t={t}
            />
            {/* TablePagination: raw Pagination lacks the t prop these tables pass. */}
          </div>
        )}
      </div>
    </RequireRole>
  );
}
