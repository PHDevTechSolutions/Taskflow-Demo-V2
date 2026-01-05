"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { DoneDialog } from "./activity-tsm-done-dialog";
import { supabase } from "@/utils/supabase";
import { type DateRange } from "react-day-picker";

interface Company {
    account_reference_number: string;
    company_name: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
}

interface HistoryItem {
    id: string;
    activity_reference_number: string;
    quotation_number?: string | null;
    quotation_amount?: number | null;
    so_number?: string | null;
    so_amount?: number | null;
    call_type?: string;
    source?: string;
    call_status?: string;
    type_activity: string;
    remarks: string;

    date_followup?: string;
    ticket_reference_number?: string;
    tsm_approved_status?: string;
    account_reference_number?: string;
    date_created?: string;
    date_updated?: string;
}

interface ScheduledProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

export const Scheduled: React.FC<ScheduledProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [doneOpen, setDoneOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (!referenceid) return;
        setLoading(true);
        setError(null);

        try {
            const [c, h] = await Promise.all([
                fetch("/api/com-fetch-companies").then((r) => r.json()),
                fetch(`/api/act-fetch-tsm-history?referenceid=${referenceid}`).then((r) =>
                    r.json()
                ),
            ]);

            setCompanies(c.data || []);
            setHistory(h.activities || []);
        } catch {
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [referenceid]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        if (!referenceid) return;

        const historyChannel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm=eq.${referenceid}`,
                },
                fetchAll
            )
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
        };
    }, [referenceid, fetchAll]);

    function isScheduledToday(dateStr?: string): boolean {
        if (!dateStr) return false;
        const scheduledDate = new Date(dateStr);
        const today = new Date();

        return (
            scheduledDate.getFullYear() === today.getFullYear() &&
            scheduledDate.getMonth() === today.getMonth() &&
            scheduledDate.getDate() === today.getDate()
        );
    }

    const allowedType = [
        "Sent Quotation Standard",
        "Sent Quotation with Special Price",
        "Sent Quotation with SPF",
    ];

    // Filter and map history items directly (no grouping)
    const filteredHistory = history
        .filter((h) => {
            if (!isScheduledToday(h.date_followup)) return false;
            if (!allowedType.includes(h.call_type ?? "")) return false;
            return true;
        })
        .map((h) => {
            const company = companies.find(
                (c) => c.account_reference_number === h.account_reference_number
            );

            return {
                ...h,
                company_name: company?.company_name ?? "Unknown",
                contact_number: company?.contact_number ?? "-",
            };
        })
        .filter((item) => {
            const term = search.toLowerCase();

            if (
                item.company_name.toLowerCase().includes(term) ||
                item.ticket_reference_number?.toLowerCase().includes(term) ||
                item.quotation_number?.toLowerCase().includes(term) ||
                item.so_number?.toLowerCase().includes(term) ||
                item.remarks.toLowerCase().includes(term)
            )
                return true;

            if (dateCreatedFilterRange?.from) {
                if (new Date(item.date_created ?? "") < dateCreatedFilterRange.from)
                    return false;
            }

            if (dateCreatedFilterRange?.to) {
                if (new Date(item.date_created ?? "") > dateCreatedFilterRange.to)
                    return false;
            }

            return false;
        })
        .sort(
            (a, b) => new Date(b.date_updated ?? "").getTime() - new Date(a.date_updated ?? "").getTime()
        );

    const openDone = (id: string) => {
        setSelectedId(id);
        setDoneOpen(true);
    };

    const confirmDone = async (data: {
        tsmapprovedstatus: string;
        tsmapprovedremarks: string;
        tsmapproveddate: string;
    }) => {
        if (!selectedId) return;

        setUpdatingId(selectedId);
        setDoneOpen(false);

        try {
            const response = await fetch("/api/act-update-tsm-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedId,
                    tsmapprovedstatus: data.tsmapprovedstatus,
                    tsmapprovedremarks: data.tsmapprovedremarks,
                    tsmapproveddate: data.tsmapproveddate,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                toast.error(`Failed to update: ${error.error || "Unknown error"}`);
                setUpdatingId(null);
                return;
            }

            toast.success("Transaction marked as Approved");
            setUpdatingId(null);
            setSelectedId(null);
            fetchAll();
        } catch (error) {
            toast.error("Failed to update transaction");
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="text-xs">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <Input
                placeholder="Search company, ticket, quotation, SO..."
                className="text-xs mb-4"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            <div className="max-h-[70vh] overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs">Company</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Quotation #</TableHead>
                            <TableHead className="text-xs">Quotation Amount</TableHead>
                            <TableHead className="text-xs">TSA Remarks</TableHead>
                            <TableHead className="text-xs">Feedback</TableHead>
                            <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-xs">
                                    No records found
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredHistory.map((item) => (
                            <TableRow key={item.id} className="text-xs">
                                <TableCell className="font-semibold">{item.company_name}</TableCell>
                                <TableCell>
                                    <Badge className="text-[10px]">{item.call_type}</Badge>
                                </TableCell>
                                <TableCell>{item.quotation_number ?? "-"}</TableCell>
                                <TableCell>
                                    {(item.quotation_amount ?? 0).toLocaleString("en-PH", {
                                        style: "currency",
                                        currency: "PHP",
                                    })}
                                </TableCell>
                                <TableCell>{item.remarks ?? "-"}</TableCell>
                                <TableCell className="uppercase">{item.tsm_approved_status ?? "-"}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        disabled={updatingId === item.id}
                                        onClick={() => openDone(item.id)}
                                    >
                                        {updatingId === item.id ? "Validating..." : "Validate"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <DoneDialog
                open={doneOpen}
                onOpenChange={setDoneOpen}
                onConfirm={confirmDone}
                loading={updatingId !== null}
            />
        </>
    );
};
