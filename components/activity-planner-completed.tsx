"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle, } from "@/components/ui/alert"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { type DateRange } from "react-day-picker";
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
}

interface Completed {
    id: number;
    referenceid: string;
    target_quota?: string;
    tsm: string;
    manager: string;
    account_reference_number: string;
    status: string;
    scheduled_status: string;
    date_updated: string;
    date_created: string;
}

interface CompletedProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

export const Completed: React.FC<CompletedProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

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
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        const channel = supabase
            .channel(`public:history:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as Completed;
                    const oldRecord = payload.old as Completed;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
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
    }, [referenceid, fetchActivities]);

    const mergedActivities = activities
        .map((history) => {
            const company = companies.find(
                (c) => c.account_reference_number === history.account_reference_number
            );
            return {
                ...history,
                company_name: company?.company_name ?? "Unknown Company",
                contact_number: company?.contact_number ?? "-",
                type_client: company?.type_client ?? "",
            };
        })
        .filter(
            (a) =>
                (a.status === "Delivered" || a.status === "Done")
        ) // status Delivered or Done AND scheduled_status Done
        .sort(
            (a, b) =>
                new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
        );


    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

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
                        <AlertTitle className="text-black">Create New Data</AlertTitle>
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
                Total Completed Activities: {mergedActivities.length}
            </div>

            <div className="max-h-[400px] overflow-auto space-y-8 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">
                    {mergedActivities.map((item) => {
                        let badgeColor: "default" | "secondary" | "destructive" | "outline" =
                            "default";

                        if (item.status === "Assisted" || item.status === "SO-Done") {
                            badgeColor = "secondary";
                        } else if (item.status === "Quote-Done") {
                            badgeColor = "outline";
                        }

                        return (
                            <AccordionItem key={item.id} value={String(item.id)}>
                                <div className="p-2 cursor-pointer select-none w-full">
                                    <div className="flex justify-between items-center w-full">
                                        <AccordionTrigger className="flex-1 text-xs font-semibold">
                                            {item.company_name}
                                        </AccordionTrigger>

                                        <Badge variant={badgeColor} className="text-[8px] ml-2 whitespace-nowrap">
                                            {item.status.replace("-", " ")}
                                        </Badge>
                                    </div>
                                </div>

                                <AccordionContent className="text-xs px-4 py-2">
                                    <p>
                                        <strong>Contact Number:</strong> {item.contact_number}
                                    </p>
                                    <p>
                                        <strong>Account Reference Number:</strong>{" "}
                                        {item.account_reference_number}
                                    </p>
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
