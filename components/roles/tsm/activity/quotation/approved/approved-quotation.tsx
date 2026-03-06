"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, FileSpreadsheet, FileText, MoreVertical, } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "../../planner/dialog/edit";

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
    tsm_approved_date: string;
    delivery_fee: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
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
    signature?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const ApprovedQuotation: React.FC<CompletedProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(null);
    const [managerDetails, setManagerDetails] = useState<SupervisorDetails | null>(null);

    // -----------------------------
    // FETCH ACTIVITIES
    // -----------------------------
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

        const url = new URL("/api/activity/tsm/quotation/fetch", window.location.origin);
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

    // -----------------------------
    // REAL-TIME SUBSCRIPTION
    // -----------------------------
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
                    filter: `tsm=eq.${referenceid}`,
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

    // -----------------------------
    // SORT & FILTER
    // -----------------------------
    const sortedActivities = useMemo(() => {
        return [...activities].sort(
            (a, b) =>
                new Date(b.date_updated ?? b.date_created).getTime() -
                new Date(a.date_updated ?? a.date_created).getTime()
        );
    }, [activities]);

    const hasMeaningfulData = (item: Completed) => {
        const columnsToCheck = ["activity_reference_number", "referenceid", "quotation_number", "quotation_amount"];
        return columnsToCheck.some((col) => {
            const val = (item as any)[col];
            if (val === null || val === undefined) return false;
            if (typeof val === "string") return val.trim() !== "";
            if (typeof val === "number") return !isNaN(val);
            return Boolean(val);
        });
    };

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return sortedActivities
            // 🔴 EXCLUDE declined quotations
            .filter((item) =>
                ["Approved", "Approved By Sales Head"].includes(item.tsm_approved_status)
            )

            // 🔍 search filter
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some(
                    (val) => val && String(val).toLowerCase().includes(search)
                );
            })

            // 📄 quotation only
            .filter((item) => item.type_activity === "Quotation Preparation")

            // 🧹 meaningful data only
            .filter(hasMeaningfulData)

            // 📅 date range filter
            .filter((item) => {
                if (!dateCreatedFilterRange) return true;

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
            });
    }, [sortedActivities, searchTerm, dateCreatedFilterRange]);

    // -----------------------------
    // AGENT MAP
    // -----------------------------
    const [agents, setAgents] = useState<any[]>([]);
    const userDetails = { referenceid }; // placeholder
    useEffect(() => {
        if (!userDetails.referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`);
                if (!response.ok) throw new Error("Failed to fetch agents");
                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error(err);
                setError("Failed to load agents.");
            }
        };

        fetchAgents();
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    // -----------------------------
    // UTILS
    // -----------------------------
    const displayValue = (v: any) => (v === null || v === undefined || String(v).trim() === "" ? "-" : String(v));

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
        if (hours) parts.push(`${hours} hr${hours !== 1 ? "s" : ""}`);
        if (minutes) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
        parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);
        return parts.join(" ");
    }

    // -----------------------------
    // SELECTION
    // -----------------------------

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

    return (
        <>
            {/* Search */}
            <div className="mb-4 flex items-center gap-4">
                <Input
                    type="text"
                    placeholder="Search..."
                    className="input input-bordered input-sm flex-grow max-w-md rounded-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Error */}
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

            {/* Total Records */}
            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold">Total Records: {filteredActivities.length}</div>
            )}

            {/* Table */}
            {filteredActivities.length > 0 && (
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px] text-center">Tools</TableHead>
                                <TableHead>Agent</TableHead>
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
                                const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-center flex space-x-2 justify-center">
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
                                                    {/* Edit */}
                                                    <DropdownMenuItem
                                                        onClick={() => openEditDialog(item)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap">
                                            <div className="flex items-center gap-2 capitalize">
                                                {agent?.profilePicture ? (
                                                    <img
                                                        src={agent.profilePicture}
                                                        alt={agent.name}
                                                        className="w-6 h-6 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                        N/A
                                                    </div>
                                                )}
                                                <span>{agent?.name || "-"}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                timeZone: "Asia/Manila",
                                            })}
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap font-mono">
                                            {formatDuration(item.start_date, item.end_date)}
                                        </TableCell>

                                        <TableCell className="font-semibold">{item.company_name}<br /><span className="text-[10px] italic">{item.activity_reference_number}</span></TableCell>
                                        <TableCell className="p-2 font-semibold text-center">
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
                                        </TableCell>

                                        <TableCell>
                                            {item.tsm_approved_date
                                                ? new Date(item.tsm_approved_date).toLocaleDateString("en-PH", {
                                                    timeZone: "Asia/Manila",
                                                })
                                                : "-"}
                                        </TableCell>

                                        <TableCell>{displayValue(item.contact_number)}</TableCell>
                                        <TableCell className="uppercase">{displayValue(item.quotation_number)}</TableCell>
                                        <TableCell>
                                            {displayValue(item.quotation_amount) !== "-"
                                                ? parseFloat(displayValue(item.quotation_amount)).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
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
                    signature={signature}
                    company={{
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    deliveryFee={editItem.delivery_fee}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                />
            )}
        </>
    );
};