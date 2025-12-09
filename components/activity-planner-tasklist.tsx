"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle, } from "@/components/ui/alert"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskListDialog } from "@/components/activity-planner-tasklist-dialog";
import TaskListEditDialog from "./activity-planner-tasklist-edit-dialog";
import { AccountsActiveDeleteDialog } from "./accounts-active-delete-dialog";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
}

interface Completed {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name?: string;
    product_category?: string;
    project_type?: string;
    source?: string;
    target_quota?: number;
    type_activity?: string;
    callback?: string;
    call_status?: string;
    call_type?: string;
    quotation_number?: string;
    quotation_amount?: number;
    so_number?: string;
    so_amount?: number;
    actual_sales?: number;
    delivery_date?: string;
    dr_number?: string;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    date_followup?: string;
    date_site_vist?: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    payment_terms?: string;
    scheduled_status?: string;
}

interface CompletedProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any; // Adjust if you want
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const TaskList: React.FC<CompletedProps> = ({
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

    // Filters state - default to "all" (means no filter)
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [removeRemarks, setRemoveRemarks] = useState("");

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

    // Real-time subscription using Supabase
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

    // Merge company info into activities
    const mergedActivities = useMemo(() => {
        return activities
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
            .sort(
                (a, b) =>
                    new Date(b.date_updated ?? b.date_created).getTime() -
                    new Date(a.date_updated ?? a.date_created).getTime()
            );
    }, [activities, companies]);

    // Check if item has any meaningful data in these columns
    const hasMeaningfulData = (item: Completed) => {
        const columnsToCheck = [
            "activity_reference_number",
            "referenceid",
            "tsm",
            "manager",
            "type_client",
            "project_name",
            "product_category",
            "project_type",
            "source",
            "target_quota",
            "type_activity",
            "callback",
            "call_status",
            "call_type",
            "quotation_number",
            "quotation_amount",
            "so_number",
            "so_amount",
            "actual_sales",
            "delivery_date",
            "dr_number",
            "ticket_reference_number",
            "remarks",
            "status",
            "start_date",
            "end_date",
            "date_followup",
            "date_site_vist",
            "date_created",
            "date_updated",
            "account_reference_number",
            "payment_terms",
            "scheduled_status",
        ];

        return columnsToCheck.some((col) => {
            const val = (item as any)[col];
            if (val === null || val === undefined) return false;

            if (typeof val === "string") return val.trim() !== "";
            if (typeof val === "number") return !isNaN(val);
            if (val instanceof Date) return !isNaN(val.getTime());

            if (typeof val === "object" && val !== null && val.toString) {
                return val.toString().trim() !== "";
            }

            return Boolean(val);
        });
    };

    // Apply search, filters, and only show those with meaningful data
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return mergedActivities
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some((val) => {
                    if (val === null || val === undefined) return false;
                    return String(val).toLowerCase().includes(search);
                });
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                if (filterTypeActivity !== "all" && item.type_activity !== filterTypeActivity) return false;
                return true;
            })

            /* ⭐⭐⭐ DATE RANGE FILTER HERE ⭐⭐⭐ */
            .filter((item) => {
                if (!dateCreatedFilterRange || (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)) {
                    return true;
                }

                const updated = item.date_updated
                    ? new Date(item.date_updated)
                    : new Date(item.date_created);

                if (isNaN(updated.getTime())) return false;

                const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
                const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;

                if (from && updated < from) return false;
                if (to && updated > to) return false;

                return true;
            })

            .filter(hasMeaningfulData);
    }, [
        mergedActivities,
        searchTerm,
        filterStatus,
        filterTypeActivity,
        dateCreatedFilterRange,
    ]);

    const isLoading = loadingCompanies || loadingActivities;
    const error = errorCompanies || errorActivities;

    // Extract unique status and type_activity values for filter dropdowns
    const statusOptions = useMemo(() => {
        const setStatus = new Set<string>();
        mergedActivities.forEach((a) => {
            if (a.status) setStatus.add(a.status);
        });
        return Array.from(setStatus).sort();
    }, [mergedActivities]);

    const typeActivityOptions = useMemo(() => {
        const setType = new Set<string>();
        mergedActivities.forEach((a) => {
            if (a.type_activity) setType.add(a.type_activity);
        });
        return Array.from(setType).sort();
    }, [mergedActivities]);

    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    // When edit is saved, refetch activities or update state accordingly
    const onEditSaved = () => {
        fetchActivities(); // or you can optimistically update
        closeEditDialog();
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Confirm remove function
    const onConfirmRemove = async () => {
        try {
            // Assuming your API endpoint for delete supports receiving multiple IDs and removeRemarks
            const res = await fetch("/api/act-delete-history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    remarks: removeRemarks,
                }),
            });

            if (!res.ok) throw new Error("Failed to delete selected activities");

            // Success toast (optional)
            // toast.success("Selected activities deleted permanently.");

            // Close dialog and clear selection + remarks
            setDeleteDialogOpen(false);
            clearSelection();
            setRemoveRemarks("");

            // Refresh activities list
            fetchActivities();
        } catch (error) {
            // toast.error("Failed to delete activities. Please try again.");
            console.error(error);
        }
    };

    return (
        <>
            {/* Search + Filter always visible */}
            <div className="mb-4 flex items-center justify-between gap-4">
                {/* Left: Search bar */}
                <Input
                    type="text"
                    placeholder="Search company, reference ID, status, or activity..."
                    className="input input-bordered input-sm flex-grow max-w-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search activities"
                />

                {/* Right: filter icon + delete button */}
                <div className="flex items-center space-x-2">
                    {/* Filter icon / dialog trigger */}
                    <TaskListDialog
                        filterStatus={filterStatus}
                        filterTypeActivity={filterTypeActivity}
                        setFilterStatus={setFilterStatus}
                        setFilterTypeActivity={setFilterTypeActivity}
                        statusOptions={statusOptions}
                        typeActivityOptions={typeActivityOptions}
                    />

                    {/* Delete button */}
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="flex items-center space-x-1"
                        >
                            <span>Delete Selected ({selectedIds.size})</span>
                        </Button>
                    )}
                </div>
            </div>


            {/* Show loading indicator */}
            {isLoading && (
                <div className="flex justify-center items-center h-40">
                    <Spinner className="size-8" />
                </div>
            )}

            {/* Show error message */}
            {error && (
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
            )}

            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Total Activities: {filteredActivities.length}
                </div>
            )}

            {/* Activities list */}
            {filteredActivities.length > 0 && (
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Accordion type="single" collapsible className="w-full">
                        {filteredActivities.map((item) => {
                            let badgeColor: "default" | "secondary" | "destructive" | "outline" =
                                "default";

                            if (item.status === "Assisted" || item.status === "SO-Done") {
                                badgeColor = "secondary";
                            } else if (item.status === "Quote-Done") {
                                badgeColor = "outline";
                            }

                            const isSelected = selectedIds.has(item.id);

                            return (
                                <AccordionItem key={item.id} value={String(item.id)}>
                                    <div className="p-2 cursor-pointer select-none w-full">
                                        <div className="flex justify-between items-center w-full">
                                            <AccordionTrigger className="flex-1 text-xs font-semibold">
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation(); // Prevent accordion toggle
                                                        toggleSelect(item.id);
                                                    }}
                                                    className="ml-1"
                                                    aria-label={`Select activity ${item.activity_reference_number}`}
                                                />
                                                {new Date(item.date_updated ?? item.date_created).toLocaleDateString()}{" "}
                                                <span className="text-[10px] text-muted-foreground mx-1">|</span>{" "}
                                                {new Date(item.date_updated ?? item.date_created).toLocaleTimeString(
                                                    [],
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }
                                                )}{" "}
                                                <span className="mx-1">-</span> {item.company_name}
                                            </AccordionTrigger>

                                            <div className="flex items-center space-x-2">
                                                <Badge variant={badgeColor} className="text-[8px] whitespace-nowrap">
                                                    {item.status?.replace("-", " ")}
                                                </Badge>

                                                <Button
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // prevent accordion toggle
                                                        openEditDialog(item);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <AccordionContent className="text-xs px-4 py-2 space-y-1">
                                        <p><strong>Contact Number:</strong> {item.contact_number}</p>
                                        <p>
                                            <strong>Account Reference Number:</strong> {item.account_reference_number}
                                        </p>

                                        {[
                                            { label: "Type Client", value: item.type_client },
                                            { label: "Project Name", value: item.project_name },
                                            { label: "Project Type", value: item.project_type },
                                            { label: "Source", value: item.source },
                                            { label: "Target Quota", value: item.target_quota },
                                            { label: "Activity Type", value: item.type_activity },
                                            { label: "Callback", value: item.callback },
                                            { label: "Call Status", value: item.call_status },
                                            { label: "Call Type", value: item.call_type },
                                            { label: "Quotation Number", value: item.quotation_number },
                                            { label: "Quotation Amount", value: item.quotation_amount },
                                            { label: "SO Number", value: item.so_number },
                                            { label: "SO Amount", value: item.so_amount },
                                            { label: "Actual Sales", value: item.actual_sales },
                                            { label: "Delivery Date", value: item.delivery_date },
                                            { label: "DR Number", value: item.dr_number },
                                            { label: "Ticket Reference Number", value: item.ticket_reference_number },
                                            { label: "Remarks", value: item.remarks },
                                            { label: "Status", value: item.status },
                                            { label: "Date Followup", value: item.date_followup },
                                            { label: "Date Site Visit", value: item.date_site_vist },
                                            { label: "Payment Terms", value: item.payment_terms },
                                            { label: "Scheduled Status", value: item.scheduled_status },
                                        ].map(({ label, value }) =>
                                            value !== null && value !== undefined && String(value).trim() !== "" ? (
                                                <p key={label}>
                                                    <strong>{label}:</strong> {String(value)}
                                                </p>
                                            ) : null
                                        )}
                                    </AccordionContent>

                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={onEditSaved}
                />
            )}

            {/* Delete confirmation dialog */}
            <AccountsActiveDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                removeRemarks={removeRemarks}
                setRemoveRemarks={setRemoveRemarks}
                onConfirmRemove={onConfirmRemove}
            />
        </>
    );
};
