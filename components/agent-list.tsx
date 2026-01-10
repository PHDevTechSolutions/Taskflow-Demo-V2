"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";

import { AgentCard } from "@/components/agent-list-card";
import { AgentActivityLogs } from "@/components/agent-list-card-activity-logs";
import { AgentMeetings } from "@/components/agent-list-card-meetings";
import { OutboundCard } from "@/components/agent-list-card-outbound";
import { OutboundCallsTableCard } from "@/components/agent-list-card-outbound-calls-table";
import { QuotationTableCard } from "@/components/agent-list-card-quotation-table";
import { SalesOrderTableCard } from "@/components/agent-list-card-sales-order-table";
import { InboundRepliesCard } from "@/components/agent-list-card-inbound-replies";

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
}

interface AgentMeeting {
    start_date?: string | null;
    end_date?: string | null;
    remarks?: string | null;
    type_activity?: string | null;
    date_created?: string | null;
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
        if (!referenceid) return;

        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch agents");
                return res.json();
            })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, [referenceid]);

    /* =========================
       FETCH HISTORY
    ========================= */
    useEffect(() => {
        if (!referenceid) return;

        setLoadingHistory(true);
        fetch(`/api/all-agent-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch history");
                return res.json();
            })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, [referenceid]);

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


    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingHistory ? (
                <div className="text-center py-10">Loading history data...</div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10">{errorHistory}</div>
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
                                <SelectItem
                                    key={agent.ReferenceID}
                                    value={agent.ReferenceID}
                                >
                                    {agent.Firstname} {agent.Lastname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

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

                        <AgentMeetings
                            agents={agents}
                            agentMeetingMap={agentMeetingMap}
                            formatDate={formatDate} // if you use formatDate inside the component
                        />

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
