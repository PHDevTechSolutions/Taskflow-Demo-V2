"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft, Settings2, RotateCcw, ChevronRight } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";

/* ─── Computation config ─────────────────────────────────────────────────── */

const STORAGE_KEY = "sales_computation_config";

interface ComputationConfig {
  totalWorkingDays: number;
  salesField: "actual_sales" | "so_amount";
  varianceDirection: "quota_minus_sales" | "sales_minus_quota";
  prorationMode: "working_days" | "full_quota";
  countSundays: boolean;
  parMode: "auto" | "manual";
  parManualPct: number;
  percentToPlanBase: "prorated" | "full_quota";
}

const DEFAULT_CONFIG: ComputationConfig = {
  totalWorkingDays: 26,
  salesField: "actual_sales",
  varianceDirection: "quota_minus_sales",
  prorationMode: "working_days",
  countSundays: false,
  parMode: "auto",
  parManualPct: 0,
  percentToPlanBase: "prorated",
};

function loadConfig(): ComputationConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { return DEFAULT_CONFIG; }
}

function saveConfig(cfg: ComputationConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Sales {
  id: number;
  actual_sales?: number;
  so_amount?: number;
  delivery_date?: string;
  target_quota: string;
  referenceid: string;
  agentName?: string;
}

interface UserDetails {
  referenceid: string; tsm: string; manager: string;
  firstname: string; lastname: string; role: string;
}

interface Agent {
  ReferenceID: string; Firstname: string; Lastname: string;
  Role: string; TargetQuota: string; TSM?: string; Manager?: string;
}

interface SalesProps {
  referenceid: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

/* ─── Drill-down level type ──────────────────────────────────────────────── */
// "manager" = top level, "tsm" = under a manager, "agent" = under a TSM
type DrillLevel = "manager" | "tsm" | "agent";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const countWorkingDays = (from: Date, to: Date, countSundays: boolean): number => {
  let count = 0;
  const cursor = new Date(from); cursor.setHours(0, 0, 0, 0);
  const end = new Date(to); end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    if (countSundays || cursor.getDay() !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

const fmtPHP = (v: number) =>
  v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

/* ─── Breadcrumb ─────────────────────────────────────────────────────────── */

const Breadcrumb = ({
  level, managerName, tsmName,
  onManager, onTSM,
}: {
  level: DrillLevel;
  managerName: string;
  tsmName: string;
  onManager: () => void;
  onTSM: () => void;
}) => (
  <nav className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
    <button
      onClick={onManager}
      className={`hover:text-gray-700 transition-colors ${level === "manager" ? "text-gray-700 font-semibold" : "hover:underline"}`}
    >
      All Managers
    </button>
    {level !== "manager" && (
      <>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <button
          onClick={onTSM}
          className={`capitalize hover:text-gray-700 transition-colors ${level === "tsm" ? "text-gray-700 font-semibold" : "hover:underline"}`}
        >
          {managerName}
        </button>
      </>
    )}
    {level === "agent" && (
      <>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="capitalize text-gray-700 font-semibold">{tsmName}</span>
      </>
    )}
  </nav>
);

/* ─── Toggle Button ──────────────────────────────────────────────────────── */

const ToggleBtn = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs border rounded-none font-semibold transition-colors ${active
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
      }`}
  >
    {children}
  </button>
);

/* ─── Edit Computation Dialog ────────────────────────────────────────────── */

const EditComputationDialog: React.FC<{
  open: boolean; onClose: () => void;
  config: ComputationConfig; onSave: (cfg: ComputationConfig) => void;
}> = ({ open, onClose, config, onSave }) => {
  const [draft, setDraft] = useState<ComputationConfig>(config);
  useEffect(() => { if (open) setDraft(config); }, [open, config]);
  const set = <K extends keyof ComputationConfig>(k: K, v: ComputationConfig[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Settings2 className="h-4 w-4" /> Edit Computation Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Customize how sales metrics are calculated. Saved to your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1 max-h-[60vh] overflow-y-auto pr-1">

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Total Working Days / Month</Label>
            <p className="text-[11px] text-gray-400">
              Divides the full month quota to get the daily quota target.
              <br /><code className="bg-gray-100 px-1 rounded text-[10px]">Daily Quota = Full Quota ÷ Total Working Days</code>
            </p>
            <Input type="number" min={1} max={31} value={draft.totalWorkingDays}
              onChange={(e) => set("totalWorkingDays", Math.max(1, Math.min(31, Number(e.target.value))))}
              className="w-24 text-xs rounded-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Count Sundays as Working Days</Label>
            <p className="text-[11px] text-gray-400">Affects how "days elapsed" is counted for par % and proration.</p>
            <div className="flex gap-2">
              <ToggleBtn active={!draft.countSundays} onClick={() => set("countSundays", false)}>No — Mon–Sat</ToggleBtn>
              <ToggleBtn active={draft.countSundays} onClick={() => set("countSundays", true)}>Yes — Mon–Sun</ToggleBtn>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Sales Field</Label>
            <p className="text-[11px] text-gray-400">Which column is summed as "total sales" per agent / TSM.</p>
            <div className="flex gap-2 flex-wrap">
              <ToggleBtn active={draft.salesField === "actual_sales"} onClick={() => set("salesField", "actual_sales")}>actual_sales (Sales Invoice)</ToggleBtn>
              <ToggleBtn active={draft.salesField === "so_amount"} onClick={() => set("salesField", "so_amount")}>so_amount (Sales Order)</ToggleBtn>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Quota Proration</Label>
            <p className="text-[11px] text-gray-400">
              Whether the target is scaled by days elapsed or uses the full month quota.
              <br /><code className="bg-gray-100 px-1 rounded text-[10px]">Pro-rated = (Full Quota ÷ Total Days) × Days Elapsed</code>
            </p>
            <div className="flex gap-2 flex-wrap">
              <ToggleBtn active={draft.prorationMode === "working_days"} onClick={() => set("prorationMode", "working_days")}>Pro-rated by Days Elapsed</ToggleBtn>
              <ToggleBtn active={draft.prorationMode === "full_quota"} onClick={() => set("prorationMode", "full_quota")}>Full Month Quota Always</ToggleBtn>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Variance Formula</Label>
            <p className="text-[11px] text-gray-400">Controls sign convention and red/green coloring.</p>
            <div className="flex gap-2 flex-wrap">
              <ToggleBtn active={draft.varianceDirection === "quota_minus_sales"} onClick={() => set("varianceDirection", "quota_minus_sales")}>Quota − Sales (positive = behind)</ToggleBtn>
              <ToggleBtn active={draft.varianceDirection === "sales_minus_quota"} onClick={() => set("varianceDirection", "sales_minus_quota")}>Sales − Quota (positive = ahead)</ToggleBtn>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Par Computation</Label>
            <p className="text-[11px] text-gray-400">
              Auto calculates from days elapsed. Manual lets you fix the par % directly.
              <br /><code className="bg-gray-100 px-1 rounded text-[10px]">Auto: Par = (Days Elapsed ÷ Total Working Days) × 100</code>
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              <ToggleBtn active={draft.parMode === "auto"} onClick={() => set("parMode", "auto")}>Auto (days elapsed)</ToggleBtn>
              <ToggleBtn active={draft.parMode === "manual"} onClick={() => set("parMode", "manual")}>Manual (fixed %)</ToggleBtn>
              {draft.parMode === "manual" && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Input type="number" min={0} max={100} step={0.01} value={draft.parManualPct}
                    onChange={(e) => set("parManualPct", Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-24 text-xs rounded-none" />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">% To Plan Denominator</Label>
            <p className="text-[11px] text-gray-400">
              What quota to divide actual sales against.
              <br /><code className="bg-gray-100 px-1 rounded text-[10px]">% To Plan = (Actual Sales ÷ Denominator) × 100</code>
            </p>
            <div className="flex gap-2 flex-wrap">
              <ToggleBtn active={draft.percentToPlanBase === "prorated"} onClick={() => set("percentToPlanBase", "prorated")}>Pro-rated Quota</ToggleBtn>
              <ToggleBtn active={draft.percentToPlanBase === "full_quota"} onClick={() => set("percentToPlanBase", "full_quota")}>Full Month Quota</ToggleBtn>
            </div>
          </div>

          <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-700 text-xs mb-1.5">Current Settings Preview</p>
            <p><span className="text-gray-400 w-36 inline-block">Working days/month:</span> <strong>{draft.totalWorkingDays}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">Count Sundays:</span> <strong>{draft.countSundays ? "Yes (Mon–Sun)" : "No (Mon–Sat)"}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">Sales field:</span> <strong>{draft.salesField}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">Proration:</span> <strong>{draft.prorationMode === "working_days" ? "Pro-rated" : "Full month"}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">Variance:</span> <strong>{draft.varianceDirection === "quota_minus_sales" ? "Quota − Sales" : "Sales − Quota"}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">Par:</span> <strong>{draft.parMode === "auto" ? "Auto (days elapsed)" : `Manual — ${draft.parManualPct}%`}</strong></p>
            <p><span className="text-gray-400 w-36 inline-block">% To Plan base:</span> <strong>{draft.percentToPlanBase === "prorated" ? "Pro-rated quota" : "Full month quota"}</strong></p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <button type="button" onClick={() => setDraft(DEFAULT_CONFIG)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <RotateCcw className="h-3 w-3" /> Reset to defaults
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs rounded-none" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="text-xs rounded-none" onClick={() => { onSave(draft); onClose(); }}>Save Settings</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

const CustomDailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const hit = data.actualSales >= data.dailyQuota;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-xs min-w-[220px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1">
        <span className="text-gray-500">Daily Quota</span>
        <span className="font-semibold text-right">{fmtPHP(data.dailyQuota)}</span>
        <span className="text-gray-500">Total Sales</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>{fmtPHP(data.actualSales)}</span>
        <span className="text-gray-500">Variance</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>{fmtPHP(data.actualSales - data.dailyQuota)}</span>
      </div>
      <p className={`text-xs font-bold mb-2 ${hit ? "text-green-600" : "text-red-500"}`}>{hit ? "✓ Hit" : "✗ Missed"}</p>
      {data.breakdown?.length > 0 && (
        <>
          <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1">{data.breakdownLabel ?? "Breakdown"}</p>
          <div className="space-y-1.5">
            {[...data.breakdown].sort((a: any, b: any) => b.sales - a.sales).map((item: any, i: number) => (
              <div key={i} className="flex flex-col gap-0.5 border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                <div className="flex justify-between gap-4 items-center">
                  <span className="capitalize text-gray-700 font-semibold">{item.name}</span>
                  <span className={`text-xs font-bold ${item.hit ? "text-green-600" : "text-red-500"}`}>{item.hit ? "✓ Hit" : "✗ Missed"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                  <span>Quota</span><span className="font-medium text-gray-600 text-right">{fmtPHP(item.dailyQuota)}</span>
                  <span>Sales</span><span className={`font-medium text-right ${item.hit ? "text-green-600" : "text-red-500"}`}>{fmtPHP(item.sales)}</span>
                  <span>Variance</span><span className={`font-medium text-right ${item.hit ? "text-green-600" : "text-red-500"}`}>{fmtPHP(item.sales - item.dailyQuota)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export const SalesTable: React.FC<SalesProps> = ({
  referenceid, userDetails, dateCreatedFilterRange, setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Sales[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  // ─── Drill-down state ─────────────────────────────────────────────────────
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("manager");
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedManagerName, setSelectedManagerName] = useState<string>("");
  const [selectedTSMId, setSelectedTSMId] = useState<string | null>(null);
  const [selectedTSMName, setSelectedTSMName] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  const [editOpen, setEditOpen] = useState(false);
  const [config, setConfig] = useState<ComputationConfig>(DEFAULT_CONFIG);

  useEffect(() => { setConfig(loadConfig()); }, []);
  const handleSaveConfig = (cfg: ComputationConfig) => { setConfig(cfg); saveConfig(cfg); };

  const { totalWorkingDays, salesField, varianceDirection, prorationMode, countSundays, parMode, parManualPct, percentToPlanBase } = config;

  // ─── Navigation helpers ───────────────────────────────────────────────────
  const goToManager = () => {
    setDrillLevel("manager");
    setSelectedManagerId(null); setSelectedManagerName("");
    setSelectedTSMId(null); setSelectedTSMName("");
    setSelectedAgent("all");
  };
  const goToTSM = () => {
    setDrillLevel("tsm");
    setSelectedTSMId(null); setSelectedTSMName("");
    setSelectedAgent("all");
  };

  // ─── Fetch activities ─────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    setLoadingActivities(true); setErrorActivities(null);
    const now = new Date();
    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const url = new URL("/api/sales-performance/admin/fetch", window.location.origin);
    url.searchParams.append("from", from);
    url.searchParams.append("to", to);
    if (userDetails.role) {
      url.searchParams.append("role", userDetails.role);
    }
    if (userDetails.role !== 'Super Admin' && userDetails.referenceid) {
      url.searchParams.append("referenceid", userDetails.referenceid);
    }
    fetch(url.toString())
      .then(async (r) => { if (!r.ok) throw new Error("Failed to fetch activities"); return r.json(); })
      .then((d) => setActivities(d.activities || []))
      .catch((e) => setErrorActivities(e.message))
      .finally(() => setLoadingActivities(false));
  }, [dateCreatedFilterRange, userDetails]);

  useEffect(() => {
    fetchActivities();
    const ch = supabase.channel("public:history")
      .on("postgres_changes", { event: "*", schema: "public", table: "history" },
        (payload) => {
          const n = payload.new as Sales, o = payload.old as Sales;
          setActivities((c) => {
            if (payload.eventType === "INSERT") return c.some((a) => a.id === n.id) ? c : [...c, n];
            if (payload.eventType === "UPDATE") return c.map((a) => a.id === n.id ? n : a);
            if (payload.eventType === "DELETE") return c.filter((a) => a.id !== o.id);
            return c;
          });
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchActivities]);

  useEffect(() => {
    if (!userDetails.referenceid && userDetails.role !== 'Super Admin') return;
    const url = new URL("/api/fetch-admin-all-user", window.location.origin);
    if (userDetails.role) {
      url.searchParams.append("role", userDetails.role);
    }
    if (userDetails.role !== 'Super Admin' && userDetails.referenceid) {
      url.searchParams.append("id", userDetails.referenceid);
    }
    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAgents(data);
        } else {
          console.error("API did not return an array for agents:", data);
          setAgents([]); // Set to empty array on error or non-array response
        }
      })
      .catch((e) => {
        setErrorActivities(e.message);
        setAgents([]); // Also set to empty array on fetch error
      });
  }, [userDetails.referenceid, userDetails.role]);

  // ─── Date / working days ──────────────────────────────────────────────────
  const { fromDate, toDate } = useMemo(() => {
    let from: Date, to: Date;
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      from = new Date(dateCreatedFilterRange.from); to = new Date(dateCreatedFilterRange.to);
    } else {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
    return { fromDate: from, toDate: to };
  }, [dateCreatedFilterRange]);

  const workingDaysSoFar = useMemo(() => {
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const rangeEnd = toDate < today ? toDate : today;
    if (fromDate > rangeEnd) return 0;
    return countWorkingDays(fromDate, rangeEnd, countSundays);
  }, [fromDate, toDate, countSundays]);

  const parPercentage = parMode === "manual"
    ? parManualPct
    : totalWorkingDays > 0 ? (workingDaysSoFar / totalWorkingDays) * 100 : 0;
  const hasDateRange = !!(dateCreatedFilterRange?.from && dateCreatedFilterRange?.to);

  const getProratedQuota = useCallback((full: number) => {
    if (prorationMode === "full_quota") return full;
    return hasDateRange ? Math.round((full / totalWorkingDays) * workingDaysSoFar) : full;
  }, [prorationMode, hasDateRange, totalWorkingDays, workingDaysSoFar]);

  const getSalesValue = useCallback((row: Sales) =>
    salesField === "actual_sales" ? (row.actual_sales ?? 0) : (row.so_amount ?? 0),
    [salesField]);

  const computeVariance = useCallback((quota: number, sales: number) =>
    varianceDirection === "quota_minus_sales" ? quota - sales : sales - quota,
    [varianceDirection]);

  const varianceIsBad = useCallback((v: number) =>
    varianceDirection === "quota_minus_sales" ? v > 0 : v < 0,
    [varianceDirection]);

  // ─── Filtered activities ──────────────────────────────────────────────────
  const filteredActivitiesByDate = useMemo(() => {
    const ft = fromDate.getTime(), tt = toDate.getTime();
    return activities.filter((a) => {
      if (!a.delivery_date) return false;
      const t = new Date(a.delivery_date).getTime();
      return t >= ft && t <= tt;
    });
  }, [activities, fromDate, toDate]);

  const activitiesByAgent = useMemo(() => {
    const map: Record<string, Sales[]> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (!map[a.referenceid]) map[a.referenceid] = [];
      map[a.referenceid].push(a);
    });
    return map;
  }, [filteredActivitiesByDate]);

  // ─── Per-Agent metrics ────────────────────────────────────────────────────
  const salesDataPerAgent = useMemo(() =>
    agents
      .filter((a) => a.Role === "Territory Sales Associate" && a.ReferenceID)
      .map((agent) => {
        const agentId = agent.ReferenceID;
        const sales = activitiesByAgent[agentId] || [];
        const totalActualSales = sales.reduce((s, r) => s + getSalesValue(r), 0);
        const fullMonthQuota = parseFloat((agent.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const proratedQuota = getProratedQuota(fullMonthQuota);
        const variance = computeVariance(proratedQuota, totalActualSales);
        const denominator = percentToPlanBase === "full_quota" ? fullMonthQuota : proratedQuota;
        const achievement = denominator === 0 ? 0 : (totalActualSales / denominator) * 100;
        return {
          agentId,
          tsmId: (agent.TSM ?? "").toLowerCase(),
          totalActualSales, fullMonthQuota, proratedQuota, variance,
          percentToPlan: Math.round(achievement), parPercentage,
        };
      }),
    [agents, activitiesByAgent, getProratedQuota, getSalesValue, computeVariance, parPercentage, percentToPlanBase]
  );

  // ─── Per-TSM metrics ──────────────────────────────────────────────────────
  const salesDataPerTSM = useMemo(() =>
    agents
      .filter((a) => a.Role === "Territory Sales Manager" && a.ReferenceID)
      .map((tsm) => {
        const tsmId = tsm.ReferenceID.toLowerCase();
        const under = salesDataPerAgent.filter((d) => d.tsmId === tsmId);
        const totalProratedQuota = under.reduce((s, d) => s + d.proratedQuota, 0);
        const totalActualSales = under.reduce((s, d) => s + d.totalActualSales, 0);
        const totalVariance = computeVariance(totalProratedQuota, totalActualSales);
        const fullMonthQuota = under.reduce((s, d) => s + d.fullMonthQuota, 0);
        const denominator = percentToPlanBase === "full_quota" ? fullMonthQuota : totalProratedQuota;
        const achievement = denominator === 0 ? 0 : (totalActualSales / denominator) * 100;
        // Link TSM to their Manager
        const managerId = (tsm.Manager ?? "").toLowerCase();
        return {
          tsmId, managerId,
          tsmName: `${tsm.Firstname} ${tsm.Lastname}`,
          totalProratedQuota, totalActualSales, totalVariance, fullMonthQuota,
          dailyQuota: fullMonthQuota / totalWorkingDays,
          percentToPlan: Math.round(achievement), parPercentage,
        };
      }),
    [agents, salesDataPerAgent, parPercentage, totalWorkingDays, computeVariance, percentToPlanBase]
  );

  // ─── Per-Manager metrics ──────────────────────────────────────────────────
  const salesDataPerManager = useMemo(() =>
    agents
      .filter((a) => a.Role === "Manager" && a.ReferenceID)
      .map((mgr) => {
        const managerId = mgr.ReferenceID.toLowerCase();
        const underTSMs = salesDataPerTSM.filter((t) => t.managerId === managerId);
        const totalProratedQuota = underTSMs.reduce((s, t) => s + t.totalProratedQuota, 0);
        const totalActualSales = underTSMs.reduce((s, t) => s + t.totalActualSales, 0);
        const totalVariance = computeVariance(totalProratedQuota, totalActualSales);
        const fullMonthQuota = underTSMs.reduce((s, t) => s + t.fullMonthQuota, 0);
        const denominator = percentToPlanBase === "full_quota" ? fullMonthQuota : totalProratedQuota;
        const achievement = denominator === 0 ? 0 : (totalActualSales / denominator) * 100;
        return {
          managerId,
          managerName: `${mgr.Firstname} ${mgr.Lastname}`,
          tsmCount: underTSMs.length,
          totalProratedQuota, totalActualSales, totalVariance, fullMonthQuota,
          percentToPlan: Math.round(achievement), parPercentage,
        };
      }),
    [agents, salesDataPerTSM, computeVariance, percentToPlanBase, parPercentage]
  );

  // ─── Drill-down filtered slices ───────────────────────────────────────────
  // TSMs under the selected Manager
  const tsmsUnderSelectedManager = useMemo(() =>
    !selectedManagerId ? [] : salesDataPerTSM.filter((t) => t.managerId === selectedManagerId),
    [salesDataPerTSM, selectedManagerId]
  );

  // Agents under the selected TSM (with optional single-agent filter)
  const agentsUnderSelectedTSM = useMemo(() =>
    !selectedTSMId ? [] : salesDataPerAgent.filter((d) => d.tsmId === selectedTSMId),
    [salesDataPerAgent, selectedTSMId]
  );
  const filteredAgentDrillDown = useMemo(() =>
    selectedAgent === "all"
      ? agentsUnderSelectedTSM
      : agentsUnderSelectedTSM.filter((d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()),
    [agentsUnderSelectedTSM, selectedAgent]
  );

  // ─── Column totals ────────────────────────────────────────────────────────
  const managerColumnTotals = useMemo(() =>
    salesDataPerManager.reduce((a, d) => ({
      totalProratedQuota: a.totalProratedQuota + d.totalProratedQuota,
      totalActualSales: a.totalActualSales + d.totalActualSales,
      totalVariance: a.totalVariance + d.totalVariance,
    }), { totalProratedQuota: 0, totalActualSales: 0, totalVariance: 0 }),
    [salesDataPerManager]
  );

  const tsmColumnTotals = useMemo(() =>
    tsmsUnderSelectedManager.reduce((a, d) => ({
      totalProratedQuota: a.totalProratedQuota + d.totalProratedQuota,
      totalActualSales: a.totalActualSales + d.totalActualSales,
      totalVariance: a.totalVariance + d.totalVariance,
    }), { totalProratedQuota: 0, totalActualSales: 0, totalVariance: 0 }),
    [tsmsUnderSelectedManager]
  );

  const agentDrillDownTotals = useMemo(() =>
    filteredAgentDrillDown.reduce((a, d) => ({
      proratedQuota: a.proratedQuota + d.proratedQuota,
      totalActualSales: a.totalActualSales + d.totalActualSales,
      variance: a.variance + d.variance,
    }), { proratedQuota: 0, totalActualSales: 0, variance: 0 }),
    [filteredAgentDrillDown]
  );

  // ─── Chart data ───────────────────────────────────────────────────────────
  const toLocalDateStr = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const dailyChartData = useMemo(() => {
    const days: any[] = [];
    const cursor = new Date(fromDate); cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate); end.setHours(23, 59, 59, 999);

    if (drillLevel === "manager") {
      // Chart: all managers
      const totalDailyQuota = salesDataPerManager.reduce((s, m) =>
        s + m.fullMonthQuota / totalWorkingDays, 0);
      const mgrInfoMap: Record<string, { name: string; dailyQuota: number }> = {};
      salesDataPerManager.forEach((m) => {
        mgrInfoMap[m.managerId] = { name: m.managerName, dailyQuota: m.fullMonthQuota / totalWorkingDays };
      });
      // agent → TSM → Manager lookup
      const agentToManager: Record<string, string> = {};
      salesDataPerAgent.forEach((d) => {
        const tsm = salesDataPerTSM.find((t) => t.tsmId === d.tsmId);
        if (tsm) agentToManager[d.agentId.toLowerCase()] = tsm.managerId;
      });

      while (cursor <= end) {
        if (countSundays || cursor.getDay() !== 0) {
          const dateStr = toLocalDateStr(cursor);
          const label = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
          const mgrSalesMap: Record<string, number> = {}; let dayTotal = 0;
          activities
            .filter((a) => a.delivery_date && toLocalDateStr(new Date(a.delivery_date)) === dateStr)
            .forEach((a) => {
              const mgrId = agentToManager[a.referenceid.toLowerCase()];
              if (!mgrId) return;
              mgrSalesMap[mgrId] = (mgrSalesMap[mgrId] ?? 0) + getSalesValue(a);
              dayTotal += getSalesValue(a);
            });
          const breakdown = Object.entries(mgrSalesMap).map(([mgrId, sales]) => {
            const info = mgrInfoMap[mgrId]; const dq = Math.round(info?.dailyQuota ?? 0);
            return { name: info?.name ?? mgrId, sales, dailyQuota: dq, hit: sales >= dq };
          });
          days.push({ date: label, actualSales: dayTotal, dailyQuota: Math.round(totalDailyQuota), breakdown, breakdownLabel: "Manager Breakdown" });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (drillLevel === "tsm") {
      // Chart: TSMs under selected Manager
      const totalDailyQuota = tsmsUnderSelectedManager.reduce((s, t) => s + t.dailyQuota, 0);
      const tsmInfoMap: Record<string, { name: string; dailyQuota: number }> = {};
      tsmsUnderSelectedManager.forEach((t) => { tsmInfoMap[t.tsmId] = { name: t.tsmName, dailyQuota: t.dailyQuota }; });
      const agentToTsm: Record<string, string> = {};
      salesDataPerAgent
        .filter((d) => tsmsUnderSelectedManager.some((t) => t.tsmId === d.tsmId))
        .forEach((d) => { agentToTsm[d.agentId.toLowerCase()] = d.tsmId; });

      while (cursor <= end) {
        if (countSundays || cursor.getDay() !== 0) {
          const dateStr = toLocalDateStr(cursor);
          const label = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
          const tsmSalesMap: Record<string, number> = {}; let dayTotal = 0;
          activities
            .filter((a) => a.delivery_date && toLocalDateStr(new Date(a.delivery_date)) === dateStr)
            .forEach((a) => {
              const tsmId = agentToTsm[a.referenceid.toLowerCase()];
              if (!tsmId) return;
              tsmSalesMap[tsmId] = (tsmSalesMap[tsmId] ?? 0) + getSalesValue(a);
              dayTotal += getSalesValue(a);
            });
          const breakdown = Object.entries(tsmSalesMap).map(([tsmId, sales]) => {
            const info = tsmInfoMap[tsmId]; const dq = Math.round(info?.dailyQuota ?? 0);
            return { name: info?.name ?? tsmId, sales, dailyQuota: dq, hit: sales >= dq };
          });
          days.push({ date: label, actualSales: dayTotal, dailyQuota: Math.round(totalDailyQuota), breakdown, breakdownLabel: "TSM Breakdown" });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      // Chart: Agents under selected TSM
      const drillAgents = selectedAgent === "all"
        ? agentsUnderSelectedTSM
        : agentsUnderSelectedTSM.filter((d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase());
      const totalDailyQuota = drillAgents.reduce((s, d) => s + d.fullMonthQuota / totalWorkingDays, 0);
      const agentNameMap: Record<string, string> = {}, agentDailyQuotaMap: Record<string, number> = {};
      drillAgents.forEach((d) => {
        const a = agents.find((ag) => ag.ReferenceID && ag.ReferenceID.toLowerCase() === d.agentId.toLowerCase());
        agentNameMap[d.agentId.toLowerCase()] = a ? `${a.Firstname} ${a.Lastname}` : d.agentId;
        agentDailyQuotaMap[d.agentId.toLowerCase()] = d.fullMonthQuota / totalWorkingDays;
      });
      const drillIds = new Set(drillAgents.map((d) => d.agentId.toLowerCase()));

      while (cursor <= end) {
        if (countSundays || cursor.getDay() !== 0) {
          const dateStr = toLocalDateStr(cursor);
          const label = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
          const agentSalesMap: Record<string, number> = {}; let dayTotal = 0;
          activities
            .filter((a) => a.delivery_date && drillIds.has(a.referenceid.toLowerCase()) && toLocalDateStr(new Date(a.delivery_date)) === dateStr)
            .forEach((a) => {
              const k = a.referenceid.toLowerCase();
              agentSalesMap[k] = (agentSalesMap[k] ?? 0) + getSalesValue(a);
              dayTotal += getSalesValue(a);
            });
          const breakdown = Object.entries(agentSalesMap).map(([refId, sales]) => {
            const dq = Math.round(agentDailyQuotaMap[refId] ?? 0);
            return { name: agentNameMap[refId] || refId, sales, dailyQuota: dq, hit: sales >= dq };
          });
          days.push({ date: label, actualSales: dayTotal, dailyQuota: Math.round(totalDailyQuota), breakdown, breakdownLabel: "Agent Breakdown" });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return days;
  }, [
    drillLevel, fromDate, toDate, activities, countSundays, totalWorkingDays,
    salesDataPerManager, salesDataPerTSM, salesDataPerAgent,
    tsmsUnderSelectedManager, agentsUnderSelectedTSM,
    selectedAgent, agents, getSalesValue,
  ]);

  if (loadingActivities) return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;
  if (errorActivities) return (
    <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
      <AlertCircleIcon className="h-6 w-6 text-red-600" />
      <div><AlertTitle>Error Loading Data</AlertTitle><AlertDescription>{errorActivities}</AlertDescription></div>
    </Alert>
  );

  return (
    <div className="space-y-6">
      <EditComputationDialog open={editOpen} onClose={() => setEditOpen(false)} config={config} onSave={handleSaveConfig} />

      {/* ── Filters / Controls Row ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Breadcrumb */}
          <Breadcrumb
            level={drillLevel}
            managerName={selectedManagerName}
            tsmName={selectedTSMName}
            onManager={goToManager}
            onTSM={goToTSM}
          />

          {/* Agent filter only visible at agent drill level */}
          {drillLevel === "agent" && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[220px] text-xs"><SelectValue placeholder="Filter by Agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agentsUnderSelectedTSM.map((d) => {
                  const a = agents.find((ag) => ag.ReferenceID && ag.ReferenceID.toLowerCase() === d.agentId.toLowerCase());
                  return a ? (
                    <SelectItem className="capitalize" key={a.ReferenceID} value={a.ReferenceID}>
                      {a.Firstname} {a.Lastname}
                    </SelectItem>
                  ) : null;
                })}
              </SelectContent>
            </Select>
          )}

          <span className="text-xs text-gray-500">
            Days elapsed: <strong>{workingDaysSoFar}</strong> / {totalWorkingDays}&nbsp;|&nbsp;
            Par: <strong>{parPercentage.toFixed(2)}%</strong>
          </span>
        </div>

        <Button variant="outline" size="sm" className="text-xs rounded-none flex items-center gap-1.5 border-dashed" onClick={() => setEditOpen(true)}>
          <Settings2 className="h-3.5 w-3.5" /> Edit Computation
        </Button>
      </div>

      {/* ── Level 1: Manager Table ── */}
      {drillLevel === "manager" && (
        <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
          <h2 className="font-semibold text-sm mb-4">Manager Sales Metrics</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Manager</TableHead>
                <TableHead className="text-xs">TSMs</TableHead>
                <TableHead className="text-xs">Target Quota</TableHead>
                <TableHead className="text-xs text-right">Total Sales</TableHead>
                <TableHead className="text-xs">Variance</TableHead>
                <TableHead className="text-xs">Par</TableHead>
                <TableHead className="text-xs">% To Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesDataPerManager.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-gray-400 py-8">No manager data available</TableCell></TableRow>
              ) : salesDataPerManager.map(({ managerId, managerName, tsmCount, totalProratedQuota, totalActualSales, totalVariance, percentToPlan }) => (
                <TableRow key={managerId}
                  className="hover:bg-muted/30 text-xs cursor-pointer group"
                  onClick={() => {
                    setSelectedManagerId(managerId);
                    setSelectedManagerName(managerName);
                    setDrillLevel("tsm");
                  }}>
                  <TableCell className="capitalize font-medium text-blue-600 group-hover:underline">{managerName}</TableCell>
                  <TableCell className="text-gray-500">{tsmCount}</TableCell>
                  <TableCell>{fmtPHP(totalProratedQuota)}</TableCell>
                  <TableCell className="text-right">{fmtPHP(totalActualSales)}</TableCell>
                  <TableCell className={varianceIsBad(totalVariance) ? "text-red-500" : "text-green-600"}>{fmtPHP(totalVariance)}</TableCell>
                  <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                  <TableCell>{percentToPlan}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 font-semibold text-xs">
                <TableCell className="text-xs font-bold">Total</TableCell>
                <TableCell />
                <TableCell className="text-xs">{fmtPHP(managerColumnTotals.totalProratedQuota)}</TableCell>
                <TableCell className="text-xs text-right">{fmtPHP(managerColumnTotals.totalActualSales)}</TableCell>
                <TableCell className={varianceIsBad(managerColumnTotals.totalVariance) ? "text-xs text-red-500" : "text-xs text-green-600"}>{fmtPHP(managerColumnTotals.totalVariance)}</TableCell>
                <TableCell className="text-xs">—</TableCell>
                <TableCell className="text-xs">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* ── Level 2: TSM Table (under selected Manager) ── */}
      {drillLevel === "tsm" && (
        <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" className="text-xs rounded-none flex items-center gap-1" onClick={goToManager}>
              <ArrowLeft className="h-3 w-3" /> Back
            </Button>
            <h2 className="font-semibold text-sm capitalize">{selectedManagerName} — TSM Sales Metrics</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">TSM</TableHead>
                <TableHead className="text-xs">Target Quota</TableHead>
                <TableHead className="text-xs text-right">Total Sales</TableHead>
                <TableHead className="text-xs">Variance</TableHead>
                <TableHead className="text-xs">Par</TableHead>
                <TableHead className="text-xs">% To Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tsmsUnderSelectedManager.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">No TSMs found under this Manager</TableCell></TableRow>
              ) : tsmsUnderSelectedManager.map(({ tsmId, tsmName, totalProratedQuota, totalActualSales, totalVariance, percentToPlan }) => (
                <TableRow key={tsmId}
                  className="hover:bg-muted/30 text-xs cursor-pointer group"
                  onClick={() => {
                    setSelectedTSMId(tsmId);
                    setSelectedTSMName(tsmName);
                    setSelectedAgent("all");
                    setDrillLevel("agent");
                  }}>
                  <TableCell className="capitalize font-medium text-blue-600 group-hover:underline">{tsmName}</TableCell>
                  <TableCell>{fmtPHP(totalProratedQuota)}</TableCell>
                  <TableCell className="text-right">{fmtPHP(totalActualSales)}</TableCell>
                  <TableCell className={varianceIsBad(totalVariance) ? "text-red-500" : "text-green-600"}>{fmtPHP(totalVariance)}</TableCell>
                  <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                  <TableCell>{percentToPlan}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 font-semibold text-xs">
                <TableCell className="text-xs font-bold">Total</TableCell>
                <TableCell className="text-xs">{fmtPHP(tsmColumnTotals.totalProratedQuota)}</TableCell>
                <TableCell className="text-xs text-right">{fmtPHP(tsmColumnTotals.totalActualSales)}</TableCell>
                <TableCell className={varianceIsBad(tsmColumnTotals.totalVariance) ? "text-xs text-red-500" : "text-xs text-green-600"}>{fmtPHP(tsmColumnTotals.totalVariance)}</TableCell>
                <TableCell className="text-xs">—</TableCell>
                <TableCell className="text-xs">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* ── Level 3: Agent Table (under selected TSM) ── */}
      {drillLevel === "agent" && (
        <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" className="text-xs rounded-none flex items-center gap-1" onClick={goToTSM}>
              <ArrowLeft className="h-3 w-3" /> Back
            </Button>
            <h2 className="font-semibold text-sm capitalize">{selectedTSMName} — Agent Sales Metrics</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Target Quota</TableHead>
                <TableHead className="text-xs text-right">Total Sales</TableHead>
                <TableHead className="text-xs">Variance</TableHead>
                <TableHead className="text-xs">Par</TableHead>
                <TableHead className="text-xs">% To Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgentDrillDown.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">No agents found under this TSM</TableCell></TableRow>
              ) : filteredAgentDrillDown.map(({ agentId, totalActualSales, proratedQuota, variance, percentToPlan }) => {
                const agent = agents.find((a) => a.ReferenceID && a.ReferenceID.toLowerCase() === agentId.toLowerCase());
                return (
                  <TableRow key={agentId} className="hover:bg-muted/30 text-xs">
                    <TableCell className="capitalize">{agent ? `${agent.Firstname} ${agent.Lastname}` : agentId}</TableCell>
                    <TableCell>{fmtPHP(proratedQuota)}</TableCell>
                    <TableCell className="text-right">{fmtPHP(totalActualSales)}</TableCell>
                    <TableCell className={varianceIsBad(variance) ? "text-red-500" : "text-green-600"}>{fmtPHP(variance)}</TableCell>
                    <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                    <TableCell>{percentToPlan}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 font-semibold text-xs">
                <TableCell className="text-xs font-bold">Total</TableCell>
                <TableCell className="text-xs">{fmtPHP(agentDrillDownTotals.proratedQuota)}</TableCell>
                <TableCell className="text-xs text-right">{fmtPHP(agentDrillDownTotals.totalActualSales)}</TableCell>
                <TableCell className={varianceIsBad(agentDrillDownTotals.variance) ? "text-xs text-red-500" : "text-xs text-green-600"}>{fmtPHP(agentDrillDownTotals.variance)}</TableCell>
                <TableCell className="text-xs">—</TableCell>
                <TableCell className="text-xs">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* ── Daily Sales Trend Chart ── */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-1">
          Daily Sales Trend
          <span className="text-gray-400 font-normal ml-2 text-xs">
            {drillLevel === "manager" && "— by Manager"}
            {drillLevel === "tsm" && `— ${selectedManagerName} (by TSM)`}
            {drillLevel === "agent" && `— ${selectedTSMName} (by Agent)`}
          </span>
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Bar shows actual sales per working day vs. daily quota target (dashed line). Hover for{" "}
          {drillLevel === "manager" ? "manager" : drillLevel === "tsm" ? "TSM" : "agent"} breakdown.
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Hit
            <span className="inline-block w-3 h-3 rounded-sm bg-red-400 ml-2" /> Missed
          </span>
        </p>
        {dailyChartData.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">No data for selected range</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyChartData} margin={{ top: 8, right: 16, left: 16, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `₱${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `₱${(v / 1000).toFixed(0)}K` : `₱${v}`} />
              <Tooltip content={<CustomDailyTooltip />} />
              <ReferenceLine y={dailyChartData[0]?.dailyQuota ?? 0} stroke="#6366f1" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: "Daily Quota", position: "insideTopRight", fontSize: 10, fill: "#6366f1" }} />
              <Bar dataKey="actualSales" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {dailyChartData.map((entry, i) => <Cell key={i} fill={entry.actualSales >= entry.dailyQuota ? "#22c55e" : "#f87171"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Computation Explanation ── */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Computation Explanation</h2>
          <span className="text-[11px] text-gray-400 italic">Reflects current settings</span>
        </div>
        <div className="text-xs space-y-3 text-gray-700">
          <p><strong>Sales Field:</strong> Using <code className="bg-gray-100 px-1 rounded">{salesField}</code> as the sales value per record.</p>
          <p>
            <strong>Target Quota:</strong>{" "}
            {prorationMode === "working_days"
              ? <><code className="bg-gray-100 px-1 rounded">Pro-rated = (Full Quota ÷ {totalWorkingDays}) × {workingDaysSoFar} days elapsed</code></>
              : <>Full month quota is used as-is (no proration).</>}
          </p>
          <p><strong>Working Days:</strong> {totalWorkingDays} days/month — {countSundays ? "Mon–Sun (Sundays counted)" : "Mon–Sat (Sundays excluded)"}.</p>
          <p>
            <strong>Variance:</strong>{" "}
            {varianceDirection === "quota_minus_sales"
              ? <>Quota − Sales. Positive = behind <span className="text-red-500">(red)</span>, negative = ahead <span className="text-green-600">(green)</span>.</>
              : <>Sales − Quota. Positive = ahead <span className="text-green-600">(green)</span>, negative = behind <span className="text-red-500">(red)</span>.</>}
          </p>
          <p>
            <strong>Par:</strong>{" "}
            {parMode === "manual"
              ? <>Fixed manually at <strong>{parManualPct}%</strong>.</>
              : <><code className="bg-gray-100 px-1 rounded">({workingDaysSoFar} ÷ {totalWorkingDays}) × 100 = {parPercentage.toFixed(2)}%</code></>}
          </p>
          <p>
            <strong>% To Plan:</strong>{" "}
            {percentToPlanBase === "full_quota"
              ? <><code className="bg-gray-100 px-1 rounded">Actual Sales ÷ Full Month Quota × 100</code> — measures against the full target regardless of days elapsed.</>
              : <><code className="bg-gray-100 px-1 rounded">Actual Sales ÷ Pro-rated Quota × 100</code> — measures against the time-adjusted target.</>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesTable;