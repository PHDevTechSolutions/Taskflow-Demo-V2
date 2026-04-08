"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, Clock, CheckCircle2, AlertCircle, PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp, Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter, Lock, } from "lucide-react";
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
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return ""; // ← dito nasosolve — kung null o undefined, ibalik na lang ""
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return ""; // ← pati invalid date strings
  return d.toLocaleDateString("en-CA");
}

export const Scheduled: React.FC<ScheduledProps> = ({
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

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const fetchAllData = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      setHistory([]);
      return;
    }

    setActivitiesLoading(true);
    setHistoryLoading(true);
    setError(null);

    // NOTE: We intentionally do NOT send the date range to the API here so
    // that we always get the full dataset and apply scheduled_date filtering
    // on the client side (see filteredActivities below).
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

  function isDelivered(status: string) {
    return [
      "Delivered",
      "Done",
      "Completed",
      "Cancelled",
      "On-Progress",
      "Transfer",
      "Pending"
    ].includes(status);
  }

  const mergedActivities = activities
    .filter((a) => !isDelivered(a.status))
    .map((activity) => {
      const relatedHistoryItems = history.filter(
        (h) =>
          h.activity_reference_number === activity.activity_reference_number,
      );
      return { ...activity, relatedHistoryItems };
    });

  const todayStr = toLocalDateString(new Date());

  const filteredActivities = useMemo(() => {
    return mergedActivities
      .filter((item) => {
        const itemScheduledDate = toLocalDateString(item.scheduled_date);

        // ── Date range filter (for scheduled_date, future dates only) ─────────
        if (dateCreatedFilterRange?.from) {
          const fromDate = toLocalDateString(dateCreatedFilterRange.from);
          const toDate = dateCreatedFilterRange.to
            ? toLocalDateString(dateCreatedFilterRange.to)
            : fromDate;

          // Only allow future dates (today onwards)
          if (itemScheduledDate < todayStr) {
            return false;
          }

          // Check if within selected date range
          if (itemScheduledDate < fromDate || itemScheduledDate > toDate) {
            return false;
          }
        } else {
          // ✅ DEFAULT: Show today only when no date range selected
          if (itemScheduledDate !== todayStr) {
            return false;
          }
        }

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
  }, [mergedActivities, dateCreatedFilterRange, todayStr, statusFilter, searchTerm]);

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities]);

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

  function getBadgeProps(status: string, isFutureDate: boolean): {
    variant: BadgeVariant;
    className?: string;
  } {
    switch (status) {
      case "Assisted":
      case "On-Progress":
        return { variant: "secondary", className: "bg-orange-500 text-white" };
      case "SO-Done":
        return { variant: "default", className: "bg-yellow-400 text-white" };
      case "Quote-Done":
        return { variant: "outline", className: isFutureDate ? "bg-blue-800 text-white" : "bg-blue-500 text-white" };
      case "Cancelled":
        return { variant: "destructive", className: "bg-red-600 text-white" };
      default:
        return { variant: "default" };
    }
  }

  function getStatusStyles(status: string, isFutureDate: boolean): {
    badgeClass?: string;
    bgClass?: string;
  } {
    switch (status) {
      case "Assisted":
      case "On-Progress":
        return {
          badgeClass: "bg-orange-500 text-white",
          bgClass: "bg-orange-100",
        };
      case "SO-Done":
        return {
          badgeClass: "bg-yellow-400 text-white",
          bgClass: "bg-yellow-100",
        };
      case "Quote-Done":
        return { badgeClass: isFutureDate ? "bg-blue-800 text-white" : "bg-blue-500 text-white", bgClass: "bg-blue-100" };
      case "Cancelled":
        return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
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

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber =
    selectedActivity?.ticket_reference_number || null;


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

  // ─── Label shown beside the list to inform the user which date is active ──
  const activeDateLabel = (() => {
    if (dateCreatedFilterRange?.from) {
      const from = toLocalDateString(dateCreatedFilterRange.from);
      const to = dateCreatedFilterRange.to
        ? toLocalDateString(dateCreatedFilterRange.to)
        : from;
      return from === to
        ? `Scheduled: ${from}`
        : `Scheduled: ${from} → ${to}`;
    }
    return `Scheduled today: ${todayStr}`;
  })();

  return (
    <>
      <div className="flex items-center gap-2">
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

              {Array.from(new Set(filteredActivities.map((a) => a.status))).map(
                (status) => {
                  const { badgeClass } = getStatusStyles(status, false);
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
                },
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active date indicator */}
      <p className="text-[10px] text-muted-foreground mb-1 px-1">
        {activeDateLabel}
      </p>

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {filteredActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">
              No scheduled activities found.
            </p>
          ) : (
            filteredActivities.map((item) => {
              const today = toLocalDateString(new Date());
              const itemDate = toLocalDateString(item.scheduled_date);
              const isFutureDate = itemDate > today;
              const badgeProps = getBadgeProps(item.status, isFutureDate);
              const statusStyles = getStatusStyles(item.status, isFutureDate);

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
                            activityReferenceNumber={
                              item.activity_reference_number
                            }
                            ticket_reference_number={
                              item.ticket_reference_number
                            }
                            agent={item.agent}
                            company_name={item.company_name}
                            contact_person={item.contact_person}
                            address={item.address}
                            accountReferenceNumber={
                              item.account_reference_number
                            }
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
                              .map(
                                (h: HistoryItem) =>
                                  h.type_activity?.trim() ?? "",
                              )
                              .filter((v) => v && v !== "-"),
                          ),
                        ).map((activity) => {
                          const getIcon = (act: string) => {
                            const lowerAct = act.toLowerCase();
                            if (
                              lowerAct.includes("outbound") ||
                              lowerAct.includes("call")
                            ) {
                              return <PhoneOutgoing size={14} />;
                            }
                            if (
                              lowerAct.includes("sales order") ||
                              lowerAct.includes("so prep")
                            ) {
                              return <PackageCheck size={14} />;
                            }
                            if (
                              lowerAct.includes("quotation") ||
                              lowerAct.includes("quote")
                            ) {
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
                                .map(
                                  (h) =>
                                    h.tsm_approved_status
                                      ?.trim()
                                      .toLowerCase() ?? "",
                                )
                                .filter(
                                  (v) => v && v !== "-" && v !== "pending",
                                ),
                            ),
                          );

                          if (statuses.length === 0) return null;

                          const isDeclined = statuses.some(
                            (status) => status === "decline",
                          );

                          const hoverText = isDeclined
                            ? "Declined by TSM"
                            : "Approved by TSM";

                          return (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Badge
                                  className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"
                                    }`}
                                >
                                  {isDeclined ? (
                                    <ThumbsDown size={12} />
                                  ) : (
                                    <ThumbsUp size={12} />
                                  )}
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
                      <strong>Contact Number:</strong>{" "}
                      {item.contact_number || "-"}
                    </p>
                    <p>
                      <strong>Contact Person:</strong>{" "}
                      {item.contact_person || "-"}
                    </p>
                    <p>
                      <strong>Email Address:</strong>{" "}
                      {item.email_address || "-"}
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
                          (h) =>
                            h.ticket_reference_number &&
                            h.ticket_reference_number !== "-",
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
                          (h) =>
                            h.quotation_number && h.quotation_number !== "-",
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
                          (h) =>
                            h.quotation_amount !== null &&
                            h.quotation_amount !== undefined,
                        ) && (
                            <p>
                              <strong>Total Quotation Amount:</strong>{" "}
                              {item.relatedHistoryItems
                                .reduce((total, h) => total + (h.quotation_amount ?? 0), 0)
                                .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.so_number && h.so_number !== "-",
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
                          (h) =>
                            h.tsm_approved_status &&
                            h.tsm_approved_status !== "-",
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
                      <span className="text-[10px]">
                        {item.activity_reference_number}
                      </span>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })
          )}
        </Accordion>
      </div>

      <DoneDialog
        open={dialogDoneOpen}
        onOpenChange={setDialogDoneOpen}
        onConfirm={handleConfirmDone}
        loading={updatingId !== null}
      />

      {/* ✅ FIXED: was incorrectly using dialogDoneOpen instead of dialogDeliveredOpen */}
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
    </>
  );
};
