// popup/breaches/tsa-report.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCcw, Loader2, List } from "lucide-react";
import { sileo } from "sileo";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

interface ClientSegments {
  top50: number; next30: number; balance20: number;
  csrClient: number; newClient: number; tsaClient: number;
  outbound: number;
}

interface Denominators {
  total: number; top50: number; next30: number; bal20: number;
  csrClient: number; newClient: number; tsaClient: number;
  daily: number; weekly: number; monthly: number;
}

interface Agent {
  Firstname: string; Lastname: string;
  ReferenceID: string; Position: string; Status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatHoursToHMS = (hours: number): string => {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

type TimeByActivity = Record<string, number>;

const computeTimeByActivity = (activities: any[]): TimeByActivity =>
  activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;
    const start = new Date(act.start_date).getTime();
    const end = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;
    acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
    return acc;
  }, {} as TimeByActivity);

// Outbound is determined ONLY by source === "Outbound - Touchbase"
const isOutboundTouchbase = (a: any): boolean =>
  a.source === "Outbound - Touchbase";

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
    <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
    <span className="text-[11px] font-bold text-gray-800">{value}</span>
  </div>
);

const SectionCard = ({
  title, badge, children, accent,
}: {
  title: string; badge?: React.ReactNode;
  children: React.ReactNode; accent?: string;
}) => (
  <li className={`bg-white border border-gray-200 shadow-sm overflow-hidden ${accent ? `border-l-4 ${accent}` : ""}`}>
    <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">{title}</span>
      {badge}
    </div>
    <div className="p-3">{children}</div>
  </li>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TSMReports() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  const [managerDetails, setManagerDetails] = useState({
    referenceid: "", firstname: "", lastname: "", role: "",
  });

  const [selectedRefId, setSelectedRefId] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [clusterAccounts, setClusterAccounts] = useState<Activity[]>([]);
  const [uniqueActivitiesList, setUniqueActivitiesList] = useState<Activity[]>([]);

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [loadingCsrMetrics, setLoadingCsrMetrics] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const [timeByActivity, setTimeByActivity] = useState<TimeByActivity>({});
  const [timeConsumedMs, setTimeConsumedMs] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [newClientCount, setNewClientCount] = useState(0);
  const [outboundDaily, setOutboundDaily] = useState(0);
  const [outboundWeekly, setOutboundWeekly] = useState(0);
  const [outboundMonthly, setOutboundMonthly] = useState(0);
  const [uniqueClientReach, setUniqueClientReach] = useState(0);

  const [clientSegments, setClientSegments] = useState<ClientSegments>({
    top50: 0, next30: 0, balance20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
    outbound: 0,
  });

  const [denominators, setDenominators] = useState<Denominators>({
    total: 0, top50: 0, next30: 0, bal20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
    daily: 20, weekly: 120, monthly: 520,
  });

  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);

  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [avgNonQuotationHT, setAvgNonQuotationHT] = useState(0);
  const [avgQuotationHT, setAvgQuotationHT] = useState(0);
  const [avgSpfHT, setAvgSpfHT] = useState(0);

  const [overdueByCompany, setOverdueByCompany] = useState<Record<string, number>>({});
  const [overdueCount, setOverdueCount] = useState(0);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [coverageDialogSource, setCoverageDialogSource] = useState<"covered" | "uncovered" | null>(null);
  const [coveredAccounts, setCoveredAccounts] = useState<Activity[]>([]);
  const [uncoveredAccounts, setUncoveredAccounts] = useState<Activity[]>([]);
  const [newClientByCompany, setNewClientByCompany] = useState<Record<string, number>>({});
  const [showAllNewClients, setShowAllNewClients] = useState(false);

  const [workingDays, setWorkingDays] = useState<number>(() => {
    if (typeof window === "undefined") return 26;
    return Number(localStorage.getItem("tsm_report_workingDays")) || 26;
  });

  // Per-TSM agent count stored as a JSON map: { [refId]: count }
  const [agentsByTsm, setAgentsByTsm] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("tsm_report_agentsByTsm") || "{}");
    } catch { return {}; }
  });

  // ── Sync userId ───────────────────────────────────────────────────────────

  useEffect(() => {
    localStorage.setItem("tsm_report_workingDays", String(workingDays));
  }, [workingDays]);

  useEffect(() => {
    localStorage.setItem("tsm_report_agentsByTsm", JSON.stringify(agentsByTsm));
  }, [agentsByTsm]);

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Fetch manager ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setManagerDetails({
        referenceid: data.ReferenceID || "",
        role: data.Role || "",
        firstname: data.Firstname || "",
        lastname: data.Lastname || "",
      }))
      .catch(() => sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" }))
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // ── Fetch agents under manager ────────────────────────────────────────────

  useEffect(() => {
    if (!managerDetails.referenceid) return;
    setLoadingAgents(true);
    fetch(`/api/activity/manager/breaches/fetch-tsm?id=${encodeURIComponent(managerDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Agent[]) => {
        const active = data.filter((a) => (a.Status || "").toLowerCase() === "active");
        setAgents(active);
        if (active.length > 0 && !selectedRefId) setSelectedRefId(active[0].ReferenceID);
      })
      .catch(() => console.error("Failed to fetch tsm"))
      .finally(() => setLoadingAgents(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerDetails.referenceid]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const res = await fetch(`/api/com-fetch-cluster-account-tsm?tsm=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const active: any[] = (data.data || []).filter((a: any) => (a.status || "").toLowerCase() === "active");
      const countByType = (val: string) =>
        active.filter((a) => (a.type_client || "").trim().toLowerCase() === val).length;
      setDenominators((prev) => ({
        ...prev,
        total: active.length,
        top50: countByType("top 50"),
        next30: countByType("next 30"),
        bal20: countByType("balance 20"),
        csrClient: countByType("csr client"),
        newClient: countByType("new client"),
        tsaClient: countByType("tsa client"),
      }));
      setClusterAccounts(
        active.map((a) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, ""),
        }))
      );
    } catch { /* silent */ }
  }, []);

  const fetchActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const fetchOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const url = `/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const acts: any[] = data.activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { /* silent */ } finally {
      setLoadingOverdue(false);
    }
  }, []);

  const fetchCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(
        `/api/activity/manager/breaches/fetch-ecodesk-tsm?manager=${encodeURIComponent(refId)}&referenceid=${encodeURIComponent(refId)}`
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`CSR metrics request failed (${res.status}): ${body}`);
      }
      const result = await res.json();
      const data: any[] = result.data || [];

      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to); toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000; rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();
        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
          baseHT = (tsmHandle - received) / 3600000;
        }
        if (!baseHT) return;

        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch (err) {
      console.error("CSR metrics error:", err);
      sileo.error({
        title: "Error",
        description: "Failed to fetch CSR metrics.",
        duration: 3000,
        position: "top-center",
      });
    } finally {
      setLoadingCsrMetrics(false);
    }
  }, []);

  // ── Auto-fetch on agent/date change ───────────────────────────────────────

  useEffect(() => {
    if (!selectedRefId) return;
    setActivities([]);
    setOverdueByCompany({});
    setOverdueCount(0);
    fetchClusterData(selectedRefId);
    fetchActivities(selectedRefId);
    fetchOverdue(selectedRefId, fromDate, toDate);
    fetchCsrMetrics(selectedRefId, fromDate, toDate);
  }, [selectedRefId, fromDate, toDate, fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics]);

  // ── Compute outbound + time metrics ───────────────────────────────────────

  useEffect(() => {
    if (!activities.length) {
      setOutboundDaily(0); setOutboundWeekly(0); setOutboundMonthly(0);
      setTimeByActivity({}); setTimeConsumedMs(0);
      setTotalSales(0); setNewClientCount(0);
      return;
    }

    setLoadingTime(true);
    try {
      const targetDate = new Date(fromDate);
      const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

      const dailyActivities = activities.filter((act) => {
        const t = new Date(act.date_created).getTime();
        return t >= startOfDay.getTime() && t <= endOfDay.getTime();
      });

      const grouped = computeTimeByActivity(dailyActivities);
      setTimeByActivity(grouped);
      setTimeConsumedMs(Object.values(grouped).reduce((s, ms) => s + ms, 0));

      let sales = 0;
      dailyActivities.forEach((act) => {
        if (act.status === "Delivered") sales += Number(act.actual_sales) || 0;
      });
      setTotalSales(sales);

      // Outbound count — source === "Outbound - Touchbase" only
      const dailyCount = dailyActivities.filter(isOutboundTouchbase).length;

      const dayOfWeek = targetDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weeklyCount = activities.filter((act) => {
        const t = new Date(act.date_created).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime() && isOutboundTouchbase(act);
      }).length;

      const monthlyCount = activities.filter((act) => {
        const d = new Date(act.date_created);
        return (
          d.getMonth() === targetDate.getMonth() &&
          d.getFullYear() === targetDate.getFullYear() &&
          isOutboundTouchbase(act)
        );
      }).length;

      setOutboundDaily(dailyCount);
      setOutboundWeekly(weeklyCount);
      setOutboundMonthly(monthlyCount);

      // ← add this block
      const agentCount = agentsByTsm[selectedRefId] || 1;
      setDenominators((prev) => ({
        ...prev,
        daily: agentCount * 20,
        weekly: agentCount * 20 * 6,
        monthly: agentCount * 20 * workingDays,
      }));

      setPendingClientApprovalCount(
        activities.filter((a) => a.status === "Quote-Done" && a.quotation_status === "Pending Client Approval").length
      );
      setSpfPendingClientApproval(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Client Approval").length
      );
      setSpfPendingProcurement(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Procurement").length
      );
      setSpfPendingPD(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending PD").length
      );
    } finally {
      setLoadingTime(false);
    }
  }, [activities, fromDate, workingDays, agentsByTsm, selectedRefId]);

  // ── Territory coverage ────────────────────────────────────────────────────
  //
  // FIX: activeClusterNames is the source of truth — only companies that exist
  // in clusterAccounts (already filtered to active) are considered.
  // Activities whose company_name is NOT in the current cluster are excluded
  // from coverage counts entirely.

  useEffect(() => {
    if (!clusterAccounts.length) {
      setUniqueClientReach(0);
      setUniqueActivitiesList([]);
      setCoveredAccounts([]);
      setUncoveredAccounts([]);
      setClientSegments({ top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, outbound: 0 });
      return;
    }

    const fromDateObj = new Date(fromDate);
    const monthStart = new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), 1, 0, 0, 0, 0).getTime();
    const monthEnd = new Date(fromDateObj.getFullYear(), fromDateObj.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    // Step 1 — Build a map of active cluster companies (source of truth)
    const clusterCompanyMap = new Map<string, Activity>();
    clusterAccounts.forEach((acc) => {
      if (acc.company_name) clusterCompanyMap.set(acc.company_name.toLowerCase(), acc);
    });

    // Step 2 — Filter activities:
    //   (a) company_name must exist in current clusterCompanyMap (active cluster only)
    //   (b) date_created must be within the month range
    const clusterActivities = activities.filter((act) =>
      act.company_name &&
      clusterCompanyMap.has(act.company_name.toLowerCase()) && // ← FIX: exclude companies no longer in cluster
      act.date_created &&
      new Date(act.date_created).getTime() >= monthStart &&
      new Date(act.date_created).getTime() <= monthEnd
    );

    // Step 3 — Unique activities by reference number
    const uniqueByRef: Record<string, Activity> = {};
    clusterActivities.forEach((act) => {
      if (act.activity_reference_number) uniqueByRef[act.activity_reference_number] = act;
    });
    setUniqueActivitiesList(Object.values(uniqueByRef));

    // Step 4 — Covered vs Uncovered (based on active cluster only)
    const touchedCompanies = new Set(clusterActivities.map((a) => a.company_name!.toLowerCase()));
    const covered = clusterAccounts.filter((acc) => acc.company_name && touchedCompanies.has(acc.company_name.toLowerCase()));
    const uncovered = clusterAccounts.filter((acc) => acc.company_name && !touchedCompanies.has(acc.company_name.toLowerCase()));

    setCoveredAccounts(covered);
    setUncoveredAccounts(uncovered);

    // Step 5 — Segment counts for covered accounts only
    const seg = { top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0 };
    covered.forEach((acc) => {
      const type = acc.type_client ?? "";
      if (type === "top50") seg.top50++;
      else if (type === "next30") seg.next30++;
      else if (type === "balance20") seg.balance20++;
      else if (type === "csrclient") seg.csrClient++;
      else if (type === "newclient") seg.newClient++;
      else if (type === "tsaclient") seg.tsaClient++;
    });

    setUniqueClientReach(covered.length);
    setClientSegments({ ...seg, outbound: covered.length });
  }, [activities, clusterAccounts, fromDate]);

  // ── New clients ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activities.length || !fromDate) {
      setNewClientByCompany({}); setNewClientCount(0); return;
    }

    const targetDate = new Date(fromDate);
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
    const allowed = ["Assisted", "Quote-Done", "SO-Done", "Delivered"];

    // FIX: also filter against active cluster companies
    const activeClusterNames = new Set(clusterAccounts.map((a) => (a.company_name ?? "").toLowerCase()));

    const grouped: Record<string, number> = {};
    let total = 0;

    activities.forEach((act) => {
      const t = new Date(act.date_created).getTime();
      const companyKey = (act.company_name || "").toLowerCase();

      // Only count if company still exists in active cluster
      if (!activeClusterNames.has(companyKey)) return;

      if (
        allowed.includes(act.status) &&
        act.type_client === "New Client" &&
        t >= startOfDay.getTime() &&
        t <= endOfDay.getTime()
      ) {
        const company = act.company_name || "Unknown";
        grouped[company] = (grouped[company] || 0) + 1;
        total++;
      }
    });

    setNewClientByCompany(grouped);
    setNewClientCount(total);
  }, [activities, fromDate, clusterAccounts]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const overdueEntries = Object.entries(overdueByCompany);
  const visibleOverdue = showAllOverdue ? overdueEntries : overdueEntries.slice(0, 5);
  const newClientEntries = Object.entries(newClientByCompany);
  const visibleNewClients = showAllNewClients ? newClientEntries : newClientEntries.slice(0, 5);

  const isAnySyncing = loadingActivities || loadingOverdue;
  const dailyPct = denominators.daily > 0
    ? Math.min(100, Math.round((outboundDaily / denominators.daily) * 100))
    : 0;
  const selectedAgent = agents.find((a) => a.ReferenceID === selectedRefId);

  const handleManualSync = () => {
    if (!selectedRefId) return;
    fetchClusterData(selectedRefId);
    fetchActivities(selectedRefId);
    fetchOverdue(selectedRefId, fromDate, toDate);
    fetchCsrMetrics(selectedRefId, fromDate, toDate);
    sileo.success({
      title: "Syncing",
      description: `Refreshing data for ${selectedAgent?.Lastname ?? ""}, ${selectedAgent?.Firstname ?? ""}`,
      duration: 3000, position: "top-right",
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-4">

      {/* ── SYNC PANEL ──────────────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">
          Agent Selection
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
              {loadingUser ? "Loading..." : `TSM: ${managerDetails.lastname || "—"}, ${managerDetails.firstname || "—"}`}
            </label>

            {loadingAgents ? (
              <div className="flex items-center gap-2 text-gray-400 h-8">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Loading agents...</span>
              </div>
            ) : agents.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic h-8 flex items-center">No agents found</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {agents.map((agent) => {
                  const isActive = agent.ReferenceID === selectedRefId;
                  return (
                    <button
                      key={agent.ReferenceID}
                      onClick={() => setSelectedRefId(agent.ReferenceID)}
                      className={`text-[9px] font-bold uppercase px-2 py-1 border transition-colors ${isActive
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                        }`}
                    >
                      {agent.Lastname}, {agent.Firstname}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                Target Date
              </label>
              <Input
                type="date"
                className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }}
              />
            </div>

            <div>
              <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                Agents ({selectedRefId ? (agentsByTsm[selectedRefId] || 0) : "—"})
              </label>
              <Input
                type="number"
                min={0}
                className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                value={selectedRefId ? (agentsByTsm[selectedRefId] || "") : ""}
                placeholder="e.g. 5"
                disabled={!selectedRefId}
                onChange={(e) => {
                  if (!selectedRefId) return;
                  const val = Number(e.target.value) || 0;
                  setAgentsByTsm((prev) => ({ ...prev, [selectedRefId]: val }));
                }}
              />
            </div>

            <div>
              <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                Working Days
              </label>
              <select
                className="h-7 w-full text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono cursor-pointer"
                value={workingDays}
                onChange={(e) => setWorkingDays(Number(e.target.value))}
              >
                <option value={26}>26 days</option>
                <option value={22}>22 days</option>
              </select>
            </div>
          </div>
        </div>

        {selectedAgent && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Viewing: <strong className="text-gray-800">{selectedAgent.Lastname}, {selectedAgent.Firstname}</strong>
            <span className="font-mono text-gray-400">({selectedRefId})</span>
          </div>
        )}

        <Button
          className="w-full h-8 bg-gray-900 hover:bg-gray-800 text-[10px] uppercase font-black tracking-wider gap-2 rounded-none"
          onClick={handleManualSync}
          disabled={isAnySyncing || !selectedRefId}
        >
          {isAnySyncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
          {isAnySyncing ? "Syncing..." : "Sync Data"}
        </Button>
      </div>

      {/* ── METRICS GRID ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* LEFT */}
        <ul className="list-none space-y-3">

          {/* Outbound Performance */}
          <SectionCard
            title="Outbound Performance"
            badge={
              <span className={`text-[9px] font-black px-2 py-0.5 ${dailyPct >= 100 ? "bg-emerald-100 text-emerald-700" :
                  dailyPct >= 50 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-600"}`}>
                {dailyPct}% Today
              </span>
            }
          >
            <div className="mb-3">
              <div className="h-1 bg-gray-100 w-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${dailyPct >= 100 ? "bg-emerald-500" :
                      dailyPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </div>
            <p className="text-[8px] text-gray-400 uppercase font-medium mb-2 tracking-wide">
              Source: Outbound - Touchbase
            </p>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { label: "Daily", value: outboundDaily, denom: denominators.daily },
                { label: "Weekly", value: outboundWeekly, denom: denominators.weekly },
                { label: "Monthly", value: outboundMonthly, denom: denominators.monthly },
              ].map(({ label, value, denom }, i) => (
                <div key={label} className={i < 2 ? "border-r border-gray-100" : ""}>
                  <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
                  <p className="font-black text-[12px] text-gray-800">
                    {value}<span className="text-[9px] font-medium text-gray-400"> /{denom}</span>
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Database Coverage */}
          <SectionCard title="Database Coverage">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-blue-700">{uniqueClientReach}</span>
                <span className="text-[10px] text-gray-400">of {denominators.total} accounts</span>
              </div>
              <div className="h-1.5 bg-gray-100 w-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: denominators.total ? `${Math.min(100, (uniqueClientReach / denominators.total) * 100)}%` : "0%" }}
                />
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {[
                  { label: "Top 50", val: clientSegments.top50, denom: denominators.top50 },
                  { label: "Next 30", val: clientSegments.next30, denom: denominators.next30 },
                  { label: "Bal 20", val: clientSegments.balance20, denom: denominators.bal20 },
                  { label: "CSR", val: clientSegments.csrClient, denom: denominators.csrClient },
                  { label: "New", val: clientSegments.newClient, denom: denominators.newClient },
                  { label: "TSA", val: clientSegments.tsaClient, denom: denominators.tsaClient },
                ].map(({ label, val, denom }) => (
                  <div key={label} className="bg-gray-50 px-2 py-1 text-center border border-gray-100">
                    <p className="text-[8px] text-gray-400 uppercase">{label}</p>
                    <p className="text-[10px] font-black text-gray-700">
                      {val}<span className="text-gray-400 font-normal">/{denom}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Overdue Activities */}
          <SectionCard
            title={`Overdue Activities${overdueCount > 0 ? ` · ${overdueCount}` : ""}`}
            accent="border-l-red-400"
            badge={
              overdueEntries.length > 5 ? (
                <button onClick={() => setShowAllOverdue(!showAllOverdue)} className="text-[9px] text-blue-600 font-semibold hover:underline">
                  {showAllOverdue ? "Less" : "More"}
                </button>
              ) : undefined
            }
          >
            {loadingOverdue ? (
              <div className="flex items-center gap-2 text-gray-400 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Loading...</span>
              </div>
            ) : overdueEntries.length === 0 ? (
              <p className="text-[10px] text-gray-300 italic">No overdue activities</p>
            ) : (
              <div className={`space-y-1 ${showAllOverdue ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                {visibleOverdue.map(([company, count]) => (
                  <div key={company} className="flex justify-between items-center px-2 py-1 bg-red-50 border border-red-100">
                    <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                    <strong className="text-[10px] text-red-600 shrink-0">{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* New Account Development */}
          <SectionCard
            title={`New Account Devt${newClientCount > 0 ? ` · ${newClientCount}` : ""}`}
            badge={
              newClientEntries.length > 5 ? (
                <button onClick={() => setShowAllNewClients(!showAllNewClients)} className="text-[9px] text-blue-600 font-semibold hover:underline">
                  {showAllNewClients ? "Less" : "More"}
                </button>
              ) : undefined
            }
          >
            {newClientEntries.length === 0 ? (
              <p className="text-[10px] text-gray-300 italic">No new clients today</p>
            ) : (
              <div className={`space-y-1 ${showAllNewClients ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                {visibleNewClients.map(([company, count]) => (
                  <div key={company} className="flex justify-between items-center px-2 py-1 bg-blue-50 border border-blue-100">
                    <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                    <strong className="text-[10px] text-blue-600 shrink-0">{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </ul>

        {/* RIGHT */}
        <ul className="list-none space-y-3">

          {/* Time Consumed */}
          <SectionCard
            title="Time Consumed"
            badge={<span className="text-[10px] font-bold text-gray-600">{formatDuration(timeConsumedMs)}</span>}
          >
            {loadingTime ? (
              <div className="flex items-center gap-2 text-gray-400 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Computing...</span>
              </div>
            ) : Object.keys(timeByActivity).length === 0 ? (
              <p className="text-[10px] text-gray-300 italic">No activities logged today</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(timeByActivity).map(([type, ms]) => (
                  <div key={type} className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase font-medium truncate mr-2">{type}</span>
                    <span className="text-[10px] font-bold text-gray-800 shrink-0">{formatDuration(ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Total Sales */}
          <li className="bg-gray-900 border border-gray-800 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Sales Today</span>
            </div>
            <div className="px-3 py-3 flex items-baseline gap-1">
              <span className="text-gray-400 text-sm font-medium">₱</span>
              <span className="text-white text-2xl font-black tracking-tight tabular-nums">
                {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </li>

          {/* CSR Metrics */}
          <SectionCard title="CSR Metrics — Handling Times">
            {loadingCsrMetrics ? (
              <div className="flex items-center gap-2 text-gray-400 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Loading metrics...</span>
              </div>
            ) : (
              <div className="space-y-1">
                <StatRow label="TSA Response Time" value={formatHoursToHMS(avgResponseTime)} />
                <StatRow label="Non-Quotation HT" value={formatHoursToHMS(avgNonQuotationHT)} />
                <StatRow label="Quotation HT" value={formatHoursToHMS(avgQuotationHT)} />
                <StatRow label="SPF Handling Duration" value={formatHoursToHMS(avgSpfHT)} />
              </div>
            )}
          </SectionCard>

          {/* Closing of Quotation */}
          <SectionCard title="Closing of Quotation" accent="border-l-red-500">
            <div className="space-y-1">
              {[
                { label: "Pending Client Approval", value: pendingClientApprovalCount },
                { label: "SPF — Pending Client", value: spfPendingClientApproval },
                { label: "SPF — Pending Procurement", value: spfPendingProcurement },
                { label: "SPF — Pending PD", value: spfPendingPD },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-2 py-1.5 border-b border-gray-50 last:border-b-0">
                  <span className="text-[10px] text-red-500 font-medium">{label}</span>
                  <span className={`text-[11px] font-black ${value > 0 ? "text-red-600" : "text-gray-400"}`}>{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </ul>
      </div>

      {/* ── COVERAGE DIALOG ─────────────────────────────────────────────── */}
      {(() => {
        const isCovered = coverageDialogSource === "covered";
        const isUncovered = coverageDialogSource === "uncovered";
        const dialogOpen = isCovered || isUncovered;
        const list = isCovered ? coveredAccounts : uncoveredAccounts;

        const typeLabel = (normalized: string): string => {
          const map: Record<string, string> = {
            top50: "Top 50", next30: "Next 30", balance20: "Balance 20",
            csrclient: "CSR Client", newclient: "New Client", tsaclient: "TSA Client",
          };
          return map[normalized] ?? normalized;
        };

        const typeColors: Record<string, string> = {
          top50: "bg-amber-100 text-amber-700 border-amber-200",
          next30: "bg-blue-100 text-blue-700 border-blue-200",
          balance20: "bg-violet-100 text-violet-700 border-violet-200",
          newclient: "bg-emerald-100 text-emerald-700 border-emerald-200",
          tsaclient: "bg-rose-100 text-rose-700 border-rose-200",
          csrclient: "bg-slate-100 text-slate-600 border-slate-200",
        };
        const pillColor = (t: string) =>
          typeColors[t] ?? "bg-indigo-50 text-indigo-600 border-indigo-200";

        return (
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setCoverageDialogSource(null); }}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">

              {/* Header */}
              <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                    {isCovered ? "Covered Accounts" : "Not Reached Accounts"}
                    <span className="ml-2 text-gray-400 font-normal">{list.length}</span>
                  </DialogTitle>
                  {/* Tab toggle */}
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setCoverageDialogSource("covered")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isCovered
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      Covered · {coveredAccounts.length}
                    </button>
                    <button
                      onClick={() => setCoverageDialogSource("uncovered")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isUncovered
                          ? "bg-amber-500 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      Not Reached · {uncoveredAccounts.length}
                    </button>
                  </div>
                </div>
              </DialogHeader>

              {/* Table */}
              {list.length === 0 ? (
                <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
                  {isCovered
                    ? "No accounts reached this month."
                    : "All accounts have been reached this month."}
                </p>
              ) : (
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-[10px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[55%]">
                          Company
                        </th>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[45%]">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((acc, i) => (
                        <tr
                          key={acc.account_reference_number || i}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                            <span className="block" title={acc.company_name || "—"}>
                              {acc.company_name || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${pillColor(acc.type_client ?? "")}`}>
                              {typeLabel(acc.type_client ?? "—")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}