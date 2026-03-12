"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";

interface CallHistory {
    id: number;
    source?: string;
    status?: string;
    date_created?: string;
    referenceid: string;
    target_quota: string;
    dr_number?: string;
    si_date?: string;
    actual_sales?: number;
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

export const Summary: React.FC<CallQuoteProps> = ({
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

        const filteredActivities = activitiesFilteredByMonth.filter((a) => a.referenceid.toLowerCase() === refId);
        const totalCalls = filteredActivities.filter((a) => a.source === "Outbound - Touchbase").length;
        const totalQuotes = filteredActivities.filter((a) => a.status === "Quote-Done").length;
        const totalSO = filteredActivities.filter((a) => a.status === "SO-Done").length;

        const percentageCallsToQuote = totalCalls === 0 ? 0 : (totalQuotes / totalCalls) * 100;
        const percentageQuoteToSO = totalQuotes === 0 ? 0 : (totalSO / totalQuotes) * 100;

        const filteredSI = filteredActivities.filter((a) => a.si_date && Number(a.actual_sales) > 0 && getYearMonth(a.si_date) === selectedMonth);
        const uniqueSIDates = new Set(filteredSI.map((a) => a.si_date));
        const totalSI = uniqueSIDates.size;

        const percentageSOToSI = totalSI === 0 ? 0 : (totalSI / totalSO) * 100;
        const percentageCallsToSI = totalSI === 0 ? 0 : (totalSI / totalCalls) * 100;


        return {
            agentName: `${agent.Firstname} ${agent.Lastname}`,
            profilePicture: agent.profilePicture || "/Taskflow.png",
            target_quota: agent.TargetQuota || "0", // <-- now correctly using fetched agent data
            totalCalls,
            totalQuotes,
            percentageCallsToQuote,
            totalSO,
            percentageQuoteToSO,
            totalSI,
            percentageSOToSI,
            percentageCallsToSI,
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

    const overallPercentage = totals.totalCalls === 0 ? 0 : (totals.totalQuotes / totals.totalCalls) * 100;

    const totalQuotesAll = rows.reduce((sum, r) => sum + r.totalQuotes, 0);
    const totalSOAll = rows.reduce((sum, r) => sum + r.totalSO, 0);
    const totalPercentageAll = totalQuotesAll === 0 ? 0 : (totalSOAll / totalQuotesAll) * 100;

    const totalSIAll = rows.reduce((sum, r) => sum + r.totalSI, 0);
    const totalPercentageSI = rows.length === 0 ? 0 : rows.reduce((sum, r) => sum + r.percentageSOToSI, 0) / rows.length;


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
            </div>

            {/* Conditionally render message or table */}
            {filteredAgents.length === 0 ? (
                <div className="text-center text-xs text-gray-500">No agents found.</div>
            ) : (
                <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2 font-mono">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs whitespace-normal break-words font-bold">Agent</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r font-bold">Target Quota</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r bg-orange-100 font-bold">Total Calls (Outbound - Touchbase)</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r bg-blue-100 font-bold">Total Quote</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r font-bold">Percentage of Calls → Quote</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r bg-yellow-100 font-bold">Total SO</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r font-bold">Percentage of Quote → SO</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r bg-green-100 font-bold">Total SI</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words border-r font-bold">Percentage of SO → SI</TableHead>
                                <TableHead className="text-xs text-right whitespace-normal break-words font-bold">Percentage of Calls → SI</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {rows.map((row, idx) => (
                                <TableRow key={idx} className="text-xs">
                                    <TableCell>
                                        <div className="flex items-center gap-2 ">
                                            <img
                                                src={row.profilePicture}
                                                alt={row.agentName}
                                                className="h-8 w-8 rounded-full object-cover border"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = "/avatar-placeholder.png";
                                                }}
                                            />
                                            <span className="uppercase">{row.agentName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right border-r">
                                        {row.target_quota && row.target_quota !== "0"
                                            ? Number(row.target_quota).toLocaleString()
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right border-r bg-orange-100">{row.totalCalls}</TableCell>
                                    <TableCell className="text-right border-r bg-blue-100">{row.totalQuotes}</TableCell>
                                    <TableCell className="text-right border-r">{row.percentageCallsToQuote.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right border-r bg-yellow-100">{row.totalSO}</TableCell>
                                    <TableCell className="text-right border-r">{row.percentageQuoteToSO.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right border-r bg-green-100">{row.totalSI}</TableCell>
                                    <TableCell className="text-right border-r">{row.percentageSOToSI.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right">{row.percentageCallsToSI.toFixed(2)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>

                        <tfoot>
                            <TableRow className="font-semibold bg-gray-100 text-xs">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right border-r">{totals.targetQuota.toLocaleString()}</TableCell>
                                <TableCell className="text-right border-r bg-orange-100">{totals.totalCalls}</TableCell>
                                <TableCell className="text-right border-r bg-blue-100">{totals.totalQuotes}</TableCell>
                                <TableCell className="text-right border-r">{overallPercentage.toFixed(2)}%</TableCell>
                                <TableCell className="text-right border-r bg-yellow-100">{totalSOAll}</TableCell>
                                <TableCell className="text-right border-r">{totalPercentageAll.toFixed(2)}%</TableCell>
                                <TableCell className="text-right border-r bg-green-100">{totalSIAll}</TableCell>
                                <TableCell className="text-right border-r">{totalPercentageSI.toFixed(2)}%</TableCell>
                                <TableCell className="text-right">
                                    {(() => {
                                        const totalCalls = rows.reduce((acc, row) => acc + row.totalCalls, 0);
                                        const totalSI = rows.reduce((acc, row) => acc + row.totalSI, 0);
                                        return totalSI === 0 ? "0.00%" : ((totalCalls / totalSI) * 100).toFixed(2) + "%";
                                    })()}
                                </TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default Summary;
