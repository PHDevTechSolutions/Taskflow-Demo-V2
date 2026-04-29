"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, CheckCircle2, AlertCircle, PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp, Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter, Calendar, Settings, Pen, } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger, } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { sileo } from "sileo";

import { CreateActivityDialog } from "../dialog/create";
import { CancelledDialog } from "../dialog/cancelled";
import { DoneDialog } from "../dialog/done";
import { DeliveredDialog } from "../dialog/delivered";
import { TransferDialog } from "../dialog/transfer";

import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface Activity {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  status: string;
  agent: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;

  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
}

interface HistoryItem {
  id: string;
  activity_reference_number: string;
  callback?: string | null;
  date_followup?: string | null;
  quotation_number?: string | null;
  quotation_amount?: number | null;
  so_number?: string | null;
  so_amount?: number | null;
  call_type?: string;
  ticket_reference_number?: string;
  source?: string;
  call_status?: string;
  tsm_approved_status: string;
  type_activity: string;
  quotation_status: string;
  status?: string;
}

interface AllActivitiesProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  tsm: string;
  managername: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

// All statuses allowed in this view
const ALL_STATUSES = [
  "Assisted",
  "Quote-Done",
  "SO-Done",
  "On-Progress",
  "Delivered",
  "Done",
  "Completed",
  "Cancelled",
  "Transfer",
  "Pending",
];

export const AllActivities: React.FC<AllActivitiesProps> = ({
  referenceid,
  tsm,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  tsmDetails,
  managerDetails,
  signature,
  onCountChange,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDoneOpen, setDialogDoneOpen] = useState(false);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);
  const [dialogRescheduleOpen, setDialogRescheduleOpen] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [rescheduleDate, setRescheduleDate] = useState<string>("");

  // ── View mode & settings ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"accordion" | "table">("accordion");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState<string>("");

  const fetchAllData = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      setHistory([]);
      return;
    }

    setActivitiesLoading(true);
    setHistoryLoading(true);
    setError(null);

    const url = new URL(
      "/api/activity/tsa/planner/fetch",
      window.location.origin,
    );
    url.searchParams.append("referenceid", referenceid);

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities and history");
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities || []);
        setHistory(data.history || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setActivitiesLoading(false);
        setHistoryLoading(false);
      });
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;

    fetchAllData();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity",
          filter: `referenceid=eq.${referenceid}`,
        },
        () => fetchAllData(),
      )
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        () => fetchAllData(),
      )
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);

      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchAllData]);

  const mergedActivities = useMemo(() => {
    return activities
      .map((activity) => {
        const relatedHistoryItems = history.filter(
          (h) =>
            h.activity_reference_number === activity.activity_reference_number,
        );
        return { ...activity, relatedHistoryItems };
      });
  }, [activities, history]);

  const filteredActivities = useMemo(() => {
    return mergedActivities
      .filter((item) => {
        // ── Status filter ─────────────────────────────────────────────────────
        if (statusFilter !== "All" && item.status !== statusFilter) return false;

        // ── Text search ───────────────────────────────────────────────────────
        if (searchTerm.trim() !== "") {
          const termLower = searchTerm.toLowerCase();

          const activityValues = Object.values(item)
            .map((v) => (v != null ? v.toString() : ""))
            .join(" ")
            .toLowerCase();

          const historyValues = item.relatedHistoryItems
            .map((h) =>
              Object.values(h)
                .map((v) => (v != null ? v.toString() : ""))
                .join(" ")
                .toLowerCase(),
            )
            .join(" ");

          const matchesSearch = activityValues.includes(termLower) || historyValues.includes(termLower);
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
      );
  }, [mergedActivities, statusFilter, searchTerm]);

  // ── Lazy loading pagination ────────────────────────────────────────────────
  const INITIAL_DISPLAY_COUNT = 20;
  const LOAD_MORE_COUNT = 10;
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Reset display count when search or filter changes
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [searchTerm, statusFilter]);

  // Slice the filtered activities for display
  const displayedActivities = useMemo(() => {
    return filteredActivities.slice(0, displayCount);
  }, [filteredActivities, displayCount]);

  const hasMoreToLoad = displayCount < filteredActivities.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, filteredActivities.length));
  };

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities, onCountChange]);

  // Also notify about displayed count for UI
  const displayedCount = displayedActivities.length;
  const totalCount = filteredActivities.length;

  const openCancelledDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
  };

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId) return;

    if (!cancellationRemarks) {
      sileo.error({
        title: "Failed",
        description: "Cancellation remarks are required.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      setUpdatingId(selectedActivityId);
      setDialogOpen(false);

      const res = await fetch("/api/act-cancelled-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedActivityId,
          cancellation_remarks: cancellationRemarks,
        }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: `Failed to update status: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        setUpdatingId(null);
        return;
      }

      await fetchAllData();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: "Transaction marked as Cancelled.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "An error occurred while updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  type BadgeVariant =
    | "secondary"
    | "outline"
    | "destructive"
    | "default"
    | null
    | undefined;

  function getBadgeProps(status: string): {
    variant: BadgeVariant;
    className?: string;
  } {
    switch (status) {
      case "Assisted":
      case "On-Progress":
      case "Pending":
        return { variant: "secondary", className: "bg-orange-500 text-white" };
      case "SO-Done":
        return { variant: "default", className: "bg-yellow-400 text-white" };
      case "Quote-Done":
        return { variant: "outline", className: "bg-blue-500 text-white" };
      case "Delivered":
      case "Done":
      case "Completed":
        return { variant: "default", className: "bg-green-600 text-white" };
      case "Cancelled":
        return { variant: "destructive", className: "bg-red-600 text-white" };
      case "Transfer":
        return { variant: "outline", className: "bg-purple-500 text-white" };
      default:
        return { variant: "default" };
    }
  }

  function getStatusStyles(status: string): {
    badgeClass?: string;
    bgClass?: string;
  } {
    switch (status) {
      case "Assisted":
      case "On-Progress":
      case "Pending":
        return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
      case "SO-Done":
        return { badgeClass: "bg-yellow-400 text-white", bgClass: "bg-yellow-100" };
      case "Quote-Done":
        return { badgeClass: "bg-blue-500 text-white", bgClass: "bg-blue-100" };
      case "Delivered":
      case "Done":
      case "Completed":
        return { badgeClass: "bg-green-600 text-white", bgClass: "bg-green-100" };
      case "Cancelled":
        return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
      case "Transfer":
        return { badgeClass: "bg-purple-500 text-white", bgClass: "bg-purple-100" };
      default:
        return { badgeClass: "", bgClass: "bg-white" };
    }
  }

  const openDoneDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogDoneOpen(true);
  };

  const openDeliveredDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogDeliveredOpen(true);
  };

  const openRescheduleDialog = (id: string) => {
    setSelectedActivityId(id);
    setRescheduleDate("");
    setDialogRescheduleOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);

      const res = await fetch("/api/act-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: `Failed to update status: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        setUpdatingId(null);
        return;
      }

      setDialogDoneOpen(false);
      await fetchAllData();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: "Transaction marked as Done.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "An error occurred while updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);

      const res = await fetch("/api/act-update-status-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: `Failed to update status: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        setUpdatingId(null);
        return;
      }

      setDialogDeliveredOpen(false);
      await fetchAllData();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: "Transaction marked as Completed.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "An error occurred while updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const openTransferDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogTransferOpen(true);
  };

  const handleConfirmTransfer = async (
    selectedUserReferenceID: string | undefined,
  ) => {
    if (!selectedActivityId) return;
    if (!selectedUserReferenceID) {
      sileo.error({
        title: "Failed",
        description: "Please select a user to transfer to.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      setUpdatingId(selectedActivityId);
      setDialogTransferOpen(false);

      const res = await fetch("/api/act-transfer-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedActivityId,
          newReferenceID: selectedUserReferenceID,
        }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: `Failed to update status: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        setUpdatingId(null);
        return;
      }

      await fetchAllData();
      sileo.success({
        title: "Success",
        description: "Transaction marked as Transfer.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "An error occurred while updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedActivityId || !rescheduleDate) return;

    const selectedDate = new Date(rescheduleDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      sileo.error({
        title: "Invalid Date",
        description: "Cannot reschedule to a past date.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      setUpdatingId(selectedActivityId);

      const res = await fetch("/api/act-reschedule-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedActivityId,
          newScheduledDate: rescheduleDate,
        }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: `Failed to reschedule: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        setUpdatingId(null);
        return;
      }

      setDialogRescheduleOpen(false);
      await fetchAllData();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: "Activity rescheduled successfully.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "An error occurred while rescheduling.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
      setRescheduleDate("");
    }
  };

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber =
    selectedActivity?.ticket_reference_number || null;

  // ── Inline edit handler for table view ──────────────────────────────────────
  const READ_ONLY_FIELDS = ["activity_reference_number", "company_name"];

  const handleActivityInlineUpdate = async (id: string, field: string, value: string) => {
    if (READ_ONLY_FIELDS.includes(field)) return;
    try {
      const res = await fetch(`/api/activity/tsa/planner/update?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update");
      }
      sileo.success({
        title: "Updated",
        description: `${field.replace(/_/g, " ")} updated.`,
        duration: 2000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      fetchAllData();
    } catch (err: any) {
      sileo.error({
        title: "Update Failed",
        description: err?.message || "Could not update.",
        duration: 3000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const startCellEdit = (id: string, field: string, currentValue: string) => {
    if (READ_ONLY_FIELDS.includes(field)) return;
    setEditingCell({ id, field });
    setEditCellValue(currentValue || "");
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    handleActivityInlineUpdate(editingCell.id, editingCell.field, editCellValue);
    setEditingCell(null);
    setEditCellValue("");
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setEditCellValue("");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
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
            <AlertTitle className="text-black">Add New Data</AlertTitle>
            <AlertDescription className="text-xs">
              You can start by adding new entries to populate your database.
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  const activeDateLabel = (() => {
    if (searchTerm.trim() !== "") {
      return `Showing ${displayedCount} of ${totalCount} matching "${searchTerm}"`;
    }
    if (totalCount === 0) return "No activities found";
    if (displayedCount === totalCount) return `All Activities (${totalCount} items)`;
    return `Showing ${displayedCount} of ${totalCount} activities`;
  })();

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 w-full">
          <Input
            type="search"
            placeholder="Search all activities..."
            className="text-xs grow rounded-none mb-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search all activities"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="whitespace-nowrap rounded-none"
              >
                {statusFilter === "All" ? <Filter /> : statusFilter} Filter
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>
                <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
                All
              </DropdownMenuItem>

              {ALL_STATUSES.map((status) => {
                const { badgeClass } = getStatusStyles(status);
                return (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className="flex items-center gap-2"
                  >
                    <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                    <span className="capitalize">{status}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className="whitespace-nowrap rounded-none"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mb-1 px-1">
        {activeDateLabel}
        {viewMode === "table" && (
          <span className="ml-2 inline-flex items-center gap-1 text-blue-600 font-bold uppercase">
            <Pen className="w-2.5 h-2.5" /> Table Edit Mode
          </span>
        )}
      </p>

      {viewMode === "accordion" ? (
      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {displayedActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">
              No activities found.
            </p>
          ) : (
            displayedActivities.map((item) => {
              const badgeProps = getBadgeProps(item.status);
              const statusStyles = getStatusStyles(item.status);

              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className={`w-full border rounded-none shadow-sm mt-2 ${statusStyles.bgClass}`}
                >
                  <div className="p-2 select-none">
                    <div className="flex justify-between items-center">
                      <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
                        {item.company_name}
                      </AccordionTrigger>

                      <div className="flex gap-2 ml-4">
                        <CreateActivityDialog
                          firstname={firstname}
                          lastname={lastname}
                          target_quota={target_quota}
                          email={email}
                          contact={contact}
                          tsmname={tsmname}
                          managername={managername}
                          referenceid={item.referenceid}
                          tsm={item.tsm}
                          manager={item.manager}
                          type_client={item.type_client}
                          contact_number={item.contact_number}
                          email_address={item.email_address}
                          activityReferenceNumber={item.activity_reference_number}
                          ticket_reference_number={item.ticket_reference_number}
                          agent={item.agent}
                          company_name={item.company_name}
                          contact_person={item.contact_person}
                          address={item.address}
                          accountReferenceNumber={item.account_reference_number}
                          onCreated={() => fetchAllData()}
                          managerDetails={managerDetails ?? null}
                          tsmDetails={tsmDetails ?? null}
                          signature={signature}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="cursor-pointer rounded-none">
                              Actions <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={updatingId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeliveredDialog(item.id);
                                }}
                              >
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                Mark as Completed
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                disabled={updatingId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRescheduleDialog(item.id);
                                }}
                              >
                                <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                                Mark as Rescheduled
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                disabled={updatingId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancelledDialog(item.id);
                                }}
                              >
                                <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
                                Cancel
                              </DropdownMenuItem>

                              {item.ticket_remarks === "Reassigned" && (
                                <DropdownMenuItem
                                  disabled={updatingId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTransferDialog(item.id);
                                  }}
                                >
                                  <Repeat className="mr-2 h-4 w-4 text-blue-600" />
                                  Transfer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="ml-1 flex flex-wrap gap-1 uppercase">
                      {!["assisted", "not assisted"].includes(
                        item.status.toLowerCase(),
                      ) && (
                          <Badge
                            variant={badgeProps.variant}
                            className={`font-mono rounded-sm shadow-md p-2 border-none text-[10px] ${badgeProps.className || ""}`}
                          >
                            <CheckCircle2 />
                            {item.status.replace("-", " ")} /{" "}
                            {item.relatedHistoryItems.some(
                              (h) =>
                                h.quotation_status && h.quotation_status !== "-",
                            ) && (
                                <p>
                                  <span className="uppercase">
                                    {Array.from(
                                      new Set(
                                        item.relatedHistoryItems
                                          .map((h) => h.quotation_status ?? "-")
                                          .filter((v) => v !== "-"),
                                      ),
                                    ).join(", ")}
                                  </span>
                                </p>
                              )}
                          </Badge>
                        )}

                      {item.relatedHistoryItems.some(
                        (h: HistoryItem) =>
                          !!h.type_activity &&
                          h.type_activity !== "-" &&
                          h.type_activity.trim() !== "",
                      ) &&
                        Array.from(
                          new Set(
                            item.relatedHistoryItems
                              .map((h: HistoryItem) => h.type_activity?.trim() ?? "")
                              .filter((v) => v && v !== "-"),
                          ),
                        ).map((activity) => {
                          const getIcon = (act: string) => {
                            const lowerAct = act.toLowerCase();
                            if (lowerAct.includes("outbound") || lowerAct.includes("call")) {
                              return <PhoneOutgoing size={14} />;
                            }
                            if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) {
                              return <PackageCheck size={14} />;
                            }
                            if (lowerAct.includes("quotation") || lowerAct.includes("quote")) {
                              return <ReceiptText size={14} />;
                            }
                            return <Activity size={14} />;
                          };

                          return (
                            <HoverCard key={activity}>
                              <HoverCardTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="flex items-center justify-center w-8 h-8 p-0 cursor-default"
                                >
                                  {getIcon(activity)}
                                </Badge>
                              </HoverCardTrigger>

                              <HoverCardContent
                                side="top"
                                align="center"
                                className="text-xs font-medium px-3 py-2 w-auto"
                              >
                                {activity.toUpperCase()}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}

                      {item.relatedHistoryItems.some(
                        (h) =>
                          h.tsm_approved_status &&
                          h.tsm_approved_status.trim() !== "" &&
                          h.tsm_approved_status.trim() !== "-" &&
                          h.tsm_approved_status.toLowerCase() !== "pending",
                      ) &&
                        (() => {
                          const statuses = Array.from(
                            new Set(
                              item.relatedHistoryItems
                                .map((h) => h.tsm_approved_status?.trim().toLowerCase() ?? "")
                                .filter((v) => v && v !== "-" && v !== "pending"),
                            ),
                          );

                          if (statuses.length === 0) return null;

                          const isDeclined = statuses.some((s) => s === "decline");
                          const hoverText = isDeclined ? "Declined by TSM" : "Approved by TSM";

                          return (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Badge
                                  className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"
                                    }`}
                                >
                                  {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                </Badge>
                              </HoverCardTrigger>

                              <HoverCardContent
                                side="top"
                                align="center"
                                className="text-xs font-medium px-3 py-2 w-auto"
                              >
                                {hoverText}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })()}
                    </div>
                  </div>

                  <AccordionContent className="text-xs px-4 py-2 uppercase">
                    <p>
                      <strong>Contact Number:</strong> {item.contact_number || "-"}
                    </p>
                    <p>
                      <strong>Contact Person:</strong> {item.contact_person || "-"}
                    </p>
                    <p>
                      <strong>Email Address:</strong> {item.email_address || "-"}
                    </p>
                    <p>
                      <strong>Address:</strong> {item.address || "-"}
                    </p>

                    <Separator className="mb-2 mt-2" />

                    {item.relatedHistoryItems.length === 0 ? (
                      <p>No quotation or SO history available.</p>
                    ) : (
                      <>
                        {item.relatedHistoryItems.some(
                          (h) => h.ticket_reference_number && h.ticket_reference_number !== "-",
                        ) && (
                            <p>
                              <strong>Ticket Reference Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.ticket_reference_number ?? "-")
                                      .filter((v) => v !== "-"),
                                  ),
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.so_number && h.so_number !== "-",
                        ) && (
                            <p>
                              <strong>Sales Order Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.so_number ?? "-")
                                      .filter((v) => v !== "-"),
                                  ),
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.quotation_number && h.quotation_number !== "-",
                        ) && (
                            <p>
                              <strong>Quotation Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.quotation_number ?? "-")
                                      .filter((v) => v !== "-"),
                                  ),
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.call_type && h.call_type !== "-",
                        ) && (
                            <p>
                              <strong>Type:</strong>{" "}
                              <span className="uppercase">
                                {item.relatedHistoryItems
                                  .map((h) => h.call_type ?? "-")
                                  .filter((v) => v !== "-")
                                  .join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.source && h.source !== "-",
                        ) && (
                            <p>
                              <strong>Source:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.source ?? "-")
                                      .filter((v) => v !== "-"),
                                  ),
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.quotation_amount !== null && h.quotation_amount !== undefined,
                        ) && (
                            <p>
                              <strong>Total Quotation Amount:</strong>{" "}
                              {item.relatedHistoryItems
                                .reduce((total, h) => total + (h.quotation_amount ?? 0), 0)
                                .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.so_amount !== null && h.so_amount !== undefined,
                        ) && (
                            <p>
                              <strong>Total SO Amount:</strong>{" "}
                              {item.relatedHistoryItems
                                .reduce((total, h) => total + (h.so_amount ?? 0), 0)
                                .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                            </p>
                          )}

                        <Separator className="mb-2 mt-2" />

                        {item.relatedHistoryItems.some(
                          (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                        ) && (
                            <p>
                              <strong>TSM Feedback:</strong>{" "}
                              <span className="uppercase">
                                {item.relatedHistoryItems
                                  .map((h) => h.tsm_approved_status ?? "-")
                                  .filter((v) => v !== "-")
                                  .join(", ")}
                              </span>
                            </p>
                          )}
                      </>
                    )}

                    <p>
                      <strong>Date Scheduled:</strong>{" "}
                      {new Date(item.scheduled_date).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <Dot />
                      <span className="text-[10px]">{item.activity_reference_number}</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })
          )}
        </Accordion>
      </div>
      ) : (

      // ── Table View ──────────────────────────────────────────────────────────
      <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-xs min-w-[1800px]">
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="hover:bg-transparent border-b border-zinc-200">
                {[
                  "Act Ref #", "Company", "Contact Person", "Contact #", "Email", "Address",
                  "Type Client", "Status", "Scheduled Date", "Ticket Ref #", "Ticket Remarks",
                ].map((h) => (
                  <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap py-3 px-3">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-zinc-400">
                    No activities found.
                  </TableCell>
                </TableRow>
              ) : (
                displayedActivities.map((item) => {
                  const isReadOnly = (field: string) => READ_ONLY_FIELDS.includes(field);
                  const isEditing = (field: string) => editingCell?.id === item.id && editingCell?.field === field;

                  const renderCell = (field: string, value: string) => {
                    if (isReadOnly(field)) {
                      return (
                        <span className="font-bold text-zinc-700">{value || "-"}</span>
                      );
                    }
                    if (isEditing(field)) {
                      return (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-6 text-xs rounded-none px-1 py-0"
                            value={editCellValue}
                            onChange={(e) => setEditCellValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCellEdit();
                              if (e.key === "Escape") cancelCellEdit();
                            }}
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-none" onClick={saveCellEdit}>
                            <Check className="w-3 h-3 text-green-600" />
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <span
                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded-sm border border-transparent hover:border-blue-200 transition-colors"
                        onClick={() => startCellEdit(item.id, field, value)}
                        title="Click to edit"
                      >
                        {value || <span className="text-zinc-300 italic">—</span>}
                      </span>
                    );
                  };

                  return (
                    <TableRow key={item.id} className="hover:bg-zinc-50/50">
                      <TableCell className="px-3 font-mono text-[10px] text-zinc-500">
                        {item.activity_reference_number}
                      </TableCell>
                      <TableCell className="px-3 font-bold text-zinc-800 whitespace-nowrap">
                        {renderCell("company_name", item.company_name)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("contact_person", item.contact_person)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("contact_number", item.contact_number)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("email_address", item.email_address)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("address", item.address)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("type_client", item.type_client)}
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge
                          variant="outline"
                          className={`rounded-none text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${
                            item.status === "Delivered" || item.status === "Done" || item.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : item.status === "Quote-Done"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : item.status === "SO-Done"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : item.status === "Cancelled"
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : "bg-orange-50 text-orange-700 border-orange-100"
                          }`}
                        >
                          {item.status.replace("-", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 whitespace-nowrap font-mono text-[11px] text-zinc-500">
                        {new Date(item.scheduled_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("ticket_reference_number", item.ticket_reference_number)}
                      </TableCell>
                      <TableCell className="px-3">
                        {renderCell("ticket_remarks", item.ticket_remarks)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* ── Load More Button ─────────────────────────────────────────────── */}
      {hasMoreToLoad && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            className="rounded-none text-xs"
            disabled={activitiesLoading || historyLoading}
          >
            {activitiesLoading || historyLoading ? (
              <Spinner className="size-4 mr-2" />
            ) : null}
            Load More ({filteredActivities.length - displayCount} remaining)
          </Button>
        </div>
      )}

      <DoneDialog
        open={dialogDoneOpen}
        onOpenChange={setDialogDoneOpen}
        onConfirm={handleConfirmDone}
        loading={updatingId !== null}
      />

      <DeliveredDialog
        open={dialogDeliveredOpen}
        onOpenChange={setDialogDeliveredOpen}
        onConfirm={handleConfirmDelivered}
        loading={updatingId !== null}
      />

      <TransferDialog
        open={dialogTransferOpen}
        onOpenChange={setDialogTransferOpen}
        onConfirm={(selectedUser) => {
          handleConfirmTransfer(selectedUser?.ReferenceID);
          setDialogTransferOpen(false);
        }}
        loading={updatingId === selectedActivityId}
        ticketReferenceNumber={selectedTicketReferenceNumber}
        tsm={selectedActivity?.tsm}
        account_reference_number={selectedActivity?.account_reference_number}
      />

      <CancelledDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmCancelled}
        loading={updatingId !== null}
      />

      <Dialog open={dialogRescheduleOpen} onOpenChange={setDialogRescheduleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Activity</DialogTitle>
            <DialogDescription>
              Select a new date to reschedule this activity. Past dates are not allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reschedule-date" className="text-right">
                New Date
              </Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={toLocalDateString(new Date())}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogRescheduleOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReschedule}
              disabled={!rescheduleDate || updatingId !== null}
            >
              {updatingId !== null ? (
                <Spinner className="size-4 mr-2" />
              ) : null}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ──────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm rounded-none p-0 overflow-hidden gap-0">
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Settings
                </DialogTitle>
              </div>
              <p className="text-zinc-400 text-[11px] mt-1">
                Configure view and editing preferences.
              </p>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div className="space-y-3">
              <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">
                Layout Mode
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setViewMode("accordion"); setSettingsOpen(false); }}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-none transition-colors ${
                    viewMode === "accordion"
                      ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Accordion</span>
                </button>
                <button
                  onClick={() => { setViewMode("table"); setSettingsOpen(false); }}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-none transition-colors ${
                    viewMode === "table"
                      ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Table</span>
                </button>
              </div>
            </div>

            {viewMode === "table" && (
              <div className="bg-blue-50 border border-blue-100 p-3 space-y-1">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  Table Edit Mode
                </p>
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  Click any cell to edit it inline. <strong>Activity Reference #</strong> and <strong>Company Name</strong> are read-only. Press <kbd className="px-1 py-0.5 bg-blue-100 border border-blue-200 rounded text-[9px] font-mono">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-blue-100 border border-blue-200 rounded text-[9px] font-mono">Esc</kbd> to cancel.
                </p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            <Button
              variant="outline"
              className="rounded-none flex-1 text-xs h-10"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
