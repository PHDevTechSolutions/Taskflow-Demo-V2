"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { AgentCard } from "@/components/agent-list-card";
import { OutboundCard } from "@/components/agent-list-card-outbound";
import { OutboundCallsTableCard } from "@/components/agent-list-card-outbound-calls-table";
import { QuotationTableCard } from "@/components/agent-list-card-quotation-table";
import { SalesOrderTableCard } from "@/components/agent-list-card-sales-order-table";
import { InboundRepliesCard } from "@/components/agent-list-card-inbound-replies";

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

                            return <AgentCard agent={agent} agentActivities={agentActivities} />;
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
