"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, Eye, MoreVertical, FileX, Loader2, LoaderPinwheel } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "./dialog/edit";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Completed {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name?: string;
    product_category?: string;
    project_type?: string;
    source?: string;
    type_activity?: string;
    quotation_number?: string;
    quotation_amount?: number;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date: string;
    end_date: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    quotation_type: string;
    company_name: string;
    contact_number: string;
    email_address: string;
    address: string;
    contact_person: string;
    tsm_approved_status: string;
    quotation_status: string;
    delivery_fee: number;
    quotation_subject: string;
    quotation_vatable: boolean;
    restocking_fee: number;
    item_remarks?: string;
    vat_type: string;
    agent_name: string;
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    tsm_name: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    tsm_approval_date: string;
    tsm_remarks: string;
    manager_name: string;
}

interface CompletedProps {
    target_quota?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    contact?: string;
    tsmname?: string;
    managername?: string;
    signature?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 10;

/* ─── Component ──────────────────────────────────────────────────────────── */

export const ApprovalQuotation: React.FC<CompletedProps> = ({
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
}) => {
    const toLocalYMD = (value: Date) => {
        const year  = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day   = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    /* ── State ── */
    const [activities,   setActivities]   = useState<Completed[]>([]);
    const [loading,      setLoading]      = useState(false);
    const [loadingMore,  setLoadingMore]  = useState(false);
    const [error,        setError]        = useState<string | null>(null);
    const [agents,       setAgents]       = useState<any[]>([]);
    const [editItem,     setEditItem]     = useState<Completed | null>(null);
    const [editOpen,     setEditOpen]     = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount,  setTotalCount]  = useState(0);
    const [hasMore,     setHasMore]     = useState(false);

    // Search — two values: committed (drives API) vs draft (input box)
    const [searchTerm,  setSearchTerm]  = useState("");
    const [searchInput, setSearchInput] = useState("");

    /* ── Fetch ── */
    const fetchActivities = useCallback(async (
        page: number = 1,
        loadMore: boolean = false,
        overrideSearch?: string,
    ) => {

        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            if (!loadMore) setCurrentPage(1);
        }
        setError(null);

        try {
            const from = dateCreatedFilterRange?.from
                ? toLocalYMD(new Date(dateCreatedFilterRange.from))
                : null;
            const to = dateCreatedFilterRange?.to
                ? toLocalYMD(new Date(dateCreatedFilterRange.to))
                : null;

            const activeSearch = overrideSearch !== undefined ? overrideSearch : searchTerm;

            const url = new URL("/api/activity/admin/quotation/fetch", window.location.origin);
            url.searchParams.append("statusType", "approved");
            url.searchParams.append("page",  String(page));
            url.searchParams.append("limit", String(ITEMS_PER_PAGE));

            if (activeSearch.trim()) url.searchParams.append("search", activeSearch.trim());
            if (from) url.searchParams.append("from", from);
            if (to)   url.searchParams.append("to",   to);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch activities");
            const data = await res.json();

            const incoming: Completed[] = data.activities || [];

            if (loadMore && page > 1) {
                setActivities((prev) => [...prev, ...incoming]);
            } else {
                setActivities(incoming);
            }

            setTotalCount(data.pagination?.totalCount ?? 0);
            setHasMore(data.pagination?.hasMore     ?? false);
            setCurrentPage(data.pagination?.currentPage ?? page);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
            if (!loadMore) setActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [searchTerm, dateCreatedFilterRange]);

    /* ── Agents ── */
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const res = await fetch(`/api/fetch-all-users-admin`);
                if (!res.ok) throw new Error("Failed to fetch agents");
                const data = await res.json();
                setAgents(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error(err);
                setAgents([]);
            }
        };
        fetchAgents();
    }, []);

    /* ── Initial load + realtime ── */
    useEffect(() => {
        fetchActivities(1, false);

        const channel = supabase
            .channel(`history-manager-approval-all`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm_approved_status=in.("Approved By Sales Head","Approved")`,
                },
                () => { fetchActivities(1, false); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchActivities]);

    /* ── Search handler ── */
    const handleSearch = useCallback(() => {
        setSearchTerm(searchInput);
        // Pass the new search value directly so the callback doesn't use stale closure
        fetchActivities(1, false, searchInput);
    }, [searchInput, fetchActivities]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSearch();
    };

    /* ── Load more ── */
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            fetchActivities(currentPage + 1, true);
        }
    }, [currentPage, hasMore, loadingMore, fetchActivities]);

    /* ── Agent map ── */
    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    /* ── Helpers ── */
    const displayValue = (v: any) =>
        v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

    function formatDuration(start?: string, end?: string) {
        if (!start || !end) return "-";
        const s = new Date(start), e = new Date(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
        let diff = Math.floor((e.getTime() - s.getTime()) / 1000);
        if (diff < 0) diff = 0;
        const hours   = Math.floor(diff / 3600); diff %= 3600;
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        const parts: string[] = [];
        if (hours)   parts.push(`${hours} hr${hours   !== 1 ? "s" : ""}`);
        if (minutes) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
        parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);
        return parts.join(" ");
    }

    /* ── Dialog handlers ── */
    const openEditDialog  = (item: Completed) => { setEditItem(item); setEditOpen(true);  };
    const closeEditDialog = ()                  => { setEditOpen(false); setEditItem(null); };

    /* ── Render ── */
    return (
        <>
            {/* Search */}
            <div className="mb-4 flex items-center gap-2">
                <Input
                    type="text"
                    placeholder="Search quotation number, company name..."
                    className="input input-bordered input-sm flex-1 rounded-none"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-9 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
            </div>

            {/* Error */}
            {error && (
                <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs mb-4">
                    <div className="flex items-center space-x-3">
                        <AlertCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                        <div>
                            <AlertTitle>Error Loading Data</AlertTitle>
                            <AlertDescription className="text-xs">{error}</AlertDescription>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Initial loading */}
            {loading && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-50" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Loading quotations...</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-sm bg-gray-50">
                    <FileX className="w-12 h-12 mb-3 opacity-25" />
                    <p className="text-sm font-bold uppercase tracking-wide text-gray-400">
                        No Approved Quotations Found
                    </p>
                    <p className="text-xs mt-1 text-gray-300">
                        {searchTerm
                            ? "Try adjusting your search term."
                            : "There are currently no quotations approved by Sales Head."}
                    </p>
                </div>
            )}

            {/* Record count */}
            {!loading && activities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Showing {activities.length} of {totalCount} records
                </div>
            )}

            {/* Table */}
            {activities.length > 0 && (
                <div className="overflow-auto space-y-4 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px] text-center">Tools</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Date Created</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead>Date Approved/Decline</TableHead>
                                <TableHead>Contact #</TableHead>
                                <TableHead>Quotation Amount</TableHead>
                                <TableHead className="text-center">Source</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {activities.map((item) => {
                                const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                                return (
                                    <TableRow key={item.id}>
                                        {/* Actions */}
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="rounded-none flex items-center gap-1 text-xs cursor-pointer">
                                                        Actions
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-none text-xs">
                                                    <DropdownMenuItem
                                                        onClick={() => openEditDialog(item)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>

                                        {/* Agent */}
                                        <TableCell className="w-[250px] max-w-[250px]">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {agent?.profilePicture ? (
                                                    <img
                                                        src={agent.profilePicture}
                                                        alt={agent.name}
                                                        className="w-6 h-6 min-w-[24px] rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 min-w-[24px] rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                        N/A
                                                    </div>
                                                )}
                                                <span className="truncate">{agent?.name || "-"}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="uppercase">{displayValue(item.quotation_number)}</TableCell>

                                        <TableCell>
                                            {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                timeZone: "Asia/Manila",
                                            })}
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap font-mono">
                                            {formatDuration(item.start_date, item.end_date)}
                                        </TableCell>

                                        <TableCell className="font-semibold">
                                            {item.company_name}
                                            <br />
                                            <span className="text-[10px] italic">{item.activity_reference_number}</span>
                                        </TableCell>

                                        {/* Status badge */}
                                        <TableCell className="p-2 font-semibold text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold
                                                    ${item.tsm_approved_status === "Approved By Sales Head"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.tsm_approved_status === "Endorsed to Sales Head"
                                                            ? "bg-orange-100 text-orange-700"
                                                            : item.tsm_approved_status === "Decline"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                        </TableCell>

                                        {/* Approval date + remarks */}
                                        <TableCell>
                                            {item.tsm_approval_date
                                                ? new Date(item.tsm_approval_date).toLocaleString("en-PH", {
                                                    timeZone: "Asia/Manila",
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })
                                                : "-"}
                                            <br />
                                            {displayValue(item.tsm_remarks)}
                                        </TableCell>

                                        <TableCell>{displayValue(item.contact_number)}</TableCell>

                                        <TableCell>
                                            {item.quotation_amount != null
                                                ? Number(item.quotation_amount).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                : "-"}
                                        </TableCell>

                                        {/* Source / quotation_type badge */}
                                        <TableCell className="text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold capitalize
                                                    ${item.quotation_type === "Ecoshift Corporation"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.quotation_type === "Disruptive Solutions Inc"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {displayValue(item.quotation_type)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    {/* Load More */}
                    {hasMore && (
                        <div className="flex justify-center py-4 border-t">
                            <Button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                            >
                                {loadingMore && (
                                    <LoaderPinwheel className="w-4 h-4 animate-spin mr-2" />
                                )}
                                {loadingMore ? "Loading..." : "Load More"}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={{
                        ...editItem,
                        restocking_fee: String(editItem.restocking_fee ?? ""),
                        quotation_vatable: String(editItem.quotation_vatable ?? ""),
                        delivery_fee: String(editItem.delivery_fee ?? "")
                    } as any}
                    onClose={closeEditDialog}
                    onSave={() => {
                        fetchActivities(1, false);
                        closeEditDialog();
                    }}
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    managername={managername}
                    signature={signature}
                    company={{
                        company_name:   editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address:  editItem.email_address,
                        address:        editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    vatType={editItem.vat_type}
                    restockingFee={String(editItem.restocking_fee ?? "")}
                    whtType={String(editItem.quotation_vatable ?? "none")}
                    quotationSubject={editItem.quotation_subject ?? "For Quotation"}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    tsmSignature={editItem.tsm_signature}
                    tsmContactNumber={editItem.tsm_contact_number}
                    tsmEmailAddress={editItem.tsm_email_address}
                    managerName={editItem.manager_name}
                    deliveryFee={String(editItem.delivery_fee ?? "")}
                />
            )}
        </>
    );
};