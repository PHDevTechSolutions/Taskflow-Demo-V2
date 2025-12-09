"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, } from "@/components/ui/pagination";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    contact_person?: string;
    type_client?: string;
}

interface SO {
    id: number;
    so_number?: string;
    so_amount?: number;
    remarks?: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    company_name?: string;
    contact_number?: string;
    type_activity: string;
    status: string;
}

interface SOProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

const PAGE_SIZE = 10;

export const SOTable: React.FC<SOProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<SO[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Pagination state
    const [page, setPage] = useState(1);

    // Fetch companies
    useEffect(() => {
        if (!referenceid) {
            setCompanies([]);
            return;
        }
        setLoadingCompanies(true);
        setErrorCompanies(null);

        fetch(`/api/com-fetch-companies`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch companies");
                return res.json();
            })
            .then((data) => setCompanies(data.data || []))
            .catch((err) => setErrorCompanies(err.message))
            .finally(() => setLoadingCompanies(false));
    }, [referenceid]);

    // Fetch activities
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    // Real-time subscription using Supabase
    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        const channel = supabase
            .channel(`public:history:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as SO;
                    const oldRecord = payload.old as SO;

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

    // Merge company info into activities
    const mergedActivities = useMemo(() => {
        return activities
            .map((history) => {
                const company = companies.find(
                    (c) => c.account_reference_number === history.account_reference_number
                );
                return {
                    ...history,
                    company_name: company?.company_name ?? "Unknown Company",
                    contact_number: company?.contact_number ?? "-",
                    contact_person: company?.contact_person ?? "-",
                };
            })
            .sort(
                (a, b) =>
                    new Date(b.date_updated ?? b.date_created).getTime() -
                    new Date(a.date_updated ?? a.date_created).getTime()
            );
    }, [activities, companies]);

    // Filter logic
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return mergedActivities
            .filter((item) => item.type_activity?.toLowerCase() === "sales order preparation")
            .filter((item) => {
                if (!search) return true;
                return (
                    (item.company_name?.toLowerCase().includes(search) ?? false) ||
                    (item.so_number?.toLowerCase().includes(search) ?? false) ||
                    (item.remarks?.toLowerCase().includes(search) ?? false)
                );
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                return true;
            })
            .filter((item) => {
                if (
                    !dateCreatedFilterRange ||
                    (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)
                ) {
                    return true;
                }

                const updatedDate = item.date_updated
                    ? new Date(item.date_updated)
                    : new Date(item.date_created);

                if (isNaN(updatedDate.getTime())) return false;

                const fromDate = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const toDate = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                // Helper function to check if two dates are on the same day (ignoring time)
                const isSameDay = (d1: Date, d2: Date) =>
                    d1.getFullYear() === d2.getFullYear() &&
                    d1.getMonth() === d2.getMonth() &&
                    d1.getDate() === d2.getDate();

                if (fromDate && toDate && isSameDay(fromDate, toDate)) {
                    // Exact one-day filter: match any record in that day
                    return isSameDay(updatedDate, fromDate);
                }

                if (fromDate && updatedDate < fromDate) return false;
                if (toDate && updatedDate > toDate) return false;

                return true;
            });

    }, [mergedActivities, searchTerm, filterStatus, dateCreatedFilterRange]);

    // Calculate totals for footer (for filteredActivities, not paginated subset)
    const totalQuotationAmount = useMemo(() => {
        return filteredActivities.reduce((acc, item) => acc + (item.so_amount ?? 0), 0);
    }, [filteredActivities]);

    // Count unique quotation_number (non-null)
    const uniqueQuotationCount = useMemo(() => {
        const uniqueSet = new Set<string>();
        filteredActivities.forEach((item) => {
            if (item.so_number) uniqueSet.add(item.so_number);
        });
        return uniqueSet.size;
    }, [filteredActivities]);

    // Pagination logic
    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(start, start + PAGE_SIZE);
    }, [filteredActivities, page]);

    // Reset to page 1 if filter or search changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterStatus, dateCreatedFilterRange]);

    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

    return (
        <>
            {/* Search */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <Input
                    type="text"
                    placeholder="Search company, quotation number or remarks..."
                    className="input input-bordered input-sm flex-grow max-w-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search quotations"
                />
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center items-center h-40">
                    <Spinner className="size-8" />
                </div>
            )}

            {/* Error */}
            {error && (
                <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
                    <div className="flex items-center space-x-3">
                        <AlertCircleIcon className="h-6 w-6 text-red-600" />
                        <div>
                            <AlertTitle>No Data Found or No Network Connection</AlertTitle>
                            <AlertDescription className="text-xs">
                                Please check your internet connection or try again later.
                            </AlertDescription>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <CheckCircle2Icon className="h-6 w-6 text-green-600" />
                        <div>
                            <AlertTitle className="text-black">Create New Data</AlertTitle>
                            <AlertDescription className="text-xs">
                                You can start by adding new entries to populate your database.
                            </AlertDescription>
                        </div>
                    </div>
                </Alert>
            )}

            {/* No Data Alert */}
            {!isLoading && !error && filteredActivities.length === 0 && (
                <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                    <AlertCircleIcon className="h-6 w-6 text-red-600" />
                    <div>
                        <AlertTitle>No Data Found</AlertTitle>
                        <AlertDescription>Please check your filters or try again later.</AlertDescription>
                    </div>
                </Alert>
            )}


            {/* Total info */}
            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Total Activities: {filteredActivities.length} | Unique SO: {uniqueQuotationCount}
                </div>
            )}

            {/* Table */}
            {filteredActivities.length > 0 && (
                <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px] text-xs">Date Created</TableHead>
                                <TableHead className="text-xs">SO Number</TableHead>
                                <TableHead className="text-right text-xs">SO Amount</TableHead>
                                <TableHead className="text-xs">Company Name</TableHead>
                                <TableHead className="text-xs">Contact Person</TableHead>
                                <TableHead className="text-xs">Contact Number</TableHead>
                                <TableHead className="text-xs">Remarks</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedActivities.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                                    <TableCell>{new Date(item.date_created).toLocaleDateString()}</TableCell>
                                    <TableCell className="uppercase">{item.so_number || "-"}</TableCell>
                                    <TableCell className="text-right">
                                        {item.so_amount !== undefined && item.so_amount !== null
                                            ? item.so_amount.toLocaleString(undefined, {
                                                style: "currency",
                                                currency: "PHP",
                                            })
                                            : "-"}
                                    </TableCell>
                                    <TableCell>{item.company_name}</TableCell>
                                    <TableCell>{item.contact_person}</TableCell>
                                    <TableCell>{item.contact_number}</TableCell>
                                    <TableCell className="capitalize">{item.remarks || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <tfoot>
                            <TableRow className="bg-muted font-semibold text-xs">
                                <TableCell colSpan={2} className="text-right pr-4">
                                    Totals:
                                </TableCell>
                                <TableCell className="text-right">
                                    {totalQuotationAmount.toLocaleString(undefined, {
                                        style: "currency",
                                        currency: "PHP",
                                    })}
                                </TableCell>
                                <TableCell colSpan={4}></TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                </div>
            )}

            {pageCount > 1 && (
                <Pagination>
                    <PaginationContent className="flex items-center space-x-4 justify-center mt-4 text-xs">
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (page > 1) setPage(page - 1);
                                }}
                                aria-disabled={page === 1}
                                className={page === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>

                        {/* Current page / total pages */}
                        <div className="px-4 font-medium select-none">
                            {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
                        </div>

                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (page < pageCount) setPage(page + 1);
                                }}
                                aria-disabled={page === pageCount}
                                className={page === pageCount ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </>
    );
};
