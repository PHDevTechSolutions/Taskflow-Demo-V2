"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AccountsActiveSearch } from "../../active/search";
import { AccountsAllFilter } from "../filter";
import { AccountsApproveDialog } from "../dialog/approve";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";

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

interface RequestTableProps {
    posts: Account[];
    userDetails: UserDetails;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
    onRefreshAccountsAction: () => Promise<void>;
}

export function RequestTable({
    posts = [],
    userDetails,
    setDateCreatedFilterRangeAction,
    onRefreshAccountsAction,
}: RequestTableProps) {
    const [localPosts, setLocalPosts] = useState<Account[]>(posts);
    const [agents, setAgents] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [agentFilter, setAgentFilter] = useState("all");
    const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [industryFilter, setIndustryFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);

    useEffect(() => setLocalPosts(posts), [posts]);

    // Fetch agents
    useEffect(() => {
        if (!userDetails.referenceid) return;
        const fetchAgents = async () => {
            try {
                const res = await fetch(
                    `/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
                );
                if (!res.ok) throw new Error("Failed to fetch agents");
                const data = await res.json();
                setAgents(data);
            } catch {
                setError("Failed to load agents.");
            }
        };
        fetchAgents();
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach((agent) => {
            map[agent.ReferenceID] = `${agent.Firstname} ${agent.Lastname}`;
        });
        return map;
    }, [agents]);

    const filteredData = useMemo(() => {
        let data = localPosts.filter((item) => item.status === "Removed");

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            const matchesType = typeFilter === "all" || item.type_client === typeFilter;
            const matchesAgent =
                agentFilter === "all" || agentMap[item.referenceid] === agentFilter;
            const matchesIndustry = industryFilter === "all" || item.industry === industryFilter;

            return matchesSearch && matchesType && matchesAgent && matchesIndustry;
        });

        // Sorting
        data.sort((a, b) => {
            if (alphabeticalFilter === "asc") return a.company_name.localeCompare(b.company_name);
            if (alphabeticalFilter === "desc") return b.company_name.localeCompare(a.company_name);
            if (dateCreatedFilter === "asc")
                return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
            if (dateCreatedFilter === "desc")
                return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
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

    const selectedAccountIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

    // Bulk approve
    const handleBulkRemove = async () => {
        if (selectedAccountIds.length === 0) return;

        try {
            const res = await fetch("/api/com-bulk-approve-account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedAccountIds, status: "Approved for Deletion" }),
            });

            if (!res.ok) throw new Error("Failed to approve accounts");

            const result = await res.json();
            if (result.success && result.updatedCount > 0) {
                setLocalPosts((prev) =>
                    prev.map((item) =>
                        selectedAccountIds.includes(item.id)
                            ? { ...item, status: "Approved for Deletion" }
                            : item
                    )
                );

                sileo.success({ title: "Success", description: "Accounts approved!", duration: 4000, position: "top-right", fill: "black" });
                await onRefreshAccountsAction();
                setRowSelection({});
                setIsRemoveDialogOpen(false);
            } else {
                sileo.warning({ title: "Warning", description: "No accounts updated.", duration: 4000, position: "top-right", fill: "black" });
            }
        } catch {
            sileo.error({ title: "Failed", description: "Failed to approve accounts", duration: 4000, position: "top-right", fill: "black" });
        }
    };

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
                <div className="flex items-center gap-2">
                    <AccountsAllFilter
                        typeFilter={typeFilter}
                        setTypeFilterAction={setTypeFilter}
                        statusFilter="Removed"
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
                    {selectedAccountIds.length > 0 && (
                        <Button onClick={() => setIsRemoveDialogOpen(true)} className="rounded-none text-xs">Approve Selected</Button>
                    )}
                </div>
            </div>

            {/* Cards */}
            <div className="h-[500px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {error && (<div className="col-span-full text-red-600 font-semibold">{error}</div>)}

                {filteredData.length > 0 && (
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Total Records: {filteredData.length}</div>
                )}

                {filteredData.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-8">
                        No accounts found.
                    </div>
                ) : (
                    filteredData.map((account) => {
                        const agentName = agentMap[account.referenceid] || "-";
                        const isSelected = !!rowSelection[account.id];

                        return (
                            <div
                                key={account.id}
                                className="border rounded-md p-4 shadow-sm bg-white flex flex-col gap-3 hover:shadow-md transition"
                            >
                                {/* HEADER */}
                                <div className="flex items-start justify-between">
                                    {/* Left: Checkbox + Company Name */}
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={!!rowSelection[account.id]}
                                            className="h-6 w-6 mt-1"
                                            onCheckedChange={(checked) =>
                                                setRowSelection((prev) => ({ ...prev, [account.id]: !!checked }))
                                            }
                                        />

                                        <div className="flex flex-col">
                                            <span className="font-semibold text-xs uppercase">
                                                {account.company_name}
                                            </span>
                                            <span className="text-gray-500 text-[11px]">
                                                Contact: {account.contact_person} | {account.contact_number}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Status Badge */}
                                    <Badge variant="outline" className="rounded-none">
                                        {account.status ?? "-"}
                                    </Badge>
                                </div>

                                {/* DETAILS */}
                                <div className="flex flex-col gap-1 text-[11px]">
                                    <div>
                                        <span className="text-gray-500">Agent:</span> {agentMap[account.referenceid] || "-"}
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Email:</span> {account.email_address}
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Address:</span> {account.address}
                                    </div>
                                </div>

                                {/* FOOTER */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="flex gap-2 flex-wrap">
                                        <Badge variant="secondary" className="rounded-none text-[10px]">
                                            {account.industry}
                                        </Badge>
                                        <Badge variant="outline" className="rounded-none text-[10px]">
                                            {account.type_client}
                                        </Badge>
                                    </div>

                                    <div className="text-[10px] text-gray-500">
                                        Date Removed: {new Date(account.date_removed).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <AccountsApproveDialog
                open={isRemoveDialogOpen}
                onOpenChange={setIsRemoveDialogOpen}
                onConfirmApprove={handleBulkRemove}
            />
        </div>
    );
}
export { RequestTable as AccountsTable };