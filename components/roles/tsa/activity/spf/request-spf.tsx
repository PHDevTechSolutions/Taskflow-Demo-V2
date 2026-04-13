"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PlusCircle, PenIcon, Trash2Icon,
    Search, FileText, Loader2, Building2, User,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";
import { RevisionDialog } from "../../activity/spf/dialog/revision-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
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
    const cls =
        s === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : s === "pending" ? "bg-amber-100 text-amber-700 border-amber-200"
                : s === "declined" ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-gray-100 text-gray-500 border-gray-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border ${cls}`}>
            {status || "—"}
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
            <DialogContent className="rounded-none max-w-sm p-0 overflow-hidden">
                <div className="bg-red-600 px-5 py-4">
                    <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">
                        Delete SPF Record
                    </DialogTitle>
                    {label && <p className="text-red-200 text-[11px] mt-0.5 truncate">{label}</p>}
                </div>
                <div className="px-5 py-3 text-[11px] text-gray-500">
                    Hold the button to permanently delete this record.
                </div>
                <DialogFooter className="flex flex-col gap-2 px-5 pb-5">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
                        className="rounded-none h-9 text-xs uppercase font-bold tracking-wider">
                        Cancel
                    </Button>
                    <div className="relative overflow-hidden">
                        <Button variant="destructive" disabled={loading}
                            onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
                            onTouchStart={startHold} onTouchEnd={cancelHold}
                            className="relative w-full rounded-none h-9 text-xs uppercase font-black tracking-wider">
                            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Deleting…</>
                                : progress > 0 ? `Hold… ${Math.round(progress)}%`
                                    : "Hold to Delete"}
                        </Button>
                        <div className="absolute inset-0 bg-red-900/25 pointer-events-none"
                            style={{ width: `${progress}%` }} />
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by }) => {
    const [activities, setActivities] = useState<SPFRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentSPF, setCurrentSPF] = useState<Partial<SPFRecord>>({});
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactOptions, setContactOptions] = useState<{ person: string; number: string }[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<SPFRecord | null>(null);
    const [loadingSPF, setLoadingSPF] = useState(false);

    // Revision dialog state
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionTargetSpfNumber, setRevisionTargetSpfNumber] = useState<string | null>(null);

    const endTimerRef = useRef<number | null>(null);

    // ─── Fetch accounts ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (!referenceid) return;
        setAccountsLoading(true);
        fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`)
            .then((r) => r.json())
            .then((data) => {
                const active = (data.data || []).filter(
                    (a: any) => a.status?.toLowerCase() === "active"
                );
                setAccounts(active);
            })
            .catch(console.error)
            .finally(() => setAccountsLoading(false));
    }, [referenceid]);

    // ─── Fetch SPF records ───────────────────────────────────────────────────────

    const fetchActivities = useCallback(async () => {
        if (!referenceid) return;
        setLoading(true); setError(null);
        try {
            const res = await fetch(
                `/api/activity/tsa/spf/fetch?referenceid=${encodeURIComponent(referenceid)}`
            );
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();
            setActivities(data.activities || []);
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

    // ─── Request Revision ──────────────────────────────────────────────────────────

    const openRevisionDialog = (spf_number: string) => {
        setRevisionTargetSpfNumber(spf_number);
        setRevisionDialogOpen(true);
    };

    const closeRevisionDialog = () => {
        setRevisionDialogOpen(false);
        setRevisionTargetSpfNumber(null);
    };

    const handleRequestRevision = async (spf_number: string, revision_type: string, revision_remarks: string) => {
        const res = await fetch("/api/activity/tsa/spf/request-revision", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spf_number, revision_type, revision_remarks }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Failed to request revision");
        }
        return res.json();
    };

    // ─── Filtered data ───────────────────────────────────────────────────────────

    const s = searchTerm.toLowerCase();
    const filteredAccounts = accounts.filter(
        (a) => a.company_name.toLowerCase().includes(s) || a.contact_person.toLowerCase().includes(s)
    );
    const filteredActivities = activities.filter(
        (a) =>
            a.customer_name.toLowerCase().includes(s) ||
            a.contact_person.toLowerCase().includes(s) ||
            a.spf_number.toLowerCase().includes(s)
    );

    // ─── Render ──────────────────────────────────────────────────────────────────

    if (loading)
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-7" />
            </div>
        );

    if (error)
        return (
            <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                <AlertCircleIcon className="h-5 w-5 text-red-600" />
                <div>
                    <AlertTitle className="text-xs font-bold">Error Loading SPF Records</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </div>
            </Alert>
        );

    return (
        <div className="space-y-4">

            {/* ── Search bar ──────────────────────────────────────────────────── */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <Input
                    className="pl-9 h-8 text-xs rounded-none border-gray-200"
                    placeholder="Search accounts, SPF number, customer…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* ── Accounts panel ──────────────────────────────────────────────── */}
                <div className="col-span-1 border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                            Accounts
                        </span>
                        {accounts.length > 0 && (
                            <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full ml-auto">
                                {filteredAccounts.length}
                            </span>
                        )}
                    </div>

                    <div className="overflow-y-auto max-h-[600px]">
                        {accountsLoading ? (
                            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs">Loading…</span>
                            </div>
                        ) : filteredAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                                <Building2 className="w-8 h-8 opacity-30" />
                                <p className="text-xs text-gray-400">No accounts found</p>
                            </div>
                        ) : (
                            <Accordion type="single" collapsible className="w-full divide-y divide-gray-100">
                                {filteredAccounts.map((acc, i) => (
                                    <AccordionItem key={i} value={`acc-${i}`} className="border-0 px-0">

                                        {/* ── Row: trigger (left) + Create button (right, always fixed) ── */}
                                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                                            <AccordionTrigger className="p-0 hover:no-underline flex-1 min-w-0 text-xs font-semibold text-gray-700 text-left">
                                                <span className="p-0 hover:no-underline text-xs font-medium">{acc.company_name}</span>
                                            </AccordionTrigger>
                                            <Button
                                                size="sm"
                                                className="h-7 rounded-none text-[10px] font-bold uppercase gap-1 px-2 shrink-0 ml-2 bg-gray-900 hover:bg-gray-700"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openContactSelection(acc);
                                                }}
                                                disabled={loadingSPF}
                                            >
                                                <PlusCircle className="w-3 h-3" /> Create
                                            </Button>
                                        </div>

                                        <AccordionContent className="px-3 pb-3 pt-0">
                                            <div className="space-y-1.5 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                                                {[
                                                    { label: "Contact", value: acc.contact_person },
                                                    { label: "Number", value: acc.contact_number },
                                                    { label: "Address", value: acc.address },
                                                ].map(({ label, value }) => (
                                                    <div key={label} className="flex gap-2">
                                                        <span className="font-bold text-gray-400 w-14 shrink-0">{label}:</span>
                                                        <span className="text-gray-600">{value || "—"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        )}
                    </div>
                </div>

                {/* ── SPF Records table ────────────────────────────────────────────── */}
                <div className="col-span-3 border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                            SPF Records
                        </span>
                        {activities.length > 0 && (
                            <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full ml-auto">
                                {filteredActivities.length}
                            </span>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        {filteredActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 text-gray-300 gap-2">
                                <FileText className="w-8 h-8 opacity-30" />
                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
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
                                            <TableHead key={h} className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap px-3 py-2.5">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredActivities.map((item, idx) => (
                                        <TableRow key={item.id}
                                            className={`text-xs ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-blue-50/40 transition-colors`}>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        title="Edit"
                                                        onClick={() => openEditDialog(item)}
                                                        className="p-1.5 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <PenIcon className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        title="Delete"
                                                        onClick={() => { setDeleteTarget(item); setDeleteDialogOpen(true); }}
                                                        className="p-1.5 border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2Icon className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        title="Request Revision"
                                                        onClick={() => openRevisionDialog(item.spf_number)}
                                                        className="p-1.5 border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <StatusBadge status={item.status} />
                                            </TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{item.spf_number}</TableCell>
                                            <TableCell className="px-3 py-2 font-semibold whitespace-nowrap">{item.customer_name}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">{item.contact_person}</TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{item.contact_number}</TableCell>
                                            <TableCell className="px-3 py-2 max-w-[140px] truncate">{item.registered_address}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400">{item.delivery_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400">{item.billing_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400">{item.collection_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">{item.payment_terms || "—"}</TableCell>
                                            <TableCell className="px-3 py-2">{item.warranty || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap font-mono text-[10px]">{item.delivery_date || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">{item.prepared_by || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap">{item.approved_by || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Contact selection dialog ─────────────────────────────────────── */}
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="max-w-sm rounded-none p-0 overflow-hidden">
                    <div className="bg-gray-900 px-5 py-4">
                        <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">
                            Select Contact
                        </DialogTitle>
                        <p className="text-gray-400 text-[11px] mt-0.5">
                            {currentSPF.customer_name}
                        </p>
                    </div>
                    <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
                        {contactOptions.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectContact(c.person, c.number)}
                                className="flex items-center w-full gap-3 px-3 py-3 border border-gray-200 hover:bg-gray-50 hover:border-gray-400 transition-colors text-left"
                            >
                                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-800 capitalize">{c.person}</p>
                                    <p className="text-[11px] text-gray-400 font-mono">{c.number}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    <DialogFooter className="px-4 pb-4">
                        <Button variant="outline" onClick={() => setContactDialogOpen(false)}
                            className="rounded-none h-8 text-xs uppercase font-bold tracking-wider w-full">
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

            {/* ── Revision dialog ────────────────────────────────────────────────── */}
            <RevisionDialog
                open={revisionDialogOpen}
                onClose={closeRevisionDialog}
                spf_number={revisionTargetSpfNumber}
                onRequestRevision={handleRequestRevision}
            />
        </div>
    );
};

export default SPF;