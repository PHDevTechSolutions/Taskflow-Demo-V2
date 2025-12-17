"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    ColumnDef,
    flexRender,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

import { AccountsActiveSearch } from "./accounts-active-search";
import { AccountsActiveFilter } from "./accounts-active-filter";
import { AccountsActivePagination } from "./accounts-active-pagination";

interface Account {
    id: string;
    tsm: string;
    referenceid: string;
    company_name: string;
    type_client: string;
    date_created: string;
    date_updated: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    industry: string;
    status?: string;
    company_group?: string;
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
}

export function AccountsTable({
    posts = [],
    userDetails,
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
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);

    // Advanced filters states
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);

    const filteredData = useMemo(() => {
        const allowedTypes = [
            "Top 50",
            "Next 30",
            "Balance 20",
            "TSA CLIENT",
            "CSR CLIENT",
        ];
        const normalizedAllowedTypes = allowedTypes.map((t) => t.toLowerCase());

        let data = localPosts.filter(
            (item) =>
                item.status?.toLowerCase() !== "removed" &&
                item.status?.toLowerCase() !== "approval for transfer" &&
                normalizedAllowedTypes.includes(item.type_client?.toLowerCase() ?? "")
        );

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            const matchesType =
                typeFilter === "all" ||
                item.type_client?.toLowerCase() === typeFilter.toLowerCase();

            const matchesStatus =
                statusFilter === "all" ||
                item.status?.toLowerCase() === statusFilter.toLowerCase();

            const matchesIndustry =
                industryFilter === "all" || item.industry === industryFilter;

            return matchesSearch && matchesType && matchesStatus && matchesIndustry;
        });

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
        statusFilter,
        industryFilter,
        alphabeticalFilter,
        dateCreatedFilter,
    ]);

    function convertToCSV(data: Account[]) {
        if (data.length === 0) return "";

        const header = [
            "Company Name",
            "Contact Person",
            "Contact Number",
            "Email Address",
            "Address",
            "Delivery Address",
            "Region",
            "Type of Client",
            "Industry",
        ];

        const csvRows = [
            header.join(","),
            ...data.map((item) =>
                [
                    item.company_name,
                    item.contact_person,
                    item.contact_number,
                    item.email_address,
                    item.address,
                    item.delivery_address,
                    item.region,
                    item.type_client,
                    item.industry,
                ]
                    .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                    .join(",")
            ),
        ];

        return csvRows.join("\n");
    }

    function handleDownloadCSV() {
        const csv = convertToCSV(filteredData);
        if (!csv) {
            toast.error("No data to download.");
            return;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "accounts.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

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
                accessorKey: "date_created",
                header: "Date Created",
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
        state: {},
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left side: Search */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-grow w-full max-w-lg flex items-center gap-3">
                        <AccountsActiveSearch
                            globalFilter={globalFilter}
                            setGlobalFilterAction={setGlobalFilter}
                            isFiltering={isFiltering}
                        />
                    </div>
                </div>

                {/* Right side: Filter + Download */}
                <div className="flex items-center gap-3">
                    <AccountsActiveFilter
                        typeFilter={typeFilter}
                        setTypeFilterAction={setTypeFilter}
                        dateCreatedFilter={dateCreatedFilter}
                        setDateCreatedFilterAction={setDateCreatedFilter}
                        alphabeticalFilter={alphabeticalFilter}
                        setAlphabeticalFilterAction={setAlphabeticalFilter}
                    />

                    <Button variant="outline" onClick={handleDownloadCSV}>
                        Download CSV
                    </Button>
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

                {/* Pending status note */}
                {filteredData.some((account) => account.status === "Pending") && (
                    <div className="mt-2 text-sm text-yellow-700 bg-yellow-100 border border-yellow-300 rounded p-2">
                        The account with the status <strong>"Pending"</strong> needs approval from
                        your Territory Sales Manager (TSM) to be verified before using it in creation
                        of activity.
                    </div>
                )}
            </div>

            <AccountsActivePagination table={table} />
        </div>
    );
}
