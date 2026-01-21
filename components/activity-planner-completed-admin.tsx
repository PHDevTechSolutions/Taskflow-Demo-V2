"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { type DateRange } from "react-day-picker";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ================= TYPES ================= */

interface HistoryItem {
    id: string;
    referenceid: string;
    activity_reference_number: string;

    // Companies
    company_name?: string;
    contact_number?: string;
    contact_person?: string;
    email_address?: string;

    // Outbound History
    call_status?: string;
    call_type?: string;

    // Quotation History
    quotation_number?: string;
    quotation_amount?: number | null;
    product_title?: string;
    product_description?: string;
    product_photo?: string;
    product_sku?: string;
    product_amount?: string;
    product_quantity?: string;
    quotation_type?: string;

    // SO History
    so_number?: string | null;
    so_amount?: number | null;

    // Delivered History
    actual_sales?: number | null;
    dr_number?: string;
    payment_terms?: string;
    si_date?: string;
    delivery_date?: string;

    status: string;
    ticket_reference_number?: string;
    source?: string;
    type_activity?: string;
    remarks: string;
    date_created: string;
}

/* ================= PROPS ================= */

interface CompletedProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction?: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

/* ================= COMPONENT ================= */

export const Completed: React.FC<CompletedProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [agents, setAgents] = useState<any[]>([]);

    /* ================= FETCH HISTORY ================= */

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/act-fetch-admin-history`);

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to fetch history");
            }

            const json = await res.json();
            setHistory(json.activities || []);
        } catch (err: any) {
            setError(err.message || "Error fetching history");
        } finally {
            setLoading(false);
        }
    }, []); // Removed referenceid from dependencies

    /* ================= REALTIME ================= */

    useEffect(() => {
        fetchHistory();

        const channel = supabase
            .channel(`history`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                },
                () => fetchHistory()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchHistory]);


    /* ================= HELPERS ================= */

    const isDateInRange = (dateStr: string): boolean => {
        if (!dateCreatedFilterRange) return true;
        const date = new Date(dateStr);
        const { from, to } = dateCreatedFilterRange;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    };

    const uniqueValues = (values: (string | undefined | null)[]) =>
        Array.from(new Set(values.filter((v) => v && v !== "-"))) as string[];

    /* ================= GROUP HISTORY ================= */

    const groupedData = useMemo(() => {
        const map = new Map<string, HistoryItem[]>();

        history
            .filter((h) => isDateInRange(h.date_created))
            .forEach((h) => {
                if (!map.has(h.activity_reference_number)) {
                    map.set(h.activity_reference_number, []);
                }
                map.get(h.activity_reference_number)!.push(h);
            });

        return Array.from(map.entries())
            .map(([activity_reference_number, items]) => {
                // Kunin ang pinaka-latest sa group by date_created
                const latest = items.reduce((a, b) =>
                    new Date(a.date_created) > new Date(b.date_created) ? a : b
                );

                return {
                    id: activity_reference_number,
                    activity_reference_number,
                    referenceid: latest.referenceid,
                    company_name: latest.company_name ?? "Unknown Company",
                    contact_number: latest.contact_number ?? "-",
                    status: latest.status,
                    date_created: latest.date_created,
                    relatedHistoryItems: items,
                };
            })
            .sort(
                (a, b) =>
                    new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
            );
    }, [history, dateCreatedFilterRange]);

    /* ================= SEARCH ================= */

    const filteredData = groupedData.filter((item) => {
        const term = searchTerm.toLowerCase();

        return (
            item.company_name.toLowerCase().includes(term) ||
            item.relatedHistoryItems.some(
                (h) =>
                    h.quotation_number?.toLowerCase().includes(term) ||
                    h.so_number?.toLowerCase().includes(term) ||
                    h.ticket_reference_number?.toLowerCase().includes(term)
            )
        );
    });

    /* ================= STATUS SORT PRIORITY ================= */

    const statusPriority = [
        "Delivered",
        "SO-Done",
        "Quote-Done",
        "Assisted",
        "Not Assisted",
        "Cancelled",
    ];

    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "", // use actual key for profile picture
                };
            }
        });
        return map;
    }, [agents]);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetch(`/api/fetch-all-user-admin`);
                if (!response.ok) throw new Error("Failed to fetch agents");

                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error("Error fetching agents:", err);
            }
        };

        fetchAgents();
    }, []);

    /* ================= UI ================= */

    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="p-4 text-xs">
                <AlertCircleIcon className="h-5 w-5" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    const deliveredData = filteredData.filter(
        (item) => item.status === "Delivered"
    );

    return (
        <>
            <Input
                type="search"
                placeholder="Search company, quotation no, SO no..."
                className="text-xs mb-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="mb-2 text-xs font-bold">
                Total Completed Activities: {filteredData.length}
            </div>

            <div className="max-h-[70vh] overflow-auto space-y-4 custom-scrollbar">
                <Accordion type="single" collapsible>
                    {deliveredData.map((item) => {
                        const histories = item.relatedHistoryItems;

                        // Sort histories by status priority inside each item
                        const sortedHistories = [...histories].sort((a, b) => {
                            const aIndex = statusPriority.indexOf(a.status);
                            const bIndex = statusPriority.indexOf(b.status);
                            const aPriority = aIndex === -1 ? statusPriority.length : aIndex;
                            const bPriority = bIndex === -1 ? statusPriority.length : bIndex;
                            return aPriority - bPriority;
                        });

                        return (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="border rounded-sm shadow-sm mb-2"
                            >
                                <div className="p-2">
                                    <div className="flex justify-between items-center">
                                        <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                                            {agentMap[item.referenceid?.toLowerCase() ?? ""]?.profilePicture ? (
                                                <img
                                                    src={agentMap[item.referenceid?.toLowerCase()]!.profilePicture}
                                                    alt={agentMap[item.referenceid?.toLowerCase()]!.name}
                                                    className="w-8 h-8 rounded-sm object-cover shadow-lg inline-block"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                    N/A
                                                </div>
                                            )}
                                            <span className="uppercase">{agentMap[item.referenceid?.toLowerCase()]?.name || "-"} - {item.company_name}</span>
                                        </AccordionTrigger>


                                        {/* VIEW RECORDS BUTTON & DIALOG */}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                >
                                                    View Records
                                                </Button>
                                            </DialogTrigger>

                                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                                                <DialogHeader>
                                                    <DialogTitle className="text-sm">
                                                        Records – {item.company_name}
                                                    </DialogTitle>
                                                </DialogHeader>

                                                <div className="space-y-4 text-xs">
                                                    {sortedHistories.map((h, idx) => (
                                                        <div
                                                            key={h.id}
                                                            className="border rounded-md p-3 space-y-1 bg-muted/40"
                                                        >
                                                            <div className="flex justify-between">
                                                                <span className="font-mono font-semibold">
                                                                    Record #{idx + 1}
                                                                </span>
                                                                <Badge variant="secondary">{h.status}</Badge>
                                                            </div>

                                                            <Separator />

                                                            {/* COMPANY */}
                                                            {h.contact_person && (
                                                                <p>
                                                                    <strong>Contact Person:</strong> {h.contact_person}
                                                                </p>
                                                            )}
                                                            {h.email_address && (
                                                                <p>
                                                                    <strong>Email:</strong> {h.email_address}
                                                                </p>
                                                            )}
                                                            {h.contact_number && (
                                                                <p>
                                                                    <strong>Contact No:</strong> {h.contact_number}
                                                                </p>
                                                            )}

                                                            {/* OUTBOUND */}
                                                            {h.call_status && (
                                                                <p>
                                                                    <strong>Call Status:</strong> {h.call_status}
                                                                </p>
                                                            )}


                                                            {/* QUOTATION */}
                                                            {h.quotation_number && (
                                                                <p>
                                                                    <strong>Quotation No:</strong> {h.quotation_number}
                                                                </p>
                                                            )}
                                                            {h.quotation_type && (
                                                                <p>
                                                                    <strong>Quotation Type:</strong> {h.quotation_type}
                                                                </p>
                                                            )}
                                                            {h.quotation_amount !== null &&
                                                                h.quotation_amount !== undefined && (
                                                                    <p>
                                                                        <strong>Quotation Amount:</strong>{" "}
                                                                        {h.quotation_amount.toLocaleString("en-PH", {
                                                                            style: "currency",
                                                                            currency: "PHP",
                                                                        })}
                                                                    </p>
                                                                )}

                                                            {h.product_title && (
                                                                <p>
                                                                    <strong>Product:</strong> {h.product_title}
                                                                </p>
                                                            )}

                                                            {h.product_sku && (
                                                                <p>
                                                                    <strong>SKU:</strong> {h.product_sku}
                                                                </p>
                                                            )}
                                                            {(h.product_quantity || h.product_amount) && (
                                                                <p>
                                                                    <strong>Qty:</strong> {h.product_quantity} |{" "}
                                                                    <strong>Price:</strong> {h.product_amount}
                                                                </p>
                                                            )}

                                                            {/* SO */}
                                                            {h.so_number && (
                                                                <>
                                                                    <p>
                                                                        <strong>SO No:</strong> {h.so_number}
                                                                    </p>
                                                                    {h.so_amount !== null &&
                                                                        h.so_amount !== undefined && (
                                                                            <p>
                                                                                <strong>SO Amount:</strong>{" "}
                                                                                {h.so_amount.toLocaleString("en-PH", {
                                                                                    style: "currency",
                                                                                    currency: "PHP",
                                                                                })}
                                                                            </p>
                                                                        )}
                                                                </>
                                                            )}

                                                            {/* DELIVERY */}
                                                            {h.actual_sales !== null && h.actual_sales !== undefined && (
                                                                <>
                                                                    <p>
                                                                        <strong>Sales Invoice:</strong>{" "}
                                                                        {h.actual_sales.toLocaleString("en-PH", {
                                                                            style: "currency",
                                                                            currency: "PHP",
                                                                        })}
                                                                    </p>
                                                                    {h.dr_number && (
                                                                        <p>
                                                                            <strong>DR No:</strong> {h.dr_number}
                                                                        </p>
                                                                    )}
                                                                    {h.payment_terms && (
                                                                        <p>
                                                                            <strong>Payment Terms:</strong> {h.payment_terms}
                                                                        </p>
                                                                    )}
                                                                    {h.si_date && (
                                                                        <p>
                                                                            <strong>SI Date:</strong> {h.si_date}
                                                                        </p>
                                                                    )}
                                                                    {h.delivery_date && (
                                                                        <p>
                                                                            <strong>Delivery Date:</strong> {h.delivery_date}
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}

                                                            <Separator />

                                                            {h.type_activity && (
                                                                <p>
                                                                    <strong>Type of Activity:</strong> {h.type_activity}
                                                                </p>
                                                            )}
                                                            {h.call_type && (
                                                                <p>
                                                                    <strong>Type:</strong> {h.call_type}
                                                                </p>
                                                            )}

                                                            <Separator />
                                                            {h.remarks && (
                                                                <p className="border rounded-sm p-2">
                                                                    <strong>Remarks / Message:</strong> {h.remarks}
                                                                </p>
                                                            )}
                                                            <p className="text-muted-foreground">
                                                                Created: {new Date(h.date_created).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <Badge className="bg-green-500 font-mono">{item.status}</Badge>
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2 space-y-1">
                                    <p>
                                        <strong>Contact Number:</strong> {item.contact_number}
                                    </p>

                                    {histories.some((h) => h.activity_reference_number) && (
                                        <p>
                                            <strong>ID:</strong>{" "}
                                            {uniqueValues(histories.map((h) => h.activity_reference_number)).join(", ")}
                                        </p>
                                    )}

                                    {uniqueValues(histories.map((h) => h.ticket_reference_number)).length > 0 && (
                                        <p>
                                            <strong>Ticket Ref:</strong>{" "}
                                            {uniqueValues(histories.map((h) => h.ticket_reference_number)).join(", ")}
                                        </p>
                                    )}

                                    {histories.some((h) => h.quotation_number) && (
                                        <p>
                                            <strong>Quotation No:</strong>{" "}
                                            {uniqueValues(histories.map((h) => h.quotation_number)).join(", ")}
                                        </p>
                                    )}

                                    {uniqueValues(histories.map((h) => h.so_number)).length > 0 && (
                                        <p>
                                            <strong>SO No:</strong>{" "}
                                            {uniqueValues(histories.map((h) => h.so_number)).join(", ")}
                                        </p>
                                    )}

                                    {histories.some((h) => h.actual_sales) && (
                                        <p>
                                            <strong>Total Sales:</strong>{" "}
                                            {histories
                                                .reduce((t, h) => t + (h.actual_sales ?? 0), 0)
                                                .toLocaleString("en-PH", {
                                                    style: "currency",
                                                    currency: "PHP",
                                                })}
                                        </p>
                                    )}

                                    <Separator className="my-2" />
                                    <p>
                                        <strong>Date Created:</strong>{" "}
                                        {new Date(item.date_created).toLocaleDateString()}
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>
        </>
    );
};
