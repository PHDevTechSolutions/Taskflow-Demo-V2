"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "./card/agent-list";
import { AgentActivityLogs } from "./card/activity-logs";
import { AgentMeetings } from "./card/meetings";
import { OutboundCard } from "../../tsm/dashboard/card/outbound";
import { OutboundCallsTableCard } from "./table/outbound-calls";
import { QuotationTableCard } from "../../tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "../../tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "../../tsm/dashboard/table/inbound-replies";
import { Building2, PhoneForwarded, X } from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
    referenceid: string;
    tsm: string;
    source: string;
    call_status: string;
    type_activity: string;
    actual_sales: string;
    dr_number: string;
    quotation_amount: string;
    quotation_number: string;
    so_amount: string;
    so_number: string;
    start_date: string;
    end_date: string;
    status: string;
    date_created: string;
    company_name: string;
    remarks: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
    Position: string;
    Status: string;
    Role: string;
    TargetQuota: string;
    Connection: string;
    TSM?: string;
}

interface ScheduledCompany {
    company_name: string;
}

type AgentActivity = {
    latestLogin: string | null;
    latestLogout: string | null;
};

type CountData = {
    totalCount: number;
    top50Count: number;
    next30Count: number;
    balance20Count: number;
    csrClientCount: number;
    tsaClientCount: number;
};

interface Props {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateCreated: any): string | null {
    if (!dateCreated) return null;

    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZoneName: "short",
    };

    if (dateCreated.toDate) return dateCreated.toDate().toLocaleString("en-US", options);
    if (typeof dateCreated === "string") return new Date(dateCreated).toLocaleString("en-US", options);
    return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentList({
    referenceid,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}: Props) {
    const [history, setHistory]               = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [errorHistory, setErrorHistory]     = useState<string | null>(null);

    const [agents, setAgents]               = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const [countData, setCountData]                             = useState<CountData | null>(null);
    const [todayNextAvailableCount, setTodayNextAvailableCount] = useState<number>(0);
    const [scheduledCompanies, setScheduledCompanies]           = useState<ScheduledCompany[]>([]);
    const [loadingScheduled, setLoadingScheduled]               = useState(false);

    const [agentActivityMap, setAgentActivityMap] = useState<Record<string, AgentActivity>>({});

    // ── Default date = today ────────────────────────────────────────────────
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setDateCreatedFilterRangeAction({ from: today, to: today });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Fetch agents ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch agents"); return res.json(); })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, [referenceid]);

    // ── Fetch history ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        setLoadingHistory(true);
        fetch(`/api/manager-all-agent-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch history"); return res.json(); })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, [referenceid]);

    // ── Filter history ──────────────────────────────────────────────────────
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];

        const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from) : new Date();
        const to   = dateCreatedFilterRange?.to   ? new Date(dateCreatedFilterRange.to)   : new Date(from);

        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        return history.filter((item) => {
            const createdAt = new Date(item.date_created);
            if (isNaN(createdAt.getTime())) return false;
            if (createdAt < from || createdAt > to) return false;
            if (selectedAgent === "all") return true;
            return item.referenceid.toLowerCase() === selectedAgent.toLowerCase();
        });
    }, [history, selectedAgent, dateCreatedFilterRange]);

    // ── Firebase listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (!agents.length) return;
        setAgentActivityMap({});
        const unsubscribes: (() => void)[] = [];

        const agentsToWatch = selectedAgent === "all"
            ? agents
            : agents.filter((a) => a.ReferenceID === selectedAgent);

        agentsToWatch.forEach((agent) => {
            const q = query(
                collection(db, "activity_logs"),
                where("ReferenceID", "==", agent.ReferenceID),
                orderBy("date_created", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc  = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "login");
                const logoutDoc = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "logout");

                setAgentActivityMap((prev) => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin:  loginDoc  ? formatDate(loginDoc.data().date_created)  : null,
                        latestLogout: logoutDoc ? formatDate(logoutDoc.data().date_created) : null,
                    },
                }));
            });
            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach((u) => u());
    }, [selectedAgent, agents]);

    // ── Fetch database count ────────────────────────────────────────────────
    useEffect(() => {
        if (selectedAgent === "all") { setCountData(null); return; }

        setLoading(true);
        setError(null);

        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => {
                if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setCountData({
                        totalCount:     data.totalCount     ?? 0,
                        top50Count:     data.top50Count     ?? 0,
                        next30Count:    data.next30Count    ?? 0,
                        balance20Count: data.balance20Count ?? 0,
                        csrClientCount: data.csrClientCount ?? 0,
                        tsaClientCount: data.tsaClientCount ?? 0,
                    });
                } else {
                    throw new Error(data.error || "Failed to fetch count");
                }
            })
            .catch((err) => { setError(err.message); setCountData(null); })
            .finally(() => setLoading(false));
    }, [selectedAgent]);

    // ── Fetch scheduled ─────────────────────────────────────────────────────
    useEffect(() => {
        if (selectedAgent === "all") {
            setTodayNextAvailableCount(0);
            setScheduledCompanies([]);
            return;
        }

        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then((res) => res.json())
            .then((data) => {
                setTodayNextAvailableCount(data.count ?? 0);
                setScheduledCompanies(data.companies ?? []);
            })
            .catch(() => { setTodayNextAvailableCount(0); setScheduledCompanies([]); })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    // ── Derived ─────────────────────────────────────────────────────────────
    const selectedAgentObj = useMemo(
        () => selectedAgent !== "all"
            ? agents.find((a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase())
            : undefined,
        [selectedAgent, agents]
    );

    // ── Render ──────────────────────────────────────────────────────────────

    if (loadingHistory) return <div className="text-center py-10">Loading history data...</div>;
    if (errorHistory)   return <div className="text-center text-red-500 py-10">{errorHistory}</div>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">

            {/* ── Active filter chip ── */}
            {selectedAgent !== "all" && selectedAgentObj && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Filtering by:</span>
                    <div className="flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full border border-green-200">
                        <img
                            src={selectedAgentObj.profilePicture || "/Taskflow.png"}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover"
                        />
                        {selectedAgentObj.Firstname} {selectedAgentObj.Lastname}
                        <button
                            onClick={() => setSelectedAgent("all")}
                            className="ml-1 hover:text-red-500 transition-colors"
                            aria-label="Clear filter"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">

                {/* ── Activity logs — always visible, cards are clickable ── */}
                <AgentActivityLogs
                    agents={agents}
                    agentActivityMap={agentActivityMap}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                />

                {/* ── Agent Summary Card (when an agent is selected) ── */}
                {selectedAgent !== "all" && (
                    selectedAgentObj ? (
                        <AgentCard
                            agent={selectedAgentObj}
                            agentActivities={filteredHistory.filter(
                                (item) => item.referenceid.toLowerCase() === selectedAgent.toLowerCase()
                            )}
                            referenceid={referenceid}
                        />
                    ) : (
                        <p className="text-center text-sm italic text-muted-foreground">
                            Agent not found.
                        </p>
                    )
                )}

                {/* ── Database + Scheduled cards (TSA only) ── */}
                {selectedAgent !== "all" && selectedAgentObj &&
                    selectedAgentObj.Role !== "Territory Sales Manager" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Total Database */}
                        <div className="p-6 rounded-lg border border-gray-200 shadow-md bg-white">
                            <h2 className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-900 border-b pb-2">
                                <Building2 className="w-5 h-5" /> Total Database
                            </h2>
                            {loading  && <p className="text-center text-gray-500 italic">Loading...</p>}
                            {error    && <p className="text-center text-red-600 font-semibold">{error}</p>}
                            {!loading && !error && !countData && (
                                <p className="mt-4 text-center text-sm text-gray-400 italic">
                                    No data available for this agent.
                                </p>
                            )}
                            {countData && !loading && !error && (
                                <div className="space-y-3 text-gray-700 text-sm">
                                    {[
                                        { label: "Total",      value: countData.totalCount },
                                        { label: "Top 50",     value: countData.top50Count },
                                        { label: "Next 30",    value: countData.next30Count },
                                        { label: "Balance 20", value: countData.balance20Count },
                                        { label: "CSR Client", value: countData.csrClientCount },
                                        { label: "TSA Client", value: countData.tsaClientCount },
                                    ].map(({ label, value }) => (
                                        <p key={label} className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">{label}:</span>
                                            <span>{value.toLocaleString()}</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Scheduled Accounts Today */}
                        <div className="p-6 rounded-lg border border-gray-200 shadow-md bg-white">
                            <h2 className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-900 border-b pb-2">
                                <PhoneForwarded className="w-5 h-5" /> OB Calls – Scheduled Accounts For Today
                            </h2>
                            <p className="text-2xl font-bold mb-3">
                                {todayNextAvailableCount.toLocaleString()}
                            </p>
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button size="sm" disabled={loadingScheduled}>View Accounts</Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-4">
                                    <SheetHeader>
                                        <SheetTitle>Scheduled Accounts Today</SheetTitle>
                                    </SheetHeader>
                                    <div className="mt-4 p-4 bg-white rounded-lg shadow-md max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {loadingScheduled && (
                                            <p className="text-sm text-muted-foreground">Loading...</p>
                                        )}
                                        {!loadingScheduled && scheduledCompanies.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No scheduled accounts for today.
                                            </p>
                                        )}
                                        {!loadingScheduled && scheduledCompanies.map((company, idx) => (
                                            <div key={idx} className="text-sm py-1 border-b border-gray-100 last:border-0">
                                                {company.company_name}
                                            </div>
                                        ))}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                )}

                {/* ── Meetings (only when no agent is selected) ── */}
                {selectedAgent === "all" && (
                    <AgentMeetings agents={agents} selectedAgent={selectedAgent} />
                )}

                {/* ── Table cards (always visible, filtered by selectedAgent) ── */}
                <OutboundCallsTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
                <QuotationTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
                <SalesOrderTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
                <OutboundCard history={filteredHistory} agents={agents} />
                <InboundRepliesCard history={filteredHistory} agents={agents} />
            </div>
        </main>
    );
}