"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Clock,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";

const QUOTATION_STATUS_OPTIONS = {
  "Pending Client Approval": [
    "For Bidding",
    "Nego",
    "Waiting for Approval",
  ],
  "Order Complete": [],
  "Convert to SO": [],
  "Decline": [
    "Loss Price is Too High",
    "Lead Time Issue",
    "Insufficient Stock",
    "Lost Bid",
    "Canvass Only",
    "Did not Meet the Specs",
    "Declined / Dissaproved",
  ],
};
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sileo } from "sileo";
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
  quotation_status_sub?: string;
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
  contact_person?: string;
  email_address?: string;
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

function toDatetimeLocal(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Remove hardcoded password - authentication handled server-side



// ─── Password Gate Dialog ─────────────────────────────────────────────────────

interface PasswordGateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function PasswordGateDialog({ open, onClose, onSuccess }: PasswordGateDialogProps) {
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState(false);
  const [shake, setShake]         = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Reset state each time dialog opens
  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPw(false);
      setError(false);
      setShake(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError(true);
      setShake(true);
      setPassword("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    try {
      const res = await fetch("/api/auth/verify-edit-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Authentication failed");
      }
      
      setError(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(true);
      setShake(true);
      setPassword("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xs rounded-none p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <Lock className="h-4 w-4 text-yellow-400" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Authentication Required
              </DialogTitle>
            </div>
            <p className="text-zinc-400 text-xs mt-1">
              Enter the password to edit timestamp data.
            </p>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 space-y-4 ${shake ? "animate-shake" : ""}`}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder="Enter password"
                className={`rounded-none text-sm pr-9 ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {error && (
              <p className="text-[11px] text-red-500 font-medium">Incorrect password. Please try again.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button
            variant="outline"
            className="rounded-none flex-1 text-xs h-10"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800 gap-1.5"
            onClick={handleSubmit}
            disabled={!password}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Time Dialog ─────────────────────────────────────────────────────────

interface EditTimeDialogProps {
  open: boolean;
  onClose: () => void;
  item: Completed | null;
  onSaved: () => void;
  onAutoUpdateStatus?: (item: Completed, trigger: 'quotation' | 'so' | 'delivery') => Promise<void>;
}

function EditTimeDialog({ open, onClose, item, onSaved, onAutoUpdateStatus }: EditTimeDialogProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setStartDate(toDatetimeLocal(item.start_date));
      setEndDate(toDatetimeLocal(item.end_date));
      setError(null);
    }
  }, [item, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = async () => {
    if (!item) return;
    
    // Validate inputs
    if (!startDate?.trim() || !endDate?.trim()) { 
      setError("Both start and end date are required."); 
      return; 
    }

    let start: Date, end: Date;
    try {
      // Fix: Parse datetime-local string correctly (no timezone offset)
      // datetime-local format: "YYYY-MM-DDTHH:mm"
      start = new Date(startDate + ":00"); // Add seconds
      end = new Date(endDate + ":00");     // Add seconds
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) { 
        setError("Invalid date format."); 
        return; 
      }
      
      if (end <= start) { 
        setError("End date must be after start date."); 
        return; 
      }
    } catch (dateErr) {
      setError("Invalid date format.");
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch("/api/activity/tsa/historical/update-history-time", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify({
          id: item.id,
          start_date: start.toISOString(),
          end_date:   end.toISOString(),
        }),
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to update time");
      }
      
      onSaved();
      
      // Trigger status progression for time updates if callback provided
      if (onAutoUpdateStatus) {
        await onAutoUpdateStatus(item, 'quotation');
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !item) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <Clock className="h-4 w-4 text-blue-400" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Edit Time
              </DialogTitle>
            </div>
            <p className="text-zinc-400 text-xs font-mono mt-1">{item.company_name}</p>
            {item.type_activity && (
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5">{item.type_activity}</p>
            )}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Start Date &amp; Time
            </label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              End Date &amp; Time
            </label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>

          {startDate && endDate && (() => {
            const s = new Date(startDate);
            const e = new Date(endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Duration: <strong className="text-zinc-800">{formatDuration(s.toISOString(), e.toISOString())}</strong></span>
                </div>
              );
            }
            return null;
          })()}

          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button
            variant="outline"
            className="rounded-none flex-1 text-xs h-10"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
            onClick={handleSave}
            disabled={saving || !startDate || !endDate}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTypeClient, setFilterTypeClient] = useState<string>("all");
  const [filterCallStatus, setFilterCallStatus] = useState<string>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");

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
  const [savingSo, setSavingSo] = useState(false);

  // ── Edit Time state ──────────────────────────────────────────────────────
  const [editTimeOpen, setEditTimeOpen]         = useState(false);
  const [editTimeItem, setEditTimeItem]         = useState<Completed | null>(null);
  const [showEditTimeBtn, setShowEditTimeBtn]   = useState(false);

  // ── Password Gate state ──────────────────────────────────────────────────
  const [pwGateOpen, setPwGateOpen]             = useState(false);
  const [pendingTimeItem, setPendingTimeItem]   = useState<Completed | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default to 10 as requested
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [paginationLoading, setPaginationLoading] = useState(false);

  // ── Status Progression Automation ─────────────────────────────────────────────

  const autoUpdateStatus = async (item: Completed, trigger: 'quotation' | 'so' | 'delivery') => {
    try {
      let newStatus: string | null = null;
      let reason = '';
      
      // Business rules for status progression
      switch (trigger) {
        case 'quotation':
          if (item.quotation_status === 'Convert to SO' && item.quotation_number && item.quotation_amount) {
            newStatus = 'Quote-Done';
            reason = 'Quotation marked for SO conversion';
          }
          break;
          
        case 'so':
          if (item.so_number && item.so_amount && item.status === 'Quote-Done') {
            newStatus = 'SO-Done';
            reason = 'Sales Order created';
          }
          break;
          
        case 'delivery':
          if (item.dr_number && item.delivery_date && item.status === 'SO-Done') {
            newStatus = 'Delivered';
            reason = 'Delivery recorded';
          }
          break;
      }
      
      if (newStatus && newStatus !== item.status) {
        const res = await fetch('/api/activity/tsa/historical/auto-update-status', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Protection': '1'
          },
          body: JSON.stringify({
            id: item.id,
            newStatus,
            previousStatus: item.status,
            trigger,
            reason,
            autoUpdate: true
          })
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Failed to auto-update status');
        }
        
        // Show notification for auto-update
        sileo.success({
          title: 'Status Auto-Updated',
          description: `${item.company_name} status changed to ${newStatus.replace('-', ' ')}`,
          duration: 3000,
          position: 'top-right',
          fill: 'black',
          styles: { title: 'text-white!', description: 'text-white' },
        });
        
        // Refresh data
        fetchActivities();
      }
    } catch (error: any) {
      sileo.error({
        title: 'Auto-Update Failed',
        description: error?.message || 'Could not auto-update status',
        duration: 3000,
        position: 'top-right',
        fill: 'black',
        styles: { title: 'text-white!', description: 'text-white' },
      });
    }
  };

  // ── Alt + Ctrl + T shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setShowEditTimeBtn((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Handler: Time button click → open password gate first ────────────────
  const handleEditTimeClick = (item: Completed) => {
    setPendingTimeItem(item);
    setPwGateOpen(true);
  };

  // ── Handler: Password verified → open Edit Time dialog ───────────────────
  const handlePasswordSuccess = () => {
    if (pendingTimeItem) {
      setEditTimeItem(pendingTimeItem);
      setEditTimeOpen(true);
    }
    setPendingTimeItem(null);
  };

  // ── Inline Update ──────────────────────────────────────────────────────────

  const handleInlineUpdate = async (id: number, field: string, value: any) => {
    // Input validation
    if (!id || !field?.trim()) {
      sileo.error({
        title: "Invalid Request",
        description: "Missing required parameters.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    // Sanitize value
    const sanitizedValue = typeof value === 'string' ? value.trim() : value;
    
    try {
      const res = await fetch(`/api/activity/tsa/historical/update?id=${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1"
          },
          body: JSON.stringify({ [field]: sanitizedValue }),
        });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to update");
      }

      sileo.success({
        title: "Updated",
        description: `${field.replace(/_/g, " ")} updated successfully.`,
        duration: 2000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      fetchActivities();
    } catch (error: any) {
      sileo.error({
        title: "Update Failed",
        description: error?.message || "Could not update the record.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const handleQuotationStatusUpdate = async (id: number, main: string, sub: string) => {
    // Input validation
    if (!id || !main?.trim()) {
      sileo.error({
        title: "Invalid Request",
        description: "Missing required parameters.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      const res = await fetch("/api/activity/tsa/historical/update-quotation-status", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify({ 
          id, 
          quotation_status: main.trim(), 
          quotation_status_sub: sub?.trim() || "" 
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to update");
      }

      // Find the updated item to trigger automation (with null check)
      const updatedItem = activities.find(item => item && item.id === id);
      if (updatedItem) {
        // Create updated item object
        const itemWithNewStatus = { ...updatedItem, quotation_status: main.trim() };
        
        // Trigger status progression automation
        await autoUpdateStatus(itemWithNewStatus, 'quotation');
      }

      sileo.success({
        title: "Updated",
        description: `Quotation status updated successfully.`,
        duration: 2000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      fetchActivities();
    } catch (error: any) {
      sileo.error({
        title: "Update Failed",
        description: error?.message || "Could not update the quotation status.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(async (page?: number) => {
    if (!referenceid?.trim()) {
      setActivities([]);
      setTotalCount(0);
      setTotalPages(0);
      return;
    }

    // Use pagination loading for all page changes, main loading only for initial load
    if (page !== undefined) {
      setPaginationLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const from = dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
        : null;
      const to = dateCreatedFilterRange?.to
        ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
        : null;

      const url = new URL("/api/activity/tsa/historical/fetch", window.location.origin);
      url.searchParams.append("referenceid", encodeURIComponent(referenceid.trim()));
      url.searchParams.append("page", String(page ?? 1));
      url.searchParams.append("limit", String(itemsPerPage));
      
      // Add search and filters
      if (searchTerm.trim()) {
        url.searchParams.append("search", searchTerm.trim());
      }
      if (filterStatus !== "all") {
        url.searchParams.append("status", filterStatus);
      }
      if (filterTypeActivity !== "all") {
        url.searchParams.append("type_activity", filterTypeActivity);
      }
      if (filterSource !== "all") {
        url.searchParams.append("source", filterSource);
      }
      if (filterTypeClient !== "all") {
        url.searchParams.append("type_client", filterTypeClient);
      }
      if (filterCallStatus !== "all") {
        url.searchParams.append("call_status", filterCallStatus);
      }
      if (filterQuotationStatus !== "all") {
        url.searchParams.append("quotation_status", filterQuotationStatus);
      }
      
      if (from && to) {
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);
      }

      const res = await fetch(url.toString(), {
        headers: {
          "X-CSRF-Protection": "1"
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to fetch activities");
      }
      
      const data = await res.json();
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      
      // Update pagination info from API response
      if (data.pagination) {
        setTotalCount(data.pagination.total_count);
        setTotalPages(data.pagination.total_pages);
        setHasMore(data.pagination.has_more);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch activities");
      setActivities([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
      setPaginationLoading(false);
    }
  }, [referenceid, dateCreatedFilterRange, itemsPerPage, searchTerm, filterStatus, filterTypeActivity, filterSource, filterTypeClient, filterCallStatus, filterQuotationStatus]);

  useEffect(() => {
    if (!referenceid?.trim()) return;
    
    let mounted = true;
    let channel: any = null;
    
    const initializeChannel = async () => {
      try {
        await fetchActivities(); // Initial load without page parameter uses main loading
        
        if (mounted) {
          channel = supabase
            .channel(`history-${referenceid}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
              () => {
                if (mounted) fetchActivities();
              },
            )
            .subscribe();
        }
      } catch (err) {
        // Silent fail - subscription is optional
      }
    };
    
    initializeChannel();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [referenceid, fetchActivities]);

  // ── Derived data ───────────────────────────────────────────────────────────
  // Note: Filtering and sorting now handled by API for better performance

  // Reset page when filters change
  useEffect(() => { 
    setCurrentPage(1); 
    // The currentPage useEffect will handle fetching page 1
  }, [searchTerm, filterStatus, filterTypeActivity, filterSource, filterTypeClient, filterCallStatus, filterQuotationStatus, dateCreatedFilterRange, itemsPerPage]);

  // Fetch page-specific data when currentPage changes
  useEffect(() => {
    fetchActivities(currentPage); // Fetch current page (including page 1)
  }, [currentPage]); // Remove fetchActivities to prevent infinite loop

  const statusOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.status).filter(Boolean))].sort() as string[];
  }, [activities]);

  const typeActivityOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.type_activity).filter(Boolean))].sort() as string[];
  }, [activities]);

  const sourceOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.source).filter(Boolean))].sort() as string[];
  }, [activities]);

  const typeClientOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.type_client).filter(Boolean))].sort() as string[];
  }, [activities]);

  const callStatusOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.call_status).filter(Boolean))].sort() as string[];
  }, [activities]);

  const quotationStatusOptions = useMemo(() => {
    return [...new Set(activities.map((a) => a.quotation_status).filter(Boolean))].sort() as string[];
  }, [activities]);

  // Remove old client-side filtering and pagination - now handled by API
  const paginatedActivities = activities; // API returns already paginated data

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allCurrentSelected = useMemo(() =>
    paginatedActivities.length > 0 &&
    paginatedActivities.every((item) => item && item.id !== undefined && selectedIds.has(item.id)),
  [paginatedActivities, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedActivities.forEach((item) => {
          if (item && item.id !== undefined) {
            next.delete(item.id);
          }
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedActivities.forEach((item) => {
          if (item && item.id !== undefined) {
            next.add(item.id);
          }
        });
        return next;
      });
    }
  }, [allCurrentSelected, paginatedActivities]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const onConfirmRemove = async () => {
    if (selectedIds.size === 0) {
      sileo.error({
        title: "No Selection",
        description: "Please select items to delete.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      const res = await fetch("/api/act-delete-history", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify({ 
          ids: Array.from(selectedIds), 
          remarks: removeRemarks?.trim() || "" 
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to delete");
      }
      
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setRemoveRemarks("");
      fetchActivities();
      
      sileo.success({
        title: "Deleted",
        description: "Selected items deleted successfully.",
        duration: 2000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (err: any) {
      sileo.error({
        title: "Delete Failed",
        description: err?.message || "Could not delete items.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };


  // ── SO Update ──────────────────────────────────────────────────────────────

  const handleSaveSo = async () => {
    if (!reSoItem?.id || !editSoNumber?.trim() || editSoAmount === "") {
      sileo.error({
        title: "Invalid Input",
        description: "Please fill in all required fields.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }
    
    setSavingSo(true);
    try {
      const res = await fetch("/api/act-update-so", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify({ 
          id: reSoItem.id, 
          so_number: editSoNumber.trim().toUpperCase(), 
          so_amount: Number(editSoAmount) 
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to update SO");
      }
      
      setIsEditingSo(false);
      setReSoOpen(false);
      
      // Trigger status progression automation
      await autoUpdateStatus(reSoItem, 'so');
      
      sileo.success({
        title: "Updated",
        description: "Sales Order updated successfully.",
        duration: 2000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (err: any) {
      sileo.error({
        title: "Update Failed",
        description: err?.message || "Could not update Sales Order.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
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
    )
      pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // Memoized pagination click handlers to prevent recreation
  const handlePageChange = useCallback((page: number) => {
    if (page !== currentPage && !paginationLoading) {
      setCurrentPage(page);
    }
  }, [currentPage, paginationLoading]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1 && !paginationLoading) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, paginationLoading]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages && !paginationLoading) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages, paginationLoading]);

  // Memoized table row handlers to prevent recreation
  const handleEditClick = useCallback((item: Completed) => {
    setEditItem(item);
    setEditOpen(true);
  }, []);

  const handleReSoClick = useCallback((item: Completed) => {
    setReSoItem(item);
    setEditSoNumber(item.so_number || "");
    setEditSoAmount(item.so_amount ?? "");
    setIsEditingSo(false);
    setReSoOpen(true);
  }, []);

  const handleEditTimeClickOptimized = useCallback((item: Completed) => {
    setPendingTimeItem(item);
    setPwGateOpen(true);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

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
      `}</style>

      {/* ── Password Gate Dialog ─────────────────────────────────────── */}
      <PasswordGateDialog
        open={pwGateOpen}
        onClose={() => { setPwGateOpen(false); setPendingTimeItem(null); }}
        onSuccess={handlePasswordSuccess}
      />

      {/* ── Edit Time Dialog ────────────────────────────────────────────── */}
      <EditTimeDialog
        open={editTimeOpen}
        onClose={() => { setEditTimeOpen(false); setEditTimeItem(null); }}
        item={editTimeItem}
        onSaved={fetchActivities}
        onAutoUpdateStatus={autoUpdateStatus}
      />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Search historical records..."
            className="pl-9 h-10 rounded-none border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {showEditTimeBtn && (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <Clock className="w-3 h-3" />
              Edit Time Mode
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
                className="h-8 flex items-center gap-1.5 px-3 rounded-none bg-red-600 hover:bg-red-700 transition-colors"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Delete ({selectedIds.size})</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700 leading-relaxed">
                We couldn't retrieve the historical data. Please check your network connection or try again later.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-60">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Retrieving Records...</p>
        </div>
      )}

      {!loading && activities.length > 0 && (
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden relative">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Historical Records</span>
              <Badge variant="outline" className="rounded-none bg-white text-[10px] font-mono border-zinc-200">
                {activities.length}
              </Badge>
              {selectedIds.size > 0 && (
                <Badge className="rounded-none bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-bold">
                  {selectedIds.size} Selected
                </Badge>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs min-w-[2200px]">
              <TableHeader className="bg-zinc-50/50">
                <TableRow className="hover:bg-transparent border-b border-zinc-200">
                  <TableHead className="w-10 h-11 text-center">
                    <Checkbox
                      checked={allCurrentSelected}
                      onCheckedChange={toggleSelectAll}
                      className="rounded-none h-4 w-4"
                    />
                  </TableHead>
                  <TableHead className="w-24 text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-center">Edit</TableHead>
                  {[
                    "Date", "Quotation #", "Duration", "Company", "Status", "Quotation Status", "Quotation Remarks",
                    "Contact #", "Type Client", "Project Name", "Project Type",
                    "Source", "Target Quota", "Activity Type", "Callback",
                    "Call Status", "Call Type", "Quotation Amount",
                    "SO #", "SO Amount", "Actual Sales", "Delivery Date", "DR #",
                    "Ticket Ref #", "Remarks", "Date Followup", "Payment Terms",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap py-3 px-3"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedActivities.map((item) => {
                  // Add null/undefined checks to prevent errors
                  if (!item || item.id === undefined) {
                    return null; // Skip invalid items
                  }
                  
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <TableRow
                      key={item.id}
                      className={`group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors ${
                        isSelected ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          className="rounded-none h-4 w-4"
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>

                      <TableCell className="px-3">
                        <div className="flex items-center justify-left gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-none hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all group/edit"
                            onClick={() => handleEditClick(item)}
                            title="Edit Record"
                          >
                            <PenIcon className="h-3.5 w-3.5 text-zinc-400 group-hover/edit:text-blue-600" />
                          </Button>

                          {item?.type_activity === "Sales Order Preparation" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-none hover:bg-amber-50 hover:text-amber-600 border border-zinc-200 transition-all group/reso"
                              onClick={() => handleReSoClick(item)}
                              title="RE-SO Preparation"
                            >
                              <Undo className="h-3.5 w-3.5 text-zinc-400 group-hover/reso:text-amber-600" />
                            </Button>
                          )}

                          {showEditTimeBtn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-none hover:bg-emerald-50 hover:text-emerald-600 transition-all group/time"
                              onClick={() => handleEditTimeClickOptimized(item)}
                              title="Edit Timestamp"
                            >
                              <Clock className="h-3.5 w-3.5 text-zinc-400 group-hover/time:text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap px-3 tabular-nums font-mono text-[11px] text-zinc-500">
                        {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="uppercase px-3 font-mono">{displayValue(item.quotation_number)}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[11px] text-zinc-500 px-3">
                        {formatDuration(item.start_date, item.end_date)}
                      </TableCell>
                      <TableCell className="font-bold text-zinc-800 whitespace-nowrap px-3 min-w-[160px]">
                        {item.company_name}
                      </TableCell>
                      <TableCell className="px-3">
                        {item.status && (
                          <Badge 
                            variant="outline"
                            className={`rounded-none text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent
                              ${item.status === "Delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                item.status === "Quote-Done" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                item.status === "SO-Done" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                item.status === "On Progress" || item.status === "Assisted" ? "bg-orange-50 text-orange-700 border-orange-100" :
                                item.status === "Cancelled" ? "bg-red-50 text-red-700 border-red-100" :
                                "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                          >
                            {item.status.replace("-", " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3">
                        {item.status === "Quote-Done" ? (
                          <Select
                            value={`${item.quotation_status || ""}__${item.quotation_status_sub || ""}`}
                            onValueChange={(val) => {
                              const [main, sub] = val.split("__");
                              handleQuotationStatusUpdate(item.id, main, sub || "");
                            }}
                          >
                            <SelectTrigger className="h-7 text-[10px] w-[140px] rounded-none border-zinc-200 bg-white hover:bg-zinc-50 transition-colors font-bold uppercase tracking-tight">
                              <SelectValue asChild><span>{item.quotation_status || 'Select status'}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {Object.entries(QUOTATION_STATUS_OPTIONS).map(([mainStatus, subStatuses]) => (
                                <SelectGroup key={mainStatus}>
                                  <SelectItem value={mainStatus} className="text-[10px] uppercase font-semibold">
                                    {mainStatus}
                                  </SelectItem>
                                  {subStatuses.map(subStatus => (
                                    <SelectItem key={subStatus} value={`${mainStatus}__${subStatus}`} className="text-[10px] pl-8">
                                      {subStatus}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-zinc-500 font-medium">{displayValue(item.quotation_status)}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 capitalize">
                        <div className="flex items-center gap-1">
                          {displayValue(item.quotation_status_sub)}
                          {item.quotation_status === 'Convert to SO' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-800">
                              AUTO
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 font-mono text-[11px] text-zinc-500">{displayValue(item.contact_number)}</TableCell>
                      <TableCell className="whitespace-nowrap px-3">
                        <Badge variant="secondary" className="rounded-none font-normal text-[10px] uppercase tracking-wider bg-zinc-100 text-zinc-600">
                          {displayValue(item.type_client)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 text-zinc-600">{displayValue(item.project_name)}</TableCell>
                      <TableCell className="px-3 text-zinc-600">{displayValue(item.project_type)}</TableCell>
                      <TableCell className="px-3 text-zinc-600">{displayValue(item.source)}</TableCell>
                      <TableCell className="px-3 tabular-nums font-mono text-[11px] text-zinc-500">{displayValue(item.target_quota)}</TableCell>
                      <TableCell className="whitespace-nowrap px-3">{displayValue(item.type_activity)}</TableCell>
                      <TableCell className="whitespace-nowrap px-3">
                        {item.callback
                          ? `${new Date(item.callback).toLocaleDateString()} ${formatTimeWithAmPm(item.callback.substring(11, 16))}`
                          : "-"}
                      </TableCell>
                      <TableCell className="px-3">
                        {item?.type_activity === "Outbound Calls" ? (
                          <Select
                            value={item.call_status || ""}
                            onValueChange={(val) => handleInlineUpdate(item.id, "call_status", val)}
                          >
                            <SelectTrigger className="h-7 text-[10px] w-[110px] rounded-none border-zinc-200 bg-white hover:bg-zinc-50 transition-colors">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="Successful" className="text-[10px]">Successful</SelectItem>
                                <SelectItem value="Unsuccessful" className="text-[10px]">Unsuccessful</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          displayValue(item.call_status)
                        )}
                      </TableCell>
                      <TableCell className="px-3">{displayValue(item.call_type)}</TableCell>
                      <TableCell className="px-3 tabular-nums">
                        {item.quotation_amount != null
                          ? item.quotation_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                          : "-"}
                      </TableCell>
                      <TableCell className="uppercase px-3 font-mono">
                        <div className="flex items-center gap-1">
                          {displayValue(item.so_number)}
                          {item.so_number && item.status === 'Quote-Done' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-800">
                              AUTO
                            </span>
                          )}
                        </div>
                      </TableCell>
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
                      <TableCell className="uppercase px-3 font-mono">
                        <div className="flex items-center gap-1">
                          {displayValue(item.dr_number)}
                          {item.dr_number && item.status === 'SO-Done' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-800">
                              AUTO
                            </span>
                          )}
                        </div>
                      </TableCell>
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
          
          {/* Pagination Loading Overlay */}
          {paginationLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
                <p className="text-xs font-medium text-zinc-600">Loading page {currentPage}...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !error && activities.length === 0 && (
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
      {!loading && activities.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
          <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider bg-zinc-50 px-3 py-1.5 border border-zinc-100">
            Showing <span className="text-zinc-900">{Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}</span>
            <span className="mx-1.5">–</span>
            <span className="text-zinc-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span>
            <span className="mx-1.5 text-zinc-300">of</span>
            <span className="text-zinc-900">{totalCount}</span>
            <span className="ml-1.5">Records</span>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 border border-zinc-200 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 disabled:opacity-30 transition-all"
              onClick={handlePrevPage}
              disabled={currentPage === 1 || paginationLoading}
            >
              {paginationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>

            {currentPage > 3 && (
              <>
                <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0 text-[11px] font-bold" onClick={() => handlePageChange(1)}>1</Button>
                {currentPage > 4 && <span className="px-1 text-zinc-300 text-[10px]">•••</span>}
              </>
            )}

            {pageWindow.map((page) => (
              <Button
                key={page}
                size="sm"
                variant={page === currentPage ? "secondary" : "ghost"}
                className={`rounded-none h-8 w-8 p-0 text-[11px] font-bold transition-all ${
                  page === currentPage
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "hover:bg-zinc-100"
                }`}
                onClick={() => handlePageChange(page)}
                disabled={paginationLoading}
              >
                {paginationLoading && page === currentPage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  page
                )}
              </Button>
            ))}

            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-1 text-zinc-300 text-[10px]">•••</span>}
                <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0 text-[11px] font-bold" onClick={() => handlePageChange(totalPages)}>{totalPages}</Button>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 disabled:opacity-30 transition-all"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || paginationLoading}
            >
              {paginationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
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
}
