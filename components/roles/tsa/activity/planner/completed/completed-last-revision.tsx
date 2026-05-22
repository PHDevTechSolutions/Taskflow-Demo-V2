"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, Check, LoaderPinwheel, PhoneOutgoing, PackageCheck, ReceiptText, Activity, Lock, MessageSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HoverCard, HoverCardContent, HoverCardTrigger, } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/utils/supabase";
import { CreateActivityDialog } from "../dialog/create";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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

export const Completed: React.FC<NewTaskProps> = ({
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
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);
  const COMPLETED_BATCH_SIZE = 10; // Show 10 initially, load more +10
  const [displayedCompletedCount, setDisplayedCompletedCount] = useState(COMPLETED_BATCH_SIZE);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Ref to always access latest fetchAllData without re-creating subscriptions
  const fetchAllDataRef = useRef<() => void>(() => {});

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

    // Use search API when debouncedSearchTerm is present, otherwise use regular fetch
    const isSearching = debouncedSearchTerm.trim().length > 0;
    const url = new URL(
      isSearching
        ? "/api/activity/tsa/planner/search"
        : "/api/activity/tsa/planner/fetch",
      window.location.origin,
    );
    url.searchParams.append("referenceid", referenceid);

    if (isSearching) {
      url.searchParams.append("search", debouncedSearchTerm);
    } else {
      // Only apply limit for regular fetch (not search)
      url.searchParams.append("limit", "500");
    }

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
  }, [referenceid, dateCreatedFilterRange, debouncedSearchTerm]);

  // Keep ref in sync
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  // Realtime subscriptions — only depend on referenceid, use ref for callback
  useEffect(() => {
    if (!referenceid) return;

    fetchAllDataRef.current();

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
        () => fetchAllDataRef.current(),
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
        () => fetchAllDataRef.current(),
      )
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);

      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid]);

  // Trigger fetch when debounced search term changes
  useEffect(() => {
    if (referenceid) {
      fetchAllData();
    }
  }, [debouncedSearchTerm, referenceid, fetchAllData]);

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

  const allowedStatuses = ["Completed", "Delivered"];

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
    // Search is now server-side, no client-side filtering needed
    return true;
  });

  // Paginated data for lazy loading
  const displayedCompletedData = filteredData.slice(0, displayedCompletedCount);
  const hasMoreCompleted = filteredData.length > displayedCompletedCount;

  useEffect(() => {
    onCountChange?.(filteredData.length);
  }, [filteredData.length]);

  // Reset pagination when search changes
  useEffect(() => {
    setDisplayedCompletedCount(COMPLETED_BATCH_SIZE);
  }, [debouncedSearchTerm]);

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
          {displayedCompletedData.map((item) => {
            // Define bg colors base sa status
            let badgeClass = "bg-gray-200 text-gray-800";
            let cardBgClass = "bg-gray-100";

            if (item.status === "Completed") {
              badgeClass = "bg-green-400 text-white";
              cardBgClass = "bg-green-100";
            } else if (item.status === "Delivered") {
              badgeClass = "bg-teal-500 text-white";
              cardBgClass = "bg-teal-100";
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

                    </div>
                  </div>

                  <div className="ml-1 flex flex-wrap gap-1 uppercase">
                    {/* MAIN STATUS BADGE */}
                    <Badge
                      className={`${badgeClass} font-mono flex items-center gap-2 whitespace-nowrap rounded-sm shadow-md p-2 text-[10px]`}
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* ─── Lazy Loading: Load More Button ─── */}
        {hasMoreCompleted && (
          <div className="flex justify-center py-4 mt-4">
            <Button
              variant="outline"
              className="rounded-none text-xs"
              onClick={() => setDisplayedCompletedCount(prev => prev + COMPLETED_BATCH_SIZE)}
            >
              Load More ({filteredData.length - displayedCompletedCount} remaining)
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
