"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AlertCircleIcon, Eye, Search, Loader2, FileX } from "lucide-react";
import { supabase } from "@/utils/supabase";
import TaskListEditDialog from "./dialog/edit";

interface Quotation {
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

interface QuotationProps {
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

export const Quotation: React.FC<QuotationProps> = ({
    referenceid,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
}) => {
    const [activities, setActivities] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [editItem, setEditItem] = useState<Quotation | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [agents, setAgents] = useState<any[]>([]);

    // -----------------------------
    // FETCH AGENTS
    // -----------------------------
    useEffect(() => {
        fetch("/api/fetch-all-user")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch agents");
                return res.json();
            })
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => {
                // Non-blocking — agents are supplementary (avatars/names)
                setAgents([]);
            });
    }, []);

    // -----------------------------
    // FETCH ACTIVITIES
    // -----------------------------
    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;

        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        try {
            const url = new URL(
                "/api/activity/csr/quotation/fetch",
                window.location.origin
            );

            if (from && to) {
                url.searchParams.append("from", from);
                url.searchParams.append("to", to);
            }

            const res = await fetch(url.toString());
            if (!res.ok)
                throw new Error(`Failed to fetch activities (${res.status})`);

            const data = await res.json();
            setActivities(data.activities || []);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [dateCreatedFilterRange]);

    // Fetch on mount + real-time subscription
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities();

        const channel = supabase
            .channel("history-all")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "history" },
                () => fetchActivities()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    // -----------------------------
    // SORT & FILTER
    // -----------------------------
    const sortedActivities = useMemo(() => {
        return [...activities].sort(
            (a, b) =>
                new Date(b.date_created).getTime() -
                new Date(a.date_created).getTime()
        );
    }, [activities]);

const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return sortedActivities.filter((item) => {
        if (!search) return true;
        return Object.values(item).some(
            (val) =>
                val != null &&
                String(val).toLowerCase().includes(search)
        );
    });
}, [sortedActivities, searchTerm]);

    // -----------------------------
    // AGENT MAP
    // -----------------------------
    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> =
            {};
        agents.forEach((agent) => {
            if (agent.Firstname && agent.Lastname) {
                const fullName = `${agent.Firstname} ${agent.Lastname}`;
                map[fullName.toLowerCase()] = {
                    name: fullName,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    const openEditDialog = (item: Quotation) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    // -----------------------------
    // HELPERS
    // -----------------------------
    const getAccentClass = (status: string) => {
        if (status === "Approved") return "bg-emerald-500";
        if (status === "Pending") return "bg-amber-400";
        return "bg-gray-300";
    };

// -----------------------------
// DOWNLOAD CSV
// -----------------------------
const handleDownloadCSV = () => {
    if (!filteredActivities.length) return;

    const headers = [
        "Agent Name",
        "Company Name",
        "Contact Person",
        "Contact Number",
        "Quotation Number",
        "Amount",
        "Status",
        "Date Created"
    ];

    const rows = filteredActivities.map((item) => [
        item.agent_name || "",
        item.company_name || "",
        item.contact_person || "",
        item.contact_number || "",
        item.quotation_number || "",
        item.quotation_amount || "",
        item.tsm_approved_status || "",
        item.date_created?.slice(0, 10) || ""
    ]);

    const csvContent =
        [headers, ...rows]
            .map((row) =>
                row
                    .map((field) =>
                        `"${String(field).replace(/"/g, '""')}"`
                    )
                    .join(",")
            )
            .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "quotation_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

    const getBadgeClass = (status: string) => {
        if (status === "Approved")
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";
        if (status === "Pending")
            return "bg-amber-50 text-amber-700 border border-amber-200";
        return "bg-gray-100 text-gray-500 border border-gray-200";
    };

    const formatAmount = (amount?: number) => {
        if (!amount) return "—";
        return `₱${amount.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    // -----------------------------
    // RENDER
    // -----------------------------
    return (
        <>
            {/* Search Bar */}
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search quotations…"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-14 text-gray-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading quotations…</span>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 mb-4">
                    <AlertCircleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-red-700">
                            Connection Error
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <FileX className="w-9 h-9 opacity-25" />
                    <p className="text-xs font-semibold uppercase tracking-widest">
                        No quotations found
                    </p>
                    {searchTerm && (
                        <p className="text-[11px] text-gray-300">
                            Try adjusting your search
                        </p>
                    )}
                </div>
            )}

            {/* Record Count */}
            {!loading && filteredActivities.length > 0 && (
<div className="mb-3 flex items-center justify-between">
    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
        {filteredActivities.length} Record
        {filteredActivities.length !== 1 ? "s" : ""}
    </span>

    <div className="flex items-center gap-2">
        <button
            onClick={handleDownloadCSV}
            className="text-[10px] font-medium px-2 py-1 rounded border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
            Download
        </button>

        <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wide bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            Quotation List
        </span>
    </div>
</div>
            )}

            {/* Cards */}
            {!loading && (
                <div className="h-[500px] overflow-y-auto space-y-2.5 pr-0.5">
                    {filteredActivities.map((item) => {
                        const agentKey = item.agent_name?.toLowerCase() ?? "";
                        const agent = agentMap[agentKey];
                        const displayName =
                            agent?.name || item.agent_name || "Unknown";

                        return (
                            <div
                                key={item.id}
                                className="flex border border-gray-100 rounded-lg bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-150 overflow-hidden"
                            >
                                {/* Left accent strip */}
                                <div
                                    className={`w-1 flex-shrink-0 ${getAccentClass(item.tsm_approved_status)}`}
                                />

                                <div className="flex-1 px-3.5 py-3 min-w-0">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {agent?.profilePicture ? (
                                                <img
                                                    src={agent.profilePicture}
                                                    alt={displayName}
                                                    className="w-7 h-7 rounded-full object-cover border border-gray-100 flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[9px] font-semibold text-blue-500 flex-shrink-0">
                                                    {getInitials(displayName)}
                                                </div>
                                            )}
                                            <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-tight truncate">
                                                {displayName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wide ${getBadgeClass(item.tsm_approved_status)}`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    openEditDialog(item)
                                                }
                                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                            >
                                                <Eye className="w-3 h-3" />
                                                View
                                            </button>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-gray-100 mb-2.5" />

                                    {/* Company Info */}
                                    <div className="mb-2">
                                        <p className="text-[12px] font-semibold text-gray-800 leading-tight">
                                            {item.company_name || "—"}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {[
                                                item.contact_person,
                                                item.contact_number,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ") || "—"}
                                        </p>
                                    </div>

                                    {/* Detail Grid */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Ref #
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500">
                                                {item.activity_reference_number}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Quotation #
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500">
                                                {item.quotation_number || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Amount
                                            </p>
                                            <p className="text-[12px] font-semibold text-emerald-600">
                                                {formatAmount(
                                                    item.quotation_amount
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Date
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500">
                                                {item.date_created.slice(0, 10)}
                                            </p>
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