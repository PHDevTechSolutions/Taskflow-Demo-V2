"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { DoneDialog } from "./activity-done-dialog";
import { CreateActivityDialog } from "./activity-create-dialog";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator"

interface Company {
    account_reference_number: string;
    company_name: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
}

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

interface ScheduledProps {
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

export const Scheduled: React.FC<ScheduledProps> = ({
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
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [errorHistory, setErrorHistory] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [agents, setAgents] = useState<any[]>([]);

    // Fetch companies with no cache
    useEffect(() => {
        setLoadingCompanies(true);
        setErrorCompanies(null);

        fetch(`/api/com-fetch-companies`, {
            cache: "no-store",
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch company data");
                return res.json();
            })
            .then((data) => {
                setCompanies(data.data || []);
            })
            .catch((err) => {
                setErrorCompanies(err.message || "Error fetching company data");
            })
            .finally(() => {
                setLoadingCompanies(false);
            });
    }, []); // Removed referenceid dependency here

    // Fetch activities with no cache via API route
    const fetchActivities = useCallback(async () => {
        setLoadingActivities(true);
        setErrorActivities(null);

        try {
            const res = await fetch(`/api/act-fetch-admin-activity`, {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to fetch activities");
            }

            const json = await res.json();
            setActivities(json.data || []);
        } catch (error: any) {
            setErrorActivities(error.message || "Error fetching activities");
        } finally {
            setLoadingActivities(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        setErrorHistory(null);

        try {
            const res = await fetch(`/api/act-fetch-admin-history`);

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to fetch history");
            }

            const json = await res.json();
            setHistory(json.activities || []);
        } catch (error: any) {
            setErrorHistory(error.message || "Error fetching history");
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    // Initial fetch + realtime subscription to keep UI fresh
    useEffect(() => {
        // Initial fetches
        fetchActivities();
        fetchHistory();

        // Subscribe realtime for activities (no referenceid filtering)
        const activityChannel = supabase
            .channel(`activity`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "activity",
                    // No filter here since referenceid is removed
                },
                (payload) => {
                    console.log("Activity realtime update:", payload);
                    fetchActivities();
                }
            )
            .subscribe();

        // Subscribe realtime for history (no referenceid filtering)
        const historyChannel = supabase
            .channel(`history`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    // No filter here since referenceid is removed
                },
                (payload) => {
                    console.log("History realtime update:", payload);
                    fetchHistory();
                }
            )
            .subscribe();

        // Cleanup subscriptions properly
        return () => {
            activityChannel.unsubscribe();
            supabase.removeChannel(activityChannel);

            historyChannel.unsubscribe();
            supabase.removeChannel(historyChannel);
        };
    }, [fetchActivities, fetchHistory]);


    const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
        if (!range) return true;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const { from, to } = range;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    };

    function isDelivered(status: string) {
        return ["Delivered", "Done", "Completed", "Cancelled"].includes(status);
    }

    function getOverdueDays(scheduledDate: string): number {
        const sched = new Date(scheduledDate);
        const today = new Date();

        // reset time para date lang ang comparison
        sched.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffMs = today.getTime() - sched.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return diffDays > 0 ? diffDays : 0;
    }

    const mergedData = activities
        .filter((a) => a.scheduled_date && a.scheduled_date.trim() !== "")
        .filter((a) => !isDelivered(a.status))
        .map((activity) => {
            const company = companies.find((c) => c.account_reference_number === activity.account_reference_number);
            const relatedHistoryItems = history.filter((h) => h.activity_reference_number === activity.activity_reference_number);
            const overdueDays = getOverdueDays(activity.scheduled_date);

            return {
                ...activity,
                company_name: company?.company_name ?? "Unknown Company",
                contact_number: company?.contact_number ?? "-",
                type_client: company?.type_client ?? "",
                contact_person: company?.contact_person ?? "",
                email_address: company?.email_address ?? "",
                address: company?.address ?? "",
                relatedHistoryItems,
                overdueDays
            };
        })
        .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    const filteredData = mergedData.filter((item) => {
        const lowerSearch = searchTerm.toLowerCase();
        return (
            item.company_name.toLowerCase().includes(lowerSearch) ||
            (item.ticket_reference_number?.toLowerCase().includes(lowerSearch) ?? false) ||
            item.relatedHistoryItems.some((h) =>
                (h.quotation_number?.toLowerCase().includes(lowerSearch) ?? false) ||
                (h.so_number?.toLowerCase().includes(lowerSearch) ?? false)
            )
        );
    });

    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

    const openDoneDialog = (id: string) => {
        setSelectedActivityId(id);
        setDialogOpen(true);
    };

    const handleConfirmDone = async () => {
        if (!selectedActivityId) return;

        try {
            setUpdatingId(selectedActivityId);
            setDialogOpen(false);

            const res = await fetch("/api/act-update-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedActivityId }),
                cache: "no-store",
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
                setUpdatingId(null);
                return;
            }

            await fetchActivities();

            toast.success("Transaction marked as Done.");
        } catch {
            toast.error("An error occurred while updating status.");
        } finally {
            setUpdatingId(null);
            setSelectedActivityId(null);
        }
    };

    const openCancelledDialog = (id: string) => {
        setSelectedActivityId(id);
        setDialogOpen(true);
    };

    const handleConfirmCancelled = async () => {
        if (!selectedActivityId) return;

        try {
            setUpdatingId(selectedActivityId);
            setDialogOpen(false);

            const res = await fetch("/api/act-cancelled-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedActivityId }),
                cache: "no-store",
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
                setUpdatingId(null);
                return;
            }

            await fetchActivities();

            toast.success("Transaction marked as Done.");
        } catch {
            toast.error("An error occurred while updating status.");
        } finally {
            setUpdatingId(null);
            setSelectedActivityId(null);
        }
    };

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
                setErrorActivities("Failed to load agents.");
            }
        };

        fetchAgents();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );
    }

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
                placeholder="Search company, ticket ref, quotation no, so no..."
                className="text-xs flex-grow mb-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search accounts"
            />

            <div className="mb-2 text-xs font-bold">
                Total On-Progress Activities: {mergedData.length}
            </div>

            <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">

                    {filteredData.map((item) => {
                        // Define bg colors base sa status
                        let badgeClass = "bg-gray-200 text-gray-800"; // default light gray

                        if (item.status === "Assisted" || item.status === "On-Progress") {
                            badgeClass = "bg-orange-400 text-white";
                        } else if (item.status === "SO-Done") {
                            badgeClass = "bg-yellow-400 text-black";
                        } else if (item.status === "Quote-Done") {
                            badgeClass = "bg-blue-500 text-white";
                        } else if (item.status === "Cancelled") {
                            badgeClass = "bg-red-600 text-white";
                        }

                        return (
                            <AccordionItem key={item.id} value={item.id} className="w-full border rounded-sm shadow-sm mt-2 border-gray-200">
                                <div className="p-2 select-none">
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
                                                    fetchActivities();
                                                }}
                                            />

                                            <Button
                                                type="button"
                                                className="cursor-pointer"
                                                variant="secondary"
                                                disabled={updatingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDoneDialog(item.id);
                                                }}
                                            >
                                                {updatingId === item.id ? "Updating..." : "Done"}
                                            </Button>

                                            <Button
                                                type="button"
                                                className="cursor-pointer"
                                                variant="destructive"
                                                disabled={updatingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openCancelledDialog(item.id);
                                                }}
                                            >
                                                {updatingId === item.id ? "Cancelling..." : "Cancelled"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="ml-1 space-x-1">
                                        <Badge className={`${badgeClass} font-mono`}>
                                            {item.status.replace("-", " ")}
                                        </Badge>
                                        {item.overdueDays > 0 && (
                                            <Badge variant="destructive" className="font-mono">
                                                <Clock /> OVERDUE: {item.overdueDays} day{item.overdueDays > 1 ? "s" : ""}
                                            </Badge>
                                        )}
                                        {item.relatedHistoryItems.some(
                                            (h: HistoryItem) =>
                                                !!h.type_activity &&
                                                h.type_activity !== "-" &&
                                                h.type_activity.trim() !== ""
                                        ) &&
                                            Array.from(
                                                new Set(
                                                    item.relatedHistoryItems
                                                        .map((h: HistoryItem) => h.type_activity?.trim() ?? "")
                                                        .filter((v) => v && v !== "-")
                                                )
                                            ).map((activity) => (
                                                <Badge key={activity} variant="default" className="font-mono">
                                                    {activity.toUpperCase()}
                                                </Badge>
                                            ))}
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2">
                                    <p>
                                        <strong>Contact Number:</strong> {item.contact_number || "-"}
                                    </p>

                                    {item.relatedHistoryItems.length === 0 ? (
                                        <p>No quotation or SO history available.</p>
                                    ) : (
                                        <>
                                            {item.relatedHistoryItems.some(
                                                (h) => h.ticket_reference_number && h.ticket_reference_number !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Ticket Reference Number:</strong>{" "}
                                                        <span className="uppercase">
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
                                                        <span className="uppercase">
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.call_type ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
                                                    </p>
                                                )}

                                            {item.relatedHistoryItems.some(
                                                (h) => h.source && h.source !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Source:</strong>{" "}
                                                        <span className="uppercase">
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
                                                        <span className="uppercase">
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
                                            {item.relatedHistoryItems.some(
                                                (h) => h.call_status && h.call_status !== "-"
                                            ) && (
                                                    <p>
                                                        <strong>Call Status:</strong>{" "}
                                                        <span className="uppercase">
                                                            {item.relatedHistoryItems
                                                                .map((h) => h.call_status ?? "-")
                                                                .filter((v) => v !== "-")
                                                                .join(", ")}
                                                        </span>
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
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>

            <DoneDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onConfirm={handleConfirmDone}
                loading={updatingId !== null}
            />
        </>
    );
};
