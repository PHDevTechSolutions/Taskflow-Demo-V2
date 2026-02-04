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

/* ================= TYPES ================= */

interface Quotation {
    id: number;
    quotation_number?: string;
    quotation_amount?: number;
    remarks?: string;
    date_created: string;
    date_updated?: string;

    company_name?: string;
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

interface Props {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
    userDetails: UserDetails;
}

const PAGE_SIZE = 10;

/* ================= COMPONENT ================= */

export const QuotationTable: React.FC<Props> = ({
    referenceid,
    dateCreatedFilterRange,
    userDetails,
}) => {
    const [activities, setActivities] = useState<Quotation[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);

    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState("all");

    /* ================= FETCH ACTIVITIES ================= */

    const fetchActivities = useCallback(() => {
        if (!referenceid) return;

        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(
            `/api/act-fetch-manager-history?referenceid=${encodeURIComponent(
                referenceid
            )}`
        )
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    /* ================= REALTIME ================= */

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
                    const next = payload.new as Quotation;
                    const prev = payload.old as Quotation;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                return curr.some((a) => a.id === next.id)
                                    ? curr
                                    : [...curr, next];
                            case "UPDATE":
                                return curr.map((a) => (a.id === next.id ? next : a));
                            case "DELETE":
                                return curr.filter((a) => a.id !== prev.id);
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

    /* ================= AGENTS ================= */

    useEffect(() => {
        if (!userDetails.referenceid) return;

        fetch(
            `/api/fetch-manager-all-user?id=${encodeURIComponent(
                userDetails.referenceid
            )}`
        )
            .then((res) => res.json())
            .then(setAgents)
            .catch(() => setErrorActivities("Failed to load agents"));
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((a) => {
            map[a.ReferenceID] = {
                name: `${a.Firstname} ${a.Lastname}`,
                profilePicture: a.profilePicture || "",
            };
        });
        return map;
    }, [agents]);

    /* ================= FILTER ================= */

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return activities
            .filter(
                (a) => a.type_activity?.toLowerCase() === "quotation preparation"
            )
            .filter((a) => {
                if (!search) return true;
                return (
                    a.company_name?.toLowerCase().includes(search) ||
                    a.quotation_number?.toLowerCase().includes(search) ||
                    a.remarks?.toLowerCase().includes(search)
                );
            })
            .filter((a) => filterStatus === "all" || a.status === filterStatus)
            .filter((a) => selectedAgent === "all" || a.referenceid === selectedAgent)
            .filter((a) => {
                if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to)
                    return true;

                const date = new Date(a.date_updated ?? a.date_created);
                if (isNaN(date.getTime())) return false;

                const from = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const to = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                if (from) from.setHours(0, 0, 0, 0);
                if (to) to.setHours(23, 59, 59, 999);

                if (from && date < from) return false;
                if (to && date > to) return false;
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

    useEffect(() => setPage(1), [
        searchTerm,
        filterStatus,
        selectedAgent,
        dateCreatedFilterRange,
    ]);

    /* ================= PAGINATION ================= */

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginated = filteredActivities.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const totalAmount = filteredActivities.reduce(
        (sum, a) => sum + (a.quotation_amount ?? 0),
        0
    );

    /* ================= UI ================= */

    if (loadingActivities)
        return (
            <div className="flex justify-center py-10">
                <Spinner className="size-8" />
            </div>
        );

    if (errorActivities)
        return (
            <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorActivities}</AlertDescription>
            </Alert>
        );

    return (
        <>
            {/* SEARCH & FILTER */}
            <div className="flex flex-wrap gap-4 mb-4">
                <Input
                    placeholder="Search company or remarks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
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

            {/* TABLE */}
            <div className="overflow-auto border rounded-md p-3">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Quotation #</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Remarks</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="flex items-center gap-2 capitalize">
                                    {agentMap[item.referenceid]?.profilePicture ? (
                                        <img
                                            src={agentMap[item.referenceid].profilePicture}
                                            alt={agentMap[item.referenceid].name}
                                            className="w-6 h-6 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                            N/A
                                        </div>
                                    )}
                                    <span>{agentMap[item.referenceid]?.name || "-"}</span>
                                </TableCell>

                                <TableCell>
                                    {new Date(item.date_created).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{item.quotation_number || "-"}</TableCell>
                                <TableCell className="text-right">
                                    {item.quotation_amount?.toLocaleString("en-PH", {
                                        style: "currency",
                                        currency: "PHP",
                                    }) || "-"}
                                </TableCell>
                                <TableCell>{item.company_name || "-"}</TableCell>
                                <TableCell>{item.contact_number || "-"}</TableCell>
                                <TableCell className="italic">{item.remarks || "-"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* FOOTER */}
            <div className="mt-2 text-xs font-semibold">
                Total Amount:{" "}
                {totalAmount.toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                })}
            </div>

            {pageCount > 1 && (
                <Pagination className="mt-4">
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={() => page > 1 && setPage(page - 1)}
                            />
                        </PaginationItem>
                        <span className="px-3 text-xs">
                            {page} / {pageCount}
                        </span>
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={() => page < pageCount && setPage(page + 1)}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </>
    );
};
