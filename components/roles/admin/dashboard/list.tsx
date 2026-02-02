"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "@/components/roles/tsm/dashboard/card/agent-list";
import { AgentActivityLogs } from "../dashboard/card/activity-logs";
import { AgentMeetings } from "@/components/roles/tsm/dashboard/card/meetings";
import { OutboundCard } from "@/components/roles/tsm/dashboard/card/outbound";
import { OutboundCallsTableCard } from "@/components/roles/tsm/dashboard/table/outbound";
import { QuotationTableCard } from "@/components/roles/tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "@/components/roles/tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "@/components/roles/tsm/dashboard/table/inbound-replies";

import ReactSelect from "react-select";
import { Building2, PhoneForwarded } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, Timestamp, onSnapshot, QuerySnapshot, DocumentData, limit } from "firebase/firestore";

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

interface AgentOption {
    value: string;
    label: string;
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

    const [agentActivityMap, setAgentActivityMap] = useState<
        Record<string, AgentActivity>
    >({});

    const [agentMeetingMap, setAgentMeetingMap] = useState<
        Record<string, AgentMeeting>
    >({});

    const formatDate = (dateCreated: any) => {
        if (!dateCreated) return null;

        if (dateCreated.toDate) {
            return dateCreated.toDate().toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                hour12: true,
                timeZoneName: "short",
            });
        }

        if (typeof dateCreated === "string") {
            return new Date(dateCreated).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                hour12: true,
                timeZoneName: "short",
            });
        }

        return null;
    };

    /* =========================
       DEFAULT DATE = TODAY
    ========================= */
    useEffect(() => {
        if (!dateCreatedFilterRange?.from) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            setDateCreatedFilterRangeAction({
                from: today,
                to: today,
            });
        }
    }, [dateCreatedFilterRange, setDateCreatedFilterRangeAction]);

    /* =========================
   FETCH AGENTS
========================= */

    useEffect(() => {

        fetch(`/api/fetch-all-users-admin`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch agents");
                return res.json();
            })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, []);

    /* =========================
       FETCH HISTORY
    ========================= */
    useEffect(() => {
        setLoadingHistory(true);
        fetch(`/api/all-agent-admin-history`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch history");
                return res.json();
            })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, []);

    /* =========================
       FILTER LOGIC (TODAY DEFAULT)
    ========================= */
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from)
            : new Date();

        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to)
            : from;

        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        return history.filter((item) => {
            const createdAt = new Date(item.date_created);
            if (isNaN(createdAt.getTime())) return false;

            if (createdAt < from || createdAt > to) return false;

            if (selectedAgent === "all") return true;

            return (
                item.referenceid.toLowerCase() ===
                selectedAgent.toLowerCase()
            );
        });
    }, [history, selectedAgent, dateCreatedFilterRange]);

    useEffect(() => {
        if (!agents.length) return;

        // clear old data
        setAgentActivityMap({});

        const unsubscribes: (() => void)[] = [];

        const agentsToWatch =
            selectedAgent === "all"
                ? agents
                : agents.filter(a => a.ReferenceID === selectedAgent);

        agentsToWatch.forEach((agent) => {
            const q = query(
                collection(db, "activity_logs"),
                where("ReferenceID", "==", agent.ReferenceID),
                orderBy("date_created", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc = snapshot.docs.find(
                    d => d.data().status?.toLowerCase() === "login"
                );
                const logoutDoc = snapshot.docs.find(
                    d => d.data().status?.toLowerCase() === "logout"
                );

                setAgentActivityMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin: loginDoc
                            ? formatDate(loginDoc.data().date_created)
                            : null,
                        latestLogout: logoutDoc
                            ? formatDate(logoutDoc.data().date_created)
                            : null,
                    },
                }));
            });

            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach(u => u());
    }, [selectedAgent, agents]);

    const [countData, setCountData] = useState<{
        totalCount: number | null;
        top50Count: number | null;
        next30Count: number | null;
        balance20Count: number | null;
        csrClientCount: number | null;
        tsaClientCount: number | null;
    } | null>(null);


    useEffect(() => {
        if (selectedAgent === "all") {
            setCountData(null);
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to fetch count");
                }
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setCountData({
                        totalCount: data.totalCount ?? 0,
                        top50Count: data.top50Count ?? 0,
                        next30Count: data.next30Count ?? 0,
                        balance20Count: data.balance20Count ?? 0,
                        csrClientCount: data.csrClientCount ?? 0,
                        tsaClientCount: data.tsaClientCount ?? 0,
                    });
                } else {
                    setError(data.error || "Failed to fetch count");
                    setCountData(null);
                }
            })
            .catch((err) => {
                setError(err.message);
                setCountData(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedAgent]);

    useEffect(() => {
        if (selectedAgent === "all") {
            setTodayNextAvailableCount(0);
            setScheduledCompanies([]);
            return;
        }

        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(res => res.json())
            .then(data => {
                setTodayNextAvailableCount(data.count ?? 0);
                // If your API returns the list too, set it here
                setScheduledCompanies(data.companies ?? []);
            })
            .catch(() => {
                setTodayNextAvailableCount(0);
                setScheduledCompanies([]);
            })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    const agentOptions: AgentOption[] = [
        { value: "all", label: "All Agents" },
        ...agents.map(agent => ({
            value: agent.ReferenceID,
            label: `${agent.Firstname} ${agent.Lastname}`,
        })),
    ];

    const selectedOption = agentOptions.find(opt => opt.value === selectedAgent);

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingHistory ? (
                <div className="text-center py-10">Loading history data...</div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10">{errorHistory}</div>
            ) : (
                <>
                    {/* AGENT FILTER */}
                    <ReactSelect
                        options={agentOptions}
                        value={selectedOption}
                        onChange={(option) => setSelectedAgent(option?.value ?? "all")}
                        placeholder="Filter by Agent"
                        isSearchable={true}
                        styles={{
                            control: (base) => ({ ...base, fontSize: 12 }),
                            menu: (base) => ({ ...base, fontSize: 12 }),
                        }}
                        className="capitalize"
                    />

                    <div className="grid grid-cols-1 gap-4 mt-2">
                        {/* CARD 1 – AGENT SUMMARY */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(
                                (a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase()
                            );

                            if (!agent) {
                                return (
                                    <p className="text-center text-sm italic text-muted-foreground">
                                        Agent not found.
                                    </p>
                                );
                            }

                            const agentActivities = filteredHistory.filter(
                                (item) => item.referenceid.toLowerCase() === selectedAgent.toLowerCase()
                            );

                            return <AgentCard
                                agent={agent}
                                agentActivities={agentActivities}
                                referenceid={referenceid}

                            />;
                        })()}

                        {selectedAgent == "all" && (
                            <AgentActivityLogs
                                agents={agents}
                                agentActivityMap={agentActivityMap}
                            />
                        )}

                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent) return null;

                            if (agent.Role === "Territory Sales Manager") {
                                // Do NOT show these cards for TSM role
                                return null;
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* CARD 1 – TOTAL DATABASE */}
                                    <div className="p-6 rounded-lg border border-gray-200 shadow-md bg-white">
                                        <h2 className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-900 border-b pb-2">
                                            <Building2 className="w-5 h-5" />Total Database
                                        </h2>

                                        {loading && (
                                            <p className="text-center text-gray-500 italic">Loading...</p>
                                        )}

                                        {error && (
                                            <p className="text-center text-red-600 font-semibold">{error}</p>
                                        )}

                                        {countData && !loading && !error && countData.totalCount !== null && (
                                            <div className="space-y-3 text-gray-700 text-sm">
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">Total:</span>
                                                    <span>{(countData.totalCount ?? 0).toLocaleString()}</span>
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">Top 50:</span>
                                                    <span>{(countData.top50Count ?? 0).toLocaleString()}</span>
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">Next 30:</span>
                                                    <span>{(countData.next30Count ?? 0).toLocaleString()}</span>
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">Balance 20:</span>
                                                    <span>{(countData.balance20Count ?? 0).toLocaleString()}</span>
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">CSR Client:</span>
                                                    <span>{(countData.csrClientCount ?? 0).toLocaleString()}</span>
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">TSA Client:</span>
                                                    <span>{(countData.tsaClientCount ?? 0).toLocaleString()}</span>
                                                </p>
                                            </div>
                                        )}

                                        {!referenceid && (
                                            <p className="mt-4 text-center text-sm text-gray-400 italic">
                                                Select an agent to see companies count.
                                            </p>
                                        )}
                                    </div>

                                    {/* CARD 2 – NEXT AVAILABLE TODAY */}
                                    <div className="p-6 rounded-lg border border-gray-200 shadow-md bg-white">
                                        <h2 className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-900 border-b pb-2">
                                            <PhoneForwarded className="w-5 h-5" /> OB Calls – Scheduled Accounts For Today
                                        </h2>

                                        <p className="text-2xl font-bold mb-3">{todayNextAvailableCount.toLocaleString()}</p>

                                        <Sheet>
                                            <SheetTrigger asChild>
                                                <Button size="sm" disabled={loadingScheduled}>
                                                    View Accounts
                                                </Button>
                                            </SheetTrigger>

                                            <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-4">
                                                <SheetHeader>
                                                    <SheetTitle>Scheduled Accounts Today</SheetTitle>
                                                </SheetHeader>

                                                {/* Card container with fixed max height and scroll */}
                                                <div className="mt-4 p-4 bg-white rounded-lg shadow-md max-h-[400px] overflow-y-auto custom-scrollbar">
                                                    {loadingScheduled && (
                                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                                    )}

                                                    {!loadingScheduled && scheduledCompanies.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">No scheduled accounts for today.</p>
                                                    )}

                                                    {!loadingScheduled &&
                                                        scheduledCompanies.map((company, idx) => (
                                                            <div key={idx}>
                                                                {company.company_name}
                                                            </div>
                                                        ))}
                                                </div>
                                            </SheetContent>
                                        </Sheet>

                                    </div>
                                </div>
                            );
                        })()}

                        {selectedAgent == "all" && (
                            <AgentMeetings agents={agents} selectedAgent={selectedAgent} />
                        )}

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

                        {/* OTHER CARDS */}
                        <OutboundCard
                            history={filteredHistory}
                            agents={agents}
                        />
                        <InboundRepliesCard
                            history={filteredHistory}
                            agents={agents}
                        />
                    </div>
                </>
            )}
        </main>
    );
}
