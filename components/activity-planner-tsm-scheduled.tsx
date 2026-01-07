"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { DoneDialog } from "./activity-tsm-done-dialog";
import { supabase } from "@/utils/supabase";
import { type DateRange } from "react-day-picker";

interface Company {
    account_reference_number: string;
    company_name: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
}

interface HistoryItem {
    id: string;
    activity_reference_number: string;
    quotation_number?: string | null;
    quotation_amount?: number | null;
    so_number?: string | null;
    so_amount?: number | null;
    call_type?: string;
    source?: string;
    call_status?: string;
    type_activity: string;
    remarks: string;

    date_followup?: string;
    ticket_reference_number?: string;
    tsm_approved_status: string;
    tsm_approved_date: string;
    account_reference_number?: string;
    date_created?: string;
    date_updated?: string;
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

interface ScheduledProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
    userDetails: UserDetails;
}

export const Scheduled: React.FC<ScheduledProps> = ({
    referenceid,
    dateCreatedFilterRange,
    userDetails
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [doneOpen, setDoneOpen] = useState(false);
    const [selectedActivityRef, setSelectedActivityRef] = useState<string | null>(null);

    const [agents, setAgents] = useState<any[]>([]);
    const [agentFilter, setAgentFilter] = useState("all");

    const fetchAll = useCallback(async () => {
        if (!referenceid) return;
        setLoading(true);
        setError(null);

        try {
            const [c, h] = await Promise.all([
                fetch("/api/com-fetch-companies").then((r) => r.json()),
                fetch(`/api/act-fetch-tsm-history?referenceid=${referenceid}`).then((r) =>
                    r.json()
                ),
            ]);

            setCompanies(c.data || []);
            setHistory(h.activities || []);
        } catch {
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [referenceid]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        if (!referenceid) return;

        const historyChannel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm=eq.${referenceid}`,
                },
                fetchAll
            )
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
        };
    }, [referenceid, fetchAll]);

    const allowedType = [
        "Sent Quotation Standard",
        "Sent Quotation with Special Price",
        "Sent Quotation with SPF",
    ];

    // Filter and map history items directly (no grouping)
    const filteredHistory = history
        .filter((h) => {
            // ✅ allowed call types lang
            if (!allowedType.includes(h.call_type ?? "")) return false;
            return true;
        })
        .map((h) => {
            const company = companies.find(
                (c) => c.account_reference_number === h.account_reference_number
            );

            return {
                ...h,
                company_name: company?.company_name ?? "Unknown",
                contact_number: company?.contact_number ?? "-",
            };
        })
        .filter((item) => {
            const term = search.toLowerCase();

            // 🔍 search filter
            if (
                item.company_name.toLowerCase().includes(term) ||
                item.ticket_reference_number?.toLowerCase().includes(term) ||
                item.quotation_number?.toLowerCase().includes(term) ||
                item.so_number?.toLowerCase().includes(term) ||
                item.remarks?.toLowerCase().includes(term)
            ) {
                return true;
            }

            // 📅 date range filter
            if (dateCreatedFilterRange?.from) {
                if (new Date(item.date_created ?? "") < dateCreatedFilterRange.from)
                    return false;
            }

            if (dateCreatedFilterRange?.to) {
                if (new Date(item.date_created ?? "") > dateCreatedFilterRange.to)
                    return false;
            }

            return false;
        })
        .sort(
            (a, b) =>
                new Date(b.date_updated ?? "").getTime() -
                new Date(a.date_updated ?? "").getTime()
        );

    const openDone = (activityRef: string) => {
        setSelectedActivityRef(activityRef);
        setDoneOpen(true);
    };

    const confirmDone = async (data: {
        tsmapprovedstatus: string;
        tsmapprovedremarks: string;
        tsmapproveddate: string;
    }) => {
        if (!selectedActivityRef) return;

        setUpdatingId(selectedActivityRef);
        setDoneOpen(false);

        try {
            const response = await fetch("/api/act-update-tsm-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activity_reference_number: selectedActivityRef,
                    tsmapprovedstatus: data.tsmapprovedstatus,
                    tsmapprovedremarks: data.tsmapprovedremarks,
                    tsmapproveddate: data.tsmapproveddate,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                toast.error(result.error || "Failed to update");
                setUpdatingId(null);
                return;
            }

            toast.success("Transaction successfully approved");
            setUpdatingId(null);
            setSelectedActivityRef(null);
            fetchAll();
        } catch (err) {
            toast.error("Server error");
            setUpdatingId(null);
        }
    };

    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, dateCreatedFilterRange]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

    const paginatedHistory = filteredHistory.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
                setError("Failed to load agents.");
            }
        };

        fetchAgents();
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "", // use actual key for profile picture
                };
            }
        });
        return map;
    }, [agents]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="text-xs">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <Input
                placeholder="Search company, ticket, quotation, SO..."
                className="text-xs mb-4"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs">Agent</TableHead>
                            <TableHead className="text-xs">Company</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Quotation #</TableHead>
                            <TableHead className="text-xs">Quotation Amount</TableHead>
                            <TableHead className="text-xs">TSA Remarks</TableHead>
                            <TableHead className="text-xs">Feedback</TableHead>
                            <TableHead className="text-xs">Follow-Up Date</TableHead>
                            <TableHead className="text-xs">Approved Date</TableHead>
                            <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {paginatedHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-xs">
                                    No records found
                                </TableCell>
                            </TableRow>
                        )}

                        {paginatedHistory.map((item) => {
                            const agentName =
                                agentMap[item.referenceid?.toLowerCase() ?? ""] || "-";
                            return (
                                <TableRow key={item.id} className="text-xs">
                                    <TableCell className="flex items-center gap-2 capitalize">
                                        {agentMap[item.referenceid?.toLowerCase() ?? ""]?.profilePicture ? (
                                            <img
                                                src={agentMap[item.referenceid?.toLowerCase()]!.profilePicture}
                                                alt={agentMap[item.referenceid?.toLowerCase()]!.name}
                                                className="w-6 h-6 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                N/A
                                            </div>
                                        )}
                                        <span>{agentMap[item.referenceid?.toLowerCase()]?.name || "-"}</span>
                                    </TableCell>
                                    <TableCell className="font-semibold">{item.company_name}</TableCell>
                                    <TableCell><Badge className="text-[10px]">{item.call_type}</Badge></TableCell>
                                    <TableCell>{item.quotation_number ?? "-"}</TableCell>
                                    <TableCell>
                                        {(item.quotation_amount ?? 0).toLocaleString("en-PH", {
                                            style: "currency",
                                            currency: "PHP",
                                        })}
                                    </TableCell>
                                    <TableCell>{item.remarks ?? "-"}</TableCell>
                                    <TableCell>
                                        {item.tsm_approved_status ? (
                                            <Badge
                                                className={
                                                    item.tsm_approved_status.toLowerCase() === "approved"
                                                        ? "bg-green-600 text-white hover:bg-green-600"
                                                        : item.tsm_approved_status.toLowerCase() === "declined"
                                                            ? "bg-red-600 text-white hover:bg-red-600"
                                                            : "bg-gray-400 text-white hover:bg-gray-400"
                                                }
                                            >
                                                {item.tsm_approved_status.toUpperCase()}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">PENDING</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.date_followup
                                            ? new Date(item.date_followup).toLocaleDateString("en-PH", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {item.tsm_approved_date
                                            ? new Date(item.tsm_approved_date).toLocaleDateString("en-PH", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            disabled={updatingId === item.activity_reference_number}
                                            onClick={() => openDone(item.activity_reference_number)}
                                        >
                                            {updatingId === item.activity_reference_number ? "Validating..." : "Validate"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                        }
                    </TableBody>
                </Table>
            </div>

            {/* Pagination controls */}
            <Pagination>
                <PaginationContent className="flex items-center space-x-4">
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                            }}
                            aria-disabled={currentPage <= 1}
                            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>

                    {/* Current page / total pages */}
                    <div className="px-4 font-medium">
                        {totalPages === 0 ? "0 / 0" : `${currentPage} / ${totalPages}`}
                    </div>

                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                            }}
                            aria-disabled={currentPage >= totalPages}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

            <DoneDialog
                open={doneOpen}
                onOpenChange={setDoneOpen}
                onConfirm={confirmDone}
                loading={updatingId !== null}
            />
        </>
    );
};
