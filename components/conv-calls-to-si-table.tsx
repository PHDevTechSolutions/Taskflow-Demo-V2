"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CallSIHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
  dr_number?: string;
  si_date?: string;
  actual_sales?: number;
}

interface CallSIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const CallSI: React.FC<CallSIProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<CallSIHistory[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  // Function to get "YYYY-MM" string from Date
  const getYearMonth = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Derive selectedMonth from dateCreatedFilterRange.from (if exists)
  const selectedMonth = React.useMemo(() => {
    if (!dateCreatedFilterRange?.from) {
      // fallback to current month if no date range selected
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${dateCreatedFilterRange.from.getFullYear()}-${String(
      dateCreatedFilterRange.from.getMonth() + 1
    ).padStart(2, "0")}`;
  }, [dateCreatedFilterRange]);

  // Fetch activities as before
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
    void fetchActivities();

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
          const newRecord = payload.new as CallSIHistory;
          const oldRecord = payload.old as CallSIHistory;

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

  const targetQuotaNumber = Number(target_quota) || 0;

  // Filter activities based on selectedMonth (derived from dateCreatedFilterRange)
  const activitiesFiltered = useMemo(() => {
    return activities.filter(
      (a) =>
        getYearMonth(a.date_created) === selectedMonth || getYearMonth(a.si_date) === selectedMonth
    );
  }, [activities, selectedMonth]);

  // Number of Calls (Outbound - Touchbase) for selected month
  const totalCalls = useMemo(() => {
    return activitiesFiltered.filter(
      (a) => a.source === "Outbound - Touchbase" && getYearMonth(a.date_created) === selectedMonth
    ).length;
  }, [activitiesFiltered, selectedMonth]);

  // Number of SI based on unique si_date with actual_sales > 0 for selected month
  const totalSI = useMemo(() => {
    const filteredSI = activitiesFiltered.filter(
      (a) => a.si_date && Number(a.actual_sales) > 0 && getYearMonth(a.si_date) === selectedMonth
    );
    const uniqueDates = new Set(filteredSI.map((a) => a.si_date));
    return uniqueDates.size;
  }, [activitiesFiltered, selectedMonth]);

  // Percentage of Calls to SI
  const percentageCallsToSI = totalSI === 0 ? 0 : (totalCalls / totalSI) * 100;

  if (loadingActivities) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (errorActivities) {
    return (
      <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
        <AlertCircleIcon className="h-6 w-6 text-red-600" />
        <div>
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{errorActivities}</AlertDescription>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Calls and SI Summary</CardTitle>
          <CardDescription>
            Data for:{" "}
            {dateCreatedFilterRange?.from
              ? dateCreatedFilterRange.from.toLocaleString("default", {
                  year: "numeric",
                  month: "long",
                })
              : selectedMonth}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow>
                <TableCell>Target Quota</TableCell>
                <TableCell className="text-right">{targetQuotaNumber.toLocaleString()}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Number of Calls (Outbound - Touchbase)</TableCell>
                <TableCell className="text-right">{totalCalls}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Number of SI (Actual Sales)</TableCell>
                <TableCell className="text-right">{totalSI}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Percentage of Calls to SI</TableCell>
                <TableCell className="text-right">{percentageCallsToSI.toFixed(2)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Computation Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Computation Explanation</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-700">
          <p>
            <strong>Number of Calls:</strong> Counted where <code>source === "Outbound - Touchbase"</code>.
          </p>
          <p>
            <strong>Number of SI:</strong> Counted unique <code>si_date</code> where <code>actual_sales</code> &gt; 0.
          </p>
          <p className="bg-gray-100 p-2 rounded">
            Percentage of Calls to SI = (Number of Calls ÷ Number of SI) × 100
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
