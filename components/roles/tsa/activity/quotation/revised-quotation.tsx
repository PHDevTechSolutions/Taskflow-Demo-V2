"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, PenIcon, MoreVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

import { TaskListDialog } from "../tasklist/dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../planner/dialog/delete";

interface SupervisorDetails {
    firstname: string;
    lastname: string;
    email: string;
    profilePicture: string;
    signatureImage: string;
    contact: string;
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
    start_date: string;
    end_date: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    quotation_type: string;
    company_name: string;
    contact_number: string;
    email_address: string;
    address: string;
    contact_person: string;
    tsm_approved_status: string;
    vat_type: string;
    delivery_fee: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    manager_signature: string;
    manager_contact_number: string;
    manager_email_address: string;

    tsm_approval_date: string;
    manager_approval_date: string;
    tsm_remarks: string;
    manager_remarks: string;
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
    // ✅ Added: passed down from parent so internal fetch is not needed
    signature?: string;
    managerDetails?: SupervisorDetails | null;
    tsmDetails?: SupervisorDetails | null;
    dateCreatedFilterRange: any;
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
    signature,
    managerDetails: managerDetailsProp,
    tsmDetails: tsmDetailsProp,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [removeRemarks, setRemoveRemarks] = useState("");

    // ✅ Use prop values as initial state — avoids internal fetch when parent already has the data
    const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(tsmDetailsProp ?? null);
    const [managerDetails, setManagerDetails] = useState<SupervisorDetails | null>(managerDetailsProp ?? null);

    // ✅ Sync if parent props update after mount
    useEffect(() => {
        if (tsmDetailsProp !== undefined) setTsmDetails(tsmDetailsProp);
    }, [tsmDetailsProp]);

    useEffect(() => {
        if (managerDetailsProp !== undefined) setManagerDetails(managerDetailsProp);
    }, [managerDetailsProp]);

    // ✅ Only fetch hierarchy internally if props were not provided
    useEffect(() => {
        // Guard 1: skip if referenceid is not ready
        if (!referenceid) return;

        // Guard 2: skip if parent already passed the details down
        if (managerDetailsProp !== undefined && tsmDetailsProp !== undefined) return;

        const fetchHierarchy = async () => {
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(referenceid)}`);

                if (!response.ok) throw new Error("Failed to fetch hierarchy details");

                const data = await response.json();

                setTsmDetails(data.tsmDetails ?? null);
                setManagerDetails(data.managerDetails ?? null);
            } catch (error) {
                console.error("Hierarchy fetch error:", error);
            }
        };

        fetchHierarchy();
    }, [referenceid, managerDetailsProp, tsmDetailsProp]);

    // Fetch activities from API
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        const url = new URL("/api/activity/tsa/quotation/fetch", window.location.origin);
        url.searchParams.append("referenceid", referenceid);
        if (from && to) {
            url.searchParams.append("from", from);
            url.searchParams.append("to", to);
        }

        fetch(url.toString())
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [referenceid, dateCreatedFilterRange]);

    // Subscribe to real-time changes with Supabase
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities();

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
                    fetchActivities();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    // Sort activities by latest date_updated or date_created
    const sortedActivities = useMemo(() => {
        return activities.sort(
            (a, b) =>
                new Date(b.date_updated ?? b.date_created).getTime() -
                new Date(a.date_updated ?? a.date_created).getTime()
        );
    }, [activities]);

    // Check if item has meaningful data
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

    // Filtered and searched activities
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return sortedActivities
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some((val) => {
                    if (val === null || val === undefined) return false;
                    return String(val).toLowerCase().includes(search);
                });
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                // force filter type_activity to "Quotation Preparation"
                if (item.type_activity !== "Quotation Preparation") return false;
                return true;
            })
            .filter((item) => {
                if (
                    !dateCreatedFilterRange ||
                    (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)
                ) {
                    return true;
                }

                const updated = item.date_updated
                    ? new Date(item.date_updated)
                    : new Date(item.date_created);

                if (isNaN(updated.getTime())) return false;

                const from = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const to = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                if (from && updated < from) return false;
                if (to && updated > to) return false;

                return true;
            })
            .filter(hasMeaningfulData);
    }, [sortedActivities, searchTerm, filterStatus, dateCreatedFilterRange]);

    // Extract unique status for filter dropdowns
    const statusOptions = useMemo(() => {
        const setStatus = new Set<string>();
        sortedActivities.forEach((a) => {
            if (a.status) setStatus.add(a.status);
        });
        return Array.from(setStatus).sort();
    }, [sortedActivities]);

    // Extract unique type_activity for filter dropdowns
    const typeActivityOptions = useMemo(() => {
        const setType = new Set<string>();
        sortedActivities.forEach((a) => {
            if (a.type_activity) setType.add(a.type_activity);
        });
        return Array.from(setType).sort();
    }, [sortedActivities]);

    // Handlers for Edit dialog
    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    const onEditSaved = () => {
        fetchActivities();
        closeEditDialog();
    };

    // Selection toggle for checkboxes
    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Delete selected activities
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
            fetchActivities();
        } catch (error) {
            console.error(error);
        }
    };

    // Helper to display or fallback "-"
    const displayValue = (v: any) =>
        v === null || v === undefined || String(v).trim() === "" ? "" : String(v);

    function formatDuration(start?: string, end?: string) {
        if (!start || !end) return "-";

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "-";

        let diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
        if (diff < 0) diff = 0;

        const hours = Math.floor(diff / 3600);
        diff %= 3600;
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;

        const parts: string[] = [];

        if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? "s" : ""}`);
        if (minutes > 0) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
        if (seconds > 0 || parts.length === 0)
            parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);

        return parts.join(" ");
    }

    return (
        <>
            {/* Search + Filter */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <Input
                    type="text"
                    placeholder="Search company, reference ID, status, or activity..."
                    className="input input-bordered input-sm flex-grow max-w-md rounded-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search activities"
                />

                <div className="flex items-center space-x-2">
                    <TaskListDialog
                        filterStatus={filterStatus}
                        filterTypeActivity={filterTypeActivity}
                        setFilterStatus={setFilterStatus}
                        setFilterTypeActivity={setFilterTypeActivity}
                        statusOptions={statusOptions}
                        typeActivityOptions={typeActivityOptions}
                    />

                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="flex items-center space-x-1 cursor-pointer rounded-none"
                        >
                            <span>Delete Selected ({selectedIds.size})</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <Alert
                    variant="destructive"
                    className="flex flex-col space-y-4 p-4 text-xs"
                >
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

            {/* Total records */}
            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Total Records: {filteredActivities.length}
                </div>
            )}

            {/* Table */}
            {filteredActivities.length > 0 && (
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]" />
                                <TableHead className="w-[60px] text-center">Tools</TableHead>
                                <TableHead>Date Created</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead>Date Approved/Decline</TableHead>
                                <TableHead>Contact #</TableHead>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Quotation Amount</TableHead>
                                <TableHead className="text-center">Source</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {filteredActivities.map((item) => {
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

                                        <TableCell className="text-center space-x-2 justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        className="rounded-none flex items-center gap-1 text-xs cursor-pointer"
                                                    >
                                                        Actions
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent align="end" className="rounded-none text-xs">
                                                    <DropdownMenuItem
                                                        onClick={() => openEditDialog(item)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <PenIcon className="w-4 h-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>

                                        <TableCell>
                                            {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                timeZone: "Asia/Manila",
                                            })}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap font-mono">
                                            {formatDuration(item.start_date, item.end_date)}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {item.company_name}
                                        </TableCell>
                                        <td className="p-2 font-semibold text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold
                                                     ${item.tsm_approved_status === "Approved"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.tsm_approved_status === "Pending"
                                                            ? "bg-orange-100 text-orange-700"
                                                            : item.tsm_approved_status === "Decline"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                        </td>
                                        <TableCell>
                                            {item.tsm_approval_date && (
                                                <>
                                                    Approved:{" "}
                                                    {new Date(item.tsm_approval_date).toLocaleString("en-PH", {
                                                        timeZone: "Asia/Manila",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        second: "2-digit",
                                                    })}
                                                </>
                                            )}

                                            {item.manager_approval_date && (
                                                <>
                                                    <br />
                                                    Sales Head Approved:{" "}
                                                    {new Date(item.manager_approval_date).toLocaleString("en-PH", {
                                                        timeZone: "Asia/Manila",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        second: "2-digit",
                                                    })}
                                                </>
                                            )}

                                            {item.tsm_remarks && displayValue(item.tsm_remarks) && (
                                                <>
                                                    <br />
                                                    TSM: {displayValue(item.tsm_remarks)}
                                                </>
                                            )}

                                            {item.manager_remarks && displayValue(item.manager_remarks) && (
                                                <>
                                                    <br />
                                                    Sales Head: {displayValue(item.manager_remarks)}
                                                </>
                                            )}
                                        </TableCell>

                                        <TableCell>{displayValue(item.contact_number)}</TableCell>

                                        <TableCell className="uppercase">
                                            {displayValue(item.quotation_number)}
                                        </TableCell>

                                        <TableCell>
                                            ₱{displayValue(item.quotation_amount) !== "-"
                                                ? parseFloat(displayValue(item.quotation_amount)).toLocaleString(
                                                    undefined,
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    }
                                                )
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold capitalize
                                                    ${item.quotation_type === "Ecoshift Corporation"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.quotation_type === "Disruptive Solutions Inc"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {displayValue(item.quotation_type)}
                                            </span>
                                        </TableCell>
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
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    managername={managername}
                    company={{
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    vatType={editItem.vat_type}
                    deliveryFee={editItem.delivery_fee}
                    // Signatories
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    TsmSignature={editItem.tsm_signature}
                    TsmEmailAddress={editItem.tsm_email_address}
                    TsmContactNumber={editItem.tsm_contact_number}
                    ManagerSignature={editItem.manager_signature}
                    ManagerContactNumber={editItem.manager_contact_number}
                    ManagerEmailAddress={editItem.manager_email_address}
                    ApprovedStatus={editItem.tsm_approved_status}
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