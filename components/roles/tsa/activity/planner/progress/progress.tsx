"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2Icon,
  Trash,
  Check,
  LoaderPinwheel,
  PhoneOutgoing,
  PackageCheck,
  ReceiptText,
  Activity,
  MoreVertical,
  Lock,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { sileo } from "sileo";
import { supabase } from "@/utils/supabase";
import { DeleteDialog } from "./dialog/delete";
import { DoneDialog } from "../dialog/done";
import { CreateActivityDialog } from "../dialog/create";
import { DeliveredDialog } from "../dialog/delivered";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
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
  agent: string;
  status: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;

  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
  signature: string | null;
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
  type_activity: string;
  tsm_approved_status: string;
  quotation_status: string;
  status?: string; // Added for delivery/completion check
}

interface NewTaskProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
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

export const Progress: React.FC<NewTaskProps> = ({
  referenceid,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- DELETE DIALOG STATE ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [errorHistory, setErrorHistory] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const PROGRESS_BATCH_SIZE = 20;
  const [displayedProgressCount, setDisplayedProgressCount] = useState(PROGRESS_BATCH_SIZE);
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);

  const fetchAllData = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      setHistory([]);
      return;
    }

    setActivitiesLoading(true);
    setHistoryLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/planner/fetch",
      window.location.origin,
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

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
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    if (!referenceid) return;

    // Initial fetch
    fetchAllData();

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
          fetchAllData();
        },
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
          fetchAllData();
        },
      )
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);

      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchAllData]);

  const isDateInRange = (
    dateStr: string,
    range: DateRange | undefined,
  ): boolean => {
    if (!range) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const { from, to } = range;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const isToday = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Show all activities EXCEPT:
  // - Quote-Done with today's scheduled date (goes to Scheduled card)
  // - Completed and Delivered (finished activities)
  const mergedData = activities
    .filter((a) => {
      // Exclude Completed and Delivered statuses
      if (a.status === "Completed" || a.status === "Delivered") {
        return false;
      }
      // Exclude Quote-Done status with today's scheduled date (goes to Scheduled)
      if (a.status === "Quote-Done" && a.scheduled_date && isToday(a.scheduled_date)) {
        return false;
      }
      return true;
    })
    .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
    .map((activity) => {
      const relatedHistoryItems = history.filter(
        (h) =>
          h.activity_reference_number === activity.activity_reference_number,
      );

      return {
        ...activity,
        relatedHistoryItems,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime(),
    );

  const filteredData = mergedData.filter((item) => {
    // Status filter
    if (statusFilter !== "all" && item.status !== statusFilter) {
      return false;
    }
    // Search filter
    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) return true;
    return (
      (item.company_name?.toLowerCase() ?? "").includes(lowerSearch) ||
      (item.ticket_reference_number?.toLowerCase().includes(lowerSearch) ??
        false) ||
      item.relatedHistoryItems.some(
        (h) =>
          (h.quotation_number?.toLowerCase().includes(lowerSearch) ?? false) ||
          (h.so_number?.toLowerCase().includes(lowerSearch) ?? false),
      )
    );
  });

  // Paginated data for lazy loading
  const displayedProgressData = filteredData.slice(0, displayedProgressCount);
  const hasMoreProgress = filteredData.length > displayedProgressCount;

  // Reset pagination when search or filter changes
  useEffect(() => {
    setDisplayedProgressCount(PROGRESS_BATCH_SIZE);
  }, [searchTerm, statusFilter]);

  const openDoneDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
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
        toast.error(
          `Failed to update status: ${result.error || "Unknown error"}`,
        );
        setUpdatingId(null);
        return;
      }

      setDialogOpen(false);
      await fetchAllData();
      window.location.reload();

      toast.success("Transaction marked as Done.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  useEffect(() => {
    onCountChange?.(filteredData.length);
  }, [filteredData.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  const openDeleteDialog = (id: string) => {
    setSelectedDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDeleteId) return;

    try {
      setUpdatingId(selectedDeleteId);
      setDeleteDialogOpen(false);

      // Call your bulk delete API
      const res = await fetch("/api/activity/tsa/planner/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [Number(selectedDeleteId)] }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Delete failed");
      }

      await fetchAllData();
      toast.success("Activity deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "An error occurred while deleting.");
    } finally {
      setUpdatingId(null);
      setSelectedDeleteId(null);
    }
  };

  const openDeliveredDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogDeliveredOpen(true);
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

  return (
    <>
      <div className="flex gap-2 mb-2">
        <Input
          type="search"
          placeholder="Search..."
          className="text-xs grow rounded-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search accounts"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] text-xs rounded-none">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Assisted">Assisted</SelectItem>
            <SelectItem value="On-Progress">On-Progress</SelectItem>
            <SelectItem value="SO-Done">SO-Done</SelectItem>
            <SelectItem value="Quote-Done">Quote-Done</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {displayedProgressData.map((item) => {
            // Define bg colors base sa status
            let badgeClass = "bg-gray-200 text-gray-800"; // default light gray
            let cardBgClass = "bg-gray-100"; // default light background

            if (item.status === "Assisted" || item.status === "On-Progress") {
              badgeClass = "bg-orange-400 text-white";
              cardBgClass = "bg-orange-100";
            } else if (item.status === "SO-Done") {
              badgeClass = "bg-yellow-400 text-black";
              cardBgClass = "bg-yellow-100";
            } else if (item.status === "Quote-Done") {
              badgeClass = "bg-blue-500 text-white";
              cardBgClass = "bg-blue-100";
            } else if (item.status === "Pending") {
              badgeClass = "bg-purple-500 text-white";
              cardBgClass = "bg-purple-100";
            } else if (item.status === "Cancelled") {
              badgeClass = "bg-red-600 text-white";
              cardBgClass = "bg-red-100";
            }

            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className={`w-full border rounded-none ${cardBgClass} shadow-sm mt-2`}
              >
                <div className="p-2 select-none">
                  <div className="flex justify-between items-center">
                    <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
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
                        ticket_reference_number={item.ticket_reference_number}
                        agent={item.agent}
                        company_name={item.company_name}
                        contact_person={item.contact_person}
                        address={item.address}
                        accountReferenceNumber={item.account_reference_number}
                        onCreated={() => {
                          fetchAllData();
                        }}
                        managerDetails={managerDetails ?? null}
                        tsmDetails={tsmDetails ?? null}
                        signature={signature}
                      />

                      {/* TSM Feedback Chat Icon */}
                      {item.relatedHistoryItems.some(
                        (h) =>
                          h.tsm_approved_status &&
                          h.tsm_approved_status !== "-",
                      ) && (() => {
                        const feedbackItems = item.relatedHistoryItems.filter(
                          (h) => h.tsm_approved_status && h.tsm_approved_status !== "-"
                        );

                        return (
                          <Popover open={tsmFeedbackOpen === item.id} onOpenChange={(open) => setTsmFeedbackOpen(open ? item.id : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 relative"
                                title="TSM Feedback"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <Badge
                                  variant="destructive"
                                  className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                                >
                                  {feedbackItems.length}
                                </Badge>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 rounded-none">
                              <div className="space-y-2">
                                <p className="text-xs font-bold uppercase text-gray-700">TSM Feedback</p>
                                <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
                                  {feedbackItems.map((h, idx) => (
                                    <div key={idx} className="border-b pb-2 last:border-0">
                                      <div className="font-semibold text-blue-600 uppercase py-1">
                                        {h.tsm_approved_status}
                                      </div>
                                      <div className="space-y-1 text-gray-600">
                                        {h.type_activity && h.type_activity !== "-" && (
                                          <div><span className="font-medium">Type:</span> {h.type_activity}</div>
                                        )}
                                        {h.quotation_number && h.quotation_number !== "-" && (
                                          <div><span className="font-medium">Quotation #:</span> {h.quotation_number}</div>
                                        )}
                                        {h.so_number && h.so_number !== "-" && (
                                          <div><span className="font-medium">SO #:</span> {h.so_number}</div>
                                        )}
                                        {h.call_type && h.call_type !== "-" && (
                                          <div><span className="font-medium">Call Type:</span> {h.call_type}</div>
                                        )}
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
                          <Button
                            type="button"
                            disabled={updatingId === item.id}
                            className="cursor-pointer rounded-none"
                          >
                            Actions <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {/*<DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openDoneDialog(item.id);
                            }}
                          >
                            <Check className="mr-2 text-red-500" /> Mark as
                            Pending
                          </DropdownMenuItem>*/}

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
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteDialog(item.id);
                            }}
                          >
                            <Trash className="mr-2 text-red-600" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="ml-1 flex flex-wrap gap-1 uppercase">
                    {/* MAIN STATUS BADGE */}
                    <Badge
                      className={`${badgeClass} rounded-sm shadow-md p-2 font-mono flex items-center gap-2 whitespace-nowrap text-[10px]`}
                    >
                      <LoaderPinwheel size={14} className="animate-spin" />
                      {item.status.replace("-", " ")}
                    </Badge>

                    {/* ACTIVITY ICON BADGES */}
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
                              (h: HistoryItem) => h.type_activity?.trim() ?? "",
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
                            return <PhoneOutgoing />;
                          }
                          if (
                            lowerAct.includes("sales order") ||
                            lowerAct.includes("so prep")
                          ) {
                            return <PackageCheck />;
                          }
                          if (
                            lowerAct.includes("quotation") ||
                            lowerAct.includes("quote")
                          ) {
                            return <ReceiptText />;
                          }
                          return <Activity />;
                        };

                        return (
                          <Badge
                            key={activity}
                            variant="outline"
                            className="flex items-center justify-center w-8 h-8 p-0"
                            title={activity.toUpperCase()}
                          >
                            {getIcon(activity)}
                          </Badge>
                        );
                      })}
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
                        (h) =>
                          h.ticket_reference_number &&
                          h.ticket_reference_number !== "-",
                      ) && (
                          <p>
                            <strong>Ticket Reference Number:</strong>{" "}
                            <span>
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
                        (h) => h.call_type && h.call_type !== "-",
                      ) && (
                          <p>
                            <strong>Type:</strong>{" "}
                            <span>
                              {item.relatedHistoryItems
                                .map((h) => h.call_type ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
                            </span>
                          </p>
                        )}

                      {item.relatedHistoryItems.some(
                        (h) => h.type_activity && h.type_activity !== "-",
                      ) && (
                          <p>
                            <strong>Type of Activity:</strong>{" "}
                            <span>
                              {Array.from(
                                new Set(
                                  item.relatedHistoryItems
                                    .map((h) => h.type_activity ?? "-")
                                    .filter((v) => v !== "-"),
                                ),
                              ).join(", ")}
                            </span>
                          </p>
                        )}

                      {item.relatedHistoryItems.some(
                        (h) => h.source && h.source !== "-",
                      ) && (
                          <p>
                            <strong>Source:</strong>{" "}
                            <span>
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

                      {/* Quotation Number */}
                      {item.relatedHistoryItems.some(
                        (h) => h.quotation_number && h.quotation_number !== "-",
                      ) && (
                          <p>
                            <strong>Quotation Number:</strong>{" "}
                            <span>
                              {item.relatedHistoryItems
                                .map((h) => h.quotation_number ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
                            </span>
                          </p>
                        )}

                      {/* TOTAL Quotation Amount */}
                      {item.relatedHistoryItems.some(
                        (h) =>
                          h.quotation_amount !== null &&
                          h.quotation_amount !== undefined,
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
                        (h) => h.so_number && h.so_number !== "-",
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
                        (h) =>
                          h.so_amount !== null && h.so_amount !== undefined,
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
                      {item.relatedHistoryItems.some(
                        (h) => h.call_status && h.call_status !== "-",
                      ) && (
                          <p>
                            <strong>Call Status:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems
                                .map((h) => h.call_status ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
                            </span>
                          </p>
                        )}
                    </>
                  )}

                  <p>
                    <strong>Date Created:</strong>{" "}
                    {new Date(item.date_created).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Date Updated:</strong>{" "}
                    {new Date(item.date_updated).toLocaleDateString()}
                  </p>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* ─── Lazy Loading: Load More Button ─── */}
        {hasMoreProgress && (
          <div className="flex justify-center py-4 mt-4">
            <Button
              variant="outline"
              className="rounded-none text-xs"
              onClick={() => setDisplayedProgressCount(prev => prev + PROGRESS_BATCH_SIZE)}
            >
              Load More ({filteredData.length - displayedProgressCount} remaining)
            </Button>
          </div>
        )}
      </div>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        loading={updatingId !== null}
        title="Delete Activity"
        description="Are you sure you want to delete this activity? This action cannot be undone."
      />

      <DeliveredDialog
        open={dialogDeliveredOpen}
        onOpenChange={setDialogDeliveredOpen}
        onConfirm={handleConfirmDelivered}
        loading={updatingId !== null}
      />

      <DoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDone}
        loading={updatingId !== null}
      />
    </>
  );
};
