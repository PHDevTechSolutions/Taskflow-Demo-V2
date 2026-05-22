"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PenIcon,
    Search, FileText, Loader2,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";
import { CollaborationHubRowTrigger } from "@/components/collaboration-row-trigger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SPFRecord {
    id: number;
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    delivery_address?: string;
    billing_address?: string;
    collection_address?: string;
    payment_terms?: string;
    warranty?: string;
    delivery_date?: string;
    prepared_by?: string;
    approved_by?: string;
    noted_by?: string;
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    special_instructions?: string;
    status?: string;
    item_description?: string;
    item_photo?: string;
    spf_creation_id?: number | null;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
    firstname?: string;
    lastname?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();

    const getDisplayText = (raw: string) => {
        const map: Record<string, string> = {
            "pending for procurement":  "For Procurement Costing",
            "approved by procurement":  "Ready for Quotation",
            "for revision":             "Revised by Sales",
            "processed by pd":          "Pending for Procurement",
            "approved by tsm":          "Pending on PD",
            "approved by sales head":   "Pending on PD",
            "declined":                 "Declined",
            "endorsed to sales head":   "Endorsed to Sales Head",
        };
        return map[s] || raw || "—";
    };

    const cls =
       s === "approved by procurement"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : s === "endorsed to sales head"
            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
            : s === "pending" || s === "pending for procurement" || s === "approved by tsm"
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : s === "processed by pd"
            ? "bg-red-100 text-red-700 border-red-200"
            : s === "for revision"
            ? "bg-blue-100 text-blue-700 border-blue-200"
            : "bg-gray-100 text-gray-500 border-gray-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border ${cls} rounded-sm`}>
            {getDisplayText(status || "")}
        </span>
    );
};

// ─── Load More Component ─────────────────────────────────────────────────────

const LoadMoreButton: React.FC<{ onClick: () => void; disabled: boolean; loading: boolean }> = ({ onClick, disabled, loading }) => (
    <div className="flex justify-center p-4 border-t">
        <Button
            onClick={onClick}
            disabled={disabled}
            className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
        >
            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            {loading ? "Loading..." : "Load More"}
        </Button>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by, firstname, lastname }) => {
    const searchParams = useSearchParams();
    const highlight = searchParams?.get("highlight");

    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [loading, setLoading]             = useState(false);
    const [loadingMore, setLoadingMore]     = useState(false);
    const [error, setError]                 = useState<string | null>(null);
    const [searchTerm, setSearchTerm]       = useState("");
    const [currentPage, setCurrentPage]     = useState(1);
    const [totalCount, setTotalCount]       = useState(0);
    const [hasMore, setHasMore]             = useState(false);
    const ITEMS_PER_PAGE = 10;

    const [dialogOpen, setDialogOpen]   = useState(false);
    const [isEditMode, setIsEditMode]   = useState(false);
    const [currentSPF, setCurrentSPF]   = useState<Partial<SPFRecord>>({});

    // ── Highlight from URL ──
    useEffect(() => {
        if (highlight) setSearchTerm(highlight);
    }, [highlight]);

    // ── Fetch SPF records with pagination ──
    const fetchActivities = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) return;
        
        if (!loadMore) {
            setLoading(true);
            setError(null);
        } else {
            setLoadingMore(true);
        }
        
        try {
            const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
            const res = await fetch(`/api/activity/manager/spf/fetch?referenceid=${encodeURIComponent(referenceid)}&page=${page}&limit=${ITEMS_PER_PAGE}${searchParam}`);
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();
            
            if (loadMore) {
                setAllActivities(prev => [...prev, ...(data.activities || [])]);
            } else {
                setAllActivities(data.activities || []);
            }
            
            setTotalCount(data.pagination?.totalCount || 0);
            setHasMore(data.pagination?.hasMore || false);
            setCurrentPage(data.pagination?.currentPage || 1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (!loadMore) {
                setLoading(false);
            } else {
                setLoadingMore(false);
            }
        }
    }, [referenceid, searchTerm]);

    useEffect(() => {
        if (!referenceid) return;
        fetchActivities(1, false);
        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "spf_request", filter: `tsm=eq.${tsm}` }, () => fetchActivities(1, false))
            .on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, () => fetchActivities(1, false))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [referenceid, tsm, fetchActivities]);

    // ── Search handler ──
    const handleSearch = useCallback(() => {
        setCurrentPage(1);
        fetchActivities(1, false);
    }, [fetchActivities]);

    // ── Load More handler ──
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            fetchActivities(currentPage + 1, true);
        }
    }, [currentPage, hasMore, loadingMore, fetchActivities]);

    // ── Client-side filter for instant search on loaded items ──
    const searchLower = searchTerm.toLowerCase();
    const filteredActivities = useMemo(() =>
        allActivities.filter((a) =>
            a.customer_name.toLowerCase().includes(searchLower) ||
            a.contact_person.toLowerCase().includes(searchLower) ||
            a.spf_number.toLowerCase().includes(searchLower)
        ),
        [allActivities, searchLower]
    );

    // ── Dialog helpers ──
    const openEditDialog = (spf: SPFRecord) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    const closeDialog = () => { setDialogOpen(false); setCurrentSPF({}); };

    // ── Create / Edit ──
    const handleCreateSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.spf_number || !data.customer_name) { alert("SPF Number and Customer Name are required"); return; }
        const now = new Date().toISOString();
        try {
            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, sales_person: data.prepared_by, start_date: data.start_date || now, end_date: data.end_date || now, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to create SPF");
            closeDialog(); fetchActivities(1, false);
        } catch (err: any) { alert(err.message || "Failed to create SPF"); }
    };

    const handleEditSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.id) return;
        try {
            const res = await fetch("/api/activity/manager/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to update SPF");
            closeDialog(); fetchActivities(1, false);
        } catch (err: any) { alert(err.message || "Failed to update SPF"); }
    };

    // ── Render ──
    if (loading && allActivities.length === 0) return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;

    if (error) return (
        <Alert variant="destructive" className="flex items-start space-x-3 p-4">
            <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
                <AlertTitle className="text-sm font-bold">Error Loading SPF Records</AlertTitle>
                <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
            </div>
        </Alert>
    );

    return (
        <div className="space-y-4">
            {/* ── Search with button ── */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                        className="pl-9 h-10 text-sm rounded-lg border-gray-300 shadow-sm"
                        placeholder="Search customers, SPF numbers, contacts…"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                    />
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                >
                    {loading ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        "Search"
                    )}
                </Button>
            </div>

            {/* ── Table ── */}
            <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <div className="flex-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">SPF Records</h3>
                        <p className="text-[11px] text-gray-500">
                            {filteredActivities.length} shown · {allActivities.length} loaded of {totalCount} total
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    {filteredActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                            <FileText className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-semibold uppercase tracking-wide">
                                {allActivities.length > 0 ? "No matching records" : "No SPF records"}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-900 hover:bg-gray-900">
                                    {["Actions", "Status", "SPF No.", "Customer", "Contact Person", "Contact No.", "Reg. Address", "Delivery", "Billing", "Collection", "Payment", "Warranty", "Delivery Date", "Prepared By", "Approved By"].map((h) => (
                                        <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap px-3 py-2.5">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredActivities.map((item, idx) => {
                                    const isHighlighted = highlight === item.spf_number;
                                    return (
                                        <TableRow
                                            key={item.id}
                                            className={`text-xs ${isHighlighted ? "bg-yellow-100/50 hover:bg-yellow-100/70 border-l-4 border-l-yellow-500" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/60 transition-colors`}
                                        >
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        title="Edit"
                                                        onClick={() => openEditDialog(item)}
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                                    >
                                                        <PenIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <CollaborationHubRowTrigger
                                                        requestId={String(item.id)}
                                                        spfNumber={item.spf_number}
                                                        chatDocId={item.spf_creation_id ?? undefined}
                                                        status={item.status || "PENDING"}
                                                        collectionName="spf_creations"
                                                        title={item.spf_number}
                                                        variant="icon"
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-[#be2d2d] hover:border-[#be2d2d]/30 hover:bg-[#be2d2d]/10 transition-all"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap"><StatusBadge status={item.status} /></TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-gray-700 font-semibold">{item.spf_number}</TableCell>
                                            <TableCell className="px-3 py-2 font-semibold whitespace-nowrap text-gray-900">{item.customer_name}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-700 capitalize">{item.contact_person}</TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-gray-600">{item.contact_number}</TableCell>
                                            <TableCell className="px-3 py-2 max-w-[140px] truncate text-gray-600">{item.registered_address}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.delivery_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.billing_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.collection_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.payment_terms || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-600">{item.warranty || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-gray-600">{item.delivery_date || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.prepared_by || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.approved_by || "—"}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* ── Load More Button ── */}
                {hasMore && (
                    <LoadMoreButton 
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        loading={loadingMore}
                    />
                )}
            </div>

            {/* ── Dialog ── */}
            <RequestDialog
                open={dialogOpen}
                onClose={closeDialog}
                isEditMode={isEditMode}
                prepared_by={prepared_by}
                firstname={firstname}
                lastname={lastname}
                currentSPF={currentSPF}
                setCurrentSPF={setCurrentSPF}
                handleCreateSPF={handleCreateSPF}
                handleEditSPF={handleEditSPF}
                referenceid={referenceid}
            />
        </div>
    );
};

export default SPF;