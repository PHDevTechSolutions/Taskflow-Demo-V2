"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender,
} from "@tanstack/react-table";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type DateRange } from "react-day-picker";

import { AccountsActiveSearch } from "./accounts-active-search";
import { AccountsActiveFilter } from "./accounts-active-filter";
import { AccountsActivePagination } from "./accounts-active-pagination";

interface Account {
    id: string;
    referenceid: string;
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
    next_available_date: string;
    status?: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
}

interface AccountsTableProps {
    posts: Account[];
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
    userDetails: UserDetails;
    onSaveAccountAction: (data: any) => void;
    onRefreshAccountsAction: () => Promise<void>;
}

export function AccountsTable({
    posts = [],
    userDetails,
    onSaveAccountAction,
    onRefreshAccountsAction,
}: AccountsTableProps) {
    const [localPosts, setLocalPosts] = useState<Account[]>(posts);

    useEffect(() => {
        setLocalPosts(posts);
    }, [posts]);

    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [industryFilter, setIndustryFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(
        null
    );

    // Advanced filters states
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);

    // Filter out removed accounts immediately
    const filteredData = useMemo(() => {
        // Filter items that have non-empty next_available_date
        let data = localPosts.filter(
            (item) =>
                item.next_available_date != null &&
                item.next_available_date.trim() !== ""
        );

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            const matchesType = typeFilter === "all" || item.type_client === typeFilter;
            const matchesStatus = statusFilter === "all" || item.status === statusFilter;
            const matchesIndustry = industryFilter === "all" || item.industry === industryFilter;

            return matchesSearch && matchesType && matchesStatus && matchesIndustry;
        });

        data = data.sort((a, b) => {
            if (alphabeticalFilter === "asc") {
                return a.company_name.localeCompare(b.company_name);
            } else if (alphabeticalFilter === "desc") {
                return b.company_name.localeCompare(a.company_name);
            }

            if (dateCreatedFilter === "asc") {
                return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
            } else if (dateCreatedFilter === "desc") {
                return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
            }

            return 0;
        });

        return data;
    }, [
        localPosts,
        globalFilter,
        typeFilter,
        statusFilter,
        industryFilter,
        alphabeticalFilter,
        dateCreatedFilter,
    ]);


    const columns = useMemo<ColumnDef<Account>[]>(
        () => [
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
                accessorKey: "next_available_date",
                header: "Next Appear Date on New Task Cluster",
                cell: (info) => new Date(info.getValue() as string).toLocaleDateString(),
            },
        ],
        []
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
        // Removed rowSelection and onRowSelectionChange to disable checkbox selection
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left side: Add Account + Search */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-grow w-full max-w-lg">
                        <AccountsActiveSearch
                            globalFilter={globalFilter}
                            setGlobalFilterAction={setGlobalFilter}
                            isFiltering={isFiltering}
                        />
                    </div>
                </div>

                {/* Right side: Filter */}
                <div className="flex items-center gap-3">
                    <AccountsActiveFilter
                                typeFilter={typeFilter}
                                setTypeFilterAction={setTypeFilter}
                                dateCreatedFilter={dateCreatedFilter}
                                setDateCreatedFilterAction={setDateCreatedFilter}
                                alphabeticalFilter={alphabeticalFilter}
                                setAlphabeticalFilterAction={setAlphabeticalFilter}
                              />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border p-4 space-y-2">
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
                                        {flexRender(header.column.columnDef.header, header.getContext())}
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
        </div>
    );
}
