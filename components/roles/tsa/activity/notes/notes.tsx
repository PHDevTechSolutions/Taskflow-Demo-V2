"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, Trash, Pen, Plus, FileText, Loader2, Clock, Search, Filter, TrendingUp, AlertCircle } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteItem {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange?: DateRange;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const truncate = (text: string, len = 40) =>
  text.length > len ? text.slice(0, len) + "…" : text;

const toLocalDateTimeInput = (utc: string): string => {
  if (!utc) return "";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const getDurationHMS = (start: string, end: string): string => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "0:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const notify = {
  success: (msg: string) =>
    sileo.success({ title: "Success", description: msg, duration: 3000, position: "top-right" }),
  error: (msg: string) =>
    sileo.error({ title: "Error", description: msg, duration: 4000, position: "top-right" }),
};

// ─── Delete Dialog ────────────────────────────────────────────────────────────

interface NoteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteItem | null;
  onConfirmDelete: () => Promise<void>;
}

const NoteDeleteDialog: React.FC<NoteDeleteDialogProps> = ({
  open, onOpenChange, note, onConfirmDelete,
}) => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  // Reset progress when dialog closes
  useEffect(() => {
    if (!open) {
      clearTimer();
      setProgress(0);
    }
  }, [open]);

  const startHold = () => {
    if (loading || !note) return;
    clearTimer();
    setProgress(0);
    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearTimer();
          triggerDelete();
          return 100;
        }
        return next;
      });
    }, 20);
  };

  const cancelHold = () => {
    clearTimer();
    setProgress(0);
  };

  const triggerDelete = async () => {
    setLoading(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
    } catch {
      notify.error("Failed to delete note");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-sm p-0 overflow-hidden">
        <div className="bg-red-600 px-5 py-4">
          <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">
            Delete Note
          </DialogTitle>
          <DialogDescription className="text-red-200 text-[11px] mt-0.5">
            This action cannot be undone.
          </DialogDescription>
        </div>

        {note && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-0.5">
              {note.type_activity}
            </p>
            <p className="text-[11px] text-red-600 italic truncate">
              {note.remarks || "No remarks"}
            </p>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 px-5 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-none h-9 text-xs uppercase font-bold tracking-wider"
          >
            Cancel
          </Button>

          <div className="relative overflow-hidden rounded-none">
            <Button
              variant="destructive"
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={loading}
              className="relative w-full rounded-none h-9 text-xs uppercase font-black tracking-wider z-10"
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Deleting…</>
                : progress > 0
                  ? `Hold… ${Math.round(progress)}%`
                  : "Hold to delete"}
            </Button>
            {/* Progress fill behind button */}
            <div
              className="absolute inset-0 bg-red-900/30 pointer-events-none transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
    {children}
  </p>
);

// ─── Notes Component ──────────────────────────────────────────────────────────

export const Notes: React.FC<NotesProps> = ({
  referenceid, tsm, manager, dateCreatedFilterRange,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [deleteNote, setDeleteNote] = useState<NoteItem | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [itemsPerPage] = useState(10); // Default to 10 items per page
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [typeActivity, setTypeActivity] = useState("Documentation");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time tracking state
  const [totalHours, setTotalHours] = useState(0);
  const [overlappingEntries, setOverlappingEntries] = useState<string[]>([]);

  // ─── Fetch (paginated) ─────────────────────────────────────────────────────

  const fetchNotes = useCallback(async (page: number = 1, loadMore: boolean = false) => {
    if (!referenceid) return;

    // Set appropriate loading state
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const url = new URL("/api/activity/tsa/documentation/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      url.searchParams.append("page", String(page));
      url.searchParams.append("limit", String(itemsPerPage));

      // Add search term if present
      if (searchQuery.trim()) {
        url.searchParams.append("search", searchQuery.trim());
      }

      // Add filter type if not "all"
      if (filterType !== "all") {
        url.searchParams.append("type", filterType);
      }

      // Add date range filter
      if (dateCreatedFilterRange?.from) {
        url.searchParams.append("from", dateCreatedFilterRange.from.toISOString());
      }
      if (dateCreatedFilterRange?.to) {
        url.searchParams.append("to", dateCreatedFilterRange.to.toISOString());
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch notes");
      const data = await res.json();

      if (loadMore && page > 1) {
        // Append new data for load more
        setNotes(prev => [...prev, ...(data.notes || [])]);
      } else {
        // Replace data for initial load or new search
        setNotes(data.notes || []);
      }

      // Update pagination info
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 0);
      setHasMore(data.hasMore || false);
      setCurrentPage(page);
    } catch (err: any) {
      notify.error(err.message || "Failed to fetch notes");
      setNotes([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [referenceid, itemsPerPage, searchQuery, filterType, dateCreatedFilterRange]);

  // Search handler - only fetches when search button is clicked
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchNotes(1, false);
  }, [fetchNotes]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      const nextPage = currentPage + 1;
      fetchNotes(nextPage, true);
    }
  }, [currentPage, hasMore, loadingMore, fetchNotes]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
    // The search will be triggered by the search button click
  }, [searchQuery, filterType]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Calculate total hours and detect overlaps
  useEffect(() => {
    let total = 0;
    const overlaps: string[] = [];
    
    notes.forEach((note, i) => {
      const duration = new Date(note.end_date).getTime() - new Date(note.start_date).getTime();
      total += duration;
      
      // Check for overlapping entries
      notes.forEach((otherNote, j) => {
        if (i !== j) {
          const start1 = new Date(note.start_date).getTime();
          const end1 = new Date(note.end_date).getTime();
          const start2 = new Date(otherNote.start_date).getTime();
          const end2 = new Date(otherNote.end_date).getTime();
          
          if ((start1 < end2 && end1 > start2)) {
            overlaps.push(`${note.type_activity} overlaps with ${otherNote.type_activity}`);
          }
        }
      });
    });
    
    setTotalHours(total / 3600000);
    setOverlappingEntries([...new Set(overlaps)]);
  }, [notes]);

  // Note: Filtering and pagination now handled by API for better performance
  // notes array contains already filtered and paginated data from the server

  // Auto-suggest activity type based on remarks
  const suggestActivityType = (remarks: string): string => {
    const r = remarks.toLowerCase();
    if (r.includes("supplier") || r.includes("accreditation")) return "Admin - Supplier Accreditation";
    if (r.includes("credit terms") || r.includes("credit application")) return "Admin - Credit Terms Application";
    if (r.includes("accounting") || r.includes("billing") || r.includes("invoice") || r.includes("payment issue")) return "Accounting Concerns";
    if (r.includes("refund")) return "After Sales Refunds";
    if (r.includes("repair") || r.includes("replacement") || r.includes("warranty")) return "After Sales Repair / Replacement";
    if (r.includes("bidding") || r.includes("bid prep") || r.includes("tender")) return "Bidding Preparations";
    if (r.includes("order") || r.includes("purchase order") || r.includes("po ")) return "Customer Orders";
    if (r.includes("delivery") || r.includes("shipment") || r.includes("shipping")) return "Delivery Concern";
    if (r.includes("follow up") || r.includes("follow-up") || r.includes("followup")) return "Follow Up";
    if (r.includes("sample") || r.includes("sample request")) return "Sample Requests";
    if (r.includes("technical") || r.includes("troubleshoot") || r.includes("specification")) return "Technical Concerns";
    return "Documentation";
  };

  // Auto-fill current time for new entries
  const autoFillCurrentTime = () => {
    const now = new Date();
    const localDateTime = toLocalDateTimeInput(now.toISOString());
    setStartDate(localDateTime);
    
    // Suggest end time (default 1 hour later)
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);
    setEndDate(toLocalDateTimeInput(endTime.toISOString()));
  };

  // Duration map (in minutes) per activity type
  const activityDurations: Record<string, number> = {
    "Documentation": 30,
    "Admin - Supplier Accreditation": 45,
    "Admin - Credit Terms Application": 45,
    "Accounting Concerns": 30,
    "After Sales Refunds": 30,
    "After Sales Repair / Replacement": 45,
    "Bidding Preparations": 60,
    "Customer Orders": 30,
    "Delivery Concern": 20,
    "Follow Up": 15,
    "Sample Requests": 20,
    "Technical Concerns": 45,
  };

  // Suggest end time based on typical duration
  const suggestEndTime = (activityType: string) => {
    if (!startDate) return;
    const start = new Date(startDate);
    const duration = (activityDurations[activityType] ?? 30) * 60 * 1000;
    const endTime = new Date(start.getTime() + duration);
    setEndDate(toLocalDateTimeInput(endTime.toISOString()));
  };

  // ─── Reset form ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedNote(null);
    setTypeActivity("Documentation");
    setRemarks("");
    setStartDate("");
    setEndDate("");
  };

  const loadIntoForm = (n: NoteItem) => {
    setSelectedNote(n);
    setTypeActivity(n.type_activity);
    setRemarks(n.remarks);
    setStartDate(toLocalDateTimeInput(n.start_date));
    setEndDate(toLocalDateTimeInput(n.end_date));
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const saveNote = async () => {
    // ✅ Validation with early return — original had a bug where both the
    // return and the sileo.error were on separate lines without braces,
    // meaning the error toast never fired (only the return executed).
    if (!startDate || !endDate) {
      notify.error("Start and End date are required");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      notify.error("End date cannot be earlier than start date");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      referenceid,
      tsm,
      manager,
      type_activity: typeActivity,
      remarks: remarks.trim() || "No remarks",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };

    try {
      const { error } = selectedNote
        ? await supabase.from("documentation").update(payload).eq("id", selectedNote.id)
        : await supabase.from("documentation").insert(payload);

      if (error) throw error;

      notify.success(selectedNote ? "Note updated" : "Note saved");
      resetForm();
      await fetchNotes();
    } catch {
      notify.error("Failed to save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteNote) return;
    try {
      const { error } = await supabase
        .from("documentation")
        .delete()
        .eq("id", deleteNote.id);

      if (error) throw error;

      notify.success("Note deleted");
      if (selectedNote?.id === deleteNote.id) resetForm();
      setDeleteNote(null);
      await fetchNotes();
    } catch (error) {
      notify.error("Failed to delete note");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left: Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 border border-zinc-200 bg-white overflow-hidden shadow-sm">

        {/* Table header bar with search */}
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Documentation
              </span>
              {notes.length > 0 && (
                <Badge variant="outline" className="rounded-none bg-white text-[10px] font-mono border-zinc-200">
                  {notes.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-none h-7 text-xs border-zinc-200"
              >
                <Filter className="w-3 h-3 mr-1" />
                Filters
              </Button>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
            </div>
          </div>
          
          {/* Search bar */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <Input
                placeholder="Search by type or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="rounded-none h-8 text-xs pl-9 border-zinc-200 focus:ring-0 focus:border-zinc-400"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-8 px-3 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Type:</span>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="rounded-none h-7 text-xs border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="text-xs">All Types</SelectItem>
                    <SelectItem value="Documentation" className="text-xs">Documentation</SelectItem>
                    <SelectItem value="Admin - Supplier Accreditation" className="text-xs">Admin - Supplier Accreditation</SelectItem>
                    <SelectItem value="Admin - Credit Terms Application" className="text-xs">Admin - Credit Terms Application</SelectItem>
                    <SelectItem value="Accounting Concerns" className="text-xs">Accounting Concerns</SelectItem>
                    <SelectItem value="After Sales Refunds" className="text-xs">After Sales Refunds</SelectItem>
                    <SelectItem value="After Sales Repair / Replacement" className="text-xs">After Sales Repair / Replacement</SelectItem>
                    <SelectItem value="Bidding Preparations" className="text-xs">Bidding Preparations</SelectItem>
                    <SelectItem value="Customer Orders" className="text-xs">Customer Orders</SelectItem>
                    <SelectItem value="Delivery Concern" className="text-xs">Delivery Concern</SelectItem>
                    <SelectItem value="Follow Up" className="text-xs">Follow Up</SelectItem>
                    <SelectItem value="Sample Requests" className="text-xs">Sample Requests</SelectItem>
                    <SelectItem value="Technical Concerns" className="text-xs">Technical Concerns</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-none bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  {notes.length} records
                  {totalCount > notes.length && (
                    <span className="text-[9px] text-blue-600 ml-1">
                      of {totalCount} total
                    </span>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Time tracking summary */}
        {(totalHours > 0 || overlappingEntries.length > 0) && (
          <div className="px-4 py-2 border-b border-zinc-100 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-bold text-blue-700">
                    Total: {totalHours.toFixed(1)} hours
                  </span>
                </div>
                {overlappingEntries.length > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-700">
                      {overlappingEntries.length} overlaps
                    </span>
                  </div>
                )}
              </div>
            </div>
            {overlappingEntries.length > 0 && (
              <div className="mt-2 space-y-1">
                {overlappingEntries.slice(0, 2).map((overlap, i) => (
                  <p key={i} className="text-[9px] text-amber-600 truncate">{overlap}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="overflow-auto max-h-[560px] custom-scrollbar">
          {!loading && notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-300 gap-2">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest">
                No records found
              </p>
            </div>
          ) : (
            <table className="w-full table-fixed text-xs text-left border-collapse">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead className="bg-zinc-50/50 text-zinc-500 sticky top-0 z-10 border-b border-zinc-100">
                <tr>
                  {["Type", "Remarks", "Start", "End", "Duration", ""].map((h) => (
                    <th key={h} className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notes.map((n: NoteItem, idx: number) => {
                  const isSelected = selectedNote?.id === n.id;
                  return (
                    <tr key={n.id} className={`border-b border-zinc-100 transition-colors ${isSelected ? "bg-zinc-50 border-l-4 border-l-zinc-900" : idx % 2 === 0 ? "bg-white hover:bg-zinc-50/50" : "bg-zinc-50/30 hover:bg-zinc-50/50"}`}>
                      <td className="px-3 py-3 font-bold text-zinc-800">{n.type_activity}</td>
                      <td className="px-3 py-3 text-zinc-600 italic truncate" title={n.remarks}>{truncate(n.remarks)}</td>
                      <td className="px-3 py-3 font-mono text-[10px] text-zinc-500 whitespace-nowrap">{fmtDateTime(n.start_date)}</td>
                      <td className="px-3 py-3 font-mono text-[10px] text-zinc-500 whitespace-nowrap">{fmtDateTime(n.end_date)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                          <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                          {getDurationHMS(n.start_date, n.end_date)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button title="Edit" onClick={() => loadIntoForm(n)} className="p-1.5 rounded-none border border-zinc-200 text-zinc-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                            <Pen className="w-3.5 h-3.5" />
                          </button>
                          <button title="Delete" onClick={() => setDeleteNote(n)} className="p-1.5 rounded-none border border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Load More Button */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
            <Button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border border-zinc-200 bg-white overflow-hidden shadow-sm">
        {/* Form header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            {selectedNote
              ? <Pen className="w-4 h-4 text-zinc-500" />
              : <Plus className="w-4 h-4 text-zinc-400" />}
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              {selectedNote ? "Edit Record" : "New Record"}
            </span>
          </div>
          {selectedNote && (
            <button
              onClick={resetForm}
              className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-widest transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); saveNote(); }}
          className="p-4 space-y-5"
        >
          {/* Type of activity */}
          <div>
            <SectionLabel>Type of Activity</SectionLabel>
            <Select value={typeActivity} onValueChange={setTypeActivity}>
              <SelectTrigger className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="Documentation" className="text-xs">Documentation</SelectItem>
                <SelectItem value="Admin - Supplier Accreditation" className="text-xs">Admin - Supplier Accreditation</SelectItem>
                <SelectItem value="Admin - Credit Terms Application" className="text-xs">Admin - Credit Terms Application</SelectItem>
                <SelectItem value="Accounting Concerns" className="text-xs">Accounting Concerns</SelectItem>
                <SelectItem value="After Sales Refunds" className="text-xs">After Sales Refunds</SelectItem>
                <SelectItem value="After Sales Repair / Replacement" className="text-xs">After Sales Repair / Replacement</SelectItem>
                <SelectItem value="Bidding Preparations" className="text-xs">Bidding Preparations</SelectItem>
                <SelectItem value="Customer Orders" className="text-xs">Customer Orders</SelectItem>
                <SelectItem value="Delivery Concern" className="text-xs">Delivery Concern</SelectItem>
                <SelectItem value="Follow Up" className="text-xs">Follow Up</SelectItem>
                <SelectItem value="Sample Requests" className="text-xs">Sample Requests</SelectItem>
                <SelectItem value="Technical Concerns" className="text-xs">Technical Concerns</SelectItem>
              </SelectContent>
            </Select>
            {remarks && suggestActivityType(remarks) !== typeActivity && (
              <p className="text-[9px] text-blue-600 mt-1">
                💡 Suggested: {suggestActivityType(remarks)}
              </p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <SectionLabel>Remarks</SectionLabel>
            <Textarea
              className="rounded-none text-xs resize-none min-h-[100px] border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all"
              placeholder="Add notes or remarks…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Date range with smart features */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <SectionLabel>Start Date & Time</SectionLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillCurrentTime}
                  className="rounded-none h-6 text-[9px] border-zinc-200 px-2"
                >
                  Now
                </Button>
              </div>
              <Input
                type="datetime-local"
                className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>End Date & Time</SectionLabel>
              <Input
                type="datetime-local"
                className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
              {startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime()) && (
                <p className="text-[9px] text-zinc-500 mt-1">
                  ⏱️ Suggested duration for {typeActivity}: {activityDurations[typeActivity] ?? 30} min
                </p>
              )}
            </div>
          </div>

          {/* Duration preview */}
          {startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime()) && new Date(endDate) >= new Date(startDate) && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-100">
              <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="text-[11px] font-mono font-bold text-zinc-600">
                {getDurationHMS(new Date(startDate).toISOString(), new Date(endDate).toISOString())}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">duration</span>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full rounded-none h-10 text-[11px] font-bold uppercase tracking-widest gap-2 ${selectedNote
                ? "bg-zinc-800 hover:bg-zinc-900"
                : "bg-zinc-900 hover:bg-zinc-800"
              }`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : selectedNote ? (
              <><Check className="w-4 h-4" /> Update Record</>
            ) : (
              <><Plus className="w-4 h-4" /> Add Record</>
            )}
          </Button>
        </form>
      </div>

      {/* Delete Dialog */}
      <NoteDeleteDialog
        open={!!deleteNote}
        onOpenChange={(open) => { if (!open) setDeleteNote(null); }}
        note={deleteNote}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
};