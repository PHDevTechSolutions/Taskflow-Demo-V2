"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon, Eye, Search, Loader2, FileX } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TaskListEditDialog from "../../dialog/edit";
import { ButtonGroup } from "@/components/ui/button-group";

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
    delivery_fee: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    item_remarks?: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    agent_name: string;

    tsm_name: string;
    tsm_approval_date: string;
    tsm_remarks: string;

    vat_type: string;
}

interface ScheduledProps {
    referenceid: string;
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

export const EndorsedQuotation : React.FC<ScheduledProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [agents, setAgents] = useState<any[]>([]);

    // -----------------------------
    // FETCH ACTIVITIES
    // -----------------------------
    const fetchActivities = useCallback(async () => {
        if (!referenceid) return;

        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        try {
            const url = new URL("/api/activity/tsm/quotation/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            if (from && to) {
                url.searchParams.append("from", from);
                url.searchParams.append("to", to);
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`Failed to fetch activities (${res.status})`);
            const data = await res.json();
            setActivities(data.activities || []);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [referenceid, dateCreatedFilterRange]);

    // Fetch agents
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => res.json())
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => setError("Failed to load agents."));
    }, [referenceid]);

    // Fetch on mount + real-time subscription
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities();

        const channel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm=eq.${referenceid}`,
                },
                () => { fetchActivities(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    // -----------------------------
    // SORT & FILTER
    // -----------------------------
    const sortedActivities = useMemo(() => {
        return [...activities].sort(
            (a, b) =>
                new Date(b.date_updated ?? b.date_created).getTime() -
                new Date(a.date_updated ?? a.date_created).getTime()
        );
    }, [activities]);

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();
        return sortedActivities
            .filter(
                (item) =>
                    item.type_activity === "Quotation Preparation" &&
                    item.tsm_approved_status === "Endorsed to Sales Head"
            )
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some(
                    (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(search)
                );
            });
    }, [sortedActivities, searchTerm]);

    // -----------------------------
    // AGENT MAP
    // -----------------------------
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

    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "Approved": return "bg-emerald-600 text-white";
            case "Pending": return "bg-amber-500 text-white";
            case "Decline": return "bg-red-500 text-white";
            case "Endorsed to Sales Head": return "bg-blue-600 text-white";
            default: return "bg-gray-400 text-white";
        }
    };

    return (
        <>
            {/* Search Bar */}
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                    type="text"
                    placeholder="Search quotations..."
                    className="pl-9 rounded-none text-xs h-9 border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs">Loading quotations...</span>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <Alert variant="destructive" className="rounded-none text-xs mb-4">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold">Connection Error</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}

            {/* Empty State */}
            {!loading && !error && filteredActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <FileX className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-xs font-semibold uppercase tracking-wide">No pending quotations</p>
                    {searchTerm && (
                        <p className="text-xs mt-1 text-gray-300">Try adjusting your search</p>
                    )}
                </div>
            )}

            {/* Record Count */}
            {!loading && filteredActivities.length > 0 && (
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        {filteredActivities.length} Record{filteredActivities.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold uppercase bg-amber-50 px-2 py-0.5 border border-amber-200">
                        Waiting Approval for Sales Head
                    </span>
                </div>
            )}

            {/* Cards */}
            {!loading && (
                <div className="h-[500px] overflow-y-auto space-y-3 pr-1">
                    {filteredActivities.map((item) => {
                        const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                        return (
                            <div
                                key={item.id}
                                className="border rounded-sm bg-white hover:shadow-md transition-shadow duration-200 relative overflow-hidden"
                            >
                                {/* Left accent strip by status */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.tsm_approved_status === "Approved" ? "bg-emerald-500" : item.tsm_approved_status === "Pending" ? "bg-amber-500" : "bg-gray-300"}`} />

                                <div className="pl-4 pr-3 pt-3 pb-3">
                                    {/* Header Row */}
                                    <div className="flex justify-between items-start mb-2.5">
                                        <div className="flex items-center gap-2">
                                            {agent?.profilePicture ? (
                                                <img
                                                    src={agent.profilePicture}
                                                    alt={agent.name}
                                                    className="w-7 h-7 rounded-full object-cover border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] text-gray-500 font-bold">
                                                    {agent?.name?.charAt(0) ?? "?"}
                                                </div>
                                            )}
                                            <span className="font-bold text-[11px] text-gray-800 uppercase tracking-tight">
                                                {agent?.name || item.referenceid || "—"}
                                            </span>
                                        </div>

                                        {/* Status + Action */}
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wide ${statusColor(item.tsm_approved_status)}`}>
                                                {item.tsm_approved_status}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-none h-7 text-[10px] px-2 border-gray-300 hover:bg-gray-50"
                                                onClick={() => openEditDialog(item)}
                                            >
                                                <Eye className="w-3 h-3 mr-1" />
                                                View
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                        <div className="col-span-2">
                                            <span className="font-semibold text-gray-500">Company: </span>
                                            <span className="font-bold text-gray-800 uppercase">{item.company_name || "—"}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Ref #: </span>
                                            <span className="font-mono text-[10px] text-gray-600">{item.activity_reference_number}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Quotation #: </span>
                                            <span className="text-gray-700 uppercase">{item.quotation_number || "—"}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Amount: </span>
                                            <span className="font-bold text-emerald-700">
                                                {item.quotation_amount
                                                    ? `₱${item.quotation_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Date: </span>
                                            <span className="font-mono text-[10px] text-gray-600">{item.date_created.slice(0, 10)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={() => {
                        fetchActivities();
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
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    deliveryFee={editItem.delivery_fee}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    vatType={editItem.vat_type}
                />
            )}
        </>
    );
};