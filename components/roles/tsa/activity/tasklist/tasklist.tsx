"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PenIcon,
  Undo,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskListDialog } from "./dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../../activity/planner/dialog/delete";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  quotation_status?: string;
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
  date_followup: string;
  date_site_visit: string;
  date_created: string;
  date_updated?: string;
  company_name: string;
  contact_number: string;
  payment_terms?: string;
  scheduled_status?: string;
}

interface CompletedProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const displayValue = (v: any): string =>
  v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

function formatTimeWithAmPm(time24: string): string {
  const [hourStr, minute] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "-";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
  let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  const parts: string[] = [];
  if (hours > 0)   parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function getBadgeClass(status?: string): string {
  switch (status) {
    case "Delivered":   return "bg-emerald-500 text-white";
    case "SO-Done":     return "bg-amber-400 text-white";
    case "Quote-Done":  return "bg-blue-600 text-white";
    case "On Progress":
    case "Assisted":    return "bg-orange-500 text-white";
    case "Cancelled":   return "bg-red-600 text-white";
    case "Completed":   return "bg-teal-600 text-white";
    case "Pending":     return "bg-slate-500 text-white";
    default:            return "bg-zinc-400 text-white";
  }
}

// FIX: was checking columns that don't exist on the interface (e.g. "date_site_vist" typo)
// Simplified: an item has meaningful data if ANY non-trivial field is non-empty
function hasMeaningfulData(item: Completed): boolean {
  const checks: (keyof Completed)[] = [
    "type_activity", "call_status", "call_type", "quotation_number",
    "quotation_amount", "quotation_status", "so_number", "so_amount",
    "actual_sales", "dr_number", "ticket_reference_number", "remarks",
    "source", "project_name", "project_type", "status",
  ];
  return checks.some((col) => {
    const val = item[col];
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim() !== "" && val.trim() !== "-";
    if (typeof val === "number") return !isNaN(val);
    return Boolean(val);
  });
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

// ─── Component ────────────────────────────────────────────────────────────────

export const TaskList: React.FC<CompletedProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Completed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

  const [editItem, setEditItem] = useState<Completed | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");

  const [reSoOpen, setReSoOpen] = useState(false);
  const [reSoItem, setReSoItem] = useState<Completed | null>(null);
  const [editSoNumber, setEditSoNumber] = useState("");
  const [editSoAmount, setEditSoAmount] = useState<number | "">("");
  const [isEditingSo, setIsEditingSo] = useState(false);
  const [savingSo, setSavingSo] = useState(false); // FIX: added loading state for SO save

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // ── Fetch ──────────────────────────────────────────────────────────────────

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

    const url = new URL("/api/activity/tsa/historical/fetch", window.location.origin);
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
    fetchActivities();

    const channel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        () => fetchActivities(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredActivities = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return activities
      .filter((item) => {
        if (!q) return true;
        return Object.values(item).some(
          (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q),
        );
      })
      .filter((item) => {
        if (filterStatus !== "all" && item.status !== filterStatus) return false;
        if (filterTypeActivity !== "all" && item.type_activity !== filterTypeActivity) return false;
        return true;
      })
      .filter((item) => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;
        // FIX: filter on date_updated if available, else date_created
        const updated = item.date_updated
          ? new Date(item.date_updated)
          : new Date(item.date_created);
        if (isNaN(updated.getTime())) return false;
        if (dateCreatedFilterRange.from && updated < new Date(dateCreatedFilterRange.from)) return false;
        if (dateCreatedFilterRange.to && updated > new Date(dateCreatedFilterRange.to)) return false;
        return true;
      })
      .filter(hasMeaningfulData)
      .sort((a, b) =>
        new Date(b.date_updated ?? b.date_created).getTime() -
        new Date(a.date_updated ?? a.date_created).getTime(),
      );
  }, [activities, searchTerm, filterStatus, filterTypeActivity, dateCreatedFilterRange]);

  // Reset page when filters change
  // FIX: was missing this — page would stay on page 5 after filtering to 1 page
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterTypeActivity, dateCreatedFilterRange]);

  const statusOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.status).filter(Boolean))].sort() as string[];
  }, [activities]);

  const typeActivityOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.type_activity).filter(Boolean))].sort() as string[];
  }, [activities]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));

  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredActivities.slice(start, start + itemsPerPage);
  }, [filteredActivities, currentPage, itemsPerPage]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // FIX: select all only selects current page items
  const allCurrentSelected =
    paginatedActivities.length > 0 &&
    paginatedActivities.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedActivities.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedActivities.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const onConfirmRemove = async () => {
    try {
      const res = await fetch("/api/act-delete-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), remarks: removeRemarks }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setRemoveRemarks("");
      fetchActivities();
    } catch (err) {
      console.error(err);
    }
  };

  // ── SO Update ──────────────────────────────────────────────────────────────

  const handleSaveSo = async () => {
    if (!reSoItem || !editSoNumber || editSoAmount === "") return;
    setSavingSo(true);
    try {
      const res = await fetch("/api/act-update-so", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reSoItem.id, so_number: editSoNumber, so_amount: editSoAmount }),
      });
      if (!res.ok) throw new Error("Failed to update SO");
      setIsEditingSo(false);
      setReSoOpen(false);
      fetchActivities();
    } catch (err) {
      console.error("Failed to update SO", err);
    } finally {
      setSavingSo(false);
    }
  };

  // ── Pagination helpers ─────────────────────────────────────────────────────

  const pageWindow = useMemo(() => {
    const delta = 2;
    const pages: number[] = [];
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search company, status, activity..."
            className="pl-8 rounded-none text-xs h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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
            size="sm"
            className="rounded-none text-xs h-9 gap-1.5"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete ({selectedIds.size})
          </Button>
        )}

        {/* Items per page */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Rows:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-300"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" className="flex flex-col space-y-3 p-4 text-xs mb-3">
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <AlertTitle>No Data Found or No Network Connection</AlertTitle>
              <AlertDescription className="text-xs">Please check your internet connection or try again later.</AlertDescription>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle2Icon className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <AlertTitle className="text-black">Create New Data</AlertTitle>
              <AlertDescription className="text-xs">You can start by adding new entries to populate your database.</AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-zinc-200 border-t-zinc-700 animate-spin" />
        </div>
      )}

      {/* ── Record count ─────────────────────────────────────────────────── */}
      {!loading && filteredActivities.length > 0 && (
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>
            <strong className="text-zinc-800">{filteredActivities.length}</strong> historical record{filteredActivities.length !== 1 ? "s" : ""}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-indigo-600 font-medium">· {selectedIds.size} selected</span>
            )}
          </span>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && filteredActivities.length > 0 && (
        <div className="overflow-auto rounded border border-zinc-200">
          <Table className="text-xs min-w-[1800px]">
            <TableHeader>
              <TableRow className="bg-zinc-50 border-b border-zinc-200">
                {/* FIX: select-all checkbox added */}
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allCurrentSelected}
                    onCheckedChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </TableHead>
                <TableHead className="w-28">Actions</TableHead>
                {[
                  "Date", "Duration", "Company", "Status", "Quotation Status",
                  "Contact #", "Type Client", "Project Name", "Project Type",
                  "Source", "Target Quota", "Activity Type", "Callback",
                  "Call Status", "Call Type", "Quotation #", "Quotation Amount",
                  "SO #", "SO Amount", "Actual Sales", "Delivery Date", "DR #",
                  "Ticket Ref #", "Remarks", "Date Followup", "Payment Terms",
                ].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap py-3 px-3"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedActivities.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <TableRow
                    key={item.id}
                    className={`border-b border-zinc-100 transition-colors ${
                      isSelected ? "bg-indigo-50/60" : "hover:bg-zinc-50/70"
                    }`}
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="h-4 w-4"
                      />
                    </TableCell>

                    <TableCell className="px-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none h-7 px-2 text-[10px] gap-1"
                          onClick={() => { setEditItem(item); setEditOpen(true); }}
                        >
                          <PenIcon className="h-3 w-3" /> Edit
                        </Button>

                        {item.type_activity === "Sales Order Preparation" && (
                          <Button
                            size="sm"
                            className="rounded-none h-7 px-2 text-[10px] gap-1 bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              setReSoItem(item);
                              setEditSoNumber(item.so_number || "");
                              setEditSoAmount(item.so_amount ?? "");
                              setIsEditingSo(false);
                              setReSoOpen(true);
                            }}
                          >
                            <Undo className="h-3 w-3" /> RE-SO
                          </Button>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-3 tabular-nums">
                      {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono px-3">
                      {formatDuration(item.start_date, item.end_date)}
                    </TableCell>
                    <TableCell className="font-semibold text-zinc-800 whitespace-nowrap px-3 min-w-[160px]">
                      {item.company_name}
                    </TableCell>
                    <TableCell className="px-3">
                      {item.status && (
                        <Badge className={`text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap font-semibold ${getBadgeClass(item.status)}`}>
                          {item.status.replace("-", " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3">{displayValue(item.quotation_status)}</TableCell>
                    <TableCell className="whitespace-nowrap px-3">{displayValue(item.contact_number)}</TableCell>
                    <TableCell className="whitespace-nowrap px-3">{displayValue(item.type_client)}</TableCell>
                    <TableCell className="px-3">{displayValue(item.project_name)}</TableCell>
                    <TableCell className="px-3">{displayValue(item.project_type)}</TableCell>
                    <TableCell className="px-3">{displayValue(item.source)}</TableCell>
                    <TableCell className="px-3 tabular-nums">{displayValue(item.target_quota)}</TableCell>
                    <TableCell className="whitespace-nowrap px-3">{displayValue(item.type_activity)}</TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {item.callback
                        ? `${new Date(item.callback).toLocaleDateString()} ${formatTimeWithAmPm(item.callback.substring(11, 16))}`
                        : "-"}
                    </TableCell>
                    <TableCell className="px-3">{displayValue(item.call_status)}</TableCell>
                    <TableCell className="px-3">{displayValue(item.call_type)}</TableCell>
                    <TableCell className="uppercase px-3 font-mono">{displayValue(item.quotation_number)}</TableCell>
                    <TableCell className="px-3 tabular-nums">
                      {item.quotation_amount != null
                        ? item.quotation_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                        : "-"}
                    </TableCell>
                    <TableCell className="uppercase px-3 font-mono">{displayValue(item.so_number)}</TableCell>
                    <TableCell className="px-3 tabular-nums">
                      {item.so_amount != null
                        ? item.so_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                        : "-"}
                    </TableCell>
                    <TableCell className="px-3 tabular-nums">
                      {item.actual_sales != null
                        ? item.actual_sales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="uppercase px-3 font-mono">{displayValue(item.dr_number)}</TableCell>
                    <TableCell className="px-3">{displayValue(item.ticket_reference_number)}</TableCell>
                    <TableCell className="px-3 capitalize max-w-[200px]">
                      <span className="block truncate" title={item.remarks ?? ""}>
                        {displayValue(item.remarks)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {item.date_followup && !isNaN(new Date(item.date_followup).getTime())
                        ? new Date(item.date_followup).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="px-3">{displayValue(item.payment_terms)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !error && filteredActivities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-300 gap-2">
          <CheckCircle2Icon className="h-10 w-10" strokeWidth={1} />
          <p className="text-sm font-medium text-zinc-400">No historical records found</p>
          {(searchTerm || filterStatus !== "all" || filterTypeActivity !== "all") && (
            <button
              className="text-xs text-indigo-400 hover:text-indigo-600 underline"
              onClick={() => { setSearchTerm(""); setFilterStatus("all"); setFilterTypeActivity("all"); }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {!loading && filteredActivities.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
          <span>
            Showing{" "}
            <strong className="text-zinc-800">
              {Math.min((currentPage - 1) * itemsPerPage + 1, filteredActivities.length)}–
              {Math.min(currentPage * itemsPerPage, filteredActivities.length)}
            </strong>{" "}
            of <strong className="text-zinc-800">{filteredActivities.length}</strong>
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none h-7 px-2"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {currentPage > 3 && (
              <>
                <Button variant="outline" size="sm" className="rounded-none h-7 w-7 text-xs" onClick={() => setCurrentPage(1)}>1</Button>
                {currentPage > 4 && <span className="px-1 text-zinc-400">…</span>}
              </>
            )}

            {pageWindow.map((page) => (
              <Button
                key={page}
                size="sm"
                variant={page === currentPage ? "default" : "outline"}
                className="rounded-none h-7 w-7 text-xs"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}

            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-1 text-zinc-400">…</span>}
                <Button variant="outline" size="sm" className="rounded-none h-7 w-7 text-xs" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="rounded-none h-7 px-2"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── RE-SO Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={reSoOpen} onOpenChange={(v) => { if (!v) { setReSoOpen(false); setIsEditingSo(false); } }}>
        <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden gap-0">
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Undo className="h-4 w-4 text-red-400" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Sales Order Info
                </DialogTitle>
              </div>
              {reSoItem && (
                <p className="text-zinc-400 text-xs font-mono mt-1">{reSoItem.company_name}</p>
              )}
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">SO Number</label>
              {!isEditingSo ? (
                <div className="border border-zinc-200 rounded px-3 py-2 bg-zinc-50 text-sm font-mono uppercase text-zinc-700">
                  {reSoItem?.so_number || <span className="text-zinc-400 italic normal-case">Not set</span>}
                </div>
              ) : (
                <Input
                  value={editSoNumber}
                  onChange={(e) => setEditSoNumber(e.target.value.toUpperCase())}
                  placeholder="Enter SO Number"
                  className="uppercase rounded-none text-sm"
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">SO Amount</label>
              {!isEditingSo ? (
                <div className="border border-zinc-200 rounded px-3 py-2 bg-zinc-50 text-sm font-mono text-zinc-700">
                  {reSoItem?.so_amount != null
                    ? Number(reSoItem.so_amount).toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                    : <span className="text-zinc-400 italic">Not set</span>}
                </div>
              ) : (
                <Input
                  type="number"
                  value={editSoAmount}
                  onChange={(e) => setEditSoAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Enter SO Amount"
                  className="rounded-none text-sm"
                />
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            <Button
              variant="outline"
              className="rounded-none flex-1 text-xs h-10"
              onClick={() => {
                if (isEditingSo) {
                  setIsEditingSo(false);
                  setEditSoNumber(reSoItem?.so_number || "");
                  setEditSoAmount(reSoItem?.so_amount ?? "");
                } else {
                  setReSoOpen(false);
                }
              }}
            >
              {isEditingSo ? "Cancel" : "Close"}
            </Button>

            {!isEditingSo ? (
              <Button
                className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
                onClick={() => { setEditSoNumber(""); setEditSoAmount(""); setIsEditingSo(true); }}
              >
                Update SO
              </Button>
            ) : (
              <Button
                className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
                onClick={handleSaveSo}
                disabled={!editSoNumber || editSoAmount === "" || savingSo}
              >
                {savingSo ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      {editOpen && editItem && (
        <TaskListEditDialog
          item={editItem}
          onClose={() => { setEditOpen(false); setEditItem(null); }}
          onSave={() => { fetchActivities(); setEditOpen(false); setEditItem(null); }}
        />
      )}

      {/* ── Delete Dialog ─────────────────────────────────────────────────── */}
      <AccountsActiveDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={onConfirmRemove}
        selectedCount={selectedIds.size}
      />
    </>
  );
};