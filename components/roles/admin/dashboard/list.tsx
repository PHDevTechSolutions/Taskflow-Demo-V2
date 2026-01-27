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

import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    where,
    Timestamp,
    onSnapshot,
    QuerySnapshot,
    DocumentData,
    limit
} from "firebase/firestore";

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
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
    Position: string;
    Status: string;
    Role: string;
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

    const [count, setCount] = useState<number | null>(null);
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

    // Fetch Meetings
    useEffect(() => {
        if (!agents.length) return;

        // clear old data
        setAgentMeetingMap({});

        const unsubscribes: (() => void)[] = [];

        const agentsToWatch =
            selectedAgent === "all"
                ? agents
                : agents.filter(a => a.ReferenceID === selectedAgent);

        agentsToWatch.forEach((agent) => {
            const q = query(
                collection(db, "meetings"),
                where("referenceid", "==", agent.ReferenceID),
                orderBy("date_created", "desc"),
                limit(1) // 🔑 latest meeting lang
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    setAgentMeetingMap(prev => ({
                        ...prev,
                        [agent.ReferenceID]: {
                            start_date: null,
                            end_date: null,
                            remarks: null,
                            type_activity: null,
                            date_created: null
                        },
                    }));
                    return;
                }

                const data = snapshot.docs[0].data();

                const formatDate = (d: any) => {
                    if (!d) return null;
                    if (d.toDate) return d.toDate().toLocaleString();
                    if (typeof d === "string") return new Date(d).toLocaleString();
                    return null;
                };

                setAgentMeetingMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        start_date: formatDate(data.start_date),
                        end_date: formatDate(data.end_date),
                        remarks: data.remarks ?? "—",
                        type_activity: data.type_activity ?? "—",
                        date_created: data.date_created ?? "—",
                    },
                }));
            });

            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach(u => u());
    }, [selectedAgent, agents]);

    useEffect(() => {
        // kapag ALL agents, walang count
        if (selectedAgent === "all") {
            setCount(null);
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
                setCount(data.count);
            })
            .catch((err) => {
                setError(err.message);
                setCount(null);
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

                        {selectedAgent !== "all" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* CARD 1 – TOTAL DATABASE */}
                                <div className="p-4 rounded-lg border shadow-sm bg-white">
                                    <h2 className="text-lg font-semibold mb-2">
                                        Total Database
                                    </h2>

                                    {loading && <p>Loading...</p>}
                                    {error && <p className="text-red-500">Error: {error}</p>}
                                    {count !== null && !loading && !error && (
                                        <p className="text-2xl font-bold">
                                            {count.toLocaleString()}
                                        </p>
                                    )}

                                    {!referenceid && (
                                        <p className="text-sm text-muted-foreground">
                                            Select an agent to see companies count.
                                        </p>
                                    )}
                                </div>

                                {/* CARD 2 – NEXT AVAILABLE TODAY */}
                                <div className="p-4 rounded-lg border shadow-sm bg-white">
                                    <h2 className="text-lg font-semibold mb-2">OB Calls – Scheduled Accounts For Today</h2>

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
                        )}

                        {selectedAgent == "all" && (
                            <AgentMeetings
                                agents={agents}
                                agentMeetingMap={agentMeetingMap}
                                formatDate={formatDate} // if you use formatDate inside the component
                            />
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
