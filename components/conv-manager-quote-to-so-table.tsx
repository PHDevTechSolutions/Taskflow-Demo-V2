"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface QuoteHistory {
    id: number;
    source?: string;
    status?: string;
    date_created?: string;
    target_quota: string;
    referenceid: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;
    profilePicture: string;
}

interface QuoteSOProps {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
    userDetails: UserDetails;
}

export const QuoteSO: React.FC<QuoteSOProps> = ({
    referenceid,
    dateCreatedFilterRange,
    userDetails,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<QuoteHistory[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    const getYearMonth = (dateStr?: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const selectedMonth = useMemo(() => {
        if (!dateCreatedFilterRange?.from) {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        }
        return `${dateCreatedFilterRange.from.getFullYear()}-${String(
            dateCreatedFilterRange.from.getMonth() + 1
        ).padStart(2, "0")}`;
    }, [dateCreatedFilterRange]);

    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/act-fetch-manager-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    useEffect(() => {
        void fetchActivities();

        if (!referenceid) return;

        const channel = supabase
            .channel(`public:history:manager=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `manager=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as QuoteHistory;
                    const oldRecord = payload.old as QuoteHistory;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;

                            case "UPDATE":
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));

                            case "DELETE":
                                return curr.filter((a) => a.id !== oldRecord.id);

                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    useEffect(() => {
        if (!userDetails.referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(
                    `/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
                );
                if (!response.ok) throw new Error("Failed to fetch agents");

                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error("Error fetching agents:", err);
                setErrorActivities("Failed to load agents.");
            }
        };

        fetchAgents();
    }, [userDetails.referenceid]);

    const activitiesFilteredByMonth = useMemo(() => {
        return activities.filter((a) => getYearMonth(a.date_created) === selectedMonth);
    }, [activities, selectedMonth]);

    const filteredAgents =
        selectedAgent === "all"
            ? agents
            : agents.filter((agent) => agent.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());

    const rows = filteredAgents.map((agent) => {
        const refId = agent.ReferenceID.toLowerCase();

        const filteredActivities = activitiesFilteredByMonth.filter(
            (a) => a.referenceid.toLowerCase() === refId
        );

        const sortedByDate = [...filteredActivities].sort((a, b) => {
            const da = a.date_created ? new Date(a.date_created).getTime() : 0;
            const db = b.date_created ? new Date(b.date_created).getTime() : 0;
            return db - da;
        });

        const target_quota = sortedByDate.length > 0 ? sortedByDate[0].target_quota : "0";

        const totalQuotes = filteredActivities.filter((a) => a.status === "Quote-Done").length;
        const totalSO = filteredActivities.filter((a) => a.status === "SO-Done").length;

        const percentageQuoteToSO = totalQuotes === 0 ? 0 : (totalSO / totalQuotes) * 100;

        return {
            agentName: `${agent.Firstname} ${agent.Lastname}`,
            profilePicture: agent.profilePicture || "/Taskflow.png",
            target_quota,
            totalQuotes,
            totalSO,
            percentageQuoteToSO,
        };
    });

    // Calculate totals for footer
    const totalQuota = rows.reduce((sum, r) => sum + Number(r.target_quota), 0);
    const totalQuotesAll = rows.reduce((sum, r) => sum + r.totalQuotes, 0);
    const totalSOAll = rows.reduce((sum, r) => sum + r.totalSO, 0);
    const totalPercentageAll = totalQuotesAll === 0 ? 0 : (totalSOAll / totalQuotesAll) * 100;

    if (loadingActivities) {
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (errorActivities) {
        return (
            <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                <AlertCircleIcon className="h-6 w-6 text-red-600" />
                <div>
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{errorActivities}</AlertDescription>
                </div>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filter and month info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

                <div className="text-xs text-muted-foreground">
                    Data for:{" "}
                    <span className="font-medium">{selectedMonth}</span>
                </div>
            </div>

            {filteredAgents.length === 0 ? (
                <div className="text-center text-xs text-gray-500">No agents found.</div>
            ) : (
                <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Agent</TableHead>
                                <TableHead className="text-xs text-right">Target Quota</TableHead>
                                <TableHead className="text-xs text-right">Total No. of Quotes</TableHead>
                                <TableHead className="text-xs text-right">Total No. of SO</TableHead>
                                <TableHead className="text-xs text-right">Percentage of Quote to SO</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={row.profilePicture}
                                                alt={row.agentName}
                                                className="h-8 w-8 rounded-full object-cover border"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = "/avatar-placeholder.png";
                                                }}
                                            />
                                            <span className="capitalize text-sm">{row.agentName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{row.target_quota}</TableCell>
                                    <TableCell className="text-right">{row.totalQuotes}</TableCell>
                                    <TableCell className="text-right">{row.totalSO}</TableCell>
                                    <TableCell className="text-right">{row.percentageQuoteToSO.toFixed(2)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <tfoot>
                            <TableRow className="font-semibold bg-gray-100">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">{totalQuota.toFixed(0)}</TableCell>
                                <TableCell className="text-right">{totalQuotesAll}</TableCell>
                                <TableCell className="text-right">{totalSOAll}</TableCell>
                                <TableCell className="text-right">{totalPercentageAll.toFixed(2)}%</TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                </div>
            )}

            {/* Computation Explanation */}
            <div className="mt-4 text-xs text-gray-700">
                <p>The numbers represent counts of quotes and sales orders completed, based on their status.</p>
                <p>
                    <strong>Number of Quotes:</strong> Counts all activities with status <code>Quote-Done</code>.
                </p>
                <p>
                    <strong>Number of SO:</strong> Counts all activities with status <code>SO-Done</code>.
                </p>
                <p className="bg-gray-100 p-2 rounded">
                    Percentage of Quote to SO: Calculated as (Number of SO ÷ Number of Quotes) × 100.
                </p>
                <p>Data filtered by selected month from dropdown.</p>
            </div>
        </div>
    );
};

export default QuoteSO;
