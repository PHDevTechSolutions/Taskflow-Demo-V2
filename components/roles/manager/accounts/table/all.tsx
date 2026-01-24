"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, } from "@/components/ui/pagination";

import { AccountsActiveSearch } from "../../../tsa/accounts/active/search";
import { AccountsAllFilter } from "../../../tsa/accounts/approval/filter";
// Removed AccountsActivePagination import since we're doing pagination here directly
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

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
    firstname: string;
    lastname: string;
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
    const [error, setError] = useState<string | null>(null);

    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
    const [agents, setAgents] = useState<any[]>([]);
    const [agentFilter, setAgentFilter] = useState("all");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        if (!userDetails.referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(
                    `/api/fetch-all-user-manager?id=${encodeURIComponent(userDetails.referenceid)}`
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
        const map: Record<string, string> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = `${agent.Firstname} ${agent.Lastname}`;
            }
        });
        return map;
    }, [agents]);

    // Reset to first page when filters/search change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        globalFilter,
        typeFilter,
        statusFilter,
        industryFilter,
        alphabeticalFilter,
        dateCreatedFilter,
        agentFilter,
        localPosts,
    ]);

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

            const agentFullname =
                agentMap[item.referenceid?.toLowerCase() ?? ""] || "";
            const matchesAgent = agentFilter === "all" || agentFullname === agentFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus &&
                matchesIndustry &&
                matchesAgent
            );
        });

        data = data.sort((a, b) => {
            if (alphabeticalFilter === "asc") {
                return a.company_name.localeCompare(b.company_name);
            } else if (alphabeticalFilter === "desc") {
                return b.company_name.localeCompare(a.company_name);
            }

            if (dateCreatedFilter === "asc") {
                return (
                    new Date(a.date_created).getTime() -
                    new Date(b.date_created).getTime()
                );
            } else if (dateCreatedFilter === "desc") {
                return (
                    new Date(b.date_created).getTime() -
                    new Date(a.date_created).getTime()
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
        agentFilter,
        agentMap,
    ]);

    // Paginated data for current page
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage]);

    function convertToCSV(data: Account[]) {
        if (data.length === 0) return "";

        const header = [
            "Agent Name",
            "Company Name",
            "Contact Person",
            "Contact Number",
            "Email Address",
            "Address",
            "Delivery Address",
            "Region",
            "Type of Client",
            "Industry",
            "Status",
            "Date Created",
        ];

        const csvRows = [
            header.join(","),
            ...data.map((item) =>
                [
                    agentMap[item.referenceid?.toLowerCase() ?? ""] || "-",
                    item.company_name,
                    item.contact_person,
                    item.contact_number,
                    item.email_address,
                    item.address,
                    item.delivery_address,
                    item.region,
                    item.type_client,
                    item.industry,
                    item.status || "-",
                    new Date(item.date_created).toLocaleDateString(),
                ]
                    .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                    .join(",")
            ),
        ];

        return csvRows.join("\n");
    }

    function handleDownloadCSV() {
        const csv = convertToCSV(filteredData); // use full filteredData to download all filtered records
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

    useEffect(() => {
        if (!globalFilter) {
            setIsFiltering(false);
            return;
        }
        setIsFiltering(true);
        const timeout = setTimeout(() => setIsFiltering(false), 300);
        return () => clearTimeout(timeout);
    }, [globalFilter]);

    // Calculate total pages
    const totalPages = Math.ceil(filteredData.length / pageSize);

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-grow w-full max-w-lg flex items-center gap-3">
                        <AccountsActiveSearch
                            globalFilter={globalFilter}
                            setGlobalFilterAction={setGlobalFilter}
                            isFiltering={isFiltering}
                        />
                    </div>
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

                    <Button variant="outline" onClick={handleDownloadCSV}>
                        Download CSV
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border p-4 space-y-2 overflow-x-auto">
                <Badge
                    className="h-10 min-w-10 rounded-full px-4 font-mono text-lg font-bold tabular-nums"
                    variant="outline"
                >
                    Total Database: {filteredData.length}
                </Badge>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Agent Name</TableHead>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Contact Number</TableHead>
                            <TableHead>Email Address</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Delivery Address</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Type of Client</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date Created</TableHead>
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
                                const agentName =
                                    agentMap[account.referenceid?.toLowerCase() ?? ""] || "-";

                                let badgeVariant:
                                    | "default"
                                    | "secondary"
                                    | "destructive"
                                    | "outline" = "outline";
                                if (account.status === "Active") badgeVariant = "default";
                                else if (account.status === "Pending") badgeVariant = "secondary";
                                else if (account.status === "Inactive") badgeVariant = "destructive";

                                return (
                                    <TableRow key={account.id} className="hover:bg-gray-50">
                                        <TableCell className="capitalize">{agentName}</TableCell>
                                        <TableCell>{account.company_name}</TableCell>
                                        <TableCell className="capitalize">
                                            {account.contact_person}
                                        </TableCell>
                                        <TableCell>{account.contact_number}</TableCell>
                                        <TableCell>{account.email_address}</TableCell>
                                        <TableCell className="capitalize">{account.address}</TableCell>
                                        <TableCell className="capitalize">
                                            {account.delivery_address}
                                        </TableCell>
                                        <TableCell>{account.region}</TableCell>
                                        <TableCell className="uppercase">{account.type_client}</TableCell>
                                        <TableCell>{account.industry}</TableCell>
                                        <TableCell>
                                            <Badge variant={badgeVariant}>{account.status ?? "-"}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(account.date_created).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <Pagination>
                        <PaginationContent className="flex items-center space-x-4 justify-center mt-4">
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                                    }}
                                    aria-disabled={currentPage === 1}
                                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
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
                                    aria-disabled={currentPage === totalPages}
                                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}

            </div>
        </div>
    );
}
