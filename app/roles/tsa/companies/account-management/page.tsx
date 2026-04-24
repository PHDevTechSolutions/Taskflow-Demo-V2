"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { type DateRange } from "react-day-picker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  X, Search, History, FileText, Hash, Building2,
  Phone, Mail, MapPin, TrendingUp, User,
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

/* ─── Helpers ───────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 20;

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

// ─── Date range helper ──────────────────────────────────────────────
const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
  if (!range?.from) return true; // No filter = include all
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

type FilterType = "all" | "with-activity" | "no-activity" | string;

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
            const key = r.id ?? i;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
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
  // Date range state - NOW USED for filtering activities data
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details when userId changes
  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

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

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 3000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } catch (err) {
        sileo.error({
          title: "Failed",
          description: "Failed to fetch user data. Please try again.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // ─── Fetch ALL accounts & activities (NO date filtering) ───
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Fetch all accounts from Neon
        const accRes = await fetch(`/api/accounts?referenceid=${encodeURIComponent(userDetails.referenceid)}`);
        if (accRes.ok) {
          const accData = await accRes.json();
          let list = Array.isArray(accData) ? accData : accData.data ?? [];
          setAccounts(list);
        }

        // ─── Fetch activities with smart date filtering and batch processing ───
        const fetchActivitiesSmart = async () => {
          // If date range is selected, use server-side filtering for efficiency
          if (dateCreatedFilterRange?.from) {
            const fromDate = dateCreatedFilterRange.from.toISOString().split('T')[0];
            const toDate = dateCreatedFilterRange.to?.toISOString().split('T')[0] || fromDate;
            
            console.log(`=== FRONTEND DATE FILTER DEBUG ===`);
            console.log(`Date range from: ${dateCreatedFilterRange.from}`);
            console.log(`Date range to: ${dateCreatedFilterRange.to}`);
            console.log(`Using server-side date filtering: ${fromDate} to ${toDate}`);
            
            const activitiesUrl = `/api/activities?referenceid=${encodeURIComponent(userDetails.referenceid)}&from=${fromDate}&to=${toDate}&fetchAll=true`;
            console.log(`Calling API URL: ${activitiesUrl}`);
            
            const actRes = await fetch(activitiesUrl);
            console.log(`API Response status: ${actRes.status}`);
            
            if (actRes.ok) {
              const actData = await actRes.json();
              let list = Array.isArray(actData) ? actData : actData.data ?? [];
              console.log(`Server-side filtered: ${list.length} activities`);
              
              // Check for April 14th in the response
              const april14Records = list.filter((a: Activity) => {
                const date = a.date_created;
                return date && (date.includes('2025-04-14') || date.includes('2026-04-14'));
              });
              
              if (april14Records.length > 0) {
                console.log(`FOUND ${april14Records.length} APRIL 14TH RECORDS IN RESPONSE:`, april14Records.map((r: Activity) => ({ 
                  company: r.company_name, 
                  date: r.date_created, 
                  activity: r.type_activity 
                })));
              } else {
                console.log(`NO APRIL 14TH RECORDS FOUND IN RESPONSE`);
                console.log(`Sample dates in response:`, list.slice(0, 5).map((a: Activity) => a.date_created));
              }
              
              return list;
            } else {
              console.error(`API Error: ${actRes.status} - ${actRes.statusText}`);
              const errorText = await actRes.text();
              console.error(`Error response:`, errorText);
            }
          }
          
          // If no date filter, fetch ALL data using batch processing
          console.log(`No date filter selected - fetching ALL activities using batch processing`);
          
          const activitiesUrl = `/api/activities?referenceid=${encodeURIComponent(userDetails.referenceid)}&fetchAll=true`;
          const actRes = await fetch(activitiesUrl);
          
          if (actRes.ok) {
            const actData = await actRes.json();
            let list = Array.isArray(actData) ? actData : actData.data ?? [];
            console.log(`ALL data fetched via batch processing: ${list.length} activities`);
            
            // Check for April 14th in the full dataset
            const april14Records = list.filter((a: Activity) => {
              const date = a.date_created;
              return date && (date.includes('2025-04-14') || date.includes('2026-04-14'));
            });
            
            if (april14Records.length > 0) {
              console.log(`FOUND ${april14Records.length} APRIL 14TH RECORDS IN FULL DATASET!`);
            }
            
            return list;
          }
          
          // Fallback to basic fetch
          console.log("Using fallback fetch method");
          const fallbackUrl = `/api/activities?referenceid=${encodeURIComponent(userDetails.referenceid)}&limit=1000`;
          const fallbackRes = await fetch(fallbackUrl);
          
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            let list = Array.isArray(fallbackData) ? fallbackData : fallbackData.data ?? [];
            return list;
          }
          
          return [];
        };
        
        const allActivities = await fetchActivitiesSmart();
        
        console.log("=== ACTIVITIES FETCH DEBUG ===");
        console.log("Total activities fetched:", allActivities.length);
        console.log("Date range of activities:");
        if (allActivities.length > 0) {
          const dates = allActivities.map((a: Activity) => a.date_created).filter(Boolean) as string[];
          const earliest = new Date(Math.min(...dates.map((d: string) => new Date(d).getTime())));
          const latest = new Date(Math.max(...dates.map((d: string) => new Date(d).getTime())));
          console.log("Earliest date:", earliest.toLocaleDateString());
          console.log("Latest date:", latest.toLocaleDateString());
          console.log("Sample February activities:", allActivities.filter((a: Activity) => a.date_created?.includes("2025-02")).slice(0, 3).map((a: Activity) => ({ company: a.company_name, date: a.date_created })));
        }
        console.log("============================");
        setActivities(allActivities);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  // ─── Filter accounts to match Accounts Table logic ───
  // Include all accounts with valid type_client that are not excluded
  const activeAccounts = useMemo(() => {
    const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];
    const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
    
    return accounts.filter((a) => {
      const status = a.status?.toLowerCase() || "";
      const typeClient = a.type_client?.toLowerCase() || "";
      
      // Must have status and type_client
      if (!a.status || !a.type_client) return false;
      
      // Exclude removed/approved for deletion/subject for transfer
      if (excludedStatuses.includes(status)) return false;
      
      // Must be in allowed types (to match Accounts Table)
      if (!allowedTypes.includes(typeClient)) return false;
      
      return true;
    });
  }, [accounts]);

  // ─── Use all active accounts (no deduplication) ───
  const allActiveAccounts = activeAccounts;

  // ─── Filter activities by date range (default: ALL activities) ───
  const filteredActivitiesByDate = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities; // No filter = return all
    return activities.filter((a) => {
      const dateToCheck = a.date_created;
      if (!dateToCheck) return false;
      return isDateInRange(dateToCheck, dateCreatedFilterRange);
    });
  }, [activities, dateCreatedFilterRange]);

  // ─── Activity counts based on DATE-FILTERED activities (aggregated by account_reference_number) ───
  const activityCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (a.account_reference_number) {
        const accRef = a.account_reference_number;
        m[accRef] = (m[accRef] ?? 0) + 1;
      }
    });
    return m;
  }, [filteredActivitiesByDate]);

  // ─── Account account_reference_number to account mapping (ALL accounts) ───
  const accountRefToAccountMap = useMemo(() => {
    const m: Record<string, Account> = {};
    allActiveAccounts.forEach((a) => {
      m[a.account_reference_number] = a; // Each account gets its slot (last wins if duplicates)
    });
    return m;
  }, [allActiveAccounts]);

  // ─── Last activity date per account (based on filtered activities) ───
  const lastActivityDateMap = useMemo(() => {
    const m: Record<string, string> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (a.account_reference_number) {
        const key = a.account_reference_number;
        const date = a.date_created;
        if (date) {
          // Keep the most recent date
          if (!m[key] || new Date(date) > new Date(m[key])) {
            m[key] = date;
          }
        }
      }
    });
    return m;
  }, [filteredActivitiesByDate]);

  // ─── Total actual sales per account (based on filtered activities) ───
  const totalSalesMap = useMemo(() => {
    const m: Record<string, number> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (a.account_reference_number) {
        const key = a.account_reference_number;
        const sales = a.actual_sales ?? 0;
        m[key] = (m[key] ?? 0) + sales;
      }
    });
    return m;
  }, [filteredActivitiesByDate]);

  // ─── Identifier per account: Leads vs Customer ───
  // Leads: Only has Outbound Calls as type_client, OR no activity at all
  // Customer: Has Quotation Preparation, Sales Order Preparation, or Delivered/Closed Transaction
  const identifierMap = useMemo(() => {
    const m: Record<string, "Leads" | "Customer"> = {};
    
    // Pre-check: which accounts have activities at all
    const accountActivities: Record<string, Activity[]> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (a.account_reference_number) {
        const key = a.account_reference_number;
        if (!accountActivities[key]) accountActivities[key] = [];
        accountActivities[key].push(a);
      }
    });

    // Determine identifier for each account
    Object.entries(accountActivities).forEach(([key, acts]) => {
      if (acts.length === 0) {
        m[key] = "Leads";
        return;
      }

      // Check for customer indicators first
      const hasCustomerActivity = acts.some((a) =>
        a.type_activity === "Quotation Preparation" ||
        a.type_activity === "Sales Order Preparation" ||
        a.type_activity === "Delivered/Closed Transaction"
      );

      if (hasCustomerActivity) {
        m[key] = "Customer";
      } else {
        // Check if all activities are Outbound Calls type_client
        const allOutboundCalls = acts.every((a) =>
          a.type_client?.toLowerCase().includes("outbound calls")
        );
        if (allOutboundCalls) {
          m[key] = "Leads";
        } else {
          // Mixed activities without customer indicators = Leads
          m[key] = "Leads";
        }
      }
    });

    return m;
  }, [filteredActivitiesByDate]);

  // ─── Accounts with activity (based on filtered activities) ───
  const accountsWithActivity = useMemo(() => {
    const s = new Set<string>();
    filteredActivitiesByDate.forEach((a) => { 
      if (a.account_reference_number) {
        s.add(a.account_reference_number);
      }
    });
    return s;
  }, [filteredActivitiesByDate]);

  // ─── Summary stats: Customers, Leads, and Total Sales ───
  const { customerCount, leadsCount, totalSalesAll } = useMemo(() => {
    let customers = 0;
    let leads = 0;
    let totalSales = 0;

    allActiveAccounts.forEach((account) => {
      const key = account.account_reference_number;
      const identifier = identifierMap[key] ?? (accountsWithActivity.has(key) ? "Customer" : "Leads");
      
      if (identifier === "Customer") {
        customers++;
      } else {
        leads++;
      }
      
      totalSales += totalSalesMap[key] ?? 0;
    });

    return { customerCount: customers, leadsCount: leads, totalSalesAll: totalSales };
  }, [allActiveAccounts, identifierMap, totalSalesMap, accountsWithActivity]);

  // ─── Filtered accounts (ALL accounts - no deduplication) ───
  const filteredAccounts = useMemo(() => {
    // Start with all accounts
    let list = allActiveAccounts;

    // Apply activity filter
    if (activityFilter === "with") {
      list = list.filter((a) => accountsWithActivity.has(a.account_reference_number));
    } else if (activityFilter === "without") {
      list = list.filter((a) => !accountsWithActivity.has(a.account_reference_number));
    }

    // Apply type filter
    if (typeFilter) list = list.filter((a) => a.type_client?.toUpperCase() === typeFilter);

    // Apply search
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.email_address.toLowerCase().includes(q)
    );
  }, [allActiveAccounts, search, typeFilter, activityFilter, accountsWithActivity]);

  // ─── Type client stats with activity breakdown ───
  const typeClientStats = useMemo(() => {
    const stats: Record<string, { total: number; withActivity: number; withoutActivity: number }> = {};
    allActiveAccounts.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      const hasActivity = accountsWithActivity.has(a.account_reference_number);
      if (!stats[t]) {
        stats[t] = { total: 0, withActivity: 0, withoutActivity: 0 };
      }
      stats[t].total += 1;
      if (hasActivity) {
        stats[t].withActivity += 1;
      } else {
        stats[t].withoutActivity += 1;
      }
    });
    return Object.entries(stats)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [allActiveAccounts, accountsWithActivity]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [search, typeFilter, activityFilter]);

  // ─── Counts based on ALL ACTIVE accounts ───
  const withActivityCount = allActiveAccounts.filter((a) => accountsWithActivity.has(a.account_reference_number)).length;
  const withoutActivityCount = allActiveAccounts.length - withActivityCount;

  // ─── DEBUG: Log counts for verification ───
  useEffect(() => {
    console.log("=== ACCOUNT-MANAGEMENT COVERAGE DEBUG ===");
    console.log("Date Range:", dateCreatedFilterRange?.from ? `${dateCreatedFilterRange.from} to ${dateCreatedFilterRange.to || dateCreatedFilterRange.from}` : "ALL (no filter)");
    console.log("Total Accounts (all):", accounts.length);
    console.log("Active Accounts (raw):", activeAccounts.length);
    console.log("Active Accounts (all):", allActiveAccounts.length);
    console.log("Total Activities (all):", activities.length);
    console.log("Filtered Activities (by date):", filteredActivitiesByDate.length);
    console.log("Unique accounts with activity (Set size):", accountsWithActivity.size);
    console.log("With Activity count:", withActivityCount);
    console.log("No Activity count:", withoutActivityCount);
    
    // Detailed breakdown of all active accounts
    console.log("=== DETAILED ACCOUNT BREAKDOWN ===");
    const allAccountDetails = allActiveAccounts.map(account => {
      const accRef = account.account_reference_number;
      const hasActivity = accountsWithActivity.has(accRef);
      const activityCount = activityCountMap[accRef] ?? 0;
      return {
        company_name: account.company_name,
        account_reference_number: account.account_reference_number,
        referenceid: account.referenceid,
        status: account.status,
        type_client: account.type_client,
        hasActivity,
        activityCount,
        lastActivity: lastActivityDateMap[accRef]
      };
    });
    
    console.log("All unique active accounts:", allAccountDetails);
    
    const accountsWithoutActivityList = allAccountDetails.filter((a: typeof allAccountDetails[0]) => !a.hasActivity);
    const accountsWithActivityList = allAccountDetails.filter((a: typeof allAccountDetails[0]) => a.hasActivity);
    
    console.log(`Accounts WITHOUT activity (${accountsWithoutActivityList.length}):`, accountsWithoutActivityList.map((a: typeof allAccountDetails[0]) => a.company_name));
    console.log(`Accounts WITH activity (${accountsWithActivityList.length}):`, accountsWithActivityList.map((a: typeof allAccountDetails[0]) => ({ company: a.company_name, count: a.activityCount })));
    
    // Check for any data issues
    console.log("=== DATA VALIDATION ===");
    const duplicateCompanies = allActiveAccounts.filter((account, index, self) => 
      self.findIndex(a => a.company_name.toLowerCase() === account.company_name.toLowerCase()) !== index
    );
    if (duplicateCompanies.length > 0) {
      console.log("WARNING: Found duplicate company names:", duplicateCompanies.map(a => a.company_name));
    }
    
    // Check activities for missing company names
    const activitiesWithoutCompany = activities.filter(a => !a.company_name);
    if (activitiesWithoutCompany.length > 0) {
      console.log("WARNING: Found activities without company names:", activitiesWithoutCompany.length);
    }
    
    // Check for activities with account_reference_number that don't match any account
    const activityAccountsNotFound = Array.from(accountsWithActivity).filter(accRef => 
      !allActiveAccounts.some(account => account.account_reference_number === accRef)
    );
    if (activityAccountsNotFound.length > 0) {
      console.log("WARNING: Activity accounts not found in accounts:", activityAccountsNotFound);
    }
    
    console.log("============================");
  }, [accounts.length, activeAccounts.length, allActiveAccounts.length, activities.length, filteredActivitiesByDate.length, dateCreatedFilterRange?.from?.toString(), dateCreatedFilterRange?.to?.toString(), accountsWithActivity.size, withActivityCount, withoutActivityCount, activityCountMap, lastActivityDateMap]);

  const openHistory = (account: Account) => {
    // Use the account directly for display
    setHistoryCompany(account.company_name);
    setHistoryAccount(account);
    setHistoryOpen(true);
    setLoadingHistory(true);
    // Filter by account_reference_number AND date range (if selected)
    const records = activities.filter((a) => {
      const matchAccount = a.account_reference_number === account.account_reference_number;
      if (!matchAccount) return false;
      // Apply date filter if exists
      if (!dateCreatedFilterRange?.from) return true; // No date filter
      const dateToCheck = a.date_created;
      if (!dateToCheck) return false;
      return isDateInRange(dateToCheck, dateCreatedFilterRange);
    });
    setHistoryRecords(records);
    setLoadingHistory(false);
  };

  const accentColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
  const loading = loadingUser || loadingData;

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
                    <h1 className="text-lg font-bold text-gray-900">My Account Management</h1>
                    <p className="text-xs text-gray-500">Manage your assigned accounts and view activity history</p>
                  </div>
                </div>

                {/* Stats - Clickable Cards for Filtering */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {/*<StatCard
                    label="Total Sales"
                    value={totalSalesAll.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                    accent="#059669"
                    sublabel={`${customerCount} Customers / ${leadsCount} Leads`}
                  />*/}
                  
                  <StatCard
                    label="Total Accounts"
                    value={allActiveAccounts.length}
                    accent="#1e293b"
                    onClick={() => { setActivityFilter("all"); setTypeFilter(null); }}
                    isActive={activityFilter === "all" && !typeFilter}
                    sublabel="valid type_client accounts"
                  />
                  <StatCard
                    label="With Activity"
                    value={withActivityCount}
                    accent="#10b981"
                    onClick={() => setActivityFilter(activityFilter === "with" ? "all" : "with")}
                    isActive={activityFilter === "with"}
                    showFraction={{ count: withActivityCount, total: allActiveAccounts.length }}
                    sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"}
                  />
                  <StatCard
                    label="No Activity"
                    value={withoutActivityCount}
                    accent="#f59e0b"
                    onClick={() => setActivityFilter(activityFilter === "without" ? "all" : "without")}
                    isActive={activityFilter === "without"}
                    isNegative
                    showFraction={{ count: withoutActivityCount, total: allActiveAccounts.length }}
                    sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"}
                  />
                  {typeClientStats.map((stat, i) => (
                    <StatCard
                      key={stat.type}
                      label={stat.type}
                      value={stat.total}
                      accent={accentColors[i % accentColors.length]}
                      onClick={() => setTypeFilter(typeFilter === stat.type ? null : stat.type)}
                      isActive={typeFilter === stat.type}
                      sublabel={`${stat.withActivity} with / ${stat.withoutActivity} without`}
                    />
                  ))}
                </div>

                {/* Active Filters Display */}
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
                        📅 {dateCreatedFilterRange.from.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} {dateCreatedFilterRange.to && dateCreatedFilterRange.to !== dateCreatedFilterRange.from && `to ${dateCreatedFilterRange.to.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
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

                {/* Search */}
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                  <Search size={13} className="text-slate-400" />
                  <input type="text" placeholder="Search company, contact, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400" />
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
                            <TableCell colSpan={7} className="text-center py-14 text-sm text-gray-400">
                              {search || typeFilter ? "No accounts match your filters" : "No accounts found"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedAccounts.map((account) => {
                            const actCount = activityCountMap[account.account_reference_number] ?? 0;
                            const hasAct = actCount > 0;
                            const typeStyle = getTypeClientStyle(account.type_client);
                            const totalSales = totalSalesMap[account.account_reference_number] ?? 0;
                            const identifier = identifierMap[account.account_reference_number] ?? (hasAct ? "Customer" : "Leads");
                            const identifierStyle = identifier === "Customer"
                              ? { pill: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" }
                              : { pill: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" };
                            return (
                              <TableRow key={account.id} className="hover:bg-indigo-50/20 transition-colors">
                                <TableCell>
                                  <button onClick={() => openHistory(account)} className="flex items-center gap-1 text-[11px] font-mono font-semibold text-indigo-500 hover:text-indigo-700">
                                    <History size={11} /> history
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button 
                                    onClick={() => openHistory(account)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${hasAct ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400"}`}
                                  >
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
                                        {!hasActivity && displayDate && (
                                          <span className="text-[9px] text-amber-500 ml-1">(created)</span>
                                        )}
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
                                {/*<TableCell>
                                  <span className={`text-[10px] font-mono font-semibold ${totalSales > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                    {totalSales > 0
                                      ? totalSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                                      : "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${identifierStyle.pill}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${identifierStyle.dot}`} /> {identifier}
                                  </span>
                                </TableCell>*/}
                                
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {filteredAccounts.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                      <span>Showing <span className="font-semibold">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}</span> of <span className="font-semibold">{filteredAccounts.length}</span></span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Prev</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                          return page <= totalPages ? <button key={page} onClick={() => setCurrentPage(page)} className={`rounded-lg px-2.5 py-1 ${page === currentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>{page}</button> : null;
                        })}
                        <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Next</button>
                      </div>
                    </div>
                  )}
                </div>
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
