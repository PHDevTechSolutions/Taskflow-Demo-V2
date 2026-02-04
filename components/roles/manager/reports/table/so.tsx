"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SO {
    id: number;
    so_number?: string;
    so_amount?: number;
    remarks?: string;
    date_created: string;
    date_updated?: string;
    company_name?: string;
    contact_person?: string;
    contact_number?: string;
    type_activity: string;
    status: string;
    referenceid: string;
}

interface UserDetails {
    referenceid: string;
    firstname: string;
    lastname: string;
    profilePicture: string;
}

interface SOProps {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
    userDetails: UserDetails;
}

const PAGE_SIZE = 10;

export const SOTable: React.FC<SOProps> = ({
    referenceid,
    dateCreatedFilterRange,
    userDetails,
}) => {
    const [activities, setActivities] = useState<SO[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);

    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState("all");

    // ================= FETCH ACTIVITIES =================
    const fetchActivities = useCallback(() => {
        if (!referenceid) return;

        setLoading(true);
        setError(null);

        fetch(
            `/api/act-fetch-manager-history?referenceid=${encodeURIComponent(
                referenceid
            )}`
        )
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [referenceid]);

    // ================= REALTIME =================
    useEffect(() => {
        fetchActivities();
        if (!referenceid) return;

        const channel = supabase
            .channel(`history-manager-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `manager=eq.${referenceid}`,
                },
                (payload) => {
                    setActivities((curr) => {
                        const next = payload.new as SO;
                        const prev = payload.old as SO;

                        if (payload.eventType === "INSERT")
                            return curr.some((a) => a.id === next.id)
                                ? curr
                                : [...curr, next];

                        if (payload.eventType === "UPDATE")
                            return curr.map((a) => (a.id === next.id ? next : a));

                        if (payload.eventType === "DELETE")
                            return curr.filter((a) => a.id !== prev.id);

                        return curr;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    // ================= AGENTS =================
    useEffect(() => {
        if (!userDetails.referenceid) return;

        fetch(
            `/api/fetch-manager-all-user?id=${encodeURIComponent(
                userDetails.referenceid
            )}`
        )
            .then((res) => res.json())
            .then(setAgents)
            .catch(() => setError("Failed to load agents"));
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((a) => {
            map[a.ReferenceID?.toLowerCase()] = {
                name: `${a.Firstname} ${a.Lastname}`,
                profilePicture: a.profilePicture || "",
            };
        });
        return map;
    }, [agents]);

    // ================= FILTER =================
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return activities
            .filter(
                (a) =>
                    a.type_activity?.toLowerCase() === "sales order preparation"
            )
            .filter((a) => {
                if (!search) return true;
                return (
                    a.company_name?.toLowerCase().includes(search) ||
                    a.so_number?.toLowerCase().includes(search) ||
                    a.remarks?.toLowerCase().includes(search)
                );
            })
            .filter((a) => filterStatus === "all" || a.status === filterStatus)
            .filter((a) => selectedAgent === "all" || a.referenceid === selectedAgent)
            .filter((a) => {
                if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to)
                    return true;

                const d = new Date(a.date_updated ?? a.date_created);
                if (isNaN(d.getTime())) return false;

                const from = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const to = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            })
            .sort(
                (a, b) =>
                    new Date(b.date_updated ?? b.date_created).getTime() -
                    new Date(a.date_updated ?? a.date_created).getTime()
            );
    }, [
        activities,
        searchTerm,
        filterStatus,
        selectedAgent,
        dateCreatedFilterRange,
    ]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterStatus, selectedAgent, dateCreatedFilterRange]);

    // ================= TOTALS =================
    const totalSOAmount = useMemo(
        () =>
            filteredActivities.reduce(
                (acc, i) => acc + (i.so_amount ?? 0),
                0
            ),
        [filteredActivities]
    );

    const uniqueSOCount = useMemo(() => {
        const s = new Set<string>();
        filteredActivities.forEach((i) => i.so_number && s.add(i.so_number));
        return s.size;
    }, [filteredActivities]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = filteredActivities.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    // ================= UI =================
    return (
        <>
            {/* SEARCH + FILTER */}
            <div className="mb-4 flex gap-4">
                <Input
                    placeholder="Search company or remarks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger className="w-[220px] text-xs">
                        <SelectValue placeholder="Filter by Agent" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {agents.map((a) => (
                            <SelectItem key={a.ReferenceID} value={a.ReferenceID}>
                                {a.Firstname} {a.Lastname}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {loading && (
                <div className="flex justify-center h-40">
                    <Spinner />
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Total Activities: {filteredActivities.length} | Unique SO:{" "}
                    {uniqueSOCount}
                </div>
            )}

            {/* TABLE */}
            <div className="overflow-auto rounded-md border p-4 font-mono">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Remarks</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedActivities.map((i) => (
                            <TableRow key={i.id}>
                                <TableCell className="flex gap-2">
                                    {agentMap[i.referenceid?.toLowerCase()]?.profilePicture ? (
                                        <img
                                            src={
                                                agentMap[i.referenceid.toLowerCase()].profilePicture
                                            }
                                            className="w-6 h-6 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 bg-gray-300 rounded-full text-xs flex items-center justify-center">
                                            N/A
                                        </div>
                                    )}
                                    {agentMap[i.referenceid?.toLowerCase()]?.name || "-"}
                                </TableCell>
                                <TableCell>
                                    {new Date(i.date_created).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    {i.so_amount?.toLocaleString("en-PH", {
                                        style: "currency",
                                        currency: "PHP",
                                    })}
                                </TableCell>
                                <TableCell>{i.company_name}</TableCell>
                                <TableCell>{i.contact_person}</TableCell>
                                <TableCell>{i.contact_number}</TableCell>
                                <TableCell className="italic">{i.remarks}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {filteredActivities.length > 0 && (
                <div className="mt-2 text-xs font-semibold">
                    Total Amount:{" "}
                    {totalSOAmount.toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                    })}
                </div>
            )}

            {pageCount > 1 && (
                <Pagination>
                    <PaginationContent className="justify-center mt-4">
                        <PaginationPrevious
                            onClick={() => page > 1 && setPage(page - 1)}
                        />
                        <span className="px-4">
                            {page} / {pageCount}
                        </span>
                        <PaginationNext
                            onClick={() => page < pageCount && setPage(page + 1)}
                        />
                    </PaginationContent>
                </Pagination>
            )}
        </>
    );
};
