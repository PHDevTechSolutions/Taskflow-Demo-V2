"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DoneDialog } from "./activity-done-dialog";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";

interface Company {
  account_reference_number: string;
  company_name: string;
  contact_number?: string;
  type_client?: string;
}

interface Scheduled {
  id: number;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  account_reference_number: string;
  status: string;
  scheduled_status: string;
  callback: string;
  date_followup?: string | null;
  date_updated: string;
  date_created: string;
}

interface ScheduledProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
}

export const Scheduled: React.FC<ScheduledProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activities, setActivities] = useState<Scheduled[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScheduledId, setSelectedScheduledId] = useState<number | null>(null);

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

  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    fetch(`/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [referenceid]);

  useEffect(() => {
    fetchActivities();

    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        (payload) => {
          const newRecord = payload.new as Scheduled;
          const oldRecord = payload.old as Scheduled;

          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                if (!curr.some((a) => a.id === newRecord.id)) {
                  return [...curr, newRecord];
                }
                return curr;
              case "UPDATE":
                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
              case "DELETE":
                return curr.filter((a) => a.id !== oldRecord.id);
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
    if (!range) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const { from, to } = range;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const isToday = (dateStr: string | undefined | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Prepare merged activities with company info
  const mergedActivities = activities
    .map((history) => {
      const company = companies.find(
        (c) => c.account_reference_number === history.account_reference_number
      );
      return {
        ...history,
        company_name: company?.company_name ?? "Unknown Company",
        contact_number: company?.contact_number ?? "-",
        type_client: company?.type_client ?? "",
      };
    })
    .filter((a) => a.scheduled_status !== "Done");

  // Filter for callback activities (filtered by dateCreatedFilterRange or today)
  const callbackActivities = mergedActivities.filter((a) => {
    if (!a.callback) return false;

    if (dateCreatedFilterRange) {
      return isDateInRange(a.callback, dateCreatedFilterRange);
    }

    return isToday(a.callback);
  });

  // Filter for followup activities (date_followup present, is today, scheduled_status not Done, and status not Delivered)
  const followupActivities = mergedActivities.filter(
    (a) =>
      isToday(a.date_followup) &&
      a.scheduled_status !== "Done" &&
      a.status !== "Delivered"
  );


  const isLoading = loadingCompanies || loadingActivities;
  const error = errorCompanies || errorActivities;

  const openDoneDialog = (id: number) => {
    setSelectedScheduledId(id);
    setDialogOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedScheduledId) return;

    try {
      setUpdatingId(selectedScheduledId);
      setDialogOpen(false);

      const res = await fetch("/api/act-update-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedScheduledId }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(`Failed to update status: ${result.error}`);
        setUpdatingId(null);
        return;
      }
      setActivities((curr) => curr.filter((a) => a.id !== selectedScheduledId));

      toast.success("Transaction marked as Done.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedScheduledId(null);
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
      {/* CALLBACK ACTIVITIES */}
      <div className="mb-4 text-xs font-bold">
        Total On-Callback Activities: {callbackActivities.length}
      </div>
      <div className="max-h-[300px] overflow-auto space-y-8 custom-scrollbar mb-6">
        <Accordion type="single" collapsible className="w-full">
          {callbackActivities.map((item) => (
            <AccordionItem key={item.id} value={String(item.id)}>
              <div className="p-2 cursor-pointer select-none">
                <div className="flex justify-between items-center">
                  <AccordionTrigger className="flex-1 text-xs font-semibold">
                    {item.company_name}
                  </AccordionTrigger>

                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
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

                <div className="ml-1">
                  <Badge variant="default" className="text-[8px]">
                    {item.status.replace("-", " ")}
                  </Badge>
                </div>
              </div>

              <AccordionContent className="text-xs px-4 py-2">
                <p>
                  <strong>Contact Number:</strong> {item.contact_number}
                </p>
                <p>
                  <strong>Account Reference Number:</strong> {item.account_reference_number}
                </p>
                <p>
                  <strong>Callback Date:</strong> {new Date(item.callback).toLocaleString()}
                </p>
                <p>
                  <strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* FOLLOWUP ACTIVITIES */}
      <div className="mb-4 text-xs font-bold">
        Total Followup Activities Today: {followupActivities.length}
      </div>
      <div className="max-h-[300px] overflow-auto space-y-8 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {followupActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">No followups today.</p>
          ) : (
            followupActivities.map((item) => (
              <AccordionItem key={`followup-${item.id}`} value={`followup-${item.id}`}>
                <div className="p-2 cursor-pointer select-none">
                  <div className="flex justify-between items-center">
                    <AccordionTrigger className="flex-1 text-xs font-semibold">
                      {item.company_name}
                    </AccordionTrigger>

                    <div className="flex gap-2 ml-4">
                      <Button
                        type="button"
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

                  <div className="ml-1">
                    <Badge variant="default" className="text-[8px]">
                      {item.status.replace("-", " ")}
                    </Badge>
                  </div>
                </div>

                <AccordionContent className="text-xs px-4 py-2">
                  <p><strong>Contact Number:</strong> {item.contact_number}</p>
                  <p><strong>Followup Date:</strong>{" "}{item.date_followup ? new Date(item.date_followup).toLocaleString() : "-"}</p>
                  <p><strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}</p>
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
