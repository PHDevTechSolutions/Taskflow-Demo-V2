"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { type DateRange } from "react-day-picker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  X, Search, History, FileText, Hash,
  Phone, Mail, TrendingUp, User,
} from "lucide-react";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

/* ─── Types ───────────────────────────────────────────────────────── */

interface Account {
  id: string;
  referenceid: string;
  account_reference_number: string;
  company_name: string;
  type_client: string;
  date_created: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address?: string;
  delivery_address?: string;
  region: string;
  industry: string;
  status?: string;
}

interface Activity {
  id?: string;
  company_name?: string;
  account_reference_number?: string;
  type_activity?: string;
  remarks?: string;
  status?: string;
  date_created?: string;
  date_updated?: string;
  referenceid?: string;
  quotation_amount?: number;
  quotation_number?: string;
  quotation_status?: string;
  so_amount?: number;
  so_number?: string;
  dr_number?: string;
  delivery_date?: string;
  type_client?: string;
  source?: string;
  call_status?: string;
  call_type?: string;
  actual_sales?: number;
  ticket_reference_number?: string;
  start_date?: string;
  end_date?: string;
  payment_terms?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname?: string;
  lastname?: string;
}

interface Agent {
  ReferenceID: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  referenceid?: string;
}

interface AgentWithStats extends Agent {
  totalAccounts: number;
  withActivity: number;
  withoutActivity: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 20;
const EXCLUDED_STATUSES = ["removed", "approved for deletion", "subject for transfer"];
const ALLOWED_TYPES = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];

const filterActiveAccounts = (raw: Account[]): Account[] =>
  raw.filter((a) => {
    const status = a.status?.toLowerCase() || "";
    const typeClient = a.type_client?.toLowerCase() || "";
    if (!a.status || !a.type_client) return false;
    if (EXCLUDED_STATUSES.includes(status)) return false;
    if (!ALLOWED_TYPES.includes(typeClient)) return false;
    return true;
  });

const fmtDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const fmtCurrency = (n?: number | null) =>
  n != null ? n.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : null;

const fmtDuration = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null;
  const s = new Date(start); const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diffMs = e.getTime() - s.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
  if (!range?.from) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : new Date(range.from);
  to.setHours(23, 59, 59, 999);
  return date >= from && date <= to;
};

/* ─── Type client color map ───────────────────────────────────────── */

const TYPE_CLIENT_STYLES: Record<string, { pill: string; dot: string }> = {
  "TOP 50": { pill: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "NEXT 30": { pill: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  "BALANCE 20": { pill: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  "NEW CLIENT": { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  "TSA CLIENT": { pill: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  "CSR CLIENT": { pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

function getTypeClientStyle(type: string) {
  return TYPE_CLIENT_STYLES[type?.toUpperCase()] ?? {
    pill: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-indigo-400",
  };
}

/* ─── Stat Card ───────────────────────────────────────────────────── */

function StatCard({
  label, value, accent, onClick, isActive, sublabel, showFraction, isNegative
}: {
  label: string; value: number | string; accent: string;
  onClick?: () => void; isActive?: boolean; sublabel?: string;
  showFraction?: { count: number; total: number };
  isNegative?: boolean;
}) {
  const percentage = showFraction && showFraction.total > 0
    ? Math.round((showFraction.count / showFraction.total) * 100)
    : null;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden transition-all cursor-pointer
        ${isActive ? "ring-2 ring-indigo-500 border-indigo-400" : "hover:shadow-md hover:-translate-y-0.5"}`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${accent}, transparent 70%)` }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
        {percentage !== null && (
          <span className={`text-lg font-semibold tabular-nums ${isNegative ? "text-amber-600" : "text-emerald-600"}`}>
            / {percentage}%
          </span>
        )}
      </div>
      {sublabel && <span className="text-[9px] text-gray-400">{sublabel}</span>}
      {isActive && <span className="text-[9px] text-indigo-600 font-semibold">Selected</span>}
    </div>
  );
}

/* ─── Agent Card ──────────────────────────────────────────────────── */

function AgentCard({ agent, onClick }: { agent: AgentWithStats; onClick: () => void }) {
  const withPct = agent.totalAccounts > 0 ? Math.round((agent.withActivity / agent.totalAccounts) * 100) : 0;
  const withoutPct = agent.totalAccounts > 0 ? Math.round((agent.withoutActivity / agent.totalAccounts) * 100) : 0;
  const fullName = `${agent.FirstName || ""} ${agent.LastName || ""}`.trim() || agent.ReferenceID;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-150 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
          <User size={16} className="text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 capitalize leading-snug truncate">{fullName}</p>
          <span className="text-[10px] font-mono text-slate-400">{agent.ReferenceID}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{agent.totalAccounts.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">accounts</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
          <span className="text-slate-400 group-hover:text-indigo-600 text-xs">→</span>
        </div>
      </div>
    </div>
  );
}

/* ─── History Dialog ──────────────────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className="text-slate-500 font-semibold w-28 shrink-0 pt-px">{label}</span>
      <span className="text-slate-300 font-mono break-words">{value}</span>
    </div>
  );
}

function HistoryDialog({ open, onClose, companyName, loading, records, account }: {
  open: boolean; onClose: () => void; companyName: string | null;
  loading: boolean; records: Activity[]; account?: Account | null;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | number | null>(null);

  useEffect(() => { if (!open) { setSearch(""); setExpanded(null); } }, [open]);

  const totalActualSales = useMemo(() => records.reduce((sum, r) => sum + (r.actual_sales ?? 0), 0), [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      (r.type_activity ?? "").toLowerCase().includes(q) ||
      (r.remarks ?? "").toLowerCase().includes(q) ||
      (r.status ?? "").toLowerCase().includes(q)
    );
  }, [search, records]);

  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    records.forEach((r) => { const t = r.type_activity ?? "Other"; g[t] = (g[t] ?? 0) + 1; });
    return g;
  }, [records]);

  const typeStyles: Record<string, string> = {
    Call: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    Email: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    Meeting: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    Demo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    Proposal: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  };
  const getTypeStyle = (t?: string) => typeStyles[t ?? ""] ?? "bg-slate-700/60 text-slate-300 border-slate-600/30";
  const toggleExpand = (key: string | number | null) => setExpanded((prev) => (prev === key ? null : key));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117]">
        <div className="px-6 py-4 bg-[#161b22] border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="ml-1">
              <DialogTitle className="text-white text-[11px] font-bold font-mono tracking-widest uppercase">activity_history</DialogTitle>
              <DialogDescription className="text-slate-500 text-[10px] font-mono">{companyName}</DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5">
            <X size={12} />
          </button>
        </div>

        {!loading && records.length > 0 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-white/5 bg-[#161b22]/50 shrink-0">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold font-mono border border-white/10">{records.length} records</span>
            {Object.entries(grouped).map(([type, count]) => (
              <span key={type} className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium border ${getTypeStyle(type)}`}>
                {type} · <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="px-6 py-3 border-b border-white/5 bg-[#0d1117] shrink-0">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {account?.contact_person && (
                <div className="flex items-center gap-2 text-[11px]">
                  <User size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono truncate">{account.contact_person}</span>
                </div>
              )}
              {account?.contact_number && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Phone size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono">{account.contact_number}</span>
                </div>
              )}
              {account?.email_address && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Mail size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono truncate">{account.email_address}</span>
                </div>
              )}
            </div>
            {totalActualSales > 0 && (
              <div className="shrink-0 flex flex-col items-end gap-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold font-mono uppercase tracking-wide">
                  <TrendingUp size={10} /> Total Actual Sales
                </div>
                <span className="text-emerald-300 font-bold font-mono text-base tabular-nums">
                  {totalActualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input type="text" placeholder="Search activity..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-300 placeholder-slate-600 font-mono" />
            {search && <button onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Fetching records…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <History size={20} className="text-slate-600" />
              </div>
              <p className="text-xs text-slate-600 font-mono">no records found</p>
            </div>
          ) : filtered.map((r, i) => {
            const key = `${r.id ?? "no-id"}-${i}`;
            const isOpen = expanded === key;
            const duration = fmtDuration(r.start_date, r.end_date);
            const hasExtra = !!(r.quotation_amount || r.quotation_number || r.actual_sales);

            return (
              <div key={key} className="rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all overflow-hidden">
                <div className={`flex gap-3 p-3 ${hasExtra ? "cursor-pointer" : ""}`} onClick={() => hasExtra && toggleExpand(key)}>
                  <div className="shrink-0 pt-0.5">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-bold uppercase border font-mono ${getTypeStyle(r.type_activity)}`}>
                      {r.type_activity ?? "—"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 font-mono uppercase">{r.remarks || <span className="text-slate-600 italic">no remarks</span>}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {r.status && <span className="text-[10px] text-slate-500 font-mono">status: {r.status}</span>}
                      {r.quotation_number && <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-mono"><Hash size={9} />{r.quotation_number}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-slate-400 font-mono">{fmtDate(r.date_created) ?? "—"}</p>
                    <p className="text-[9px] text-slate-600 font-mono">created</p>
                    {hasExtra && <span className="text-[9px] text-slate-600 font-mono">{isOpen ? "▲ less" : "▼ more"}</span>}
                  </div>
                </div>

                {isOpen && hasExtra && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-white/[0.02] space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 uppercase">
                      <DetailField label="Quotation No." value={r.quotation_number} />
                      <DetailField label="Quotation Status" value={r.quotation_status} />
                      <DetailField label="Quotation Amount" value={fmtCurrency(r.quotation_amount)} />
                      <DetailField label="SO Number" value={r.so_number} />
                      <DetailField label="SO Amount" value={fmtCurrency(r.so_amount)} />
                      <DetailField label="Actual Sales" value={fmtCurrency(r.actual_sales)} />
                      <DetailField label="DR Number" value={r.dr_number} />
                      <DetailField label="Delivery Date" value={fmtDate(r.delivery_date)} />
                      <DetailField label="Payment Terms" value={r.payment_terms} />
                      <DetailField label="Duration" value={duration} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Dashboard Content ───────────────────────────────────────── */

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "",
  });
  // TSM-level data (for agents overview)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  // Agent-level data (for drill-down — fetched fresh per agent)
  const [agentAccounts, setAgentAccounts] = useState<Account[]>([]);
  const [agentActivities, setAgentActivities] = useState<Activity[]>([]);
  const [loadingAgentData, setLoadingAgentData] = useState(false);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "with" | "without">("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCompany, setHistoryCompany] = useState<string | null>(null);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<Activity[]>([]);
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [drillLevel, setDrillLevel] = useState<"agents" | "accounts">("agents");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          firstname: data.FirstName || "",
          lastname: data.LastName || "",
        });
        sileo.success({ title: "Success", description: "User data loaded successfully!", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } catch (err) {
        sileo.error({ title: "Failed", description: "Failed to fetch user data. Please try again.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [userId]);

  // ─── TSM-level fetch (agents overview) ───
  useEffect(() => {
    if (!userDetails.referenceid) return;
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const accRes = await fetch(`/api/accounts-tsm?tsm=${encodeURIComponent(userDetails.referenceid)}`);
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(Array.isArray(accData) ? accData : accData.data ?? []);
        }

        const agentsRes = await fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`);
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          const raw = Array.isArray(agentsData) ? agentsData : [];
          const normalized = raw.map((a: any) => ({
            ...a,
            ReferenceID: a.ReferenceID || a.referenceid || "",
            FirstName: a.FirstName || a.Firstname || a.firstname || a.first_name || "",
            LastName: a.LastName || a.Lastname || a.lastname || a.last_name || "",
          }));
          setAgents(normalized);
        }

        const fetchActivitiesSmart = async () => {
          if (dateCreatedFilterRange?.from) {
            const fromDate = dateCreatedFilterRange.from.toISOString().split("T")[0];
            const toDate = dateCreatedFilterRange.to?.toISOString().split("T")[0] || fromDate;
            const actRes = await fetch(`/api/activities-tsm?tsm=${encodeURIComponent(userDetails.referenceid)}&from=${fromDate}&to=${toDate}&fetchAll=true`);
            if (actRes.ok) {
              const actData = await actRes.json();
              return Array.isArray(actData) ? actData : actData.data ?? [];
            }
          }
          const actRes = await fetch(`/api/activities-tsm?tsm=${encodeURIComponent(userDetails.referenceid)}&fetchAll=true`);
          if (actRes.ok) {
            const actData = await actRes.json();
            return Array.isArray(actData) ? actData : actData.data ?? [];
          }
          const fallbackRes = await fetch(`/api/activities-tsm?tsm=${encodeURIComponent(userDetails.referenceid)}&limit=1000`);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            return Array.isArray(fallbackData) ? fallbackData : fallbackData.data ?? [];
          }
          return [];
        };

        setActivities(await fetchActivitiesSmart());
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  // ─── TSM-level derived data ───
  const allActiveAccounts = useMemo(() => filterActiveAccounts(accounts), [accounts]);

  const filteredActivitiesByDate = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities;
    return activities.filter((a) => a.date_created && isDateInRange(a.date_created, dateCreatedFilterRange));
  }, [activities, dateCreatedFilterRange]);

  // ─── Agent stats for overview cards (TSM-level, using account_reference_number matching) ───
  const agentStats = useMemo(() => {
    return agents.map((agent) => {
      const agentAccs = allActiveAccounts.filter(
        (a) => a.referenceid?.toLowerCase() === agent.ReferenceID?.toLowerCase()
      );
      const agentAccRefs = new Set(agentAccs.map((a) => a.account_reference_number));
      const withActivitySet = new Set(
        filteredActivitiesByDate
          .filter((act) => act.account_reference_number && agentAccRefs.has(act.account_reference_number))
          .map((act) => act.account_reference_number as string)
      );
      const withActivity = agentAccs.filter((a) => withActivitySet.has(a.account_reference_number)).length;
      return {
        ...agent,
        totalAccounts: agentAccs.length,
        withActivity,
        withoutActivity: agentAccs.length - withActivity,
      };
    }).sort((a, b) => b.totalAccounts - a.totalAccounts);
  }, [agents, allActiveAccounts, filteredActivitiesByDate]);

  // ─── TSM-level stat card totals (agents overview) ───
  const tsmStatCards = useMemo(() => {
    const withActivity = allActiveAccounts.filter((a) => {
      const s = new Set(filteredActivitiesByDate.map((act) => act.account_reference_number));
      return s.has(a.account_reference_number);
    }).length;
    const typeStats: Record<string, { total: number; withActivity: number; withoutActivity: number }> = {};
    const activitySet = new Set(filteredActivitiesByDate.map((act) => act.account_reference_number));
    allActiveAccounts.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      const hasAct = activitySet.has(a.account_reference_number);
      if (!typeStats[t]) typeStats[t] = { total: 0, withActivity: 0, withoutActivity: 0 };
      typeStats[t].total += 1;
      if (hasAct) typeStats[t].withActivity += 1;
      else typeStats[t].withoutActivity += 1;
    });
    return {
      total: allActiveAccounts.length,
      withActivity,
      withoutActivity: allActiveAccounts.length - withActivity,
      typeStats: Object.entries(typeStats)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.total - a.total),
    };
  }, [allActiveAccounts, filteredActivitiesByDate]);

  // ─── Agent drill-down: scoped data from fresh per-agent fetch ───
  const scopedActivities = useMemo(() => {
    if (drillLevel !== "accounts") return filteredActivitiesByDate;
    // Apply date filter on agent activities
    if (!dateCreatedFilterRange?.from) return agentActivities;
    return agentActivities.filter((a) => a.date_created && isDateInRange(a.date_created, dateCreatedFilterRange));
  }, [drillLevel, agentActivities, filteredActivitiesByDate, dateCreatedFilterRange]);

  const scopedAccounts = useMemo(() => {
    if (drillLevel !== "accounts") return allActiveAccounts;
    return agentAccounts;
  }, [drillLevel, agentAccounts, allActiveAccounts]);

  // ─── Scoped computations (used for drill-down stat cards + table) ───
  const scopedAccountsWithActivity = useMemo(() => {
    const s = new Set<string>();
    scopedActivities.forEach((a) => { if (a.account_reference_number) s.add(a.account_reference_number); });
    return s;
  }, [scopedActivities]);

  const activityCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    scopedActivities.forEach((a) => {
      if (a.account_reference_number)
        m[a.account_reference_number] = (m[a.account_reference_number] ?? 0) + 1;
    });
    return m;
  }, [scopedActivities]);

  const lastActivityDateMap = useMemo(() => {
    const m: Record<string, string> = {};
    scopedActivities.forEach((a) => {
      if (a.account_reference_number && a.date_created) {
        const key = a.account_reference_number;
        if (!m[key] || new Date(a.date_created) > new Date(m[key])) m[key] = a.date_created;
      }
    });
    return m;
  }, [scopedActivities]);

  const typeClientStats = useMemo(() => {
    const stats: Record<string, { total: number; withActivity: number; withoutActivity: number }> = {};
    scopedAccounts.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      const hasActivity = scopedAccountsWithActivity.has(a.account_reference_number);
      if (!stats[t]) stats[t] = { total: 0, withActivity: 0, withoutActivity: 0 };
      stats[t].total += 1;
      if (hasActivity) stats[t].withActivity += 1;
      else stats[t].withoutActivity += 1;
    });
    return Object.entries(stats)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [scopedAccounts, scopedAccountsWithActivity]);

  const filteredAccounts = useMemo(() => {
    let list = scopedAccounts;
    if (activityFilter === "with") list = list.filter((a) => scopedAccountsWithActivity.has(a.account_reference_number));
    else if (activityFilter === "without") list = list.filter((a) => !scopedAccountsWithActivity.has(a.account_reference_number));
    if (typeFilter) list = list.filter((a) => a.type_client?.toUpperCase() === typeFilter);
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.email_address.toLowerCase().includes(q)
    );
  }, [scopedAccounts, search, typeFilter, activityFilter, scopedAccountsWithActivity]);

  const withActivityCount = scopedAccounts.filter((a) => scopedAccountsWithActivity.has(a.account_reference_number)).length;
  const withoutActivityCount = scopedAccounts.length - withActivityCount;

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [search, typeFilter, activityFilter, drillLevel, selectedAgentId]);

  const openHistory = (account: Account) => {
    setHistoryCompany(account.company_name);
    setHistoryAccount(account);
    setHistoryOpen(true);
    setLoadingHistory(true);
    // Use agentActivities (unfiltered by date) when in drill-down so history shows all records
    const sourceActivities = drillLevel === "accounts" ? agentActivities : activities;
    const records = sourceActivities.filter((a) => {
      if (a.account_reference_number !== account.account_reference_number) return false;
      if (!dateCreatedFilterRange?.from) return true;
      if (!a.date_created) return false;
      return isDateInRange(a.date_created, dateCreatedFilterRange);
    });
    setHistoryRecords(records);
    setLoadingHistory(false);
  };

  const accentColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
  const loading = loadingUser || loadingData;

  const goToAgents = () => {
    setDrillLevel("agents");
    setSelectedAgentId(null);
    setSelectedAgentName(null);
    setAgentAccounts([]);
    setAgentActivities([]);
    setSearch("");
    setActivityFilter("all");
    setTypeFilter(null);
  };

  // ─── Select agent: fetch fresh data using agent's own referenceid ───
  const selectAgent = async (agentId: string, agentName: string) => {
    setSelectedAgentId(agentId);
    setSelectedAgentName(agentName);
    setDrillLevel("accounts");
    setSearch("");
    setCurrentPage(1);
    setActivityFilter("all");
    setTypeFilter(null);
    setLoadingAgentData(true);
    try {
      const dateParams = dateCreatedFilterRange?.from
        ? `&from=${dateCreatedFilterRange.from.toISOString().split("T")[0]}&to=${(dateCreatedFilterRange.to ?? dateCreatedFilterRange.from).toISOString().split("T")[0]}`
        : "";

      const [accRes, actRes] = await Promise.all([
        fetch(`/api/accounts?referenceid=${encodeURIComponent(agentId)}`),
        fetch(`/api/activities?referenceid=${encodeURIComponent(agentId)}&fetchAll=true${dateParams}`),
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        const raw = Array.isArray(accData) ? accData : accData.data ?? [];
        setAgentAccounts(filterActiveAccounts(raw));
      }

      if (actRes.ok) {
        const actData = await actRes.json();
        setAgentActivities(Array.isArray(actData) ? actData : actData.data ?? []);
      }
    } catch (err) {
      console.error("Agent data fetch error:", err);
    } finally {
      setLoadingAgentData(false);
    }
  };

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                      My Account Management
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} companyName={historyCompany} loading={loadingHistory} records={historyRecords} account={historyAccount} />

            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      {drillLevel === "accounts" && selectedAgentName ? (
                        <>
                          <button onClick={goToAgents} className="hover:text-indigo-600">
                            <span className="hover:underline">All Agents</span>
                            <span className="text-gray-400 ml-1">/</span>
                          </button>
                          <span className="font-semibold text-gray-800">{selectedAgentName}</span>
                        </>
                      ) : (
                        <span className="font-semibold text-gray-800">All Agents</span>
                      )}
                    </div>
                    <h1 className="text-lg font-bold text-gray-900">
                      {drillLevel === "accounts" && selectedAgentName
                        ? `${selectedAgentName}'s Accounts`
                        : "My Account Management"}
                    </h1>
                    <p className="text-xs text-gray-500">
                      {drillLevel === "accounts" && selectedAgentName
                        ? `Viewing accounts assigned to ${selectedAgentName}`
                        : "Manage your assigned accounts and view activity history"}
                    </p>
                  </div>
                  {drillLevel === "accounts" && (
                    <button onClick={goToAgents} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <X size={12} /> Back to Agents
                    </button>
                  )}
                </div>

                {/* Stats — agents overview uses tsmStatCards, drill-down uses scoped */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {drillLevel === "agents" ? (
                    <>
                      <StatCard label="Total Accounts" value={tsmStatCards.total} accent="#1e293b"
                        onClick={() => { setActivityFilter("all"); setTypeFilter(null); }}
                        isActive={activityFilter === "all" && !typeFilter}
                        sublabel="valid type_client accounts" />
                      <StatCard label="With Activity" value={tsmStatCards.withActivity} accent="#10b981"
                        showFraction={{ count: tsmStatCards.withActivity, total: tsmStatCards.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      <StatCard label="No Activity" value={tsmStatCards.withoutActivity} accent="#f59e0b"
                        isNegative
                        showFraction={{ count: tsmStatCards.withoutActivity, total: tsmStatCards.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      {tsmStatCards.typeStats.map((stat, i) => (
                        <StatCard key={stat.type} label={stat.type} value={stat.total}
                          accent={accentColors[i % accentColors.length]}
                          sublabel={`${stat.withActivity} with / ${stat.withoutActivity} without`} />
                      ))}
                    </>
                  ) : (
                    <>
                      <StatCard label="Total Accounts" value={scopedAccounts.length} accent="#1e293b"
                        onClick={() => { setActivityFilter("all"); setTypeFilter(null); }}
                        isActive={activityFilter === "all" && !typeFilter}
                        sublabel={`assigned to ${selectedAgentName}`} />
                      <StatCard label="With Activity" value={withActivityCount} accent="#10b981"
                        onClick={() => setActivityFilter(activityFilter === "with" ? "all" : "with")}
                        isActive={activityFilter === "with"}
                        showFraction={{ count: withActivityCount, total: scopedAccounts.length }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      <StatCard label="No Activity" value={withoutActivityCount} accent="#f59e0b"
                        onClick={() => setActivityFilter(activityFilter === "without" ? "all" : "without")}
                        isActive={activityFilter === "without"}
                        isNegative
                        showFraction={{ count: withoutActivityCount, total: scopedAccounts.length }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      {typeClientStats.map((stat, i) => (
                        <StatCard key={stat.type} label={stat.type} value={stat.total}
                          accent={accentColors[i % accentColors.length]}
                          onClick={() => setTypeFilter(typeFilter === stat.type ? null : stat.type)}
                          isActive={typeFilter === stat.type}
                          sublabel={`${stat.withActivity} with / ${stat.withoutActivity} without`} />
                      ))}
                    </>
                  )}
                </div>

                {/* Active Filters */}
                {(activityFilter !== "all" || typeFilter || dateCreatedFilterRange?.from) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Active filters:</span>
                    {activityFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {activityFilter === "with" ? "With Activities" : "No Activities"}
                        <button onClick={() => setActivityFilter("all")} className="text-indigo-400 hover:text-indigo-700"><X size={10} /></button>
                      </span>
                    )}
                    {typeFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {typeFilter}
                        <button onClick={() => setTypeFilter(null)} className="text-indigo-400 hover:text-indigo-700"><X size={10} /></button>
                      </span>
                    )}
                    {dateCreatedFilterRange?.from && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        📅 {dateCreatedFilterRange.from.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        {dateCreatedFilterRange.to && dateCreatedFilterRange.to !== dateCreatedFilterRange.from && ` to ${dateCreatedFilterRange.to.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
                        <button onClick={() => setDateCreatedFilterRangeAction(undefined)} className="text-amber-400 hover:text-amber-700"><X size={10} /></button>
                      </span>
                    )}
                    <button
                      onClick={() => { setActivityFilter("all"); setTypeFilter(null); setDateCreatedFilterRangeAction(undefined); }}
                      className="text-[11px] text-gray-400 hover:text-gray-600 underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Agents List or Accounts Table */}
                {drillLevel === "agents" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Click on an agent to view their accounts</p>
                      <span className="text-xs text-gray-400">{agentStats.length} agents</span>
                    </div>
                    {agentStats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                        <User size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">No agents found</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {agentStats.map((agent) => (
                          <AgentCard
                            key={agent.ReferenceID}
                            agent={agent}
                            onClick={() => selectAgent(
                              agent.ReferenceID,
                              `${agent.FirstName || ""} ${agent.LastName || ""}`.trim() || agent.ReferenceID
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : loadingAgentData ? (
                  <div className="flex justify-center items-center py-16">
                    <Spinner className="size-8" />
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                      <Search size={13} className="text-slate-400" />
                      <input type="text" placeholder="Search company, contact, email..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400" />
                      {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-100">
                              {["Actions", "Activities", "Last Touch", "Company", "Type"].map((h) => (
                                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAccounts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-14 text-sm text-gray-400">
                                  {search || typeFilter ? "No accounts match your filters" : "No accounts found"}
                                </TableCell>
                              </TableRow>
                            ) : paginatedAccounts.map((account) => {
                              const actCount = activityCountMap[account.account_reference_number] ?? 0;
                              const hasAct = actCount > 0;
                              const typeStyle = getTypeClientStyle(account.type_client);
                              return (
                                <TableRow key={account.id} className="hover:bg-indigo-50/20 transition-colors">
                                  <TableCell>
                                    <button onClick={() => openHistory(account)} className="flex items-center gap-1 text-[11px] font-mono font-semibold text-indigo-500 hover:text-indigo-700">
                                      <History size={11} /> history
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <button onClick={() => openHistory(account)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${hasAct ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                                      <FileText size={9} /> {actCount}
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    {(() => {
                                      const lastActDate = lastActivityDateMap[account.account_reference_number];
                                      const fallbackDate = account.date_created;
                                      const hasActivity = !!lastActDate;
                                      const displayDate = hasActivity ? lastActDate : fallbackDate;
                                      return (
                                        <span className={`text-[10px] font-mono ${hasActivity ? "text-gray-500" : "text-amber-600"}`}>
                                          {fmtDate(displayDate) ?? "—"}
                                          {!hasActivity && displayDate && <span className="text-[9px] text-amber-500 ml-1">(created)</span>}
                                        </span>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="font-semibold text-gray-800 text-sm">{account.company_name}</TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeStyle.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} /> {account.type_client?.toUpperCase()}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {filteredAccounts.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                          <span>Showing <span className="font-semibold">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}</span> of <span className="font-semibold">{filteredAccounts.length}</span></span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Prev</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                              return page <= totalPages ? (
                                <button key={page} onClick={() => setCurrentPage(page)} className={`rounded-lg px-2.5 py-1 ${page === currentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>{page}</button>
                              ) : null;
                            })}
                            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </main>
        </SidebarInset>
        <SidebarRight
          dateCreatedFilterRange={dateCreatedFilterRange}
          setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
        />
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}