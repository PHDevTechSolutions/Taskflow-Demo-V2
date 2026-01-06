"use client";

import React, { useEffect, useState } from "react";
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

interface Deletion {
    company_name: string;
    date_approved: string;
    status: string;
}

interface UserDetails {
    referenceid: string;
}

export function ApproveDeletionDialog() {
    const searchParams = useSearchParams();
    const [deletions, setDeletions] = useState<Deletion[]>([]);
    const [open, setOpen] = useState(false);
    const [showDismissConfirm, setShowDismissConfirm] = useState(false);
    const { userId, setUserId } = useUser();
    const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
    const [loadingUser, setLoadingUser] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingDeletions, setLoadingDeletions] = useState(false);
    const [errorDeletions, setErrorDeletions] = useState<string | null>(null);

    const queryUserId = searchParams?.get("id") ?? "";

    // Sync URL query param with userId context
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    // Fetch user details based on userId
    useEffect(() => {
        if (!userId) {
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
                toast.error(
                    "Failed to connect to server. Please try again later or refresh your network connection"
                );
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    // Fetch active deletions for the user
    useEffect(() => {
        if (!userDetails || !userDetails.referenceid) return;

        const fetchActiveDeletions = async () => {
            setLoadingDeletions(true);
            setErrorDeletions(null);
            try {
                const res = await fetch(
                    `/api/active-deletion?referenceid=${encodeURIComponent(userDetails.referenceid)}`
                );
                if (!res.ok) throw new Error("Failed to fetch active deletions");
                const json = await res.json();

                if (json.success && json.data.length > 0) {
                    // Load dismissed list from localStorage
                    const dismissedDeletions: string[] = JSON.parse(localStorage.getItem("dismissedDeletions") || "[]");

                    // Filter out dismissed companies
                    const newDeletions = json.data.filter(
                        (t: Deletion) => !dismissedDeletions.includes(t.company_name)
                    );

                    if (newDeletions.length > 0) {
                        setDeletions(newDeletions);
                        setOpen(true);
                    } else {
                        setDeletions([]);
                        setOpen(false);
                    }
                } else {
                    setDeletions([]);
                    setOpen(false);
                }
            } catch (err: any) {
                console.error("Failed to fetch active deletions", err);
                setErrorDeletions(err.message || "Unknown error");
                setDeletions([]);
                setOpen(false);
            } finally {
                setLoadingDeletions(false);
            }
        };

        fetchActiveDeletions();
    }, [userDetails]);

    function handleDismiss() {
        setShowDismissConfirm(true);
    }

    function confirmDismiss() {
        const dismissedDeletions: string[] = JSON.parse(localStorage.getItem("dismissedDeletions") || "[]");
        const newDismissed = [...dismissedDeletions, ...deletions.map(t => t.company_name)];
        localStorage.setItem("dismissedDeletions", JSON.stringify(newDismissed));

        setShowDismissConfirm(false);
        setOpen(false);
    }

    function cancelDismiss() {
        setShowDismissConfirm(false);
    }

    if (loadingUser || loadingDeletions) return null;
    if (error || errorDeletions) return null;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <>
            {/* Main Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Company Deletion</DialogTitle>
                        <DialogDescription>
                            {deletions.length > 0 ? (
                                <>
                                    <div>
                                        {deletions.length} {deletions.length === 1 ? "company has" : "companies have"} been approved by your manager for subject deletion:
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto mt-2">
                                        <ul className="list-disc pl-5 space-y-4">
                                            {deletions.map((t, i) => (
                                                <li key={i}>
                                                    <strong>{t.company_name}</strong>
                                                    <div>
                                                        Approved on: {formatDate(t.date_approved)} <br />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : null}
                        </DialogDescription>

                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={handleDismiss}>Dismiss</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dismiss confirmation dialog */}
            <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Dismiss</DialogTitle>
                        <DialogDescription>
                            Once you dismiss this alert, you won&apos;t see it again until new deletions are available.
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
