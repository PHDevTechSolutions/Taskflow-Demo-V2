"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, Check, LoaderPinwheel, PhoneOutgoing, PackageCheck, ReceiptText, Activity, Dot } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner"
import { supabase } from "@/utils/supabase";
import { CreateActivityDialog } from "../dialog/create";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator"

interface Activity {
    id: string;
    referenceid: string;
    target_quota?: string;
    tsm: string;
    manager: string;
    activity_reference_number: string;
    account_reference_number: string;
    ticket_reference_number: string;
    agent: string;
    status: string;
    date_updated: string;
    scheduled_date: string;
    date_created: string;

    company_name: string;
    contact_number: string;
    type_client: string;
    email_address: string;
    address: string;
    contact_person: string;
}

interface HistoryItem {
    id: string;
    activity_reference_number: string;
    callback?: string | null;
    date_followup?: string | null;
    quotation_number?: string | null;
    quotation_amount?: number | null;
    so_number?: string | null;
    so_amount?: number | null;
    call_type?: string;
    ticket_reference_number?: string;
    source?: string;
    call_status?: string;
    type_activity: string;
    tsm_approved_status: string;
}

interface NewTaskProps {
    referenceid: string;
    target_quota?: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsmname: string;
    managername: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

export const Overdue: React.FC<NewTaskProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [searchTerm, setSearchTerm] = useState("");

    const fetchAllData = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            setHistory([]);
            return;
        }

        setActivitiesLoading(true);
        setHistoryLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        const url = new URL("/api/activity/tsa/breaches/fetch-activity", window.location.origin);
        url.searchParams.append("referenceid", referenceid);
        if (from && to) {
            url.searchParams.append("from", from);
            url.searchParams.append("to", to);
        }

        fetch(url.toString())
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities and history");
                return res.json();
            })
            .then((data) => {
                setActivities(data.activities || []);
                setHistory(data.history || []);
            })
            .catch((err) => setError(err.message))
            .finally(() => {
                setActivitiesLoading(false);
                setHistoryLoading(false);
            });
    }, [referenceid, dateCreatedFilterRange]);

    useEffect(() => {
        if (!referenceid) return;

        // Initial fetch
        fetchAllData();

        // Subscribe realtime for activities
        const activityChannel = supabase
            .channel(`activity-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "activity",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    console.log("Activity realtime update:", payload);
                    fetchAllData();
                }
            )
            .subscribe();

        // Subscribe realtime for history
        const historyChannel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    console.log("History realtime update:", payload);
                    fetchAllData();
                }
            )
            .subscribe();

        return () => {
            activityChannel.unsubscribe();
            supabase.removeChannel(activityChannel);

            historyChannel.unsubscribe();
            supabase.removeChannel(historyChannel);
        };
    }, [referenceid, fetchAllData]);

    const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
        if (!range) return true;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const { from, to } = range;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    };

    const allowedStatuses = ["Done"];

    const mergedData = activities
        .filter((a) => a.status === "Assisted" || a.status === "Not Assisted")
        .filter((a) => {
            // Check if overdue (scheduled_date < today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const schedDate = new Date(a.scheduled_date);
            schedDate.setHours(0, 0, 0, 0);

            return schedDate < today; // only overdue
        })
        .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
        .map((activity) => {
            const relatedHistoryItems = history.filter(
                (h) => h.activity_reference_number === activity.activity_reference_number
            );

            return {
                ...activity,
                relatedHistoryItems,
            };
        })
        .sort(
            (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
        );

    const filteredData = mergedData.filter((item) => {
        const lowerSearch = searchTerm.toLowerCase();
        return (
            (item.company_name?.toLowerCase() ?? "").includes(lowerSearch) ||
            (item.ticket_reference_number?.toLowerCase().includes(lowerSearch) ?? false) ||
            item.relatedHistoryItems.some((h) =>
                (h.quotation_number?.toLowerCase().includes(lowerSearch) ?? false) ||
                (h.so_number?.toLowerCase().includes(lowerSearch) ?? false)
            )
        );
    });

    if (error) {
        return (
            <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
                <div className="flex items-center space-x-3">
                    <AlertCircleIcon className="h-6 w-6 text-red-600" />
                    <div>
                        <AlertTitle>No Data Found or No Network Connection</AlertTitle>
                        <AlertDescription className="text-xs">
                            Please check your internet connection or try again later.
                        </AlertDescription>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <CheckCircle2Icon className="h-6 w-6 text-green-600" />
                    <div>
                        <AlertTitle className="text-black">Add New Data</AlertTitle>
                        <AlertDescription className="text-xs">
                            You can start by adding new entries to populate your database.
                        </AlertDescription>
                    </div>
                </div>
            </Alert>
        );
    }

    return (
        <>
            <Input
                type="search"
                placeholder="Search..."
                className="text-xs flex-grow mb-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search accounts"
            />

            <div className="mb-2 text-xs font-bold">
                Total Overdue Activities: ({mergedData.length})
            </div>

            <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">

                    {filteredData.map((item) => {
                        // Define bg colors base sa status
                        let badgeClass = "bg-gray-200 text-gray-800";

                        if (item.status === "Done") {
                            badgeClass = "bg-gray-400 text-white";
                        }

                        return (
                            <AccordionItem key={item.id} value={item.id} className="w-full border rounded-sm shadow-sm mt-2">
                                <div className="p-2 select-none">
                                    <div className="flex justify-between items-center">
                                        <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                                            {item.company_name}
                                        </AccordionTrigger>

                                        <div className="flex gap-2 ml-4">
                                            <CreateActivityDialog
                                                firstname={firstname}
                                                lastname={lastname}
                                                target_quota={target_quota}
                                                email={email}
                                                contact={contact}
                                                tsmname={tsmname}
                                                managername={managername}
                                                referenceid={item.referenceid}
                                                tsm={item.tsm}
                                                manager={item.manager}
                                                type_client={item.type_client}
                                                contact_number={item.contact_number}
                                                email_address={item.email_address}
                                                activityReferenceNumber={item.activity_reference_number}
                                                ticket_reference_number={item.ticket_reference_number}
                                                agent={item.agent}
                                                company_name={item.company_name}
                                                contact_person={item.contact_person}
                                                address={item.address}
                                                accountReferenceNumber={item.account_reference_number}
                                                onCreated={() => {
                                                    fetchAllData();
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="ml-1 flex flex-wrap gap-1 uppercase">
                                        {/* ACTIVITY ICON BADGES */}
                                        {item.relatedHistoryItems.some((h: HistoryItem) =>
                                            !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== ""
                                        ) &&
                                            Array.from(
                                                new Set(
                                                    item.relatedHistoryItems
                                                        .map((h: HistoryItem) => h.type_activity?.trim() ?? "")
                                                        .filter((v) => v && v !== "-")
                                                )
                                            ).map((activity) => {
                                                const getIcon = (act: string) => {
                                                    const lowerAct = act.toLowerCase();
                                                    if (lowerAct.includes("outbound") || lowerAct.includes("call")) {
                                                        return <PhoneOutgoing />;
                                                    }
                                                    if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) {
                                                        return <PackageCheck />;
                                                    }
                                                    if (lowerAct.includes("quotation") || lowerAct.includes("quote")) {
                                                        return <ReceiptText />;
                                                    }
                                                    return <Activity />;
                                                };

                                                return (
                                                    <Badge
                                                        key={activity}
                                                        variant="outline"
                                                        className="flex items-center justify-center w-8 h-8 p-0"
                                                        title={activity.toUpperCase()}
                                                    >
                                                        {getIcon(activity)}
                                                    </Badge>
                                                );
                                            })
                                        }
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2 uppercase">
                                    <p><strong>Contact Number:</strong> {item.contact_number || "-"}</p>
                                    <p><strong>Contact Person:</strong> {item.contact_person || "-"}</p>
                                    <p><strong>Email Address:</strong> {item.email_address || "-"}</p>
                                    <p><strong>Address:</strong> {item.address || "-"}</p>

                                    <Separator className="mb-2 mt-2" />

                                    {item.relatedHistoryItems.length === 0 ? (
                                        <p>No quotation or SO history available.</p>
                                    ) : (
                                        <>
                                            {item.relatedHistoryItems.some(
                                                (h) => h.ticket_reference_number && h.ticket_reference_number !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Ticket Reference Number:</strong>{" "}
                                                        <span>
                                                            {Array.from(
                                                                new Set(
                                                                    item.relatedHistoryItems
                                                                        .map((h) => h.ticket_reference_number ?? "-")
                                                                        .filter((v) => v !== "-")
                                                                )
                                                            ).join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {item.relatedHistoryItems.some(
                                                (h) => h.call_type && h.call_type !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Type:</strong>{" "}
                                                        <span>
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.call_type ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {item.relatedHistoryItems.some(
                                                (h) => h.type_activity && h.type_activity !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Type of Activity:</strong>{" "}
                                                        <span>
                                                            {Array.from(
                                                                new Set(
                                                                    item.relatedHistoryItems
                                                                        .map((h) => h.type_activity ?? "-")
                                                                        .filter((v) => v !== "-")
                                                                )
                                                            ).join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {item.relatedHistoryItems.some(
                                                (h) => h.source && h.source !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Source:</strong>{" "}
                                                        <span>
                                                            {Array.from(
                                                                new Set(
                                                                    item.relatedHistoryItems
                                                                        .map((h) => h.source ?? "-")
                                                                        .filter((v) => v !== "-")
                                                                )
                                                            ).join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {/* Quotation Number */}
                                            {item.relatedHistoryItems.some(
                                                (h) => h.quotation_number && h.quotation_number !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Quotation Number:</strong>{" "}
                                                        <span>
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.quotation_number ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {/* TOTAL Quotation Amount */}
                                            {item.relatedHistoryItems.some(
                                                (h) => h.quotation_amount !== null && h.quotation_amount !== undefined
                                            ) && (
                                                    <p>
                                                        <strong>Total Quotation Amount:</strong>{" "}
                                                        {item.relatedHistoryItems
                                                            .reduce((total, h) => {
                                                                return total + (h.quotation_amount ?? 0);
                                                            }, 0)
                                                            .toLocaleString("en-PH", {
                                                                style: "currency",
                                                                currency: "PHP",
                                                            })}
                                                    </p>
                                                )}

                                            {/* SO Number */}
                                            {item.relatedHistoryItems.some(
                                                (h) => h.so_number && h.so_number !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>SO Number:</strong>{" "}
                                                        <span className="uppercase">
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.so_number ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {/* TOTAL SO Amount */}
                                            {item.relatedHistoryItems.some(
                                                (h) => h.so_amount !== null && h.so_amount !== undefined
                                            ) && (
                                                    <p>
                                                        <strong>Total SO Amount:</strong>{" "}
                                                        {item.relatedHistoryItems
                                                            .reduce((total, h) => {
                                                                return total + (h.so_amount ?? 0);
                                                            }, 0)
                                                            .toLocaleString("en-PH", {
                                                                style: "currency",
                                                                currency: "PHP",
                                                            })}
                                                    </p>
                                                )}

                                            <Separator className="mb-2 mt-2" />
                                            {item.relatedHistoryItems.some(
                                                (h) => h.tsm_approved_status && h.tsm_approved_status !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>TSM Feedback:</strong>{" "}
                                                        <span className="uppercase">
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.tsm_approved_status ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
                                                    </p>
                                                )}
                                        </>
                                    )}

                                    <p>
                                        <strong>Date Created:</strong>{" "}
                                        {new Date(item.date_created).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs font-semibold">
                                        <Dot />
                                        <span className="text-[10px]">{item.activity_reference_number}</span>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>
        </>
    );
};
