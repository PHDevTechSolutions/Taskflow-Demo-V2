"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle, } from "@/components/ui/alert"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

import { TaskListDialog } from "../../../tsa/activity/tasklist/dialog/filter";
import TaskListEditDialog from "../../../tsa/activity/tasklist/dialog/edit";
import { AccountsActiveDeleteDialog } from "../../../tsa/activity/planner/dialog/delete";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
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
    type_activity?: string;
    quotation_number?: string;
    quotation_amount?: number;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    quotation_type: string;
}

interface CompletedProps {
    referenceid: string;
    target_quota?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    contact?: string;
    tsmname?: string;
    managername?: string;
    dateCreatedFilterRange: any; // Adjust if you want
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const RevisedQuotation: React.FC<CompletedProps> = ({
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
        if (!referenceid) return;

        // Initial fetch
        fetchActivities();

        // Subscribe realtime for history changes that affect activities
        const channel = supabase
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
                    // Refetch activities on any history change
                    fetchActivities();
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
                    email_address: company?.email_address ?? "",
                    address: company?.address ?? "",
                    contact_person: company?.contact_person ?? "",
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
            "quotation_number",
            "quotation_amount",
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
                // dito natin i-force filter type_activity sa "Quotation Preparation"
                if (item.type_activity !== "Quotation Preparation") return false;
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
            const res = await fetch("/api/act-delete-history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    remarks: removeRemarks,
                }),
            });

            if (!res.ok) throw new Error("Failed to delete selected activities");

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
                            className="flex items-center space-x-1 cursor-pointer"
                        >
                            <span>Delete Selected ({selectedIds.size})</span>
                        </Button>
                    )}
                </div>
            </div>

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
                    Total Records: {filteredActivities.length}
                </div>
            )}

            {filteredActivities.length > 0 && (
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]" />
                                <TableHead className="w-[60px] text-center">Edit</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Contact #</TableHead>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Quotation Amount</TableHead>
                                <TableHead>Source</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {filteredActivities.map((item) => {
                                let badgeColor: "default" | "secondary" | "destructive" | "outline" = "default";
                                if (item.status === "Assisted" || item.status === "SO-Done") badgeColor = "secondary";
                                else if (item.status === "Quote-Done") badgeColor = "outline";

                                const displayValue = (v: any) =>
                                    v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

                                const isSelected = selectedIds.has(item.id);

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                className="w-6 h-6 hover:bg-gray-100 rounded cursor-pointer"
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelect(item.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center flex space-x-2 justify-center">
                                            <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                                                Edit
                                            </Button>
                                        </TableCell>

                                        <TableCell>{new Date(item.date_updated ?? item.date_created).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {new Date(item.date_updated ?? item.date_created).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </TableCell>
                                        <TableCell className="font-semibold">{item.company_name}</TableCell>
                                        <TableCell>{displayValue(item.contact_number)}</TableCell>
                                        <TableCell className="uppercase">{displayValue(item.quotation_number)}</TableCell>
                                        <TableCell>{displayValue(item.quotation_amount) !== "-" ? parseFloat(displayValue(item.quotation_amount)).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        }) : "-"}</TableCell>
                                        <TableCell className="capitalize">{displayValue(item.quotation_type)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={onEditSaved}
                    company={companies.find(
                        (c) => c.account_reference_number === editItem.account_reference_number
                    )}
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    managername={managername}
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
