"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { DoneDialog } from "../../../../tsa/activity/planner/dialog/done";
import { CreateActivityDialog } from "../../../../tsa/activity/planner/dialog/create";
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

export const Progress: React.FC<NewTaskProps> = ({
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

    // Server-side pagination state
    const BATCH_SIZE = 10;
    const [allActivities, setAllActivities] = useState<Activity[]>([]); // Accumulated activities
    const [lastActivityId, setLastActivityId] = useState<number | null>(null);
    const [hasMoreActivities, setHasMoreActivities] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

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

    // Fetch activities with server-side pagination
    const fetchActivities = useCallback(async (loadMore: boolean = false) => {
        if (loadMore) {
            setIsLoadingMore(true);
        } else {
            setLoadingActivities(true);
            // Reset pagination on fresh fetch
            setLastActivityId(null);
            setHasMoreActivities(true);
            setAllActivities([]);
        }
        setErrorActivities(null);

        try {
            // Build URL with pagination params
            const params = new URLSearchParams();
            params.append("limit", String(BATCH_SIZE));
            if (loadMore && lastActivityId !== null) {
                params.append("lastId", String(lastActivityId));
            }

            const res = await fetch(`/api/act-fetch-admin-activity?${params.toString()}`, {
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
            const newActivities = json.data || [];

            // Check if we got a full batch (means there might be more)
            setHasMoreActivities(newActivities.length === BATCH_SIZE);

            // Track last ID for next pagination
            if (newActivities.length > 0) {
                const lastId = newActivities[newActivities.length - 1].id;
                setLastActivityId(lastId);
            }

            // Accumulate or replace activities
            if (loadMore) {
                setAllActivities(prev => [...prev, ...newActivities]);
            } else {
                setAllActivities(newActivities);
            }
        } catch (error: any) {
            setErrorActivities(error.message || "Error fetching activities");
        } finally {
            setLoadingActivities(false);
            setIsLoadingMore(false);
        }
    }, [lastActivityId]);

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
        // Initial fetches - first batch only
        fetchActivities(false);
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

    const allowedStatuses = ["On-Progress", "Assisted", "Quote-Done", "SO-Done", "Not Assisted", "Cancelled"];

    const mergedData = allActivities
        .filter((a) => allowedStatuses.includes(a.status))
        .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
        .filter((a) => !a.scheduled_date || a.scheduled_date === "")
        .map((activity) => {
            const company = companies.find((c) => c.account_reference_number === activity.account_reference_number);
            const relatedHistoryItems = history.filter((h) => h.activity_reference_number === activity.activity_reference_number);

            return {
                ...activity,
                company_name: company?.company_name ?? "Unknown Company",
                contact_number: company?.contact_number ?? "-",
                type_client: company?.type_client ?? "",
                contact_person: company?.contact_person ?? "",
                email_address: company?.email_address ?? "",
                address: company?.address ?? "",
                relatedHistoryItems,
            };
        })
        .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    // Filter all data first (search works on complete dataset)
    const filteredData = useMemo(() => {
        return mergedData.filter((item) => {
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
    }, [mergedData, searchTerm]);

    // Search works on all loaded data
    const displayedData = filteredData;

    // hasMore comes from server response
    const hasMore = hasMoreActivities;

    const isLoading = loadingCompanies || (loadingActivities && !isLoadingMore);
    const error = errorCompanies || errorActivities;

    // Handle Load More click
    const handleLoadMore = () => {
        if (!isLoadingMore && hasMoreActivities) {
            fetchActivities(true); // Load more from server
        }
    };

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

    // Show skeleton loading while data is being fetched (initial load only)
    const showSkeletonLoading = (loadingCompanies || loadingActivities || loadingHistory) && displayedData.length === 0 && !isLoadingMore;

    // Skeleton component for loading state
    const SkeletonItem = () => (
        <div className="w-full border rounded-sm shadow-sm mt-2 border-gray-200 p-2 animate-pulse">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 bg-gray-200 rounded-sm"></div>
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="w-16 h-8 bg-gray-200 rounded"></div>
            </div>
            <div className="flex gap-1">
                <div className="h-6 bg-gray-200 rounded w-20"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
        </div>
    );

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

            <div className="mb-2 text-xs font-bold flex items-center justify-between">
                <span>
                    Total On-Progress Activities: {filteredData.length}
                    {showSkeletonLoading && (
                        <span className="ml-2 text-muted-foreground font-normal">(Loading...)</span>
                    )}
                </span>
                {(loadingActivities || loadingHistory || loadingCompanies || isLoadingMore) && (
                    <span className="flex items-center gap-1 text-muted-foreground font-normal animate-pulse">
                        <Spinner className="size-3" /> 
                        {showSkeletonLoading ? "Fetching data..." : isLoadingMore ? "Loading more..." : "Updating..."}
                    </span>
                )}
            </div>

            <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">

                    {/* Skeleton loading when no data yet */}
                    {showSkeletonLoading && (
                        <>
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                            <SkeletonItem />
                        </>
                    )}

                    {/* Show data when available */}
                    {!showSkeletonLoading && displayedData.map((item) => {
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
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={updatingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDoneDialog(item.id);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                {updatingId === item.id ? "Updating..." : "Done"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="ml-1 space-x-1">
                                        <Badge className={`${badgeClass} font-mono`}>
                                            {item.status.replace("-", " ")}
                                        </Badge>
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

                    {/* Show empty state when no data and not loading */}
                    {!showSkeletonLoading && displayedData.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                            {searchTerm ? "No matching activities found." : "No activities available."}
                        </div>
                    )}
                </Accordion>

                {/* Loading progress bar for background fetches */}
                {(loadingActivities || loadingHistory || loadingCompanies || isLoadingMore) && !showSkeletonLoading && (
                    <div className="w-full bg-gray-100 h-1 mt-2 overflow-hidden rounded-none">
                        <div className="bg-blue-500 h-full animate-pulse w-full"></div>
                    </div>
                )}

                {/* Load More Button - fetches from server */}
                {hasMore && !showSkeletonLoading && (
                    <div className="flex justify-center py-4 mt-4">
                        <Button
                            variant="outline"
                            className="rounded-none text-xs"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore || loadingActivities || loadingHistory || loadingCompanies}
                        >
                            {isLoadingMore ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="size-3" /> Loading more from server...
                                </span>
                            ) : (
                                `Load More (showing ${displayedData.length} of ${allActivities.length}+)` 
                            )}
                        </Button>
                    </div>
                )}
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
