"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    contact_person?: string;
    type_client?: string;
}

interface Account {
    id: number;
    actual_sales?: number;
    remarks?: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    company_name?: string;
    contact_number?: string;
    status: string;
    dr_number: string;
    referenceid: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;
}

interface AccountProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
    userDetails: UserDetails;
}

const PAGE_SIZE = 10;

export const ASTable: React.FC<AccountProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    userDetails,
    setDateCreatedFilterRangeAction,
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<Account[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const [page, setPage] = useState(1);
    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

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
        fetchActivities();

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
                    const newRecord = payload.new as Account;
                    const oldRecord = payload.old as Account;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;

                            case "UPDATE":
                                return curr.map((a) =>
                                    a.id === newRecord.id ? newRecord : a
                                );

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

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return mergedActivities
            .filter((item) => {
                if (!search) return true;
                return (
                    (item.company_name?.toLowerCase().includes(search) ?? false) ||
                    (item.remarks?.toLowerCase().includes(search) ?? false)
                );
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus)
                    return false;
                return true;
            })
            .filter((item) => {
                const hasSales = item.actual_sales && Number(item.actual_sales) > 0;
                const hasDR =
                    item.dr_number && item.dr_number.toString().trim() !== "";

                return hasSales || hasDR;
            })
            .filter((item) => {
                if (selectedAgent === "all") return true;
                return item.referenceid === selectedAgent;
            })
            .filter((item) => {
                if (
                    !dateCreatedFilterRange ||
                    (!dateCreatedFilterRange.from &&
                        !dateCreatedFilterRange.to)
                ) {
                    return true;
                }

                const updatedDate = new Date(item.date_created);
                if (isNaN(updatedDate.getTime())) return false;

                const fromDate = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const toDate = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                const isSameDay = (d1: Date, d2: Date) =>
                    d1.getFullYear() === d2.getFullYear() &&
                    d1.getMonth() === d2.getMonth() &&
                    d1.getDate() === d2.getDate();

                if (fromDate && toDate && isSameDay(fromDate, toDate)) {
                    return isSameDay(updatedDate, fromDate);
                }

                if (fromDate && updatedDate < fromDate) return false;
                if (toDate && updatedDate > toDate) return false;

                return true;
            });
    }, [mergedActivities, searchTerm, filterStatus, dateCreatedFilterRange, selectedAgent]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterStatus, dateCreatedFilterRange, selectedAgent]);

    const groupedByCompany = useMemo(() => {
        const map = new Map();

        filteredActivities.forEach((item) => {
            if (!map.has(item.company_name)) {
                map.set(item.company_name, item);
            }
        });

        return Array.from(map.values());
    }, [filteredActivities]);

    const pageCount = Math.ceil(groupedByCompany.length / PAGE_SIZE);

    const paginatedGrouped = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return groupedByCompany.slice(start, start + PAGE_SIZE);
    }, [groupedByCompany, page]);

    const totalActualSales = useMemo(() => {
        return paginatedGrouped.reduce((sum, item) => {
            const val = Number(item.actual_sales);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    }, [paginatedGrouped]);

    const totalDRCount = useMemo(() => {
        return paginatedGrouped.reduce((count, item) => {
            if (item.dr_number && item.dr_number.toString().trim() !== "") {
                return count + 1;
            }
            return count;
        }, 0);
    }, [paginatedGrouped]);


    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterStatus, dateCreatedFilterRange]);

    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

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

    return (
        <>
            <div className="mb-4 flex flex-wrap items-center gap-4">
                <Input
                    type="text"
                    placeholder="Search company or remarks..."
                    className="max-w-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <Select
                    value={selectedAgent}
                    onValueChange={(value) => {
                        setSelectedAgent(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[220px] text-xs">
                        <SelectValue placeholder="Filter by Agent" />
                    </SelectTrigger>

                    <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>

                        {agents.map((agent) => (
                            <SelectItem className="capitalize"
                                key={agent.ReferenceID}
                                value={agent.ReferenceID}
                            >
                                {agent.Firstname} {agent.Lastname}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center h-40">
                    <Spinner className="size-8" />
                </div>
            )}

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

            {!isLoading && !error && groupedByCompany.length === 0 && (
                <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                    <AlertCircleIcon className="h-6 w-6 text-red-600" />
                    <div>
                        <AlertTitle>No Data Found</AlertTitle>
                        <AlertDescription>Try adjusting filters or search.</AlertDescription>
                    </div>
                </Alert>
            )}

            {groupedByCompany.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Total Companies: {groupedByCompany.length}
                </div>
            )}

            {groupedByCompany.length > 0 && (
                <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px] text-xs">Agent</TableHead>
                                <TableHead className="w-[120px] text-xs">Date Created</TableHead>
                                <TableHead className="text-xs text-right">Sales Amount</TableHead>
                                <TableHead className="text-xs">DR Number</TableHead>
                                <TableHead className="text-xs">Company Name</TableHead>
                                <TableHead className="text-xs">Contact Person</TableHead>
                                <TableHead className="text-xs">Contact Number</TableHead>
                                <TableHead className="text-xs">Remarks</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedGrouped.map((item) => {
                                const agentName =
                                    agentMap[item.referenceid?.toLowerCase() ?? ""] || "-";

                                return (
                                    <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                                        <TableCell className="capitalize">{agentName}</TableCell>

                                        <TableCell>
                                            {item.date_created
                                                ? new Date(item.date_created).toLocaleDateString()
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            {item.actual_sales
                                                ? item.actual_sales.toLocaleString("en-PH", {
                                                    style: "currency",
                                                    currency: "PHP",
                                                })
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="uppercase">
                                            {item.dr_number || "-"}
                                        </TableCell>

                                        <TableCell>{item.company_name || "-"}</TableCell>
                                        <TableCell>{item.contact_person || "-"}</TableCell>
                                        <TableCell>{item.contact_number || "-"}</TableCell>
                                        <TableCell className="capitalize italic font-semibold">{item.remarks || "-"}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>

                        <tfoot>
                            <TableRow className="bg-muted font-semibold text-xs">
                                <TableCell colSpan={2} className="text-right pr-4">
                                    Totals:
                                </TableCell>

                                <TableCell className="text-right font-bold">
                                    {totalActualSales.toLocaleString("en-PH", {
                                        style: "currency",
                                        currency: "PHP",
                                    })}
                                </TableCell>

                                <TableCell className="font-bold">
                                    DR Number QTY: {totalDRCount}
                                </TableCell>

                                <TableCell colSpan={3}></TableCell>
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
                                className={
                                    page === 1
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>

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
                                className={
                                    page === pageCount
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </>
    );
};
