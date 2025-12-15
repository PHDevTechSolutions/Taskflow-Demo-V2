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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SOSIHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
  dr_number?: string;
  si_date?: string;
  actual_sales?: number;
}

interface SOSIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const SOSI: React.FC<SOSIProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<SOSIHistory[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  // Parse date string into "YYYY-MM"
  const getYearMonth = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Derive selectedMonth from external dateCreatedFilterRange.from, fallback to current month
  const selectedMonth = useMemo(() => {
    if (!dateCreatedFilterRange?.from) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${dateCreatedFilterRange.from.getFullYear()}-${String(dateCreatedFilterRange.from.getMonth() + 1).padStart(2, "0")}`;
  }, [dateCreatedFilterRange]);

  // Update external dateCreatedFilterRange when month is changed in dropdown
  const onMonthChange = (monthValue: string) => {
    // monthValue is "YYYY-MM"
    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const newDate = new Date(year, month, 1);
    setDateCreatedFilterRangeAction({ from: newDate });
  };

  // Fetch activities from API
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

  // Setup Supabase realtime channel for updates
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
          const newRecord = payload.new as SOSIHistory;
          const oldRecord = payload.old as SOSIHistory;

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

  // Filter activities based on selectedMonth
  const activitiesFiltered = useMemo(() => {
    return activities.filter(
      (a) =>
        getYearMonth(a.date_created) === selectedMonth || getYearMonth(a.si_date) === selectedMonth
    );
  }, [activities, selectedMonth]);

  // Filter SO activities for selected month
  const activitiesSO = useMemo(() => {
    return activitiesFiltered.filter(
      (a) => a.status === "SO-Done" && getYearMonth(a.date_created) === selectedMonth
    );
  }, [activitiesFiltered, selectedMonth]);

  // Calculate totals
  const totalSO = activitiesSO.length;

  const totalSI = useMemo(() => {
    const filteredSI = activitiesFiltered.filter(
      (a) => a.si_date && Number(a.actual_sales) > 0 && getYearMonth(a.si_date) === selectedMonth
    );
    const uniqueDates = new Set(filteredSI.map((a) => a.si_date));
    return uniqueDates.size;
  }, [activitiesFiltered, selectedMonth]);

  const percentageSOToSI = totalSI === 0 ? 0 : (totalSO / totalSI) * 100;

  // Last 12 months for dropdown options
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("default", { year: "numeric", month: "long" }),
      });
    }
    return options;
  }, []);

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
        <CardHeader className="flex items-center justify-between space-x-4">
          <div>
            <CardTitle>SO and SI Summary</CardTitle>
            <CardDescription>
              Data for: {monthOptions.find((opt) => opt.value === selectedMonth)?.label || selectedMonth}
            </CardDescription>
          </div>
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
                <TableCell>Number of SO</TableCell>
                <TableCell className="text-right">{totalSO}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Number of SI (Actual Sales)</TableCell>
                <TableCell className="text-right">{totalSI}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Percentage of SO to SI</TableCell>
                <TableCell className="text-right">{percentageSOToSI.toFixed(2)}%</TableCell>
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
            The numbers represent counts of sales orders and SI completed, based on their status and presence of si_date with actual sales.
          </p>
          <p>
            <strong>Number of SO:</strong> Counts all activities with status <code>SO-Done</code>.
          </p>
          <p>
            <strong>Number of SI:</strong> Counts unique <code>si_date</code> where <code>actual_sales</code> is &gt; 0.
          </p>
          <p className="bg-gray-100 p-2 rounded text-sm">
            Percentage of SO to SI: Calculated as (Number of SO ÷ Number of SI) × 100.
          </p>
          <p>Data is filtered based on the selected month.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SOSI;
