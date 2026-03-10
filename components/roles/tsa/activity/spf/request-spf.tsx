"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, PlusCircle, PenIcon, Trash2Icon, MoreVertical, User } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";

interface Account {
    company_name: string;
    contact_person: string;
    contact_number: string;
    address: string;
}

interface SPF {
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
    start_date?: string;
    end_date?: string;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
}

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by }) => {
    const [activities, setActivities] = useState<SPF[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentSPF, setCurrentSPF] = useState<Partial<SPF>>({});
    const [endTime, setEndTime] = useState<string>("");

    const endTimerRef = useRef<number | null>(null);

    // Accounts
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteProgress, setDeleteProgress] = useState(0);
    const [loadingDelete, setLoadingDelete] = useState(false);
    const deleteIntervalRef = useRef<number | null>(null);

    // Contact selection dialog
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactOptions, setContactOptions] = useState<{ person: string; number: string }[]>([]);
    const [loadingSPF, setLoadingSPF] = useState(false);

    useEffect(() => {
        if (!referenceid) return;

        async function fetchAccounts() {
            try {
                setAccountsLoading(true);

                const res = await fetch(
                    `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`
                );

                if (!res.ok) throw new Error("Failed to fetch accounts");

                const data = await res.json();

                // ✅ Filter only active accounts
                const activeAccounts = (data.data || []).filter(
                    (acc: any) => acc.status?.toLowerCase() === "active"
                );

                setAccounts(activeAccounts);

            } catch (err) {
                console.error("Fetch accounts error:", err);
            } finally {
                setAccountsLoading(false);
            }
        }

        fetchAccounts();
    }, [referenceid]);

    const fetchActivities = useCallback(() => {
        if (!referenceid) return;
        setLoading(true);
        setError(null);

        fetch(`/api/activity/tsa/spf/fetch?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch SPF records");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [referenceid]);

    useEffect(() => {
        // Hiwalay na async function sa loob
        const loadActivities = async () => {
            await fetchActivities();
        };

        loadActivities(); // tawag sa async function

        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "spf",
                    filter: `referenceid=eq.${referenceid}`,
                },
                fetchActivities
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    const generateNextSPF = async () => {
        try {
            setLoadingSPF(true);
            const res = await fetch(`/api/activity/tsa/spf/generate`);
            const data = await res.json();
            const existingSPFs: string[] = data.activities?.map((a: any) => a.spf_number) || [];
            const prefix = "SPF-DSI-";
            const year = new Date().getFullYear();

            const yearSPFs = existingSPFs
                .filter(spf => spf.startsWith(`${prefix}${year}-`))
                .map(spf => parseInt(spf.replace(`${prefix}${year}-`, ""), 10))
                .filter(num => !isNaN(num));

            const maxNumber = yearSPFs.length ? Math.max(...yearSPFs) : 0;
            const nextNumber = maxNumber + 1;
            const nextSPF = `${prefix}${year}-${String(nextNumber).padStart(3, "0")}`;
            setCurrentSPF((prev: any) => ({ ...prev, spf_number: nextSPF }));
        } catch (err) {
            console.error("Failed to generate SPF Number:", err);
        } finally {
            setLoadingSPF(false);
        }
    };


    const openCreateDialogWithAccount = (acc: Account) => {
        setIsEditMode(false);

        const nowISO = new Date().toISOString();

        setCurrentSPF({
            start_date: nowISO,
            end_date: nowISO,
            prepared_by: prepared_by || "",
            customer_name: acc.company_name,
            contact_person: acc.contact_person,
            contact_number: acc.contact_number,
            registered_address: acc.address,
        });

        setEndTime(nowISO);
        setDialogOpen(true);

        endTimerRef.current = window.setInterval(() => {
            const isoNow = new Date().toISOString();
            setEndTime(isoNow);
            setCurrentSPF((prev) => ({ ...prev, end_date: isoNow }));
        }, 1000);
    };

    const openEditDialog = (spf: SPF) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    const openContactSelection = (acc: Account) => {
        const persons = acc.contact_person.split(",").map(p => p.trim());
        const numbers = acc.contact_number.split(",").map(n => n.trim());

        const options = persons.map((p, i) => ({
            person: p,
            number: numbers[i] || numbers[0] || "",
        }));

        setIsEditMode(false);

        setContactOptions(options);
        setCurrentSPF({
            customer_name: acc.company_name,
            registered_address: acc.address,
            prepared_by: prepared_by || "",
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
        });
        setContactDialogOpen(true);
    };

    const selectContact = (person: string, number: string) => {
        setCurrentSPF(prev => ({
            ...prev,
            contact_person: person,
            contact_number: number,
        }));

        // Generate SPF before opening dialog
        generateNextSPF();

        setContactDialogOpen(false);
        setDialogOpen(true);

        // start end date timer
        endTimerRef.current = window.setInterval(() => {
            const nowISO = new Date().toISOString();
            setEndTime(nowISO);
            setCurrentSPF(prev => ({ ...prev, end_date: nowISO }));
        }, 1000);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        if (endTimerRef.current) {
            clearInterval(endTimerRef.current);
            endTimerRef.current = null;
        }
        setCurrentSPF({});
    };

    const handleCreateSPF = async () => {
        if (!currentSPF.spf_number || !currentSPF.customer_name) {
            alert("SPF Number and Customer Name are required");
            return;
        }

        if (endTimerRef.current) {
            clearInterval(endTimerRef.current);
            endTimerRef.current = null;
        }

        const nowISO = new Date().toISOString();
        const finalStartDate = currentSPF.start_date ? new Date(currentSPF.start_date).toISOString() : new Date().toISOString();
        const finalEndDate = currentSPF.end_date ? new Date(currentSPF.end_date).toISOString() : new Date().toISOString();

        try {
            const payload = {
                ...currentSPF,
                start_date: finalStartDate,
                end_date: finalEndDate,
                referenceid,
                tsm,
                manager,
            };

            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to create SPF");

            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to create SPF");
        }
    };

    const handleEditSPF = async () => {
        if (!currentSPF.id) return;
        try {
            const payload = { ...currentSPF, referenceid, tsm, manager };
            const res = await fetch("/api/activity/tsa/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update SPF");

            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to update SPF");
        }
    };


    const openDeleteDialog = (id: number) => {
        setDeleteId(id);
        setDeleteDialogOpen(true);
    };

    const startHoldDelete = () => {
        if (loadingDelete || deleteId === null) return;

        if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
        setDeleteProgress(0);

        deleteIntervalRef.current = window.setInterval(() => {
            setDeleteProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(deleteIntervalRef.current!);
                    handleConfirmDelete();
                    return 100;
                }
                return prev + 1;
            });
        }, 20); // ~2 seconds to fill
    };

    const cancelHoldDelete = () => {
        if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
        setDeleteProgress(0);
    };

    const handleConfirmDelete = async () => {
        if (deleteId === null) return;

        setLoadingDelete(true);
        try {
            const res = await fetch("/api/activity/tsa/spf/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: deleteId }),
            });
            if (!res.ok) throw new Error("Failed to delete SPF");
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to delete SPF");
        } finally {
            setTimeout(() => {
                setLoadingDelete(false);
                setDeleteProgress(0);
                setDeleteDialogOpen(false);
                setDeleteId(null);
            }, 300);
        }
    };

    // 🔹 Filtered arrays based on search term
    const filteredAccounts = accounts.filter(acc =>
        acc.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredActivities = activities.filter(spf =>
        spf.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        spf.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        spf.spf_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;
    if (error)
        return (
            <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                <AlertCircleIcon className="h-6 w-6 text-red-600" />
                <div>
                    <AlertTitle>Error Loading SPF Records</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </div>
            </Alert>
        );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="col-span-4">
                <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-xs"
                    placeholder="Search accounts or SPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="col-span-1 rounded-md border p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold text-sm">Accounts</h2>
                </div>

                {/* Scrollable container */}
                <div className="overflow-auto max-h-[600px]"> {/* adjust 600px as needed */}
                    <Accordion type="single" collapsible className="w-full">
                        {filteredAccounts.map((acc, i) => (
                            <AccordionItem key={i} value={`acc-${i}`} className="border rounded-none mb-2 px-3">

                                {/* HEADER */}
                                <div className="flex items-center justify-between py-2">
                                    {/* Company Name (Accordion Trigger) */}
                                    <AccordionTrigger className="p-0 hover:no-underline text-xs font-medium">
                                        {acc.company_name}
                                    </AccordionTrigger>

                                    {/* Create Button */}
                                    <Button className="rounded-none" onClick={() => openContactSelection(acc)}>
                                        <PlusCircle className="size-4 mr-1" /> Create
                                    </Button>
                                </div>

                                {/* EXPANDED CONTENT */}
                                <AccordionContent>
                                    <div className="grid grid-cols-1 gap-2 text-xs pt-2">
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-muted-foreground capitalize">Contact Person: {acc.contact_person || "-"}</span>
                                        </div>

                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-muted-foreground capitalize">Contact Number: {acc.contact_number || "-"}</span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground capitalize">Address: {acc.address || "-"}</span>
                                        </div>
                                    </div>
                                </AccordionContent>

                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </div>

            <div className="col-span-3 rounded-md border p-4 space-y-3">
                <h2 className="font-semibold text-sm">SPF Records</h2>

                <div className="overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Actions</TableHead>
                                <TableHead className="text-xs">SPF Number</TableHead>
                                <TableHead className="text-xs">Customer Name</TableHead>
                                <TableHead className="text-xs">Contact Person</TableHead>
                                <TableHead className="text-xs">Contact Number</TableHead>
                                <TableHead className="text-xs">Registered Address</TableHead>
                                <TableHead className="text-xs">Delivery Address</TableHead>
                                <TableHead className="text-xs">Billing Address</TableHead>
                                <TableHead className="text-xs">Collection Address</TableHead>
                                <TableHead className="text-xs">Payment Terms</TableHead>
                                <TableHead className="text-xs">Warranty</TableHead>
                                <TableHead className="text-xs">Delivery Date</TableHead>
                                <TableHead className="text-xs">Prepared By</TableHead>
                                <TableHead className="text-xs">Approved By</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredActivities.map((item) => (
                                <TableRow key={item.id} className="text-xs">
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="rounded-none">
                                                    Actions <MoreVertical />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => openEditDialog(item)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openDeleteDialog(item.id)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell>{item.spf_number}</TableCell>
                                    <TableCell>{item.customer_name}</TableCell>
                                    <TableCell>{item.contact_person}</TableCell>
                                    <TableCell>{item.contact_number}</TableCell>
                                    <TableCell>{item.registered_address}</TableCell>
                                    <TableCell>{item.delivery_address || "-"}</TableCell>
                                    <TableCell>{item.billing_address || "-"}</TableCell>
                                    <TableCell>{item.collection_address || "-"}</TableCell>
                                    <TableCell>{item.payment_terms ?? "-"}</TableCell>
                                    <TableCell>{item.warranty || "-"}</TableCell>
                                    <TableCell>{item.delivery_date || "-"}</TableCell>
                                    <TableCell>{item.prepared_by || "-"}</TableCell>
                                    <TableCell>{item.approved_by || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-none p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Select Contact</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-4 mt-4 max-h-72 overflow-y-auto">
                        {contactOptions.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectContact(c.person, c.number)}
                                className="flex items-center w-full p-4 space-x-4 rounded-none shadow-sm border hover:shadow-md transition bg-white"
                            >
                                <div className="flex-shrink-0 bg-blue-100 p-2 rounded-full">
                                    <User className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="font-medium text-sm text-gray-800 capitalize">{c.person}</span>
                                    <span className="text-gray-500 text-xs">{c.number}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <DialogFooter className="mt-4 flex justify-end">
                        <Button variant="outline" onClick={closeDialog} className="rounded-none p-6">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-none p-6">
                    <DialogHeader>
                        <DialogTitle>Delete SPF Record?</DialogTitle>
                    </DialogHeader>

                    <div className="text-xs text-muted-foreground mt-2">
                        Hold the button below to confirm deletion. This action cannot be undone.
                    </div>

                    <DialogFooter className="flex flex-col gap-2 mt-4">
                        <Button
                            variant="outline"
                            className="rounded-none p-6"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={loadingDelete}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="destructive"
                            className="rounded-none p-6 overflow-hidden relative"
                            onMouseDown={startHoldDelete}
                            onMouseUp={cancelHoldDelete}
                            onMouseLeave={cancelHoldDelete}
                            disabled={loadingDelete || deleteId === null}
                        >
                            {loadingDelete ? "Deleting..." : "Hold to Delete"}

                            <div
                                className="absolute top-0 left-0 h-full bg-red-900/30 pointer-events-none transition-all"
                                style={{ width: `${deleteProgress}%` }}
                            />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SPF;