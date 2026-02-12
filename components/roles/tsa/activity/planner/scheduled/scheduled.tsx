"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import {
  CheckCircle2Icon, AlertCircleIcon, Clock, CheckCircle2, AlertCircle,
  PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp, Check, Repeat, MoreVertical, ThumbsDown, Dot
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { CreateActivityDialog } from "../dialog/create";
import { CancelledDialog } from "../dialog/cancelled";
import { DoneDialog } from "../dialog/done";
import { TransferDialog } from "../dialog/transfer";

import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator"

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
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDoneOpen, setDialogDoneOpen] = useState(false);

  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    try {
      const res = await fetch(
        `/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to fetch activities");
      }

      const json = await res.json();
      setActivities(json.data || []);
    } catch (error: any) {
      setErrorActivities(error.message || "Error fetching activities");
    } finally {
      setLoadingActivities(false);
    }
  }, [referenceid]);

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    if (!referenceid) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    setErrorHistory(null);

    try {
      const res = await fetch(
        `/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to fetch history");
      }

      const json = await res.json();
      setHistory(json.activities || []);
    } catch (error: any) {
      setErrorHistory(error.message || "Error fetching history");
    } finally {
      setLoadingHistory(false);
    }
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;

    // Initial fetches
    fetchActivities();
    fetchHistory();

    // Subscribe realtime for activities
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
        (payload) => {
          console.log("Activity realtime update:", payload);
          fetchActivities();
        }
      )
      .subscribe();

    // Subscribe realtime for history
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
        (payload) => {
          console.log("History realtime update:", payload);
          fetchHistory();
        }
      )
      .subscribe();

    // Cleanup subscriptions properly
    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);

      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchActivities, fetchHistory]);

  function isDelivered(status: string) {
    return ["Delivered", "Done", "Completed", "Cancelled", "On-Progress", "Transfer"].includes(status);
  }

  function getOverdueDays(scheduledDate: string): number {
    const sched = new Date(scheduledDate);
    const today = new Date();

    // reset time para date lang ang comparison
    sched.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - sched.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  const mergedActivities = activities
    .filter((a) => !isDelivered(a.status)) // Remove delivered/completed/cancelled
    .filter((a) => {
      // Remove Assisted activities that are overdue
      if (a.status === "Assisted") {
        const overdueDays = getOverdueDays(a.scheduled_date);
        return overdueDays === 0; // only keep if not overdue
      }
      return true; // keep other statuses
    })
    .map((activity) => {
      const relatedHistoryItems = history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number
      );

      const overdueDays = getOverdueDays(activity.scheduled_date);

      return {
        ...activity,
        relatedHistoryItems,
        overdueDays,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.scheduled_date).getTime() -
        new Date(a.scheduled_date).getTime()
    );

  const term = searchTerm.toLowerCase();

  const filteredActivities = mergedActivities
    // ❌ REMOVE scheduled_date filter dito, kaya wala na ito

    // 🔍 search filter
    .filter((item) => {
      const lowerTerm = term.toLowerCase();

      if (item.company_name?.toLowerCase().includes(lowerTerm)) return true;
      if (item.ticket_reference_number?.toLowerCase().includes(lowerTerm)) return true;

      if (
        item.relatedHistoryItems.some((h) =>
          h.quotation_number?.toLowerCase().includes(lowerTerm)
        )
      )
        return true;

      if (
        item.relatedHistoryItems.some((h) =>
          h.so_number?.toLowerCase().includes(lowerTerm)
        )
      )
        return true;

      return false;
    })

    // 🔽 sort newest first
    .sort(
      (a, b) =>
        new Date(b.date_updated).getTime() -
        new Date(a.date_updated).getTime()
    );

  const isLoading = loadingCompanies || loadingActivities || loadingHistory;
  const error = errorCompanies || errorActivities || errorHistory;

  const openCancelledDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
  };

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId) return;

    if (!cancellationRemarks) {
      toast.error("Cancellation remarks are required.");
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
        toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
        setUpdatingId(null);
        return;
      }

      await fetchActivities();
      window.location.reload();

      toast.success("Transaction marked as Cancelled.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  type BadgeVariant = "secondary" | "outline" | "destructive" | "default" | null | undefined;

  function getBadgeProps(status: string): { variant: BadgeVariant; className?: string } {
    switch (status) {
      case "Assisted":
      case "On-Progress":
        return { variant: "secondary", className: "bg-orange-500 text-white" };
      case "SO-Done":
        return { variant: "default", className: "bg-yellow-400 text-white" };
      case "Quote-Done":
        return { variant: "outline", className: "bg-blue-500 text-white" };
      case "Cancelled":
        return { variant: "destructive", className: "bg-red-600 text-white" };
      default:
        return { variant: "default" };
    }
  }

  const openDoneDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);
      setDialogDoneOpen(false);

      const res = await fetch("/api/act-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
        setUpdatingId(null);
        return;
      }

      await fetchActivities();

      toast.success("Transaction marked as Done.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const openTransferDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogTransferOpen(true);
  };

  const handleConfirmTransfer = async (selectedUserReferenceID: string | undefined) => {
    if (!selectedActivityId) return;
    if (!selectedUserReferenceID) {
      toast.error("Please select a user to transfer to.");
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
        toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
        setUpdatingId(null);
        return;
      }

      await fetchActivities();

      toast.success("Transaction marked as Transfer.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber = selectedActivity?.ticket_reference_number || null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
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
            <AlertTitle className="text-black">Add New Data</AlertTitle>
            <AlertDescription className="text-xs">
              You can start by adding new entries to populate your database.
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Input
          type="search"
          placeholder="Search company, ticket ref, quotation no, so no..."
          className="text-xs flex-grow"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search accounts"
        />

      </div>

      <div className="mb-4 text-xs font-bold">
        Total Follow Up: {filteredActivities.length}
      </div>
      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {filteredActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">
              No scheduled activities found.
            </p>
          ) : (
            filteredActivities.map((item) => {
              const badgeProps = getBadgeProps(item.status);

              return (
                <AccordionItem key={item.id} value={item.id} className="w-full border rounded-sm shadow-sm mt-2">
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
                          onCreated={() => {
                            fetchActivities();
                          }}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" className="cursor-pointer">
                              Actions <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={updatingId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDoneDialog(item.id);
                                }}
                              >
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                Mark as Done
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
                      {/* Status Badge */}
                      {!["assisted", "not assisted"].includes(item.status.toLowerCase()) && (
                        <Badge
                          variant={badgeProps.variant}
                          className={`font-mono text-[10px] ${badgeProps.className || ""}`}
                        >
                          <CheckCircle2 />
                          {item.status.replace("-", " ")} / {item.relatedHistoryItems.some(
                            (h) => h.quotation_status && h.quotation_status !== "-"
                          ) && (
                              <p>
                                <span className="uppercase">
                                  {Array.from(
                                    new Set(
                                      item.relatedHistoryItems
                                        .map((h) => h.quotation_status ?? "-")
                                        .filter((v) => v !== "-")
                                    )
                                  ).join(", ")}
                                </span>
                              </p>
                            )}
                        </Badge>
                      )}

                      {item.relatedHistoryItems.some((h: HistoryItem) =>
                        !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== ""
                      ) &&
                        Array.from(
                          new Set(
                            item.relatedHistoryItems
                              .map((h: HistoryItem) => h.type_activity?.trim() ?? "")
                              .filter((v) => v && v !== "-")
                          )
                        ).map((activity) => {
                          const getIcon = (act: string) => {
                            const lowerAct = act.toLowerCase();
                            if (lowerAct.includes("outbound") || lowerAct.includes("call")) {
                              return <PhoneOutgoing />;
                            }
                            if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) {
                              return <PackageCheck />;
                            }
                            if (lowerAct.includes("quotation") || lowerAct.includes("quote")) {
                              return <ReceiptText />;
                            }
                            return <Activity />;
                          };

                          return (
                            <Badge
                              key={activity}
                              variant="outline"
                              className="flex items-center justify-center w-8 h-8 p-0 text-[10px]"
                              title={activity.toUpperCase()}
                            >
                              {getIcon(activity)}
                            </Badge>
                          );
                        })
                      }

                      {item.overdueDays > 0 && (
                        <Badge className="font-mono text-[10px]">
                          <Clock /> {item.overdueDays} day{item.overdueDays > 1 ? "s" : ""} Ago.
                        </Badge>
                      )}

                      {item.relatedHistoryItems.some(
                        (h) =>
                          h.tsm_approved_status &&
                          h.tsm_approved_status !== "-" &&
                          h.tsm_approved_status.trim() !== ""
                      ) && (() => {
                        const statuses = Array.from(
                          new Set(
                            item.relatedHistoryItems
                              .map((h) => h.tsm_approved_status?.trim() ?? "")
                              .filter((v) => v && v !== "-")
                          )
                        );

                        const isDeclined = statuses.some(
                          (status) => status.toLowerCase() === "decline"
                        );

                        return (
                          <Badge
                            className={`font-mono text-[10px] flex items-center gap-1 ${isDeclined
                              ? "bg-red-600 text-white"
                              : "bg-blue-900 text-white"
                              }`}
                          >
                            {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}

                          </Badge>
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
                    {item.relatedHistoryItems.length === 0 ? (
                      <p>No quotation or SO history available.</p>
                    ) : (
                      <>
                        {item.relatedHistoryItems.some(
                          (h) => h.ticket_reference_number && h.ticket_reference_number !== "-"
                        ) && (
                            <p>
                              <strong>Ticket Reference Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.ticket_reference_number ?? "-")
                                      .filter((v) => v !== "-")
                                  )
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.so_number && h.so_number !== "-"
                        ) && (
                            <p>
                              <strong>Sales Order Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.so_number ?? "-")
                                      .filter((v) => v !== "-")
                                  )
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.quotation_number && h.quotation_number !== "-"
                        ) && (
                            <p>
                              <strong>Quotation Number:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.quotation_number ?? "-")
                                      .filter((v) => v !== "-")
                                  )
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {item.relatedHistoryItems.some(
                          (h) => h.call_type && h.call_type !== "-"
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
                          (h) => h.source && h.source !== "-"
                        ) && (
                            <p>
                              <strong>Source:</strong>{" "}
                              <span className="uppercase">
                                {Array.from(
                                  new Set(
                                    item.relatedHistoryItems
                                      .map((h) => h.source ?? "-")
                                      .filter((v) => v !== "-")
                                  )
                                ).join(", ")}
                              </span>
                            </p>
                          )}

                        {/* TOTAL Quotation Amount */}
                        {item.relatedHistoryItems.some(
                          (h) => h.quotation_amount !== null && h.quotation_amount !== undefined
                        ) && (
                            <p>
                              <strong>Total Quotation Amount:</strong>{" "}
                              {item.relatedHistoryItems
                                .reduce((total, h) => {
                                  return total + (h.quotation_amount ?? 0);
                                }, 0)
                                .toLocaleString("en-PH", {
                                  style: "currency",
                                  currency: "PHP",
                                })}
                            </p>
                          )}

                        {/* SO Number */}
                        {item.relatedHistoryItems.some(
                          (h) => h.so_number && h.so_number !== "-"
                        ) && (
                            <p>
                              <strong>SO Number:</strong>{" "}
                              <span className="uppercase">
                                {item.relatedHistoryItems
                                  .map((h) => h.so_number ?? "-")
                                  .filter((v) => v !== "-")
                                  .join(", ")}
                              </span>
                            </p>
                          )}

                        {/* TOTAL SO Amount */}
                        {item.relatedHistoryItems.some(
                          (h) => h.so_amount !== null && h.so_amount !== undefined
                        ) && (
                            <p>
                              <strong>Total SO Amount:</strong>{" "}
                              {item.relatedHistoryItems
                                .reduce((total, h) => {
                                  return total + (h.so_amount ?? 0);
                                }, 0)
                                .toLocaleString("en-PH", {
                                  style: "currency",
                                  currency: "PHP",
                                })}
                            </p>
                          )}

                        <Separator className="mb-2 mt-2" />
                        {item.relatedHistoryItems.some(
                          (h) => h.tsm_approved_status && h.tsm_approved_status !== "-"
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

      <DoneDialog
        open={dialogDoneOpen}
        onOpenChange={setDialogDoneOpen}
        onConfirm={handleConfirmDone}
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
