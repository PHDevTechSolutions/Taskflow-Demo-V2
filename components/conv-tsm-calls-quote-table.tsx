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

interface CallHistory {
    id: number;
    source?: string;
    status?: string;
    date_created?: string;
    referenceid: string;
    target_quota: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;
    profilePicture: string;
}

interface CallQuoteProps {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
    userDetails: UserDetails;
}

export const CallQuote: React.FC<CallQuoteProps> = ({
    referenceid,
    dateCreatedFilterRange,
    userDetails,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<CallHistory[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    // Convert date string to "YYYY-MM"
    const getYearMonth = (dateStr?: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    // Derive selectedMonth from external filter or default to current month
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

        fetch(`/api/act-fetch-tsm-history?referenceid=${encodeURIComponent(referenceid)}`)
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
            .channel(`public:history:tsm=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as CallHistory;
                    const oldRecord = payload.old as CallHistory;

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

    // Generate last 12 months for dropdown
    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            options.push({
                value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: d.toLocaleString("default", { year: "numeric", month: "long" }),
            });
        }
        return options;
    }, []);

    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = `${agent.Firstname} ${agent.Lastname}`;
            }
        });
        return map;
    }, [agents]);

    useEffect(() => {
        if (!userDetails.referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(
                    `/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
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

    // Memo for activities filtered by month
    const activitiesFilteredByMonth = useMemo(() => {
        return activities.filter((a) => getYearMonth(a.date_created) === selectedMonth);
    }, [activities, selectedMonth]);

    // Filter agents for rows
    const filteredAgents =
        selectedAgent === "all"
            ? agents
            : agents.filter((agent) => agent.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());

    // For each agent, calculate metrics
    const rows = filteredAgents.map((agent) => {
        const refId = agent.ReferenceID.toLowerCase();

        const filteredActivities = activitiesFilteredByMonth.filter(
            (a) => a.referenceid.toLowerCase() === refId
        );

        // Get latest target_quota from filteredActivities (by date_created desc)
        const sortedByDate = [...filteredActivities].sort((a, b) => {
            const da = a.date_created ? new Date(a.date_created).getTime() : 0;
            const db = b.date_created ? new Date(b.date_created).getTime() : 0;
            return db - da; // descending
        });

        const target_quota = sortedByDate.length > 0 ? sortedByDate[0].target_quota : "0";

        const totalCalls = filteredActivities.filter(
            (a) => a.source === "Outbound - Touchbase"
        ).length;

        const totalQuotes = filteredActivities.filter((a) => a.status === "Quote-Done").length;

        const percentageCallsToQuote = totalCalls === 0 ? 0 : (totalQuotes / totalCalls) * 100;

        return {
            agentName: `${agent.Firstname} ${agent.Lastname}`,
            profilePicture: agent.profilePicture || "/Taskflow.png",
            target_quota,
            totalCalls,
            totalQuotes,
            percentageCallsToQuote,
        };
    });

    // Compute totals
    const totals = rows.reduce(
        (acc, row) => {
            const targetQuotaNum = parseFloat(row.target_quota);
            return {
                targetQuota: !isNaN(targetQuotaNum) ? acc.targetQuota + targetQuotaNum : acc.targetQuota,
                totalCalls: acc.totalCalls + row.totalCalls,
                totalQuotes: acc.totalQuotes + row.totalQuotes,
            };
        },
        { targetQuota: 0, totalCalls: 0, totalQuotes: 0 }
    );

    const overallPercentage =
        totals.totalCalls === 0 ? 0 : (totals.totalQuotes / totals.totalCalls) * 100;


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
            {/* Filter & Info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Select
                    value={selectedAgent}
                    onValueChange={(value) => {
                        setSelectedAgent(value);
                    }}
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

                <div className="text-xs text-muted-foreground">
                    Data for:{" "}
                    <span className="font-medium">
                        {monthOptions.find((opt) => opt.value === selectedMonth)?.label || selectedMonth}
                    </span>
                </div>
            </div>

            {/* Conditionally render message or table */}
            {filteredAgents.length === 0 ? (
                <div className="text-center text-xs text-gray-500">No agents found.</div>
            ) : (
                <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Agent</TableHead>
                                <TableHead className="text-xs text-right">Target Quota</TableHead>
                                <TableHead className="text-xs text-right">No. of Calls</TableHead>
                                <TableHead className="text-xs text-right">Total Number of Quotes</TableHead>
                                <TableHead className="text-xs text-right">Percentage of Calls to Quote</TableHead>
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
                                    <TableCell className="text-right">{row.totalCalls}</TableCell>
                                    <TableCell className="text-right">{row.totalQuotes}</TableCell>
                                    <TableCell className="text-right">{row.percentageCallsToQuote.toFixed(2)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <tfoot>
                            <TableRow className="font-semibold bg-gray-100">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">{totals.targetQuota.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{totals.totalCalls}</TableCell>
                                <TableCell className="text-right">{totals.totalQuotes}</TableCell>
                                <TableCell className="text-right">{overallPercentage.toFixed(2)}%</TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                </div>
            )}

            {/* Computation Explanation */}
            <div className="mt-4 text-xs text-gray-700">
                <p>
                    <strong>Percentage of Calls to Quote:</strong> This represents the ratio
                    of successful quotes to total outbound calls. Calculated as:
                </p>
                <p className="bg-gray-100 p-2 rounded">
                    Percentage of Calls to Quote = (Total Number of Quotes ÷ No. of Calls) × 100%
                </p>
            </div>
        </div>
    );
};

export default CallQuote;
