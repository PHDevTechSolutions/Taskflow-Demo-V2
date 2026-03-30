"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, MoreVertical, FileX, Loader2, Clock, CheckCircle, XCircle, Users, TrendingUp, Filter } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "./dialog/edit";

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
    quotation_status: string;
    delivery_fee: string;
    quotation_subject: string;
    quotation_vatable: string;
    restocking_fee: string;
    item_remarks?: string;
    vat_type: string;
    agent_name: string;
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    tsm_name: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    tsm_approval_date: string;
    tsm_remarks: string;
    manager_name: string;
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

interface TSMStat {
    tsmName: string;
    tsmId: string;
    approved: number;
    total: number;
}

export const ApprovalQuotation: React.FC<CompletedProps> = ({
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [tsmFilter, setTsmFilter] = useState("all");
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    // Fetch activities
    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: supabaseError } = await supabase
                .from('completed')
                .select('*')
                .order('date_created', { ascending: false });

            if (supabaseError) {
                throw new Error(supabaseError.message);
            }

            setActivities(data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activities');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // Sort activities by date_created
    const sortedActivities = useMemo(() => {
        return [...activities].sort((a, b) => {
            return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
        });
    }, [activities]);

    // Base filtered activities - MODIFIED FOR APPROVED STATUS
    const baseFilteredActivities = useMemo(() => {
        return sortedActivities.filter((item) => {
            const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();
            return (
                status === "approved by sales head" ||
                status === "approved"
            );
        }).filter((item) => String(item.type_activity ?? "").trim().toLowerCase() === "quotation preparation");
    }, [sortedActivities]);

    // TSM Statistics - MODIFIED FOR APPROVED STATUS
    const tsmStats = useMemo(() => {
        const statsMap = new Map<string, TSMStat>();

        baseFilteredActivities.forEach((item) => {
            const tsmId = item.tsm || "unknown";
            const tsmName = item.tsm_name || "Unknown TSM";
            const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();

            if (!statsMap.has(tsmId)) {
                statsMap.set(tsmId, {
                    tsmId,
                    tsmName,
                    approved: 0,
                    total: 0,
                });
            }

            const stat = statsMap.get(tsmId)!;
            stat.total += 1;

            if (status === "approved by sales head" || status === "approved") {
                stat.approved += 1;
            }
        });

        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [baseFilteredActivities]);

    // Overall statistics - MODIFIED FOR APPROVED STATUS
    const stats = useMemo(() => {
        const approved = baseFilteredActivities.filter(
            (item) => String(item.tsm_approved_status ?? "").trim().toLowerCase() === "approved by sales head" ||
                     String(item.tsm_approved_status ?? "").trim().toLowerCase() === "approved"
        ).length;

        return {
            approved,
            total: baseFilteredActivities.length,
        };
    }, [baseFilteredActivities]);

    // Final filtered activities with search and filters
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();

        return baseFilteredActivities
            .filter((item) => {
                if (statusFilter === "all") return true;
                const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();
                if (statusFilter === "approved") {
                    return status === "approved by sales head" || status === "approved";
                }
                return status === statusFilter;
            })
            .filter((item) => {
                if (tsmFilter === "all") return true;
                return item.tsm === tsmFilter;
            })
            .filter((item) => {
                if (!search) return true;
                return Object.values(item).some(
                    (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(search)
                );
            });
    }, [baseFilteredActivities, searchTerm, statusFilter, tsmFilter]);

    // TSM filter options
    const tsmOptions = useMemo(() => {
        const tsms = new Set<string>();
        baseFilteredActivities.forEach((item) => {
            if (item.tsm) tsms.add(item.tsm);
        });
        return Array.from(tsms).map((tsmId) => {
            const tsm = baseFilteredActivities.find((item) => item.tsm === tsmId);
            return {
                value: tsmId,
                label: tsm?.tsm_name || tsmId,
            };
        });
    }, [baseFilteredActivities]);

    const displayValue = (value: any) => {
        if (value === null || value === undefined) return "-";
        if (typeof value === "string" && value.trim() === "") return "-";
        return String(value);
    };

    const formatCurrency = (amount: number | string | null | undefined) => {
        if (amount === null || amount === undefined || amount === "") return "₱0.00";
        const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(isNaN(numAmount) ? 0 : numAmount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Loading quotations...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircleIcon className="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    {/* Search Input */}
                    <div className="flex-1">
                        <Input
                            placeholder="Search quotations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    {statusFilter === "all" ? "All Status" : statusFilter}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                                    All Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("approved")}>
                                    Approved
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* TSM Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    {tsmFilter === "all" ? "All TSM" : tsmOptions.find(opt => opt.value === tsmFilter)?.label || tsmFilter}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setTsmFilter("all")}>
                                    All TSM
                                </DropdownMenuItem>
                                {tsmOptions.map((tsm) => (
                                    <DropdownMenuItem key={tsm.value} onClick={() => setTsmFilter(tsm.value)}>
                                        {tsm.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-100">
                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Approved Quotations</p>
                                    <p className="text-2xl font-bold">{stats.approved}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-100">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Quotations</p>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-orange-100">
                                    <Users className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Active TSM</p>
                                    <p className="text-2xl font-bold">{tsmStats.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TSM Statistics Table */}
                {tsmStats.length > 0 && (
                    <div className="rounded-lg border bg-card p-4 shadow-sm mb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            TSM Performance Summary
                        </h3>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>TSM Name</TableHead>
                                        <TableHead className="text-right">Approved</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tsmStats.map((stat) => (
                                        <TableRow key={stat.tsmId}>
                                            <TableCell className="font-medium">{stat.tsmName}</TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-green-600 font-semibold">{stat.approved}</span>
                                            </TableCell>
                                            <TableCell className="text-right">{stat.total}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Quotations Table */}
            <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileX className="w-5 h-5" />
                        Approved Quotations
                    </h3>
                </div>

                {filteredActivities.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                            {baseFilteredActivities.length === 0
                                ? "No approved quotations found."
                                : "No quotations match your search criteria."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Activity Ref #</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Quotation #</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Quotation Status</TableHead>
                                    <TableHead>Date Created</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredActivities.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {displayValue(item.activity_reference_number)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[150px] truncate" title={displayValue(item.company_name)}>
                                                {displayValue(item.company_name)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[120px] truncate" title={displayValue(item.contact_person)}>
                                                {displayValue(item.contact_person)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {displayValue(item.quotation_number)}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {formatCurrency(item.quotation_amount)}
                                        </TableCell>
                                        <TableCell className="p-2 font-semibold text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-2 py-1 text-[9px] sm:text-xs font-semibold whitespace-nowrap
                                                    ${item.tsm_approved_status === "Approved By Sales Head"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.tsm_approved_status === "Endorsed to Sales Head"
                                                            ? "bg-orange-100 text-orange-700"
                                                            : item.tsm_approved_status === "Decline" || item.tsm_approved_status === "Decline By Sales Head"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <div className="max-w-[150px] truncate" title={displayValue(item.quotation_status)}>
                                                {displayValue(item.quotation_status)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(item.date_created).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditItem(item);
                                                            setEditDialogOpen(true);
                                                        }}
                                                    >
                                                        <Eye className="w-4 h-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            {editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={() => setEditDialogOpen(false)}
                    onSave={() => {
                        fetchActivities();
                        setEditItem(null);
                    }}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    tsmSignature={editItem.tsm_signature}
                    tsmContactNumber={editItem.tsm_contact_number}
                    tsmEmailAddress={editItem.tsm_email_address}
                    managerName={editItem.manager_name}
                    deliveryFee={editItem.delivery_fee}
                />
            )}
        </>
    );
};
