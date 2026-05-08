"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  CheckCircle2Icon, AlertCircleIcon, LoaderPinwheel,
  PhoneOutgoing, PackageCheck, ReceiptText, Activity, MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/utils/supabase";
import { CreateActivityDialog } from "../dialog/create";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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
  status?: string;
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
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

const ALLOWED_STATUSES = ["Completed", "Delivered"];

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
  // ─── Accumulated data from all fetched pages ─────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ─── Pagination state ────────────────────────────────────────────────────
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ─── Loading states ──────────────────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Search ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ─── Build fetch URL ──────────────────────────────────────────────────────
  const buildUrl = useCallback(
    (offset: number) => {
      const isSearching = debouncedSearchTerm.trim().length > 0;
      const url = new URL(
        isSearching
          ? "/api/activity/tsa/planner/search"
          : "/api/activity/tsa/planner/fetch-completed",
        window.location.origin,
      );

      url.searchParams.append("referenceid", referenceid);

      if (isSearching) {
        url.searchParams.append("search", debouncedSearchTerm);
      } else {
        url.searchParams.append("offset", String(offset));
      }

      const from = dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
        : null;
      const to = dateCreatedFilterRange?.to
        ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
        : null;

      if (from && to) {
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);
      }

      return url.toString();
    },
    [referenceid, debouncedSearchTerm, dateCreatedFilterRange],
  );

  // ─── Initial load / reset — fetches page 0 ───────────────────────────────
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

  // ─── Ref for realtime subscriptions ──────────────────────────────────────
  const fetchInitialRef = useRef(fetchInitial);
  useEffect(() => { fetchInitialRef.current = fetchInitial; }, [fetchInitial]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) return;

    fetchInitialRef.current();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "activity",
        filter: `referenceid=eq.${referenceid}`,
      }, () => fetchInitialRef.current())
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "history",
        filter: `referenceid=eq.${referenceid}`,
      }, () => fetchInitialRef.current())
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);
      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid]);

  // ─── Re-fetch from page 0 when search/date filter changes ─────────────────
  useEffect(() => {
    if (referenceid) fetchInitial();
  }, [debouncedSearchTerm, dateCreatedFilterRange, referenceid]); // eslint-disable-line

  // ─── Merge activities + history ───────────────────────────────────────────
  const mergedData = activities
    .filter((a) => ALLOWED_STATUSES.includes(a.status))
    .map((activity) => ({
      ...activity,
      relatedHistoryItems: history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number,
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime(),
    );

  useEffect(() => {
    onCountChange?.(mergedData.length);
  }, [mergedData.length]); // eslint-disable-line

  // ─── Error state ──────────────────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────
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
        {initialLoading ? (
          <div className="flex justify-center py-8">
            <LoaderPinwheel className="animate-spin h-5 w-5 text-gray-400" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {mergedData.map((item) => {
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
                          activityReferenceNumber={item.activity_reference_number}
                          ticket_reference_number={item.ticket_reference_number}
                          agent={item.agent}
                          company_name={item.company_name}
                          contact_person={item.contact_person}
                          address={item.address}
                          accountReferenceNumber={item.account_reference_number}
                          onCreated={fetchInitial}
                          managerDetails={managerDetails ?? null}
                          tsmDetails={tsmDetails ?? null}
                          signature={signature}
                        />

                        {item.relatedHistoryItems.some(
                          (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                        ) && (() => {
                          const feedbackItems = item.relatedHistoryItems.filter(
                            (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                          );
                          return (
                            <Popover
                              open={tsmFeedbackOpen === item.id}
                              onOpenChange={(open) => setTsmFeedbackOpen(open ? item.id : null)}
                            >
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
                      <Badge
                        className={`${badgeClass} font-mono flex items-center gap-2 whitespace-nowrap rounded-sm shadow-md p-2 text-[10px]`}
                      >
                        <LoaderPinwheel size={14} className="animate-spin" />
                        {item.status.replace("-", " ")}
                      </Badge>

                      {item.relatedHistoryItems.some(
                        (h) => !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== "",
                      ) &&
                        Array.from(
                          new Set(
                            item.relatedHistoryItems
                              .map((h) => h.type_activity?.trim() ?? "")
                              .filter((v) => v && v !== "-"),
                          ),
                        ).map((activity) => {
                          const getIcon = (act: string) => {
                            const lowerAct = act.toLowerCase();
                            if (lowerAct.includes("outbound") || lowerAct.includes("call"))
                              return <PhoneOutgoing size={14} />;
                            if (lowerAct.includes("sales order") || lowerAct.includes("so prep"))
                              return <PackageCheck size={14} />;
                            if (lowerAct.includes("quotation") || lowerAct.includes("quote"))
                              return <ReceiptText size={14} />;
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
                              <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">
                                {activity.toUpperCase()}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
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
                        {item.relatedHistoryItems.some((h) => h.ticket_reference_number && h.ticket_reference_number !== "-") && (
                          <p>
                            <strong>Ticket Reference Number:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                          <p>
                            <strong>Type:</strong>{" "}
                            {item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.type_activity && h.type_activity !== "-") && (
                          <p>
                            <strong>Type of Activity:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.type_activity ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                          <p>
                            <strong>Source:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                          <p>
                            <strong>Quotation Number:</strong>{" "}
                            {item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-").join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.quotation_amount !== null && h.quotation_amount !== undefined) && (
                          <p>
                            <strong>Total Quotation Amount:</strong>{" "}
                            {item.relatedHistoryItems.reduce((total, h) => total + (h.quotation_amount ?? 0), 0)
                              .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                          <p>
                            <strong>SO Number:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.so_amount !== null && h.so_amount !== undefined) && (
                          <p>
                            <strong>Total SO Amount:</strong>{" "}
                            {item.relatedHistoryItems.reduce((total, h) => total + (h.so_amount ?? 0), 0)
                              .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.call_status && h.call_status !== "-") && (
                          <p>
                            <strong>Call Status:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.call_status ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                        <Separator className="mb-2 mt-2" />
                        {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                          <p>
                            <strong>TSM Feedback:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                      </>
                    )}
                    <p><strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}</p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* ─── Load More: fetches next 10 from server ─── */}
        {hasMore && !initialLoading && (
          <div className="flex justify-center py-4 mt-4">
            <Button
              variant="outline"
              className="rounded-none text-xs"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <LoaderPinwheel className="animate-spin h-3 w-3" />
                  Loading...
                </span>
              ) : (
                `Load More (${50 - nextOffset} remaining of 50 max)`
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};