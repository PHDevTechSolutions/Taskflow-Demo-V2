"use client";

import React, { useEffect, useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { DoneDialog } from "./activity-done-dialog";
import { CreateActivityDialog } from "./activity-create-dialog";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

interface Company {
    account_reference_number: string;
    company_name: string;
    contact_number?: string;
    type_client?: string;
}

interface Activity {
    id: string;
    referenceid: string;
    target_quota?: string;
    tsm: string;
    manager: string;
    activity_reference_number: string;
    account_reference_number: string;
    status: string;
    date_updated: string;
    date_created: string;
}

interface NewTaskProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

export const Progress: React.FC<NewTaskProps> = ({
    referenceid,
    target_quota,
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

    // Dialog state for Done
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityRefNum, setSelectedActivityRefNum] = useState<string | null>(null);

    // Fetch companies by referenceid
    useEffect(() => {
        if (!referenceid) {
            setCompanies([]);
            return;
        }
        setLoadingCompanies(true);
        setErrorCompanies(null);

        fetch(`/api/com-fetch-account?referenceid=${encodeURIComponent(referenceid)}`)
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
    }, [referenceid]);

    // Fetch activities and subscribe to realtime changes
    useEffect(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoadingActivities(true);
        setErrorActivities(null);

        const fetchActivities = async () => {
            const { data, error } = await supabase
                .from("activity")
                .select("*")
                .eq("referenceid", referenceid);

            if (error) {
                setErrorActivities(error.message);
            } else {
                setActivities(data || []);
            }
            setLoadingActivities(false);
        };

        fetchActivities();

        const channel = supabase
            .channel(`public:activity:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "activity",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as Activity;
                    const oldRecord = payload.old as Activity;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.find((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;
                            case "UPDATE":
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
                            case "DELETE":
                                return curr.filter((a) => a.id !== oldRecord.id);
                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid]);

    // Helper to check if date is in filter range
    const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
        if (!range) return true;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const { from, to } = range;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    };

    // Define allowed statuses as an array
    const allowedStatuses = ["On-Progress", "Assisted", "Quote-Done", "SO-Done"];

    // Merge activity with company info, filter by allowed statuses and date, then map and sort
    const mergedData = activities
        .filter((a) => allowedStatuses.includes(a.status)) // <-- filter by multiple statuses
        .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
        .map((activity) => {
            const company = companies.find(
                (c) => c.account_reference_number === activity.account_reference_number
            );
            return {
                ...activity,
                company_name: company?.company_name ?? "Unknown Company",
                contact_number: company?.contact_number ?? "-",
                type_client: company?.type_client ?? "",
            };
        })

        .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());


    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

    // Handle marking activity as done
    const openDoneDialog = (activityReferenceNumber: string) => {
        setSelectedActivityRefNum(activityReferenceNumber);
        setDialogOpen(true);
    };

    const handleConfirmDone = async () => {
        if (!selectedActivityRefNum) return;

        try {
            setUpdatingId(selectedActivityRefNum);
            setDialogOpen(false);

            const res = await fetch("/api/act-update-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activityReferenceNumber: selectedActivityRefNum }),
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
                setUpdatingId(null);
                return;
            }

            setActivities((curr) =>
                curr.filter((a) => a.activity_reference_number !== selectedActivityRefNum)
            );

            toast.success("Transaction marked as Done.");
        } catch {
            toast.error("An error occurred while updating status.");
        } finally {
            setUpdatingId(null);
            setSelectedActivityRefNum(null);
        }
    };

    if (isLoading) {
        return <div className="text-center text-muted-foreground">Loading data...</div>;
    }

    if (error) {
        return (
            <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded border border-yellow-300">
                {error}
            </div>
        );
    }

    if (mergedData.length === 0) {
        return <div className="text-muted-foreground">No activities found.</div>;
    }

    return (
        <>
            <div className="mb-2 text-xs font-bold">
                Total On-Progress Activities: {mergedData.length}
            </div>

            <div className="max-h-[400px] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">
                    {mergedData.map((item) => {
                        // Determine badge color based on status
                        let badgeColor: "default" | "secondary" | "destructive" | "outline" = "default";

                        if (item.status === "Assisted" || item.status === "SO-Done") {
                            badgeColor = "secondary";
                        } else if (item.status === "Quote-Done") {
                            badgeColor = "outline";
                        }

                        return (
                            <AccordionItem key={item.id} value={item.id}>
                                {/* Header container */}
                                <div className="p-2 cursor-pointer select-none">
                                    <div className="flex justify-between items-center">
                                        {/* Company name */}
                                        <AccordionTrigger className="flex-1 text-xs font-semibold">
                                            {item.company_name}
                                        </AccordionTrigger>

                                        {/* Action buttons */}
                                        <div className="flex gap-2 ml-4">
                                            <CreateActivityDialog
                                                target_quota={target_quota}
                                                referenceid={item.referenceid}
                                                tsm={item.tsm}
                                                manager={item.manager}
                                                type_client={item.type_client}
                                                contact_number={item.contact_number}
                                                activityReferenceNumber={item.activity_reference_number}
                                                accountReferenceNumber={item.account_reference_number}
                                                onCreated={(newActivity) => setActivities((curr) => [...curr, newActivity])}
                                            />

                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={updatingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDoneDialog(item.id);
                                                }}
                                            >
                                                {updatingId === item.id ? "Updating..." : "Done"}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Badge below company name and buttons */}
                                    <div className="ml-1">
                                        <Badge variant={badgeColor} className="text-[8px]">
                                            {item.status.replace("-", " ")}
                                        </Badge>
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2">
                                    <p>
                                        <strong>Contact Number:</strong> {item.contact_number}
                                    </p>
                                    <p>
                                        <strong>Account Reference Number:</strong> {item.account_reference_number}
                                    </p>
                                    <p>
                                        <strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}
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
