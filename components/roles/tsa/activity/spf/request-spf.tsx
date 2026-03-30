"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PlusCircle, PenIcon, Trash2Icon,
    Search, FileText, Loader2, Building2, User, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
    id?: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    address: string;
}

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
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    special_instructions?: string;
    status?: string;
    item_description?: string;
    item_photo?: string;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();
    
    // Map status values to display text
    const getDisplayText = (status: string) => {
        const statusMap: Record<string, string> = {
            "pending for procurement": "For Procurement Costing",
            "approved by procurement": "Ready for Quotation", 
            "for revision": "Revised by Sales",
            "approved": "Approved",
            "pending": "Pending",
            "declined": "Declined"
        };
        
        return statusMap[s] || status || "—";
    };
    
    const cls =
        s === "approved" || s === "approved by procurement" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : s === "pending" || s === "pending for procurement" ? "bg-amber-100 text-amber-700 border-amber-200"
                : s === "declined" ? "bg-red-100 text-red-700 border-red-200"
                    : s === "for revision" ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-gray-100 text-gray-500 border-gray-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border ${cls} rounded-sm`}>
            {getDisplayText(status || "")}
        </span>
    );
};

// ─── Hold-to-delete dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => Promise<void>;
    label?: string;
}

const HoldDeleteDialog: React.FC<DeleteDialogProps> = ({
    open, onOpenChange, onConfirm, label,
}) => {
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<number | null>(null);

    const clear = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    useEffect(() => { if (!open) { clear(); setProgress(0); } }, [open]);
    useEffect(() => () => clear(), []);

    const startHold = () => {
        if (loading) return;
        clear(); setProgress(0);
        timerRef.current = window.setInterval(() => {
            setProgress((p) => {
                const n = p + 2;
                if (n >= 100) { clear(); triggerDelete(); return 100; }
                return n;
            });
        }, 20);
    };

    const cancelHold = () => { clear(); setProgress(0); };

    const triggerDelete = async () => {
        setLoading(true);
        try { await onConfirm(); onOpenChange(false); }
        catch { /* parent handles error */ }
        finally { setLoading(false); setProgress(0); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-lg max-w-sm p-0 overflow-hidden border border-red-200">
                <div className="bg-red-600 px-6 py-4">
                    <DialogTitle className="text-white text-sm font-bold uppercase tracking-wider">
                        Delete SPF Record
                    </DialogTitle>
                    {label && <p className="text-red-200 text-xs mt-1">{label}</p>}
                </div>
                <div className="px-6 py-3 text-sm text-gray-600">
                    Hold the button to permanently delete this record.
                </div>
                <DialogFooter className="flex flex-col gap-2 px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
                        className="rounded-lg h-9 text-xs uppercase font-bold tracking-wide border-gray-300">
                        Cancel
                    </Button>
                    <div className="relative overflow-hidden rounded-lg">
                        <Button variant="destructive" disabled={loading}
                            onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
                            onTouchStart={startHold} onTouchEnd={cancelHold}
                            className="relative w-full h-9 text-xs uppercase font-bold tracking-wide">
                            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</>
                                : progress > 0 ? `Hold… ${Math.round(progress)}%`
                                    : "Hold to Delete"}
                        </Button>
                        <div className="absolute inset-0 bg-red-900/30 pointer-events-none transition-all"
                            style={{ width: `${progress}%` }} />
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Pagination Component ─────────────────────────────────────────────────────

interface PaginationProps {
    total: number;
    current: number;
    perPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ total, current, perPage, onPageChange }) => {
    const totalPages = Math.ceil(total / perPage);
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600">
                Showing {total === 0 ? 0 : (current - 1) * perPage + 1}–{Math.min(current * perPage, total)} of {total}
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(current - 1)}
                    disabled={current === 1}
                    className="rounded-lg h-8 w-8 p-0 border-gray-300"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - current) <= 1 || p === 1 || p === totalPages)
                        .map((p, i, arr) => (
                            <React.Fragment key={p}>
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-gray-400">…</span>}
                                <Button
                                    variant={p === current ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => onPageChange(p)}
                                    className="rounded-lg h-8 w-8 p-0 text-xs font-bold"
                                >
                                    {p}
                                </Button>
                            </React.Fragment>
                        ))}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(current + 1)}
                    disabled={current === totalPages}
                    className="rounded-lg h-8 w-8 p-0 border-gray-300"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by }) => {
    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination
    const [accountsPage, setAccountsPage] = useState(1);
    const [recordsPage, setRecordsPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentSPF, setCurrentSPF] = useState<Partial<SPFRecord>>({});
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactOptions, setContactOptions] = useState<{ person: string; number: string }[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<SPFRecord | null>(null);
    const [loadingSPF, setLoadingSPF] = useState(false);

    const endTimerRef = useRef<number | null>(null);

    // ─── Fetch accounts (all, not paginated on API level) ────────────────────────

    useEffect(() => {
        if (!referenceid) return;
        setAccountsLoading(true);
        fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`)
            .then((r) => r.json())
            .then((data) => {
                const active = (data.data || []).filter(
                    (a: any) => a.status?.toLowerCase() === "active"
                );
                setAllAccounts(active);
            })
            .catch(console.error)
            .finally(() => setAccountsLoading(false));
    }, [referenceid]);

    // ─── Fetch SPF records (all) ─────────────────────────────────────────────────

    const fetchActivities = useCallback(async () => {
        if (!referenceid) return;
        setLoading(true); setError(null);
        try {
            const res = await fetch(
                `/api/activity/tsa/spf/fetch?referenceid=${encodeURIComponent(referenceid)}`
            );
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();
            setAllActivities(data.activities || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();
        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on("postgres_changes",
                { event: "*", schema: "public", table: "spf", filter: `referenceid=eq.${referenceid}` },
                fetchActivities
            )
            .on("postgres_changes",
                { event: "*", schema: "public", table: "spf_creation" },
                fetchActivities
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    // ─── SPF number generator ────────────────────────────────────────────────────

    const generateNextSPF = useCallback(async (): Promise<string> => {
        setLoadingSPF(true);
        try {
            const res = await fetch("/api/activity/tsa/spf/generate");
            const data = await res.json();
            const existing: string[] = data.activities?.map((a: any) => a.spf_number) || [];
            const prefix = "SPF-DSI-";
            const year = new Date().getFullYear().toString().slice(-2);
            const nums = existing
                .filter((s) => s.startsWith(`${prefix}${year}-`))
                .map((s) => parseInt(s.replace(`${prefix}${year}-`, ""), 10))
                .filter((n) => !isNaN(n));
            const next = (nums.length ? Math.max(...nums) : 0) + 1;
            return `${prefix}${year}-${String(next).padStart(3, "0")}`;
        } catch (err) {
            console.error("SPF generate error:", err);
            return `SPF-DSI-${Date.now()}`;
        } finally {
            setLoadingSPF(false);
        }
    }, []);

    // ─── Filter data based on search (searches entire dataset) ────────────────────

    const searchLower = searchTerm.toLowerCase();
    const filteredAccounts = useMemo(() =>
        allAccounts.filter(
            (a) =>
                a.company_name.toLowerCase().includes(searchLower) ||
                a.contact_person.toLowerCase().includes(searchLower) ||
                a.address.toLowerCase().includes(searchLower)
        ),
        [allAccounts, searchLower]
    );

    const filteredActivities = useMemo(() =>
        allActivities.filter(
            (a) =>
                a.customer_name.toLowerCase().includes(searchLower) ||
                a.contact_person.toLowerCase().includes(searchLower) ||
                a.spf_number.toLowerCase().includes(searchLower)
        ),
        [allActivities, searchLower]
    );

    // ─── Paginate filtered data ────────────────────────────────────────────────────

    const paginatedAccounts = useMemo(() => {
        const start = (accountsPage - 1) * ITEMS_PER_PAGE;
        return filteredAccounts.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAccounts, accountsPage]);

    const paginatedActivities = useMemo(() => {
        const start = (recordsPage - 1) * ITEMS_PER_PAGE;
        return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredActivities, recordsPage]);

    // ─── Open edit ───────────────────────────────────────────────────────────────

    const openEditDialog = (spf: SPFRecord) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    // ─── Open create (contact selection first) ──────────────────────────────────

    const openContactSelection = (acc: Account) => {
        const persons = acc.contact_person.split(",").map((p) => p.trim());
        const numbers = acc.contact_number.split(",").map((n) => n.trim());
        const options = persons.map((p, i) => ({
            person: p,
            number: numbers[i] || numbers[0] || "",
        }));
        setContactOptions(options);
        setCurrentSPF({
            customer_name: acc.company_name,
            registered_address: acc.address,
            prepared_by: prepared_by || "",
            sales_person: prepared_by || "",
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
        });
        setIsEditMode(false);
        setContactDialogOpen(true);
    };

    const selectContact = async (person: string, number: string) => {
        setContactDialogOpen(false);
        const spfNumber = await generateNextSPF();
        setCurrentSPF((prev) => ({
            ...prev,
            contact_person: person,
            contact_number: number,
            spf_number: spfNumber,
        }));
        setDialogOpen(true);
        // Live end_date timer
        if (endTimerRef.current) clearInterval(endTimerRef.current);
        endTimerRef.current = window.setInterval(() => {
            const now = new Date().toISOString();
            setCurrentSPF((prev) => ({ ...prev, end_date: now }));
        }, 1000);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        setCurrentSPF({});
    };

    // ─── Create / Edit ───────────────────────────────────────────────────────────

    const handleCreateSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.spf_number || !data.customer_name) {
            alert("SPF Number and Customer Name are required");
            return;
        }
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        const now = new Date().toISOString();
        try {
            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    sales_person: data.prepared_by,
                    start_date: data.start_date || now,
                    end_date: data.end_date || now,
                    referenceid, tsm, manager,
                }),
            });
            if (!res.ok) throw new Error("Failed to create SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to create SPF");
        }
    };

    const handleEditSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.id) return;
        try {
            const res = await fetch("/api/activity/tsa/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to update SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to update SPF");
        }
    };

    // ─── Delete ──────────────────────────────────────────────────────────────────

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const res = await fetch("/api/activity/tsa/spf/delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deleteTarget.id }),
        });
        if (!res.ok) throw new Error("Failed to delete SPF");
        setDeleteTarget(null);
        fetchActivities();
    };

    // ─── Render ──────────────────────────────────────────────────────────────────

    if (loading)
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );

    if (error)
        return (
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

            {/* ── Search bar ──────────────────────────────────────────────────── */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                    className="pl-9 h-10 text-sm rounded-lg border-gray-300 shadow-sm"
                    placeholder="Search accounts, customers, SPF numbers, contacts…"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setAccountsPage(1); setRecordsPage(1); }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* ── Accounts panel ──────────────────────────────────────────────── */}
                <div className="col-span-1 border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                        <Building2 className="w-4 h-4 text-gray-600" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                Accounts
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                {filteredAccounts.length} of {allAccounts.length}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-100">
                        {accountsLoading ? (
                            <div className="flex items-center justify-center py-12 text-gray-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : paginatedAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2 px-4">
                                <Building2 className="w-10 h-10 opacity-20" />
                                <p className="text-xs font-semibold text-center">No accounts found</p>
                            </div>
                        ) : (
                            paginatedAccounts.map((acc, i) => (
                                <div key={acc.id || i} className="p-3 hover:bg-blue-50 transition-colors">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-bold text-gray-900 truncate">
                                                {acc.company_name}
                                            </h4>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {acc.contact_person}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-7 rounded-lg text-[10px] font-bold uppercase gap-1 px-2 shrink-0 bg-gray-900 hover:bg-gray-700"
                                            onClick={() => openContactSelection(acc)}
                                            disabled={loadingSPF}
                                        >
                                            <PlusCircle className="w-3 h-3" /> Create
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 truncate">
                                        {acc.address}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {filteredAccounts.length > ITEMS_PER_PAGE && (
                        <Pagination
                            total={filteredAccounts.length}
                            current={accountsPage}
                            perPage={ITEMS_PER_PAGE}
                            onPageChange={setAccountsPage}
                        />
                    )}
                </div>

                {/* ── SPF Records table ────────────────────────────────────────────── */}
                <div className="col-span-3 border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm flex flex-col">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <div className="flex-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                SPF Records
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                {filteredActivities.length} of {allActivities.length}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        {paginatedActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                                <FileText className="w-12 h-12 opacity-20" />
                                <p className="text-sm font-semibold uppercase tracking-wide">
                                    No SPF records
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-900 hover:bg-gray-900">
                                        {[
                                            "Actions", "Status", "SPF No.", "Customer",
                                            "Contact Person", "Contact No.", "Reg. Address",
                                            "Delivery", "Billing", "Collection",
                                            "Payment", "Warranty", "Delivery Date",
                                            "Prepared By", "Approved By",
                                        ].map((h) => (
                                            <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap px-3 py-2.5">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedActivities.map((item, idx) => (
                                        <TableRow key={item.id}
                                            className={`text-xs ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/60 transition-colors`}>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        title="Edit"
                                                        onClick={() => openEditDialog(item)}
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                                    >
                                                        <PenIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        title="Delete"
                                                        onClick={() => { setDeleteTarget(item); setDeleteDialogOpen(true); }}
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
                                                    >
                                                        <Trash2Icon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <StatusBadge status={item.status} />
                                            </TableCell>
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
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {filteredActivities.length > ITEMS_PER_PAGE && (
                        <Pagination
                            total={filteredActivities.length}
                            current={recordsPage}
                            perPage={ITEMS_PER_PAGE}
                            onPageChange={setRecordsPage}
                        />
                    )}
                </div>
            </div>

            {/* ── Contact selection dialog ─────────────────────────────────────── */}
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="max-w-sm rounded-lg p-0 overflow-hidden border border-gray-200">
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4">
                        <DialogTitle className="text-white text-sm font-bold uppercase tracking-wide">
                            Select Contact
                        </DialogTitle>
                        <p className="text-gray-400 text-xs mt-1.5">
                            {currentSPF.customer_name}
                        </p>
                    </div>
                    <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
                        {contactOptions.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectContact(c.person, c.number)}
                                className="flex items-center w-full gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 capitalize">{c.person}</p>
                                    <p className="text-xs text-gray-500 font-mono">{c.number}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    <DialogFooter className="px-6 pb-6 bg-gray-50 border-t border-gray-100">
                        <Button variant="outline" onClick={() => setContactDialogOpen(false)}
                            className="rounded-lg h-9 text-xs uppercase font-bold tracking-wide w-full border-gray-300">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Request / Edit dialog ────────────────────────────────────────── */}
            <RequestDialog
                open={dialogOpen}
                onClose={closeDialog}
                isEditMode={isEditMode}
                prepared_by={prepared_by}
                currentSPF={currentSPF}
                setCurrentSPF={setCurrentSPF}
                handleCreateSPF={handleCreateSPF}
                handleEditSPF={handleEditSPF}
                referenceid={referenceid}
            />

            {/* ── Delete dialog ────────────────────────────────────────────────── */}
            <HoldDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={(v) => { setDeleteDialogOpen(v); if (!v) setDeleteTarget(null); }}
                onConfirm={confirmDelete}
                label={deleteTarget ? `${deleteTarget.spf_number} — ${deleteTarget.customer_name}` : undefined}
            />
        </div>
    );
};

export default SPF;
