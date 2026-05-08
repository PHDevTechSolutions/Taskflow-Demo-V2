"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  CheckCircle2Icon, AlertCircleIcon, CheckCircle2, AlertCircle,
  PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp,
  Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter,
  LoaderPinwheel, MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

// ─── Interfaces (unchanged) ───────────────────────────────────────────────────
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

interface ScheduledProps {
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
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
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

const ALLOWED_STATUSES = ["Assisted", "Quote-Done"];

export const Overdue: React.FC<ScheduledProps> = ({
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
  // ─── Accumulated data ─────────────────────────────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ─── Pagination state ─────────────────────────────────────────────────────
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ─── Loading states ───────────────────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ─── Dialog states ────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDoneOpen, setDialogDoneOpen] = useState(false);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // ─── Search & filter ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);

  const todayStr = toLocalDateString(new Date());

  // ─── Build fetch URL ──────────────────────────────────────────────────────
  const buildUrl = useCallback(
    (offset: number) => {
      const url = new URL(
        "/api/activity/tsa/planner/fetch-overdue",
        window.location.origin,
      );
      url.searchParams.append("referenceid", referenceid);
      url.searchParams.append("offset", String(offset));

      if (dateCreatedFilterRange?.from) {
        const fromStr = toLocalDateString(dateCreatedFilterRange.from);
        url.searchParams.append("from", fromStr);
        url.searchParams.append(
          "to",
          dateCreatedFilterRange.to
            ? toLocalDateString(dateCreatedFilterRange.to)
            : fromStr,
        );
      }

      return url.toString();
    },
    [referenceid, dateCreatedFilterRange],
  );

  // ─── Initial load / reset ─────────────────────────────────────────────────
  const fetchInitial = useCallback(() => {
    if (!referenceid) return;

    setInitialLoading(true);
    setError(null);
    setActivities([]);
    setHistory([]);
    setNextOffset(0);
    setHasMore(false);

    fetch(buildUrl(0))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities ?? []);
        setHistory(data.history ?? []);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setInitialLoading(false));
  }, [referenceid, buildUrl]);

  // ─── Load More — fetches next page and APPENDS ────────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    fetch(buildUrl(nextOffset))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setActivities((prev) => [...prev, ...(data.activities ?? [])]);
        setHistory((prev) => [...prev, ...(data.history ?? [])]);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? nextOffset + (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextOffset, buildUrl]);

  // ─── Ref for realtime ─────────────────────────────────────────────────────
  const fetchInitialRef = useRef(fetchInitial);
  useEffect(() => { fetchInitialRef.current = fetchInitial; }, [fetchInitial]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) return;

    fetchInitialRef.current();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity", filter: `referenceid=eq.${referenceid}` },
        () => fetchInitialRef.current())
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        () => fetchInitialRef.current())
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);
      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid]);

  // ─── Re-fetch on date filter change ──────────────────────────────────────
  useEffect(() => {
    if (referenceid) fetchInitial();
  }, [dateCreatedFilterRange, referenceid]); // eslint-disable-line

  // ─── Merge + filter (client-side: overdue date + search + status) ─────────
  const mergedActivities = activities
    .filter((a) => ALLOWED_STATUSES.includes(a.status))
    .map((activity) => ({
      ...activity,
      relatedHistoryItems: history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number,
      ),
    }));

  const filteredActivities = mergedActivities
    .filter((item) => {
      const itemScheduledDate = toLocalDateString(item.scheduled_date);

      // Only past dates (overdue)
      if (itemScheduledDate >= todayStr) return false;

      if (searchTerm.trim() !== "") {
        // Skip date filter when searching
      } else {
        if (dateCreatedFilterRange?.from) {
          const fromStr = toLocalDateString(dateCreatedFilterRange.from);
          const toStr = dateCreatedFilterRange.to
            ? toLocalDateString(dateCreatedFilterRange.to)
            : fromStr;
          if (itemScheduledDate < fromStr || itemScheduledDate > toStr) return false;
        }
      }

      if (statusFilter !== "All" && item.status !== statusFilter) return false;

      if (searchTerm.trim() !== "") {
        const termLower = searchTerm.toLowerCase();
        const activityValues = Object.values(item).map((v) => v != null ? v.toString() : "").join(" ").toLowerCase();
        if (activityValues.includes(termLower)) return true;
        const historyValues = item.relatedHistoryItems.map((h) => Object.values(h).map((v) => v != null ? v.toString() : "").join(" ").toLowerCase()).join(" ");
        if (historyValues.includes(termLower)) return true;
        return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities.length]); // eslint-disable-line

  // ─── Style helpers (unchanged) ────────────────────────────────────────────
  type BadgeVariant = "secondary" | "outline" | "destructive" | "default" | null | undefined;
  function getBadgeProps(status: string): { variant: BadgeVariant; className?: string } {
    switch (status) {
      case "Assisted": case "On-Progress": return { variant: "secondary", className: "bg-orange-500 text-white" };
      case "SO-Done": return { variant: "default", className: "bg-yellow-400 text-white" };
      case "Quote-Done": return { variant: "outline", className: "bg-blue-500 text-white" };
      case "Cancelled": return { variant: "destructive", className: "bg-red-600 text-white" };
      default: return { variant: "default" };
    }
  }
  function getStatusStyles(status: string): { badgeClass?: string; bgClass?: string } {
    switch (status) {
      case "Assisted": case "On-Progress": return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
      case "SO-Done": return { badgeClass: "bg-yellow-400 text-white", bgClass: "bg-yellow-100" };
      case "Quote-Done": return { badgeClass: "bg-blue-500 text-white", bgClass: "bg-blue-100" };
      case "Cancelled": return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
      default: return { badgeClass: "", bgClass: "bg-white" };
    }
  }

  // ─── Dialog handlers (unchanged) ─────────────────────────────────────────
  const openCancelledDialog = (id: string) => { setSelectedActivityId(id); setDialogOpen(true); };
  const openDoneDialog = (id: string) => { setSelectedActivityId(id); setDialogDoneOpen(true); };
  const openDeliveredDialog = (id: string) => { setSelectedActivityId(id); setDialogDeliveredOpen(true); };
  const openTransferDialog = (id: string) => { setSelectedActivityId(id); setDialogTransferOpen(true); };

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId || !cancellationRemarks) {
      sileo.error({ title: "Failed", description: "Cancellation remarks are required.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    try {
      setUpdatingId(selectedActivityId);
      setDialogOpen(false);
      const res = await fetch("/api/act-cancelled-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedActivityId, cancellation_remarks: cancellationRemarks }), cache: "no-store" });
      const result = await res.json();
      if (!res.ok) { sileo.error({ title: "Failed", description: `Failed to update status: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
      await fetchInitial();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Cancelled.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch { sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
    finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;
    try {
      setUpdatingId(selectedActivityId);
      const res = await fetch("/api/act-update-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedActivityId }), cache: "no-store" });
      const result = await res.json();
      if (!res.ok) { sileo.error({ title: "Failed", description: `Failed to update status: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
      setDialogDoneOpen(false);
      await fetchInitial();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Done.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch { sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
    finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;
    try {
      setUpdatingId(selectedActivityId);
      const res = await fetch("/api/act-update-status-delivered", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedActivityId }), cache: "no-store" });
      const result = await res.json();
      if (!res.ok) { sileo.error({ title: "Failed", description: `Failed to update status: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
      setDialogDeliveredOpen(false);
      await fetchInitial();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Done.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch { sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
    finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const handleConfirmTransfer = async (selectedUserReferenceID: string | undefined) => {
    if (!selectedActivityId) return;
    if (!selectedUserReferenceID) { sileo.error({ title: "Failed", description: "Please select a user to transfer to.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
    try {
      setUpdatingId(selectedActivityId);
      setDialogTransferOpen(false);
      const res = await fetch("/api/act-transfer-ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedActivityId, newReferenceID: selectedUserReferenceID }), cache: "no-store" });
      const result = await res.json();
      if (!res.ok) { sileo.error({ title: "Failed", description: `Failed to update status: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
      await fetchInitial();
      sileo.success({ title: "Success", description: "Transaction marked as Transfer.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch { sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
    finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber = selectedActivity?.ticket_reference_number || null;

  if (error) {
    return (
      <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
        <div className="flex items-center space-x-3">
          <AlertCircleIcon className="h-6 w-6 text-red-600" />
          <div>
            <AlertTitle>No Data Found or No Network Connection</AlertTitle>
            <AlertDescription className="text-xs">Please check your internet connection or try again later.</AlertDescription>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <CheckCircle2Icon className="h-6 w-6 text-green-600" />
          <div>
            <AlertTitle className="text-black">Add New Data</AlertTitle>
            <AlertDescription className="text-xs">You can start by adding new entries to populate your database.</AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  const activeDateLabel = (() => {
    if (searchTerm.trim() !== "") return "Showing all (search active)";
    if (dateCreatedFilterRange?.from) {
      const from = toLocalDateString(dateCreatedFilterRange.from);
      const to = dateCreatedFilterRange.to ? toLocalDateString(dateCreatedFilterRange.to) : from;
      return from === to ? `Scheduled: ${from}` : `Scheduled: ${from} → ${to}`;
    }
    return `Scheduled today: ${todayStr}`;
  })();

  return (
    <>
      <div className="flex items-center gap-2 w-full">
        <Input
          type="search"
          placeholder="Search..."
          className="text-xs grow rounded-none mb-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search accounts"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="whitespace-nowrap rounded-none">
              {statusFilter === "All" ? <Filter /> : statusFilter} Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setStatusFilter("All")}>
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" /> All
            </DropdownMenuItem>
            {Array.from(new Set(filteredActivities.map((a) => a.status))).map((status) => {
              const { badgeClass } = getStatusStyles(status);
              return (
                <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                  <span className="capitalize">{status}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-[10px] text-muted-foreground mb-1 px-1">{activeDateLabel}</p>

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        {initialLoading ? (
          <div className="flex justify-center items-center h-40">
            <Spinner className="size-8" />
          </div>
        ) : (
          <>
            <Accordion type="single" collapsible className="w-full">
              {filteredActivities.length === 0 ? (
                <p className="text-muted-foreground text-xs px-2">No scheduled activities found.</p>
              ) : (
                filteredActivities.map((item) => {
                  const badgeProps = getBadgeProps(item.status);
                  const statusStyles = getStatusStyles(item.status);

                  return (
                    <AccordionItem key={item.id} value={item.id} className={`w-full border rounded-none shadow-sm mt-2 ${statusStyles.bgClass}`}>
                      <div className="p-2 select-none">
                        <div className="flex justify-between items-center">
                          <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
                            {item.company_name}
                          </AccordionTrigger>

                          <div className="flex gap-2 ml-4">
                            <CreateActivityDialog
                              firstname={firstname} lastname={lastname} target_quota={target_quota} email={email} contact={contact}
                              tsmname={tsmname} managername={managername} referenceid={item.referenceid} tsm={item.tsm} manager={item.manager}
                              type_client={item.type_client} contact_number={item.contact_number} email_address={item.email_address}
                              activityReferenceNumber={item.activity_reference_number} ticket_reference_number={item.ticket_reference_number}
                              agent={item.agent} company_name={item.company_name} contact_person={item.contact_person} address={item.address}
                              accountReferenceNumber={item.account_reference_number} onCreated={fetchInitial}
                              managerDetails={managerDetails ?? null} tsmDetails={tsmDetails ?? null} signature={signature}
                            />

                            {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (() => {
                              const feedbackItems = item.relatedHistoryItems.filter((h) => h.tsm_approved_status && h.tsm_approved_status !== "-");
                              return (
                                <Popover open={tsmFeedbackOpen === item.id} onOpenChange={(open) => setTsmFeedbackOpen(open ? item.id : null)}>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 relative" title="TSM Feedback">
                                      <MessageSquare className="h-3 w-3" />
                                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">{feedbackItems.length}</Badge>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 rounded-none">
                                    <div className="space-y-2">
                                      <p className="text-xs font-bold uppercase text-gray-700">TSM Feedback</p>
                                      <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
                                        {feedbackItems.map((h, idx) => (
                                          <div key={idx} className="border-b pb-2 last:border-0">
                                            <div className="font-semibold text-blue-600 uppercase py-1">{h.tsm_approved_status}</div>
                                            <div className="space-y-1 text-gray-600">
                                              {h.type_activity && h.type_activity !== "-" && <div><span className="font-medium">Type:</span> {h.type_activity}</div>}
                                              {h.quotation_number && h.quotation_number !== "-" && <div><span className="font-medium">Quotation #:</span> {h.quotation_number}</div>}
                                              {h.so_number && h.so_number !== "-" && <div><span className="font-medium">SO #:</span> {h.so_number}</div>}
                                              {h.call_type && h.call_type !== "-" && <div><span className="font-medium">Call Type:</span> {h.call_type}</div>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button className="cursor-pointer rounded-none">Actions <MoreVertical /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuGroup>
                                  <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openDeliveredDialog(item.id); }}>
                                    <Check className="mr-2 h-4 w-4 text-green-600" /> Mark as Completed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openCancelledDialog(item.id); }}>
                                    <AlertCircle className="mr-2 h-4 w-4 text-red-600" /> Cancel
                                  </DropdownMenuItem>
                                  {item.ticket_remarks === "Reassigned" && (
                                    <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openTransferDialog(item.id); }}>
                                      <Repeat className="mr-2 h-4 w-4 text-blue-600" /> Transfer
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="ml-1 flex flex-wrap gap-1 uppercase">
                          {!["assisted", "not assisted"].includes(item.status.toLowerCase()) && (
                            <Badge variant={badgeProps.variant} className={`font-mono rounded-sm shadow-md p-2 border-none text-[10px] ${badgeProps.className || ""}`}>
                              <CheckCircle2 />
                              {item.status.replace("-", " ")} /{" "}
                              {item.relatedHistoryItems.some((h) => h.quotation_status && h.quotation_status !== "-") && (
                                <p><span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_status ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                              )}
                            </Badge>
                          )}

                          {item.relatedHistoryItems.some((h) => !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== "") &&
                            Array.from(new Set(item.relatedHistoryItems.map((h) => h.type_activity?.trim() ?? "").filter((v) => v && v !== "-"))).map((activity) => {
                              const getIcon = (act: string) => {
                                const lowerAct = act.toLowerCase();
                                if (lowerAct.includes("outbound") || lowerAct.includes("call")) return <PhoneOutgoing size={14} />;
                                if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) return <PackageCheck size={14} />;
                                if (lowerAct.includes("quotation") || lowerAct.includes("quote")) return <ReceiptText size={14} />;
                                return <Activity size={14} />;
                              };
                              return (
                                <HoverCard key={activity}>
                                  <HoverCardTrigger asChild>
                                    <Badge variant="outline" className="flex items-center justify-center w-8 h-8 p-0 cursor-default">{getIcon(activity)}</Badge>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">{activity.toUpperCase()}</HoverCardContent>
                                </HoverCard>
                              );
                            })}

                          {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status.trim() !== "" && h.tsm_approved_status.trim() !== "-" && h.tsm_approved_status.toLowerCase() !== "pending") && (() => {
                            const statuses = Array.from(new Set(item.relatedHistoryItems.map((h) => h.tsm_approved_status?.trim().toLowerCase() ?? "").filter((v) => v && v !== "-" && v !== "pending")));
                            if (statuses.length === 0) return null;
                            const isDeclined = statuses.some((s) => s === "decline");
                            return (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Badge className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"}`}>
                                    {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">{isDeclined ? "Declined by TSM" : "Approved by TSM"}</HoverCardContent>
                              </HoverCard>
                            );
                          })()}
                        </div>
                      </div>

                      <AccordionContent className="text-xs px-4 py-2 uppercase">
                        <p><strong>Contact Number:</strong> {item.contact_number || "-"}</p>
                        <p><strong>Contact Person:</strong> {item.contact_person || "-"}</p>
                        <p><strong>Email Address:</strong> {item.email_address || "-"}</p>
                        <p><strong>Address:</strong> {item.address || "-"}</p>
                        <Separator className="mb-2 mt-2" />
                        {item.relatedHistoryItems.length === 0 ? <p>No quotation or SO history available.</p> : (
                          <>
                            {item.relatedHistoryItems.some((h) => h.ticket_reference_number && h.ticket_reference_number !== "-") && (
                              <p><strong>Ticket Reference Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                              <p><strong>Sales Order Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                              <p><strong>Quotation Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                              <p><strong>Type:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                              <p><strong>Source:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.quotation_amount !== null && h.quotation_amount !== undefined) && (
                              <p><strong>Total Quotation Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.quotation_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.so_amount !== null && h.so_amount !== undefined) && (
                              <p><strong>Total SO Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.so_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                            )}
                            <Separator className="mb-2 mt-2" />
                            {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                              <p><strong>TSM Feedback:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                            )}
                          </>
                        )}
                        <p><strong>Date Scheduled:</strong> {new Date(item.scheduled_date).toLocaleDateString()}</p>
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

            {/* ─── Load More: fetches next 10 from server ─── */}
            {hasMore && (
              <div className="flex justify-center py-4 mt-4">
                <Button variant="outline" className="rounded-none text-xs" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <LoaderPinwheel className="animate-spin h-3 w-3" /> Loading...
                    </span>
                  ) : (
                    `Load More (${50 - nextOffset} remaining of 50 max)`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <DoneDialog open={dialogDoneOpen} onOpenChange={setDialogDoneOpen} onConfirm={handleConfirmDone} loading={updatingId !== null} />
      <DeliveredDialog open={dialogDeliveredOpen} onOpenChange={setDialogDeliveredOpen} onConfirm={handleConfirmDelivered} loading={updatingId !== null} />
      <TransferDialog open={dialogTransferOpen} onOpenChange={setDialogTransferOpen}
        onConfirm={(selectedUser) => { handleConfirmTransfer(selectedUser?.ReferenceID); setDialogTransferOpen(false); }}
        loading={updatingId === selectedActivityId} ticketReferenceNumber={selectedTicketReferenceNumber}
        tsm={selectedActivity?.tsm} account_reference_number={selectedActivity?.account_reference_number}
      />
      <CancelledDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={handleConfirmCancelled} loading={updatingId !== null} />
    </>
  );
};