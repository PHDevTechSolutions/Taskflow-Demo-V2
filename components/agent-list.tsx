"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from "@/components/ui/item";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { OutboundCard } from "@/components/agent-list-card-outbound";
import { InboundRepliesCard } from "@/components/agent-list-card-inbound-replies";
import { OtherActivitiesCard } from "@/components/agent-list-card-others-activities";

interface HistoryItem {
    referenceid: string;
    tsm: string;
    source: string;
    call_status: string;
    type_activity: string;
    start_date: string;
    end_date: string;
    date_created: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
}

interface Props {
    referenceid: string; // from props (parent)
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export function AgentList({
    referenceid,
    dateCreatedFilterRange,
}: Props) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [errorHistory, setErrorHistory] = useState<string | null>(null);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    // Fetch agents
    useEffect(() => {
        if (!referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(
                    `/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`
                );
                if (!response.ok) throw new Error("Failed to fetch agents");

                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error("Error fetching agents:", err);
                setErrorHistory("Failed to load agents.");
            }
        };

        fetchAgents();
    }, [referenceid]);

    // Fetch history for referenceid
    useEffect(() => {
        if (!referenceid) return;

        const fetchHistoryByReference = async () => {
            setLoadingHistory(true);
            setErrorHistory(null);

            try {
                const res = await fetch(
                    `/api/all-agent-history?referenceid=${encodeURIComponent(referenceid)}`
                );

                if (!res.ok) {
                    throw new Error("Failed to fetch history data");
                }

                const data = await res.json();
                setHistory(data.activities ?? []);
            } catch (err: any) {
                setErrorHistory(err.message);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchHistoryByReference();
    }, [referenceid]);

    // Filter history by selected agent, or show all if "all"
    const filteredHistory = useMemo(() => {
        if (selectedAgent === "all") {
            return history;
        }
        // Filter where tsm matches selected agent ReferenceID
        return history.filter((item) => item.referenceid.toLowerCase() === selectedAgent.toLowerCase());
    }, [history, selectedAgent]);

    function formatDurationMs(ms: number) {
        if (ms <= 0) return "-";

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
        if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
        if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

        return parts.join(" ") || "0 sec";
    }

    // Helper: calculate average duration in ms for given filtered items
    function averageDurationMs(items: HistoryItem[]) {
        if (items.length === 0) return 0;

        const totalMs = items.reduce((acc, curr) => {
            const start = new Date(curr.start_date).getTime();
            const end = new Date(curr.end_date).getTime();
            if (!isNaN(start) && !isNaN(end) && end > start) {
                return acc + (end - start);
            }
            return acc;
        }, 0);

        return totalMs / items.length;
    }

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingHistory ? (
                <div className="text-center py-10">Loading history data...</div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10">{errorHistory}</div>
            ) : (
                <>
                    {/* Filter Select */}
                    <Select
                        value={selectedAgent}
                        onValueChange={(value) => setSelectedAgent(value)}
                    >
                        <SelectTrigger className="w-[220px] text-xs">
                            <SelectValue placeholder="Filter by Agent" />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="all">All Agents</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem
                                    className="capitalize"
                                    key={agent.ReferenceID}
                                    value={agent.ReferenceID}
                                >
                                    {agent.Firstname} {agent.Lastname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                        {/* CARD 1 */}
                        <OutboundCard history={filteredHistory} />

                        {/* CARD 2 */}
                        <InboundRepliesCard history={filteredHistory} />

                        {/* CARD 3 */}
                        <OtherActivitiesCard history={filteredHistory} />

                        {/* CARD 4 */}
                        <Card className="min-h-[160px] flex items-center justify-center text-muted-foreground">
                            Empty Card
                        </Card>
                    </div>
                </>
            )}
        </main>
    );
}
