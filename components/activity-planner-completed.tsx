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
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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
  agent: string;
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
  type_activity: string;
  tsm_approved_status: string;
  actual_sales?: number | null; // I changed this to number type to be consistent with amounts
}

interface NewTaskProps {
  referenceid: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
}

export const Completed: React.FC<NewTaskProps> = ({
  referenceid,
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

  const [searchTerm, setSearchTerm] = useState("");

  // Fetch companies
  useEffect(() => {
    if (!referenceid) {
      setCompanies([]);
      return;
    }
    setLoadingCompanies(true);
    setErrorCompanies(null);

    fetch(`/api/com-fetch-companies`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch company data");
        return res.json();
      })
      .then((data) => {
        setCompanies(data.data || []);
      })
      .catch((err) => {
        setErrorCompanies(err.message || "Error fetching company data");
      })
      .finally(() => {
        setLoadingCompanies(false);
      });
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
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
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

  // Fetch history
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

  // Real-time subscriptions & initial fetch
  useEffect(() => {
    if (!referenceid) return;

    fetchActivities();
    fetchHistory();

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
        () => fetchActivities()
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
        () => fetchHistory()
      )
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);

      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchActivities, fetchHistory]);

  // Helper to filter dates by range
  const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
    if (!range) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const { from, to } = range;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  // Prepare and merge data
  const mergedData = activities
    .filter((a) => a.status === "Delivered")
    .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
    .filter((a) => !a.scheduled_date || a.scheduled_date === "")
    .map((activity) => {
      const company = companies.find(
        (c) => c.account_reference_number === activity.account_reference_number
      );

      const relatedHistoryItems = history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number
      );

      return {
        ...activity,
        company_name: company?.company_name ?? "Unknown Company",
        contact_number: company?.contact_number ?? "-",
        type_client: company?.type_client ?? "",
        contact_person: company?.contact_person ?? "",
        email_address: company?.email_address ?? "",
        address: company?.address ?? "",
        relatedHistoryItems,
      };
    })
    .sort(
      (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
    );

  // Filter based on search term
  const filteredData = mergedData.filter((item) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      item.company_name.toLowerCase().includes(lowerSearch) ||
      (item.ticket_reference_number?.toLowerCase().includes(lowerSearch) ?? false) ||
      item.relatedHistoryItems.some(
        (h) =>
          (h.quotation_number?.toLowerCase().includes(lowerSearch) ?? false) ||
          (h.so_number?.toLowerCase().includes(lowerSearch) ?? false)
      )
    );
  });

  const isLoading = loadingCompanies || loadingActivities || loadingHistory;
  const error = errorCompanies || errorActivities || errorHistory;

  // Loading UI
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  // Error UI
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

  // Main UI
  return (
    <>
      <Input
        type="search"
        placeholder="Search company, ticket ref, quotation no, so no..."
        className="text-xs flex-grow mb-3"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search accounts"
      />

      <div className="mb-2 text-xs font-bold">
        Total Completed Activities: {mergedData.length}
      </div>

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {filteredData.map((item) => {
            // Badge color logic based on status
            let badgeColor: "default" | "secondary" | "destructive" | "outline" =
              "default";

            if (item.status === "Assisted" || item.status === "SO-Done") {
              badgeColor = "secondary";
            } else if (item.status === "Quote-Done") {
              badgeColor = "outline";
            }

            return (
              <AccordionItem key={item.id} value={item.id}>
                <div className="p-2 select-none">
                  <div className="flex justify-between items-center">
                    <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
                      {item.company_name}
                    </AccordionTrigger>
                  </div>

                  <div className="ml-1 space-x-1">
                    <Badge variant={badgeColor} className="text-[8px]">
                      {item.status.replace("-", " ")}
                    </Badge>
                    {item.relatedHistoryItems.some(
                      (h: HistoryItem) =>
                        !!h.type_activity &&
                        h.type_activity !== "-" &&
                        h.type_activity.trim() !== ""
                    ) && (
                      <Badge variant="default" className="text-[8px]">
                        {item.relatedHistoryItems
                          .map((h: HistoryItem) => h.type_activity ?? "")
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

                      {item.relatedHistoryItems.some(
                        (h) => h.quotation_amount !== null && h.quotation_amount !== undefined
                      ) && (
                        <p>
                          <strong>Total Quotation Amount:</strong>{" "}
                          {item.relatedHistoryItems
                            .reduce((total, h) => total + (h.quotation_amount ?? 0), 0)
                            .toLocaleString("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            })}
                        </p>
                      )}

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

                      {item.relatedHistoryItems.some(
                        (h) => h.so_amount !== null && h.so_amount !== undefined
                      ) && (
                        <p>
                          <strong>Total SO Amount:</strong>{" "}
                          {item.relatedHistoryItems
                            .reduce((total, h) => total + (h.so_amount ?? 0), 0)
                            .toLocaleString("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            })}
                        </p>
                      )}

                      {item.relatedHistoryItems.some(
                        (h) => h.actual_sales !== null && h.actual_sales !== undefined
                      ) && (
                        <p>
                          <strong>Total Sales Invoice:</strong>{" "}
                          {item.relatedHistoryItems
                            .reduce((total, h) => total + (h.actual_sales ?? 0), 0)
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
                    <strong>Date Created:</strong>{" "}
                    {new Date(item.date_created).toLocaleDateString()}
                  </p>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </>
  );
};
