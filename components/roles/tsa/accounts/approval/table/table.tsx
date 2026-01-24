"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender, } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AccountsActiveSearch } from "../../active/search";
import { AccountsAllFilter } from "../filter";
import { AccountsActivePagination } from "../../active/pagination";
import { AccountsApproveDialog } from "../dialog/approve";
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
    date_removed: string;
    industry: string;
    status?: string;
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

    // For bulk remove
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        setLocalPosts(posts);
    }, [posts]);

    // FETCH AGENTS based on userDetails.referenceid (TSM)
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

    // Map ReferenceID -> agent fullname for display and filtering
    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach((agent) => {
            map[agent.ReferenceID] = `${agent.Firstname} ${agent.Lastname}`;
        });
        return map;
    }, [agents]);

    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [industryFilter, setIndustryFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(
        null
    );
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(
        null
    );

    const filteredData = useMemo(() => {
        let data = localPosts.filter((item) => item.status == "Removed");

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            const matchesType = typeFilter === "all" || item.type_client === typeFilter;

            // Force status === "Pending" filter
            const matchesStatus = item.status === "Removed";

            const matchesIndustry =
                industryFilter === "all" || item.industry === industryFilter;

            // Get agent fullname from map using account referenceid
            const agentFullname = agentMap[item.referenceid] || "";

            // Match agent filter (all or exact fullname)
            const matchesAgent = agentFilter === "all" || agentFullname === agentFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus &&
                matchesIndustry &&
                matchesAgent
            );
        });

        // Sorting logic
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

    const columns = useMemo<ColumnDef<Account>[]>(
        () => [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all accounts"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label={`Select account ${row.original.company_name}`}
                    />
                ),
                enableSorting: false,
                enableHiding: false,
            },
            {
                accessorKey: "agent_name",
                header: "Agent Name",
                cell: ({ row }) => {
                    const accountRefId = row.original.referenceid;
                    const agent = agents.find((a) => a.ReferenceID === accountRefId);
                    if (!agent) return "-";
                    return `${agent.Firstname} ${agent.Lastname}`;
                },
            },
            {
                accessorKey: "company_name",
                header: "Company Name",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "contact_person",
                header: "Contact Person",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "email_address",
                header: "Email Address",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "address",
                header: "Address",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "type_client",
                header: "Type of Client",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "industry",
                header: "Industry",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "status",
                header: "Status",
                cell: (info) => {
                    const value = info.getValue() as string;
                    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
                    if (value === "Active") variant = "default";
                    else if (value === "Pending") variant = "secondary";
                    else if (value === "Inactive") variant = "destructive";
                    return <Badge variant={variant}>{value ?? "-"}</Badge>;
                },
            },
            {
                accessorKey: "date_removed",
                header: "Date Removed",
                cell: (info) =>
                    new Date(info.getValue() as string).toLocaleDateString(),
            },
        ],
        [agents]
    );

    useEffect(() => {
        if (!globalFilter) {
            setIsFiltering(false);
            return;
        }
        setIsFiltering(true);
        const timeout = setTimeout(() => setIsFiltering(false), 300);
        return () => clearTimeout(timeout);
    }, [globalFilter]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),

        state: {
            rowSelection,
        },
        onRowSelectionChange: setRowSelection,
    });

    // Extract selected account IDs for bulk removal
    const selectedAccountIds = table
        .getSelectedRowModel()
        .rows
        .map(row => row.original.id);


    // Handle bulk remove action
    async function handleBulkRemove() {
        if (selectedAccountIds.length === 0) return;

        try {
            const res = await fetch("/api/com-bulk-approve-account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: selectedAccountIds,
                    status: "Approved for Deletion",
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData?.error || "Failed to approve accounts");
            }

            const result = await res.json();

            if (result.success && result.updatedCount > 0) {
                // Update localPosts to reflect the change
                setLocalPosts((prev) =>
                    prev.map((item) =>
                        selectedAccountIds.includes(item.id)
                            ? { ...item, status: "Approved for Deletion" }
                            : item
                    )
                );

                toast.success("Accounts approved successfully!");

                await onRefreshAccountsAction();

                setRowSelection({});
                setIsRemoveDialogOpen(false);
                table.setPageIndex(0);
            } else {
                toast.error("No accounts updated. IDs may not exist.");
            }
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to approve accounts"
            );
        }
    }

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
                        statusFilter={statusFilter}
                        setStatusFilterAction={setStatusFilter}
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
                    {selectedAccountIds.length > 0 && (
                        <Button
                            onClick={() => setIsRemoveDialogOpen(true)}
                        >
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
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="text-center py-4">
                                    No accounts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AccountsActivePagination table={table} />

            <AccountsApproveDialog
                open={isRemoveDialogOpen}
                onOpenChange={setIsRemoveDialogOpen}
                onConfirmApprove={handleBulkRemove}
            />
        </div>
    );
}
