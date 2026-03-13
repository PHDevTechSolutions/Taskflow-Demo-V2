"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "@/components/roles/tsm/dashboard/card/agent-list";
import { AgentActivityLogs } from "@/components/roles/tsm/dashboard/card/activity-logs";
import { AgentMeetings } from "@/components/roles/tsm/dashboard/card/meetings";
import { OutboundCard } from "@/components/roles/tsm/dashboard/card/outbound";

import { OutboundCallsTableCard } from "@/components/roles/tsm/dashboard/table/outbound";
import { QuotationTableCard } from "@/components/roles/tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "@/components/roles/tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "@/components/roles/tsm/dashboard/table/inbound-replies";

import { Building2, PhoneForwarded, ChevronRight } from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot, limit } from "firebase/firestore";

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
    activity_reference_number: string;
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
}

interface AgentMeeting {
    start_date?: string | null;
    end_date?: string | null;
    remarks?: string | null;
    type_activity?: string | null;
    date_created?: string | null;
}

interface ScheduledCompany {
    company_name: string;
}

interface Props {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export function AgentList({
    referenceid,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}: Props) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [errorHistory, setErrorHistory] = useState<string | null>(null);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [todayNextAvailableCount, setTodayNextAvailableCount] = useState<number>(0);
    const [scheduledCompanies, setScheduledCompanies] = useState<ScheduledCompany[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    type AgentActivity = {
        latestLogin: string | null;
        latestLogout: string | null;
    };

    const [agentActivityMap, setAgentActivityMap] = useState<Record<string, AgentActivity>>({});
    const [agentMeetingMap, setAgentMeetingMap] = useState<Record<string, AgentMeeting>>({});

    const formatDate = (dateCreated: any) => {
        if (!dateCreated) return null;
        if (dateCreated.toDate) {
            return dateCreated.toDate().toLocaleString("en-US", {
                year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "numeric", second: "numeric",
                hour12: true, timeZoneName: "short",
            });
        }
        if (typeof dateCreated === "string") {
            return new Date(dateCreated).toLocaleString("en-US", {
                year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "numeric", second: "numeric",
                hour12: true, timeZoneName: "short",
            });
        }
        return null;
    };

    const [countData, setCountData] = useState<{
        totalCount: number | null;
        top50Count: number | null;
        next30Count: number | null;
        balance20Count: number | null;
        csrClientCount: number | null;
        tsaClientCount: number | null;
    } | null>(null);

    /* ========================= DEFAULT DATE = TODAY ========================= */
    useEffect(() => {
        if (!dateCreatedFilterRange?.from) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setDateCreatedFilterRangeAction({ from: today, to: today });
        }
    }, [dateCreatedFilterRange, setDateCreatedFilterRangeAction]);

    /* ========================= FETCH AGENTS ========================= */
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch agents"); return res.json(); })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, [referenceid]);

    /* ========================= FETCH HISTORY ========================= */
    useEffect(() => {
        if (!referenceid) return;
        setLoadingHistory(true);
        fetch(`/api/all-agent-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch history"); return res.json(); })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, [referenceid]);

    /* ========================= FILTER LOGIC ========================= */
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];
        const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from) : new Date();
        const to = dateCreatedFilterRange?.to ? new Date(dateCreatedFilterRange.to) : from;
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

    /* ========================= ACTIVITY LOGS ========================= */
    useEffect(() => {
        if (!agents.length) return;
        setAgentActivityMap({});
        const unsubscribes: (() => void)[] = [];
        const agentsToWatch = selectedAgent === "all" ? agents : agents.filter(a => a.ReferenceID === selectedAgent);
        agentsToWatch.forEach((agent) => {
            const q = query(collection(db, "activity_logs"), where("ReferenceID", "==", agent.ReferenceID), orderBy("date_created", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc = snapshot.docs.find(d => d.data().status?.toLowerCase() === "login");
                const logoutDoc = snapshot.docs.find(d => d.data().status?.toLowerCase() === "logout");
                setAgentActivityMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin: loginDoc ? formatDate(loginDoc.data().date_created) : null,
                        latestLogout: logoutDoc ? formatDate(logoutDoc.data().date_created) : null,
                    },
                }));
            });
            unsubscribes.push(unsubscribe);
        });
        return () => unsubscribes.forEach(u => u());
    }, [selectedAgent, agents]);

    /* ========================= MEETINGS ========================= */
    useEffect(() => {
        if (!agents.length) return;
        setAgentMeetingMap({});
        const unsubscribes: (() => void)[] = [];
        const agentsToWatch = selectedAgent === "all" ? agents : agents.filter(a => a.ReferenceID === selectedAgent);
        agentsToWatch.forEach((agent) => {
            const q = query(collection(db, "meetings"), where("referenceid", "==", agent.ReferenceID), orderBy("date_created", "desc"), limit(1));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    setAgentMeetingMap(prev => ({ ...prev, [agent.ReferenceID]: { start_date: null, end_date: null, remarks: null, type_activity: null, date_created: null } }));
                    return;
                }
                const data = snapshot.docs[0].data();
                const fd = (d: any) => {
                    if (!d) return null;
                    if (d.toDate) return d.toDate().toLocaleString();
                    if (typeof d === "string") return new Date(d).toLocaleString();
                    return null;
                };
                setAgentMeetingMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: { start_date: fd(data.start_date), end_date: fd(data.end_date), remarks: data.remarks ?? "—", type_activity: data.type_activity ?? "—", date_created: data.date_created ?? "—" },
                }));
            });
            unsubscribes.push(unsubscribe);
        });
        return () => unsubscribes.forEach(u => u());
    }, [selectedAgent, agents]);

    /* ========================= COUNT DATABASE ========================= */
    useEffect(() => {
        if (selectedAgent === "all") { setCountData(null); return; }
        setLoading(true);
        setError(null);
        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => { if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); } return res.json(); })
            .then((data) => {
                if (data.success) {
                    setCountData({ totalCount: data.totalCount ?? 0, top50Count: data.top50Count ?? 0, next30Count: data.next30Count ?? 0, balance20Count: data.balance20Count ?? 0, csrClientCount: data.csrClientCount ?? 0, tsaClientCount: data.tsaClientCount ?? 0 });
                } else { setError(data.error || "Failed"); setCountData(null); }
            })
            .catch((err) => { setError(err.message); setCountData(null); })
            .finally(() => setLoading(false));
    }, [selectedAgent]);

    /* ========================= SCHEDULED ========================= */
    useEffect(() => {
        if (selectedAgent === "all") { setTodayNextAvailableCount(0); setScheduledCompanies([]); return; }
        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(res => res.json())
            .then(data => { setTodayNextAvailableCount(data.count ?? 0); setScheduledCompanies(data.companies ?? []); })
            .catch(() => { setTodayNextAvailableCount(0); setScheduledCompanies([]); })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingHistory ? (
                <div className="text-center py-10 text-sm text-gray-400">Loading history data...</div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10 text-sm">{errorHistory}</div>
            ) : (
                <>
                    {/* AGENT FILTER */}
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="w-[220px] text-xs">
                            <SelectValue placeholder="Filter by Agent" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Agents</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem className="capitalize" key={agent.ReferenceID} value={agent.ReferenceID}>
                                    {agent.Firstname} {agent.Lastname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="grid grid-cols-1 gap-4 mt-2">
                        {/* AGENT SUMMARY */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent) return <p className="text-center text-sm italic text-muted-foreground">Agent not found.</p>;
                            const agentActivities = filteredHistory.filter(item => item.referenceid.toLowerCase() === selectedAgent.toLowerCase());
                            return <AgentCard agent={agent} agentActivities={agentActivities} referenceid={referenceid} />;
                        })()}

                        {selectedAgent === "all" && (
                            <AgentActivityLogs agents={agents} agentActivityMap={agentActivityMap} />
                        )}

                        <AgentMeetings
                            agents={agents}
                            selectedAgent={selectedAgent}
                            dateCreatedFilterRange={dateCreatedFilterRange}
                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                        />

                        {/* TOTAL DATABASE + SCHEDULED */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent || agent.Role === "Territory Sales Manager") return null;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* ── CARD 1: TOTAL DATABASE ── */}
                                    <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
                                        {/* Header */}
                                        <div className="px-5 pt-5 pb-3 border-b">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <Building2 className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-gray-800">Total Database</h2>
                                                    <p className="text-xs text-gray-400 mt-0.5">Assigned company accounts</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4">
                                            {loading ? (
                                                <div className="flex items-center justify-center py-6 text-xs text-gray-400">Loading...</div>
                                            ) : error ? (
                                                <div className="flex items-center justify-center py-6 text-xs text-red-500">{error}</div>
                                            ) : countData ? (
                                                <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden text-xs font-mono">
                                                    {[
                                                        { label: "Total", value: countData.totalCount, highlight: true },
                                                        { label: "Top 50", value: countData.top50Count },
                                                        { label: "Next 30", value: countData.next30Count },
                                                        { label: "Balance 20", value: countData.balance20Count },
                                                        { label: "CSR Client", value: countData.csrClientCount },
                                                        { label: "TSA Client", value: countData.tsaClientCount },
                                                    ].map(({ label, value, highlight }) => (
                                                        <div
                                                            key={label}
                                                            className={`flex items-center justify-between px-4 py-2.5 ${highlight ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                                                        >
                                                            <span className={highlight ? "font-semibold text-gray-700" : "text-gray-500"}>{label}</span>
                                                            <span className={highlight ? "font-bold text-gray-900" : "font-semibold text-gray-700"}>
                                                                {(value ?? 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center py-6 text-xs text-gray-400 italic">
                                                    Select an agent to view database.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── CARD 2: SCHEDULED ACCOUNTS ── */}
                                    <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
                                        {/* Header */}
                                        <div className="px-5 pt-5 pb-3 border-b">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <PhoneForwarded className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-gray-800">OB Calls – Scheduled Today</h2>
                                                    <p className="text-xs text-gray-400 mt-0.5">Accounts available for outbound calls today</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4">
                                            {/* Big count */}
                                            <div className="flex items-end gap-1.5 mb-4">
                                                <span className="text-3xl font-bold text-gray-900 font-mono">
                                                    {todayNextAvailableCount.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-400 mb-1">accounts</span>
                                            </div>

                                            {/* Sheet trigger */}
                                            <Sheet>
                                                <SheetTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={loadingScheduled}
                                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                        View Accounts
                                                    </Button>
                                                </SheetTrigger>

                                                <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-4">
                                                    <SheetHeader>
                                                        <SheetTitle>Scheduled Accounts Today</SheetTitle>
                                                    </SheetHeader>

                                                    <div className="mt-4 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
                                                        {loadingScheduled ? (
                                                            <div className="flex items-center justify-center py-6 text-xs text-gray-400">Loading...</div>
                                                        ) : scheduledCompanies.length === 0 ? (
                                                            <div className="flex items-center justify-center py-6 text-xs text-gray-400 italic">
                                                                No scheduled accounts for today.
                                                            </div>
                                                        ) : (
                                                            scheduledCompanies.map((company, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="px-4 py-2.5 text-xs text-gray-700 font-mono hover:bg-gray-50 transition-colors"
                                                                >
                                                                    {company.company_name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </SheetContent>
                                            </Sheet>
                                        </div>
                                    </div>

                                </div>
                            );
                        })()}

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
                </>
            )}
        </main>
    );
}