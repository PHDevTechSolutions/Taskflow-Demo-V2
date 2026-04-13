"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircleIcon,
  PenIcon,
  MoreVertical,
  Loader2,
  Trash2,
  Filter,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sileo } from "sileo";

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
  restocking_fee?: string;
  quotation_vatable?: string;
  quotation_subject?: string;
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
  quotation_status: string;
  discounted_priced?: string;
  discounted_amount?: string;
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
  managerDetails?: SupervisorDetails | null;
  tsmDetails?: SupervisorDetails | null;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const displayValue = (v: any) =>
  v === null || v === undefined || String(v).trim() === "" ? "" : String(v);

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return "-";
  const s = new Date(start),
    e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
  let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  diff %= 3600;
  const m = Math.floor(diff / 60);
  const sec = diff % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
}

const MASTER_PASSWORD = "PHDEVTECH";

// ─── Component ────────────────────────────────────────────────────────────────

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
  const searchParams = useSearchParams();

  const highlightRef = searchParams?.get("highlight") ?? null;
  const openEditRef = searchParams?.get("openEdit") ?? null;
  const actionRef = (searchParams?.get("action") ?? null) as
    | "preview"
    | "download"
    | null;

  const [activities, setActivities] = useState<Completed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Set search term if highlight is present
  useEffect(() => {
    if (highlightRef) {
      setSearchTerm(highlightRef);
    }
  }, [highlightRef]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTypeClient, setFilterTypeClient] = useState<string>("all");
  const [filterCallStatus, setFilterCallStatus] = useState<string>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [editItem, setEditItem] = useState<Completed | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAutoAction, setEditAutoAction] = useState<
    "preview" | "download" | null
  >(null);

  const autoOpenFiredRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");

  const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(
    tsmDetailsProp ?? null,
  );
  const [managerDetails, setManagerDetails] =
    useState<SupervisorDetails | null>(managerDetailsProp ?? null);

  const [highlightedArn, setHighlightedArn] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // ── Inline status edit state ─────────────────────────────────────────────
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});

  // ── Master password dialog ───────────────────────────────────────────────
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    if (tsmDetailsProp !== undefined) setTsmDetails(tsmDetailsProp);
  }, [tsmDetailsProp]);

  useEffect(() => {
    if (managerDetailsProp !== undefined) setManagerDetails(managerDetailsProp);
  }, [managerDetailsProp]);

  const fetchHierarchy = useCallback(async () => {
    if (!referenceid) return;
    try {
      const response = await fetch(`/api/user?id=${encodeURIComponent(referenceid)}`);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setTsmDetails(data.tsmDetails ?? null);
      setManagerDetails(data.managerDetails ?? null);
    } catch (e) {
      console.error("Hierarchy fetch error:", e);
    }
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;
    if (managerDetailsProp === undefined || tsmDetailsProp === undefined) {
      fetchHierarchy();
    }
  }, [referenceid, managerDetailsProp, tsmDetailsProp, fetchHierarchy]);

  const fetchActivities = useCallback(async () => {
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

    try {
      const url = new URL("/api/activity/tsa/quotation/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (from && to) {
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [referenceid, dateCreatedFilterRange]);

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
        () => fetchActivities(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  // ── Highlight + scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!highlightRef) return;
    setHighlightedArn(highlightRef);
    const t1 = setTimeout(() => {
      // Find row by either activity_reference_number OR quotation_number
      const targetRow = rowRefs.current.get(highlightRef);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    const t2 = setTimeout(() => setHighlightedArn(null), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightRef, activities]);

  // ── Auto-open edit dialog ────────────────────────────────────────────────
  useEffect(() => {
    if (!openEditRef || activities.length === 0) return;
    if (autoOpenFiredRef.current === openEditRef) return;

    const target = activities.find(
      (a) => a.activity_reference_number === openEditRef,
    );
    if (!target) return;

    autoOpenFiredRef.current = openEditRef;
    setEditItem(target);
    setEditAutoAction(actionRef);
    setEditOpen(true);
  }, [openEditRef, actionRef, activities]);

  // ── Alt + Ctrl + E  →  toggle inline status-edit mode ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (editStatusMode) {
          // Already on — toggle off directly, no password needed
          setEditStatusMode(false);
          setPendingStatuses({});
        } else {
          // Toggle on — require password first
          setPwInput("");
          setPwError(false);
          setPwDialogOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editStatusMode]);

  // ── Save a single row's inline status ───────────────────────────────────
  const saveStatus = async (item: Completed) => {
    const newStatus = pendingStatuses[item.id];
    if (!newStatus || newStatus === item.tsm_approved_status) return;
    try {
      await fetch("/api/act-update-status", { // ← adjust to your real endpoint
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, tsm_approved_status: newStatus }),
      });
      fetchActivities();
    } catch (err) {
      console.error("Status update failed", err);
    }
  };

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.date_updated ?? b.date_created).getTime() -
          new Date(a.date_updated ?? a.date_created).getTime(),
      ),
    [activities],
  );

  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return sortedActivities.filter((item) => {
      // 1. Meaningful data check
      const hasData = [
        "activity_reference_number",
        "referenceid",
        "quotation_number",
        "quotation_amount",
      ].some((col) => {
        const val = (item as any)[col];
        return val !== null && val !== undefined && String(val).trim() !== "";
      });
      if (!hasData) return false;

      // 2. Search filter
      const matchesSearch = !search || Object.values(item).some(
        (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;

      // 3. Status filter
      if (filterStatus !== "all" && item.status !== filterStatus) return false;

      // 4. Type Activity filter (Fixed to Quotation Preparation)
      if (item.type_activity !== "Quotation Preparation") return false;

      // 5. Date Range filter
      if (dateCreatedFilterRange?.from || dateCreatedFilterRange?.to) {
        const updated = new Date(item.date_updated ?? item.date_created);
        if (isNaN(updated.getTime())) return false;
        if (dateCreatedFilterRange.from && updated < new Date(dateCreatedFilterRange.from)) return false;
        if (dateCreatedFilterRange.to && updated > new Date(dateCreatedFilterRange.to)) return false;
      }

      return true;
    });
  }, [sortedActivities, searchTerm, filterStatus, dateCreatedFilterRange]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.status) s.add(a.status);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const typeActivityOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.type_activity) s.add(a.type_activity);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const sourceOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.source) s.add(a.source);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const typeClientOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.type_client) s.add(a.type_client);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const callStatusOptions = useMemo(() => {
    return [] as string[];
  }, []);

  const quotationStatusOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.quotation_status) s.add(a.quotation_status);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const openEditDialog = (item: Completed) => {
    setEditItem(item);
    setEditAutoAction(null);
    setEditOpen(true);
  };
  const closeEditDialog = () => {
    setEditOpen(false);
    setEditItem(null);
    setEditAutoAction(null);
  };
  const onEditSaved = () => {
    fetchActivities();
    closeEditDialog();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

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
      if (!res.ok) throw new Error("Failed to delete");

      sileo.success({
        title: "Deleted",
        description: `${selectedIds.size} records removed.`,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setRemoveRemarks("");
      fetchActivities();
    } catch (e: any) {
      console.error(e);
      sileo.error({
        title: "Delete Failed",
        description: e.message || "Failed to remove records.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  return (
    <>
      <style>{`
        @keyframes rq-highlight-pulse {
          0%   { background-color: rgb(254 249 195); }
          50%  { background-color: rgb(253 224 71);  }
          100% { background-color: rgb(254 249 195); }
        }
        .rq-highlight-row {
          animation: rq-highlight-pulse 0.8s ease-in-out 3;
          outline: 2px solid rgb(234 179 8);
          outline-offset: -2px;
        }
        .status-edit-mode-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          border: 1px solid #93c5fd;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Search company, reference ID, or quotation #..."
            className="pl-9 h-10 rounded-none border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {editStatusMode && (
            <span className="status-edit-mode-badge shadow-sm">
              <PenIcon className="w-3 h-3" />
              Status Edit Mode
            </span>
          )}

          <div className="flex items-center gap-1.5 border border-zinc-200 p-1 bg-white">
            <TaskListDialog
              filterStatus={filterStatus}
              filterTypeActivity={filterTypeActivity}
              filterSource={filterSource}
              filterTypeClient={filterTypeClient}
              filterCallStatus={filterCallStatus}
              filterQuotationStatus={filterQuotationStatus}
              setFilterStatus={setFilterStatus}
              setFilterTypeActivity={setFilterTypeActivity}
              setFilterSource={setFilterSource}
              setFilterTypeClient={setFilterTypeClient}
              setFilterCallStatus={setFilterCallStatus}
              setFilterQuotationStatus={setFilterQuotationStatus}
              statusOptions={statusOptions}
              typeActivityOptions={typeActivityOptions}
              sourceOptions={sourceOptions}
              typeClientOptions={typeClientOptions}
              callStatusOptions={callStatusOptions}
              quotationStatusOptions={quotationStatusOptions}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              setCurrentPage={setCurrentPage}
            />
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-8 flex items-center gap-1.5 px-3 rounded-none bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Delete ({selectedIds.size})</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700 leading-relaxed">
                We couldn't retrieve the latest activity data. Please check your network connection or try refreshing the page.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {loading && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-60">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Retrieving Quotations...</p>
        </div>
      )}

      {!loading && filteredActivities.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-zinc-50/50 border border-dashed border-zinc-200">
          <AlertCircleIcon className="h-8 w-8 text-zinc-300" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-500">No records found</p>
            <p className="text-[11px] text-zinc-400">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Quotation History</span>
              <Badge variant="outline" className="rounded-none bg-white text-[10px] font-mono border-zinc-200">
                {filteredActivities.length}
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-zinc-50/50">
                <TableRow className="hover:bg-transparent border-b border-zinc-200">
                  <TableHead className="w-10 h-11 text-center">
                    <Checkbox
                      checked={selectedIds.size === filteredActivities.length && filteredActivities.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filteredActivities.map(a => a.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded-none h-4 w-4"
                    />
                  </TableHead>
                  <TableHead className="w-20 text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-center">Edit</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Quotation #</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Remarks</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-center">Status</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Duration</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Company</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Timeline</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Feedback / Notes</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-right">Amount</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-center">Created</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredActivities.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isHighlighted =
                    highlightedArn === item.activity_reference_number ||
                    highlightedArn === item.quotation_number;

                  return (
                    <TableRow
                      key={item.id}
                      ref={(el) => {
                        if (el) {
                          rowRefs.current.set(item.activity_reference_number, el);
                          if (item.quotation_number) rowRefs.current.set(item.quotation_number, el);
                        } else {
                          rowRefs.current.delete(item.activity_reference_number);
                          if (item.quotation_number) rowRefs.current.delete(item.quotation_number);
                        }
                      }}
                      className={`group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors ${isHighlighted ? "rq-highlight-row" : ""}`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          className="rounded-none h-4 w-4"
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          className="h-8 w-8 p-0 rounded-none hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all group"
                          title="Edit Quotation"
                        >
                          <PenIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600" />
                        </Button>
                      </TableCell>

                      <TableCell className="font-mono text-[11px] font-bold text-zinc-700 uppercase">
                        {displayValue(item.quotation_number)}
                      </TableCell>

                      <TableCell className="max-w-[150px] truncate text-zinc-600" title={item.quotation_status}>
                        {item.quotation_status}
                      </TableCell>

                      <TableCell className="text-center">
                        {editStatusMode ? (
                          <Input
                            className="h-7 text-[10px] w-28 uppercase font-bold border-blue-200 bg-blue-50/50 focus:ring-0 focus:border-blue-400 rounded-none mx-auto text-center"
                            value={pendingStatuses[item.id] ?? item.tsm_approved_status}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPendingStatuses((prev) => ({ ...prev, [item.id]: value }));
                            }}
                            onBlur={() => saveStatus(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") {
                                setPendingStatuses((prev) => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className={`rounded-none text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent
                              ${item.tsm_approved_status === "Approved" || item.tsm_approved_status === "Approved By Sales Head"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : item.tsm_approved_status === "Pending"
                                  ? "bg-orange-50 text-orange-700 border-orange-100"
                                  : item.tsm_approved_status === "Decline"
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                          >
                            {item.tsm_approved_status}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-[10px] text-zinc-500">
                        {formatDuration(item.start_date, item.end_date)}
                      </TableCell>

                      <TableCell className="font-bold text-zinc-800">
                        {item.company_name}
                      </TableCell>

                      <TableCell className="text-[10px] text-zinc-500 leading-tight py-2">
                        {item.tsm_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter">TSM:</span>
                            <span>{new Date(item.tsm_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                        {item.manager_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter">MGR:</span>
                            <span>{new Date(item.manager_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                        {!item.tsm_approval_date && !item.manager_approval_date && <span className="text-zinc-300 italic">No activity logs</span>}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-zinc-700">
                        {item.tsm_remarks || "—"}{item.manager_remarks}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-zinc-700">
                        {item.quotation_amount ? (
                          `₱${parseFloat(String(item.quotation_amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : "—"}
                      </TableCell>

                      <TableCell className="text-center font-mono text-[11px] text-zinc-400">
                        {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

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
          restockingFee={editItem.restocking_fee ?? ""}
          whtType={editItem.quotation_vatable ?? "none"}
          quotationSubject={editItem.quotation_subject ?? "For Quotation"}
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
          autoAction={editAutoAction}
        />
      )}

      {/* ── Master Password Dialog ── */}
      {pwDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPwDialogOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <PenIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">Status Edit — Authorization</h2>
            </div>
            <p className="text-xs text-gray-500">
              Enter the master password to enable inline status editing.
            </p>
            <input
              autoFocus
              type="password"
              placeholder="Master password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }
                if (e.key === "Escape") setPwDialogOpen(false);
              }}
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${pwError
                ? "border-red-400 focus:ring-red-200 bg-red-50"
                : "border-gray-300 focus:ring-blue-200"
                }`}
            />
            {pwError && (
              <p className="text-xs text-red-500 -mt-2 flex items-center gap-1">
                <AlertCircleIcon className="w-3 h-3" /> Incorrect password. Try again.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="text-xs rounded-lg"
                onClick={() => setPwDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="text-xs rounded-lg"
                onClick={() => {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }}
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}

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