"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreateActivityDialog } from "./activity-create-dialog";
import { DoneDialog } from "./activity-done-dialog";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";

interface Company {
  account_reference_number: string;
  company_name: string;
  contact_number?: string;
  type_client?: string;
  email_address?: string;
  address?: string;
  contact_person?: string;
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
  status: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;
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
}

interface ScheduledProps {
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
}

export const Scheduled: React.FC<ScheduledProps> = ({
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
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch companies
  useEffect(() => {
    if (!referenceid) {
      setCompanies([]);
      return;
    }
    setLoadingCompanies(true);
    setErrorCompanies(null);

    fetch(`/api/com-fetch-companies`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch companies");
        return res.json();
      })
      .then((data) => setCompanies(data.data || []))
      .catch((err) => setErrorCompanies(err.message))
      .finally(() => setLoadingCompanies(false));
  }, [referenceid]);

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

  const allowedStatuses = ["Assisted", "Quote-Done", "SO-Done", "Not Assisted"];

  function isScheduledToday(dateStr: string): boolean {
    const scheduledDate = new Date(dateStr);
    const today = new Date();

    return (
      scheduledDate.getFullYear() === today.getFullYear() &&
      scheduledDate.getMonth() === today.getMonth() &&
      scheduledDate.getDate() === today.getDate()
    );
  }

  const mergedActivities = activities
    .filter((a) => a.scheduled_date && a.scheduled_date.trim() !== "")
    .filter((a) => isScheduledToday(a.scheduled_date))
    .filter((a) => allowedStatuses.includes(a.status))
    .map((activity) => {
      const company = companies.find(
        (c) => c.account_reference_number === activity.account_reference_number
      );

      // All history related to this activity
      const relatedHistoryItems = history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number
      );

      return {
        ...activity,
        company_name: company?.company_name ?? "Unknown Company",
        contact_number: company?.contact_number ?? "-",
        type_client: company?.type_client ?? "",
        email_address: company?.email_address ?? "",
        contact_person: company?.contact_person ?? "",
        address: company?.address ?? "",
        relatedHistoryItems, // pass all related histories here
      };
    })
    .sort(
      (a, b) =>
        new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
    );

  const term = searchTerm.toLowerCase();

  const filteredActivities = mergedActivities.filter((item) => {
    // Check company_name safely
    if (item.company_name?.toLowerCase().includes(term)) return true;

    // Check ticket_reference_number safely
    if (item.ticket_reference_number?.toLowerCase().includes(term)) return true;

    // Check quotation_number(s) inside relatedHistoryItems safely
    if (
      item.relatedHistoryItems.some((h) =>
        h.quotation_number?.toLowerCase().includes(term)
      )
    )
      return true;

    // Check so_number(s) inside relatedHistoryItems safely
    if (
      item.relatedHistoryItems.some((h) =>
        h.so_number?.toLowerCase().includes(term)
      )
    )
      return true;

    return false;
  });

  const isLoading = loadingCompanies || loadingActivities || loadingHistory;
  const error = errorCompanies || errorActivities || errorHistory;

  const openDoneDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);
      setDialogOpen(false);

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
            filteredActivities.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
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
                        company_name={item.company_name}
                        contact_person={item.contact_person}
                        address={item.address}
                        accountReferenceNumber={item.account_reference_number}
                        onCreated={() => {
                          fetchActivities();
                        }}
                      />
                      <Button
                        type="button"
                        className="cursor-pointer"
                        variant="secondary"
                        disabled={updatingId === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDoneDialog(item.id);
                        }}
                      >
                        {updatingId === item.id ? "Updating..." : "Done"}
                      </Button>
                    </div>
                  </div>

                  <div className="ml-1 flex flex-wrap gap-1">
                    {/* Status Badge */}
                    <Badge variant="default" className="text-[8px]">
                      {item.status.replace("-", " ")} | {(() => {
                        if (item.status === "SO-Done") return "Sales Order Preparation";
                        if (item.status === "Quote-Done") return "Quotation Preparation";
                        if (item.status === "Assisted") return "Outbound Calls";
                        if (item.status === "Not Assisted") return "Outbound Calls";
                        return item.status.replace("-", " ");
                      })()}
                    </Badge>

                    {/* SO Number Badge — only if there's at least one valid SO number */}
                    {item.relatedHistoryItems.some(
                      (h) => h.so_number && h.so_number !== "-" && h.so_number.trim() !== ""
                    ) && (
                        <Badge variant="default" className="text-[8px]">
                          <strong>SO:</strong>{" "}
                          {item.relatedHistoryItems
                            .map((h) => h.so_number ?? "")
                            .filter((v) => v && v !== "-")
                            .join(", ")
                            .toUpperCase()}
                        </Badge>
                      )}

                    {/* Quotation Number Badge — only if there's at least one valid Quotation number */}
                    {item.relatedHistoryItems.some(
                      (h) => h.quotation_number && h.quotation_number !== "-" && h.quotation_number.trim() !== ""
                    ) && (
                        <Badge variant="default" className="text-[8px]">
                          <strong>Quotation Number:</strong>{" "}
                          {item.relatedHistoryItems
                            .map((h) => h.quotation_number ?? "")
                            .filter((v) => v && v !== "-")
                            .join(", ")
                            .toUpperCase()}
                        </Badge>
                      )}
                  </div>
                </div>

                <AccordionContent className="text-xs px-4 py-2">
                  <p>
                    <strong>Contact Number:</strong> {item.contact_number || "-"}
                  </p>

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
                              {item.relatedHistoryItems
                                .map((h) => h.ticket_reference_number ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
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
                              {item.relatedHistoryItems
                                .map((h) => h.source ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
                            </span>
                          </p>
                        )}

                      {/* Quotation Number */}
                      {item.relatedHistoryItems.some(
                        (h) => h.quotation_number && h.quotation_number !== "-"
                      ) && (
                          <p>
                            <strong>Quotation Number:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems
                                .map((h) => h.quotation_number ?? "-")
                                .filter((v) => v !== "-")
                                .join(", ")}
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
                      {item.relatedHistoryItems.some(
                        (h) => h.call_status && h.call_status !== "-"
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
                </AccordionContent>



              </AccordionItem>
            ))
          )}
        </Accordion>
      </div>

      <DoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDone}
        loading={updatingId !== null}
      />
    </>
  );
};
