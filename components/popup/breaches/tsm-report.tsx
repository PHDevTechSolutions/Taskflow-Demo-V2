// popup/breaches/tsm-report.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, Loader2 } from "lucide-react";
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
    top50: number;
    next30: number;
    balance20: number;
    csrClient: number;
    newClient: number;
    tsaClient: number;
    inbound: number;
    outbound: number;
}

interface Denominators {
    total: number;
    top50: number;
    next30: number;
    bal20: number;
    csrClient: number;
    newClient: number;
    tsaClient: number;
    daily: number;
    weekly: number;
    monthly: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatHoursToHMS = (hours: number) => {
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
};

type TimeByActivity = Record<string, number>;

const computeTimeByActivity = (activities: any[]): TimeByActivity => {
    return activities.reduce((acc, act) => {
        if (!act.start_date || !act.end_date || !act.type_activity) return acc;
        const start = new Date(act.start_date).getTime();
        const end = new Date(act.end_date).getTime();
        if (isNaN(start) || isNaN(end) || end < start) return acc;
        acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
        return acc;
    }, {} as TimeByActivity);
};

// Fixed outbound counts per TSM per month (hardcoded business logic)
const getFixedCount = (refId: string, date: Date): number => {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const feb2026: Record<string, number> = {
        "RT-NCR-815758": 11,
        "MF-PH-840897": 7,
        "AB-NCR-288130": 11,
        "AS-NCR-146592": 4,
        "MP-CDO-613398": 4,
        "JG-NCR-713768": 1,
        "JM-CBU-702043": 3,
    };
    const marchOnwards: Record<string, number> = {
        "RT-NCR-815758": 12,
        "MF-PH-840897": 5,
        "AB-NCR-288130": 11,
        "AS-NCR-146592": 4,
        "MP-CDO-613398": 4,
        "JG-NCR-713768": 1,
        "JM-CBU-702043": 2,
    };

    if (year === 2026 && month === 2) return feb2026[refId] ?? 0;
    if (year > 2026 || (year === 2026 && month >= 3)) return marchOnwards[refId] ?? 0;
    return 0;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
        <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
        <span className="text-[11px] font-bold text-gray-800">{value}</span>
    </div>
);

const SectionCard = ({
    title,
    badge,
    children,
    accent,
}: {
    title: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    accent?: string;
}) => (
    <li
        className={`bg-white border border-gray-200 shadow-sm overflow-hidden ${accent ? `border-l-4 ${accent}` : ""}`}
    >
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

    const [userDetails, setUserDetails] = useState({
        referenceid: "",
        firstname: "",
        lastname: "",
        role: "",
    });

    const [activities, setActivities] = useState<any[]>([]);
    const [clusterAccounts, setClusterAccounts] = useState<Activity[]>([]);
    const [uniqueActivitiesList, setUniqueActivitiesList] = useState<Activity[]>([]);

    // Loading states
    const [loadingUser, setLoadingUser] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [loadingOverdue, setLoadingOverdue] = useState(false);
    const [loadingCsrMetrics, setLoadingCsrMetrics] = useState(false);
    const [loadingTime, setLoadingTime] = useState(false);

    // Metrics
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
        inbound: 0, outbound: 0,
    });

    const [denominators, setDenominators] = useState<Denominators>({
        total: 0, top50: 0, next30: 0, bal20: 0,
        csrClient: 0, newClient: 0, tsaClient: 0,
        daily: 0, weekly: 0, monthly: 0,
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
    const [newClientByCompany, setNewClientByCompany] = useState<Record<string, number>>({});
    const [showAllNewClients, setShowAllNewClients] = useState(false);

    // ─── Sync userId from URL ───────────────────────────────────────────────

    useEffect(() => {
        if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
    }, [queryUserId, userId, setUserId]);

    // ─── Fetch user then cluster ────────────────────────────────────────────

    useEffect(() => {
        if (!userId) return;

        const fetchUser = async () => {
            setLoadingUser(true);
            try {
                const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!res.ok) throw new Error("Failed to fetch user");
                const data = await res.json();
                const refId = data.ReferenceID || "";
                setUserDetails({
                    referenceid: refId,
                    role: data.Role || "",
                    firstname: data.Firstname || "",
                    lastname: data.Lastname || "",
                });
            } catch {
                sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" });
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUser();
    }, [userId]);

    // ─── Fetch helpers ──────────────────────────────────────────────────────

    const fetchClusterData = useCallback(async (refId: string) => {
        if (!refId) return;
        try {
            const res = await fetch(`/api/com-fetch-cluster-account-tsm?tsm=${encodeURIComponent(refId)}`);
            if (!res.ok) throw new Error("Failed to fetch cluster");
            const data = await res.json();
            const allAccounts: any[] = data.data || [];
            const active = allAccounts.filter((a) => (a.status || "").toLowerCase() === "active");

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
        } catch {
            sileo.error({ title: "Error", description: "Failed to fetch cluster.", duration: 4000, position: "top-center" });
        }
    }, []);

    const fetchActivities = useCallback(async (refId: string) => {
        if (!refId) return;
        setLoadingActivities(true);
        try {
            const res = await fetch(`/api/activity/tsm/breaches/fetch?tsm=${encodeURIComponent(refId)}`);
            if (!res.ok) throw new Error("Failed to fetch activities");
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
            const url = `/api/activity/tsm/breaches/fetch-activity?tsm=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch overdue");
            const data = await res.json();
            const acts: any[] = data.activities || [];
            const grouped: Record<string, number> = {};
            acts.forEach((a) => {
                const c = a.company_name || "Unknown";
                grouped[c] = (grouped[c] || 0) + 1;
            });
            setOverdueByCompany(grouped);
            setOverdueCount(acts.length);
        } catch {
            sileo.error({ title: "Error", description: "Failed to fetch overdue.", duration: 4000, position: "top-center" });
        } finally {
            setLoadingOverdue(false);
        }
    }, []);

    const fetchCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
        if (!refId) return;
        setLoadingCsrMetrics(true);
        try {
            const res = await fetch(`/api/activity/tsm/breaches/fetch-ecodesk?manager=${encodeURIComponent(refId)}`);
            if (!res.ok) throw new Error();
            const result = await res.json();
            const data: any[] = result.data || [];

            const excluded = [
                "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
                "Supplier/Vendor Product Offer", "Internal Whistle Blower",
                "Threats/Extortion/Intimidation", "Prank Call",
            ];

            const fromTs = new Date(from).getTime();
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            const toTs = toDate.getTime();

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
                    rtTotal += (tsaAck - endorsed) / 3600000;
                    rtCount++;
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
        } catch {
            console.error("CSR metrics error");
        } finally {
            setLoadingCsrMetrics(false);
        }
    }, []);

    // ─── Auto-fetch when referenceid or date changes ────────────────────────

    useEffect(() => {
        const refId = userDetails.referenceid;
        if (!refId) return;
        fetchClusterData(refId);
        fetchActivities(refId);
        fetchOverdue(refId, fromDate, toDate);
        fetchCsrMetrics(refId, fromDate, toDate);
    }, [userDetails.referenceid, fromDate, toDate, fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics]);

    // ─── Compute outbound + time metrics ───────────────────────────────────

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

            const fixedCount = getFixedCount(userDetails.referenceid, targetDate);

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

            // Outbound daily
            const isOutbound = (a: any) => a.type_activity === "Outbound Calls" || a.source === "history";
            const dailyCount = dailyActivities.filter(isOutbound).length;

            // Weekly (Mon–Sun)
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
                return t >= weekStart.getTime() && t <= weekEnd.getTime() && isOutbound(act);
            }).length;

            const monthlyCount = activities.filter((act) => {
                const d = new Date(act.date_created);
                return d.getMonth() === targetDate.getMonth()
                    && d.getFullYear() === targetDate.getFullYear()
                    && isOutbound(act);
            }).length;

            const dailyDenom = fixedCount ? fixedCount * 20 : 20;
            const weeklyDenom = fixedCount ? fixedCount * 20 * 5 : 120;
            const monthlyDenom = fixedCount ? fixedCount * 20 * 22 : 480;

            setOutboundDaily(dailyCount);
            setOutboundWeekly(weeklyCount);
            setOutboundMonthly(monthlyCount);
            setDenominators((prev) => ({
                ...prev,
                daily: dailyDenom,
                weekly: weeklyDenom,
                monthly: monthlyDenom,
            }));

            // Quotation pending counts
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
    }, [activities, fromDate, userDetails.referenceid]);

    // ─── Compute territory coverage ─────────────────────────────────────────

    useEffect(() => {
        if (!clusterAccounts.length) {
            setUniqueClientReach(0);
            setUniqueActivitiesList([]);
            setClientSegments({ top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, inbound: 0, outbound: 0 });
            return;
        }

        const fromDateObj = new Date(fromDate);
        const selectedMonth = fromDateObj.getMonth();
        const selectedYear = fromDateObj.getFullYear();

        const filtered = activities.filter(
            (act) =>
                act.account_reference_number &&
                act.date_created &&
                (act.type_activity === "Inbound Calls" || act.type_activity === "Outbound Calls") &&
                new Date(act.date_created).getMonth() === selectedMonth &&
                new Date(act.date_created).getFullYear() === selectedYear
        );

        const byRef: Record<string, any> = {};
        filtered.forEach((act) => { byRef[act.activity_reference_number] = act; });
        const unique = Object.values(byRef);
        setUniqueActivitiesList(unique);

        let inbound = 0, outbound = 0;
        const seg = { top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0 };

        unique.forEach((act) => {
            if (act.type_activity === "Inbound Calls") inbound++;
            if (act.type_activity === "Outbound Calls") outbound++;

            const account = clusterAccounts.find((acc) => acc.account_reference_number === act.account_reference_number);
            if (!account?.type_client) return;
            const type = account.type_client; // already normalized on fetch

            if (type === "top50") seg.top50++;
            else if (type === "next30") seg.next30++;
            else if (type === "balance20") seg.balance20++;
            else if (type === "csrclient") seg.csrClient++;
            else if (type === "newclient") seg.newClient++;
            else if (type === "tsaclient") seg.tsaClient++;
        });

        setUniqueClientReach(unique.length);
        setClientSegments({ ...seg, inbound, outbound });
    }, [activities, clusterAccounts, fromDate]);

    // ─── Compute new clients per company ───────────────────────────────────

    useEffect(() => {
        if (!activities.length || !fromDate) {
            setNewClientByCompany({}); setNewClientCount(0); return;
        }

        const targetDate = new Date(fromDate);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
        const allowed = ["Assisted", "Quote-Done", "SO-Done", "Delivered"];

        const grouped: Record<string, number> = {};
        let total = 0;

        activities.forEach((act) => {
            const t = new Date(act.date_created).getTime();
            if (
                allowed.includes(act.status) &&
                act.type_client === "New Client" &&
                t >= startOfDay.getTime() && t <= endOfDay.getTime()
            ) {
                const company = act.company_name || "Unknown";
                grouped[company] = (grouped[company] || 0) + 1;
                total++;
            }
        });

        setNewClientByCompany(grouped);
        setNewClientCount(total);
    }, [activities, fromDate]);

    // ─── Derived ────────────────────────────────────────────────────────────

    const overdueEntries = Object.entries(overdueByCompany);
    const visibleOverdue = showAllOverdue ? overdueEntries : overdueEntries.slice(0, 5);

    const newClientEntries = Object.entries(newClientByCompany);
    const visibleNewClients = showAllNewClients ? newClientEntries : newClientEntries.slice(0, 5);

    const isAnySyncing = loadingActivities || loadingOverdue;

    const handleManualSync = () => {
        const refId = userDetails.referenceid;
        if (!refId) return;
        fetchClusterData(refId);
        fetchActivities(refId);
        fetchOverdue(refId, fromDate, toDate);
        fetchCsrMetrics(refId, fromDate, toDate);
        sileo.success({
            title: "Syncing",
            description: `Refreshing data for ${userDetails.lastname}, ${userDetails.firstname}`,
            duration: 3000,
            position: "top-right",
        });
    };

    const dailyPct = denominators.daily > 0 ? Math.min(100, Math.round((outboundDaily / denominators.daily) * 100)) : 0;

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4 pb-4">
            {/* ── SYNC PANEL ────────────────────────────────────────────────── */}
            <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    Sync Configuration
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                            {loadingUser
                                ? "Loading..."
                                : `${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                        </label>
                        <Input
                            className="h-7 text-[11px] font-mono rounded-none bg-white border-gray-200"
                            value={userDetails.referenceid}
                            disabled
                            placeholder="Reference ID"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                            Target Date
                        </label>
                        <Input
                            type="date"
                            className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setToDate(e.target.value);
                            }}
                        />
                    </div>
                </div>
                <Button
                    className="w-full h-8 bg-gray-900 hover:bg-gray-800 text-[10px] uppercase font-black tracking-wider gap-2 rounded-none"
                    onClick={handleManualSync}
                    disabled={isAnySyncing || !userDetails.referenceid}
                >
                    {isAnySyncing
                        ? <Loader2 size={11} className="animate-spin" />
                        : <RefreshCcw size={11} />}
                    {isAnySyncing ? "Syncing..." : "Sync Data"}
                </Button>
            </div>

            {/* ── METRICS GRID ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
                {/* LEFT COLUMN */}
                <ul className="list-none space-y-3">

                    {/* Outbound Performance */}
                    <SectionCard
                        title="Outbound Performance"
                        badge={
                            <span className={`text-[9px] font-black px-2 py-0.5 ${dailyPct >= 100 ? "bg-emerald-100 text-emerald-700" : dailyPct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                                {dailyPct}% Today
                            </span>
                        }
                    >
                        {/* Progress bar */}
                        <div className="mb-3">
                            <div className="h-1 bg-gray-100 w-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${dailyPct >= 100 ? "bg-emerald-500" : dailyPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                    style={{ width: `${dailyPct}%` }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center">
                            {[
                                { label: "Daily", value: outboundDaily, denom: denominators.daily },
                                { label: "Weekly", value: outboundWeekly, denom: denominators.weekly },
                                { label: "Monthly", value: outboundMonthly, denom: denominators.monthly },
                            ].map(({ label, value, denom }, i) => (
                                <div key={label} className={`${i < 2 ? "border-r border-gray-100" : ""}`}>
                                    <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
                                    <p className="font-black text-[12px] text-gray-800">
                                        {value}
                                        <span className="text-[9px] font-medium text-gray-400"> /{denom}</span>
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
                            {/* Segment breakdown */}
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
                                        <p className="text-[10px] font-black text-gray-700">{val}<span className="text-gray-400 font-normal">/{denom}</span></p>
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
                                <button
                                    onClick={() => setShowAllOverdue(!showAllOverdue)}
                                    className="text-[9px] text-blue-600 font-semibold hover:underline"
                                >
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
                                <button
                                    onClick={() => setShowAllNewClients(!showAllNewClients)}
                                    className="text-[9px] text-blue-600 font-semibold hover:underline"
                                >
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

                {/* RIGHT COLUMN */}
                <ul className="list-none space-y-3">

                    {/* Time Consumed */}
                    <SectionCard
                        title="Time Consumed"
                        badge={
                            <span className="text-[10px] font-bold text-gray-600">{formatDuration(timeConsumedMs)}</span>
                        }
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
        </div>
    );
}