"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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

  const allowedStatuses = [
    "On-Progress",
    "Assisted",
    "SO-Done",
    "Pending",
    "Cancelled",
  ];

  const mergedData = activities
    .filter((a) => allowedStatuses.includes(a.status))
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
    const lowerSearch = searchTerm.toLowerCase();
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
      <Input
        type="search"
        placeholder="Search..."
        className="text-xs grow rounded-none mb-2"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search accounts"
      />

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {filteredData.map((item) => {
            // Define bg colors base sa status
            let badgeClass = "bg-gray-200 text-gray-800"; // default light gray

            if (item.status === "Assisted" || item.status === "On-Progress") {
              badgeClass = "bg-orange-400 text-white";
            } else if (item.status === "SO-Done") {
              badgeClass = "bg-yellow-400 text-black";
            } else if (item.status === "Quote-Done") {
              badgeClass = "bg-blue-500 text-white";
            } else if (item.status === "Cancelled") {
              badgeClass = "bg-red-600 text-white";
            }

            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="w-full border rounded-none bg-orange-100 shadow-sm mt-2"
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
