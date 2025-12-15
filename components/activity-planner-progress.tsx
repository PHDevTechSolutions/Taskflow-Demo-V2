"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner"
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
    status: string;
    date_updated: string;
    scheduled_date: string;
    date_created: string;
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

    // Fetch companies with no cache
    useEffect(() => {
        if (!referenceid) {
            setCompanies([]);
            return;
        }
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
    }, [referenceid]);

    // Fetch activities with no cache via API route
    const fetchActivities = useCallback(async () => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        try {
            const res = await fetch(`/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`, {
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
    }, [referenceid]);

    // Initial fetch + realtime subscription to keep UI fresh
    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        // Gumawa ng channel na naka-subscribe sa activity table filtered by referenceid
        const channel = supabase
            .channel(`public:activity:referenceid=eq.${referenceid}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'activity',
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as Activity;
                    const oldRecord = payload.old as Activity;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case 'INSERT':
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;
                            case 'UPDATE':
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
                            case 'DELETE':
                                return curr.filter((a) => a.id !== oldRecord.id);
                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            // Proper way to unsubscribe sa bagong API:
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
        if (!range) return true;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const { from, to } = range;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    };

    const allowedStatuses = ["On-Progress", "Assisted", "Quote-Done", "SO-Done", "Not Assisted"];

    const mergedData = activities
        .filter((a) => allowedStatuses.includes(a.status))
        .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
        .filter((a) => !a.scheduled_date || a.scheduled_date === "")
        .map((activity) => {
            const company = companies.find(
                (c) => c.account_reference_number === activity.account_reference_number
            );
            return {
                ...activity,
                company_name: company?.company_name ?? "Unknown Company",
                contact_number: company?.contact_number ?? "-",
                type_client: company?.type_client ?? "",
                contact_person: company?.contact_person ?? "",
                email_address: company?.email_address ?? "",
                address: company?.address ?? "",
            };
        })
        .sort(
            (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
        );

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
            <div className="mb-2 text-xs font-bold">
                Total On-Progress Activities: {mergedData.length}
            </div>

            <div className="max-h-[400px] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">
                    {mergedData.map((item) => {
                        let badgeColor: "default" | "secondary" | "destructive" | "outline" = "default";

                        if (item.status === "Assisted" || item.status === "SO-Done") {
                            badgeColor = "secondary";
                        } else if (item.status === "Quote-Done") {
                            badgeColor = "outline";
                        }

                        return (
                            <AccordionItem key={item.id} value={item.id}>
                                <div className="p-2 cursor-pointer select-none">
                                    <div className="flex justify-between items-center">
                                        <AccordionTrigger className="flex-1 text-xs font-semibold">
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

                                    <div className="ml-1">
                                        <Badge variant={badgeColor} className="text-[8px]">
                                            {item.status.replace("-", " ")}
                                        </Badge>
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2">
                                    <p><strong>Type of Client:</strong> {item.type_client}</p>
                                    <p><strong>Contact Person:</strong> {item.contact_person}</p>
                                    <p><strong>Contact Number:</strong> {item.contact_number}</p>
                                    <p><strong>Email Address:</strong> {item.email_address}</p>
                                    <p><strong>Address:</strong> {item.address}</p>
                                    <p><strong>Date Created:</strong>{" "}{new Date(item.date_created).toLocaleDateString()}</p>
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
