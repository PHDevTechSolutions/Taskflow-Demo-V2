"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";

interface Activity {
    id: string;
    scheduled_date: string;
    account_reference_number: string;
    status: string;
    date_updated: string;
    activity_reference_number: string;
    // Add other fields as needed
}

interface Company {
    account_reference_number: string;
    company_name: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    contact_person?: string;
    address?: string;
    // Add other fields as needed
}

interface HistoryItem {
    activity_reference_number: string;
    // other fields
}

interface UserDetails {
    referenceid: string;
}

const allowedStatuses = ["Assisted", "Quote-Done"]; // example, adjust as needed

export function ActivityToday() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
    const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [open, setOpen] = useState(false);
    const [showDismissConfirm, setShowDismissConfirm] = useState(false);
    const [loadingUser, setLoadingUser] = useState(false);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);
    const [errorHistory, setErrorHistory] = useState<string | null>(null);

    const queryUserId = searchParams?.get("id") ?? "";
    const referenceid = userDetails.referenceid;

    // Helper: check if date string is today (local)
    const isScheduledToday = (dateStr: string) => {
        const today = new Date();
        const date = new Date(dateStr);
        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    };

    // Sync URL param with userId context
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    // Fetch user details
    useEffect(() => {
        if (!userId) {
            setError("User ID is missing.");
            setLoadingUser(false);
            return;
        }
        const fetchUserData = async () => {
            setError(null);
            setLoadingUser(true);
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!response.ok) throw new Error("Failed to fetch user data");
                const data = await response.json();

                setUserDetails({
                    referenceid: data.ReferenceID || "",
                });

                toast.success("User data loaded successfully!");
            } catch (err) {
                console.error("Error fetching user data:", err);
                toast.error("Failed to connect to server. Please try again later or refresh your network connection");
            } finally {
                setLoadingUser(false);
            }
        };
        fetchUserData();
    }, [userId]);

    // Fetch companies
    useEffect(() => {
        if (!referenceid) {
            setCompanies([]);
            return;
        }
        setLoadingCompanies(true);
        setErrorCompanies(null);

        fetch(`/api/com-fetch-companies`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch companies");
                return res.json();
            })
            .then((data) => setCompanies(data.data || []))
            .catch((err) => setErrorCompanies(err.message))
            .finally(() => setLoadingCompanies(false));
    }, [referenceid]);

    // Fetch activities
    const fetchActivities = useCallback(async () => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        try {
            const res = await fetch(
                `/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`,
                {
                    cache: "no-store",
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                }
            );

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
    }, [referenceid]);

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (!referenceid) {
            setHistory([]);
            return;
        }
        setLoadingHistory(true);
        setErrorHistory(null);

        try {
            const res = await fetch(
                `/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`
            );

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
    }, [referenceid]);

    // Initial fetch + realtime subscriptions
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities();
        fetchHistory();

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
                () => {
                    fetchActivities();
                }
            )
            .subscribe();

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
                () => {
                    fetchHistory();
                }
            )
            .subscribe();

        return () => {
            activityChannel.unsubscribe();
            supabase.removeChannel(activityChannel);

            historyChannel.unsubscribe();
            supabase.removeChannel(historyChannel);
        };
    }, [referenceid, fetchActivities, fetchHistory]);

    // Merge activities with company info and filter for today & allowed status
    const mergedActivities = activities
        .filter((a) => a.scheduled_date && a.scheduled_date.trim() !== "")
        .filter((a) => isScheduledToday(a.scheduled_date))
        .filter((a) => allowedStatuses.includes(a.status))
        .map((activity) => {
            const company = companies.find(
                (c) => c.account_reference_number === activity.account_reference_number
            );

            return {
                ...activity,
                company_name: company?.company_name ?? "Unknown Company",
            };
        });

    // Show dialog if there are activities today
    useEffect(() => {
        if (mergedActivities.length > 0) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [mergedActivities]);

    function handleDismiss() {
        setShowDismissConfirm(true);
    }

    function confirmDismiss() {
        // For example, save dismissed activity IDs in localStorage to prevent re-showing
        const dismissedActivities: string[] = JSON.parse(localStorage.getItem("dismissedActivities") || "[]");
        const newDismissed = [...dismissedActivities, ...mergedActivities.map((a) => a.id)];
        localStorage.setItem("dismissedActivities", JSON.stringify(newDismissed));

        setShowDismissConfirm(false);
        setOpen(false);
    }

    function cancelDismiss() {
        setShowDismissConfirm(false);
    }

    if (loadingUser || loadingCompanies || loadingActivities || loadingHistory) return null;
    if (error || errorCompanies || errorActivities || errorHistory) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Activities Scheduled for Today</DialogTitle>
                        <DialogDescription>
                            {mergedActivities.length > 0 ? (
                                <>
                                    <p>
                                        You have {mergedActivities.length} {mergedActivities.length === 1 ? "activity" : "activities"} scheduled for today:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-2 mt-3 max-h-60 overflow-y-auto">
                                        {mergedActivities.map((activity) => (
                                            <li key={activity.id}>
                                                <strong>{activity.company_name}</strong><br /> Scheduled on:{" "}
                                                {new Date(activity.scheduled_date).toLocaleDateString(undefined, {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p>No activities scheduled for today.</p>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={handleDismiss}>Dismiss</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Dismiss</DialogTitle>
                        <DialogDescription>
                            Once you dismiss this alert, you won't see it again until new activities are scheduled for today.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDismiss}>Cancel</Button>
                        <Button onClick={confirmDismiss}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
