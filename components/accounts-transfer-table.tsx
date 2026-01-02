"use client";

import React, { useState, useEffect, useMemo } from "react";
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
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AccountsActiveSearch } from "./accounts-active-search";
import { AccountsAllFilter } from "./accounts-all-filter";
import { AccountsApproveDialog } from "./accounts-transfer-approve-dialog";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

interface Account {
    id: string;
    referenceid: string;
    tsm: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    type_client: string;
    date_created: string;
    industry: string;
    status?: string;
    transfer_to: string;
    date_transferred: string;
}

interface UserDetails {
    referenceid: string;
    firstname: string;
    lastname: string;
    tsm: string;
    manager: string;
}

interface AccountsTableProps {
    posts: Account[];
    userDetails: UserDetails;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
    onRefreshAccountsAction: () => Promise<void>;
}

export function AccountsTable({
    posts = [],
    userDetails,
    setDateCreatedFilterRangeAction,
    onRefreshAccountsAction,
}: AccountsTableProps) {
    const [localPosts, setLocalPosts] = useState<Account[]>(posts);
    const [agents, setAgents] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [agentFilter, setAgentFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters states
    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [industryFilter, setIndustryFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(
        null
    );
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(
        null
    );

    // Transfer dialog
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setLocalPosts(posts);
        setCurrentPage(1); // reset page when posts change
    }, [posts]);

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

    // Map ReferenceID -> agent fullname
    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach((agent) => {
            map[agent.ReferenceID] = `${agent.Firstname} ${agent.Lastname}`;
        });
        return map;
    }, [agents]);

    // Filtering data
    const filteredData = useMemo(() => {
        let data = localPosts.filter((item) => item.status !== "Removed");

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            const matchesType = typeFilter === "all" || item.type_client === typeFilter;

            const matchesStatus = item.status === "Subject for Transfer";

            const matchesIndustry =
                industryFilter === "all" || item.industry === industryFilter;

            const agentFullname = agentMap[item.referenceid] || "";

            const matchesAgent = agentFilter === "all" || agentFullname === agentFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus &&
                matchesIndustry &&
                matchesAgent
            );
        });

        // Sorting
        data = data.sort((a, b) => {
            if (alphabeticalFilter === "asc") {
                return a.company_name.localeCompare(b.company_name);
            } else if (alphabeticalFilter === "desc") {
                return b.company_name.localeCompare(a.company_name);
            }

            if (dateCreatedFilter === "asc") {
                return (
                    new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
                );
            } else if (dateCreatedFilter === "desc") {
                return (
                    new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
                );
            }

            return 0;
        });

        return data;
    }, [
        localPosts,
        globalFilter,
        typeFilter,
        industryFilter,
        alphabeticalFilter,
        dateCreatedFilter,
        agentFilter,
        agentMap,
    ]);

    // Calculate pagination values
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Ensure current page is not out of range after filters change
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages || 1);
        }
    }, [currentPage, totalPages]);

    // Paginate filtered data
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredData.slice(startIndex, startIndex + pageSize);
    }, [filteredData, currentPage, pageSize]);

    // Selection handlers
    const isAllSelected = paginatedData.length > 0 && paginatedData.every((a) => selectedIds.has(a.id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            // Remove all ids on current page
            setSelectedIds((prev) => {
                const copy = new Set(prev);
                paginatedData.forEach((a) => copy.delete(a.id));
                return copy;
            });
        } else {
            // Add all ids on current page
            setSelectedIds((prev) => {
                const copy = new Set(prev);
                paginatedData.forEach((a) => copy.add(a.id));
                return copy;
            });
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds((prev) => {
            const copy = new Set(prev);
            if (copy.has(id)) copy.delete(id);
            else copy.add(id);
            return copy;
        });
    };

    // Bulk approve transfer
    async function handleBulkTransfer() {
        if (selectedIds.size === 0) return;

        try {
            const res = await fetch("/api/com-bulk-approve-account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    status: "Approval for Transfer",
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData?.error || "Failed to approve accounts");
            }

            const result = await res.json();

            if (result.success && result.updatedCount > 0) {
                setLocalPosts((prev) =>
                    prev.map((item) =>
                        selectedIds.has(item.id)
                            ? { ...item, status: "Approval for Transfer" }
                            : item
                    )
                );

                toast.success(
                    "Accounts transfer successfully! Subject for Approval on IT Department"
                );

                await onRefreshAccountsAction();

                setSelectedIds(new Set());
                setIsTransferDialogOpen(false);
            } else {
                toast.error("No accounts updated. IDs may not exist.");
            }
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to approve accounts"
            );
        }
    }

    useEffect(() => {
        if (!globalFilter) {
            setIsFiltering(false);
            return;
        }
        setIsFiltering(true);
        const timeout = setTimeout(() => setIsFiltering(false), 300);
        return () => clearTimeout(timeout);
    }, [globalFilter]);

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-grow max-w-lg">
                    <AccountsActiveSearch
                        globalFilter={globalFilter}
                        setGlobalFilterAction={setGlobalFilter}
                        isFiltering={isFiltering}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <AccountsAllFilter
                        typeFilter={typeFilter}
                        setTypeFilterAction={setTypeFilter}
                        statusFilter={"Subject for Transfer"} // fixed filter as in original logic
                        setStatusFilterAction={() => { }}
                        dateCreatedFilter={dateCreatedFilter}
                        setDateCreatedFilterAction={setDateCreatedFilter}
                        industryFilter={industryFilter}
                        setIndustryFilterAction={setIndustryFilter}
                        alphabeticalFilter={alphabeticalFilter}
                        setAlphabeticalFilterAction={setAlphabeticalFilter}
                        agentFilter={agentFilter}
                        setAgentFilterAction={setAgentFilter}
                        agents={agents}
                    />
                    {selectedIds.size > 0 && (
                        <Button onClick={() => setIsTransferDialogOpen(true)}>
                            Approved Selected
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border p-4 space-y-2">
                {error && (
                    <div className="text-red-600 font-semibold mb-2">{error}</div>
                )}
                <Badge
                    className="h-5 min-w-5 rounded-full px-2 font-mono tabular-nums"
                    variant="outline"
                >
                    Total: {filteredData.length}
                </Badge>

                <Table>
                    <TableHeader>
                        <TableRow className="whitespace-nowrap">
                            <TableHead>
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all accounts on current page"
                                />
                            </TableHead>
                            <TableHead>Transferred From</TableHead>
                            <TableHead>Transferred To</TableHead>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Email Address</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Type of Client</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date Transferred</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={12} className="text-center py-4">
                                    No accounts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((account) => {
                                const agentFrom = agents.find(
                                    (a) => a.ReferenceID === account.referenceid
                                );
                                const agentTo = agents.find(
                                    (a) => a.ReferenceID === account.transfer_to
                                );

                                return (
                                    <TableRow key={account.id} className="whitespace-nowrap">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(account.id)}
                                                onCheckedChange={() => toggleSelectOne(account.id)}
                                                aria-label={`Select account ${account.company_name}`}
                                            />
                                        </TableCell>

                                        <TableCell className="capitalize">
                                            {agentFrom
                                                ? `${agentFrom.Firstname} ${agentFrom.Lastname}`
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="capitalize">
                                            {agentTo
                                                ? `${agentTo.Firstname} ${agentTo.Lastname}`
                                                : "-"}
                                        </TableCell>

                                        <TableCell>{account.company_name}</TableCell>
                                        <TableCell className="capitalize">{account.contact_person}</TableCell>
                                        <TableCell>{account.email_address}</TableCell>
                                        <TableCell className="capitalize">{account.address}</TableCell>
                                        <TableCell>{account.type_client}</TableCell>
                                        <TableCell>{account.industry}</TableCell>
                                        <TableCell>{account.status ?? "-"}</TableCell>

                                        <TableCell>
                                            <Badge
                                                variant={
                                                    account.status === "Active"
                                                        ? "default"
                                                        : account.status === "Pending"
                                                            ? "secondary"
                                                            : account.status === "Inactive"
                                                                ? "destructive"
                                                                : "outline"
                                                }
                                            >
                                                {account.status ?? "-"}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            {new Date(account.date_transferred).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
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

            <AccountsApproveDialog
                open={isTransferDialogOpen}
                onOpenChange={setIsTransferDialogOpen}
                onConfirmApprove={handleBulkTransfer}
            />
        </div>
    );
}
