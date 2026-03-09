"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon, Eye, MoreVertical } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TaskListEditDialog from "../../dialog/edit";
import { ButtonGroup } from "@/components/ui/button-group"

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
    delivery_fee: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    agent_name: string;

    tsm_name: string;
    tsm_approval_date: string;
    tsm_remarks: string;

    vat_type: string;
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

export const Scheduled: React.FC<CompletedProps> = ({
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
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    // -----------------------------
    // FETCH ACTIVITIES
    // -----------------------------
    const fetchActivities = useCallback(() => {
        if (!referenceid) return;

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

    useEffect(() => {
        if (!referenceid) return;

        // ✅ define async function and call it immediately (do not return)
        const fetchData = async () => {
            await fetchActivities();
        };
        fetchData(); // call it, but don't return it

        const channel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` },
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

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();
        return sortedActivities
            // ✅ Only include Quotation Preparation activities with the correct status
            .filter(
                (item) =>
                    item.type_activity === "Quotation Preparation" &&
                    ["Pending"].includes(item.tsm_approved_status)
            )
            // ✅ Apply search filter
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some(
                    (val) => val && String(val).toLowerCase().includes(search)
                );
            });
    }, [sortedActivities, searchTerm]);

    // -----------------------------
    // AGENT MAP
    // -----------------------------
    const [agents, setAgents] = useState<any[]>([]);
    useEffect(() => {
        if (!referenceid) return;

        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => res.json())
            .then((data) => setAgents(data))
            .catch(() => setError("Failed to load agents."));
    }, [referenceid]);

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

    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    return (
        <>
            {/* Search */}
            <div className="mb-4 flex items-center gap-4">
                <Input
                    type="text"
                    placeholder="Search..."
                    className="input input-bordered input-sm flex-grow rounded-none"
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

            {/* Cards */}
            <div className="h-[500px] overflow-y-auto grid grid-cols-1 gap-4">
                {filteredActivities.map((item) => {
                    const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                    return (
                        <div key={item.id} className="border rounded-md p-3 shadow-sm bg-white relative">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
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
                                    <span className="font-semibold text-xs uppercase">{agent?.name || "-"}</span>
                                </div>

                                {/* Top-right: Status + Button */}
                                <div className="flex items-center gap-2">
                                    <ButtonGroup>
                                        <Button className={`rounded-none p-4 text-xs text-white font-semibold ${item.tsm_approved_status === "Approved"
                                            ? "bg-green-600"
                                            : item.tsm_approved_status === "Pending"
                                                ? "bg-orange-500"
                                                : "bg-gray-400"
                                            }`}>{item.tsm_approved_status}</Button>
                                        <Button variant="outline" className="rounded-none text-xs" onClick={() => openEditDialog(item)}><Eye className="w-4 h-4 mr-1" /> View</Button>
                                    </ButtonGroup>

                                </div>
                            </div>

                            {/* Body */}
                            <div className="space-y-1 text-xs">
                                <div>
                                    <span className="font-semibold">Company: </span>
                                    <span className="uppercase">{item.company_name}</span>
                                </div>
                                <div>
                                    <span className="font-semibold">Activity Ref: </span>
                                    <span className="italic text-[10px]">{item.activity_reference_number}</span>
                                </div>
                                <div>
                                    <span className="font-semibold">Quotation #: </span>
                                    <span className="uppercase">{item.quotation_number || "-"}</span>
                                </div>
                                <div>
                                    <span className="font-semibold">Amount: </span>
                                    <span>
                                        {item.quotation_amount
                                            ? item.quotation_amount.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            : "-"}
                                    </span>
                                </div>
                                <div>Date: <span className="text-xs font-mono">{item.date_created.slice(0, 10)}</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={() => { fetchActivities(); closeEditDialog(); }}
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
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    vatType={editItem.vat_type}
                />
            )}
        </>
    );
};