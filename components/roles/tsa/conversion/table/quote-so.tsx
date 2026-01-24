"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Card, CardContent,CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";

interface QuoteHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
}

interface QuoteSOProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const QuoteSO: React.FC<QuoteSOProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<QuoteHistory[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  // Convert date string to "YYYY-MM" format
  const getYearMonth = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Use external filter range date or current month fallback
  const selectedMonth = useMemo(() => {
    if (!dateCreatedFilterRange?.from) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${dateCreatedFilterRange.from.getFullYear()}-${String(
      dateCreatedFilterRange.from.getMonth() + 1
    ).padStart(2, "0")}`;
  }, [dateCreatedFilterRange]);

  // Update external filter date on dropdown change
  const onMonthChange = (monthValue: string) => {
    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const newDate = new Date(year, month, 1);
    setDateCreatedFilterRangeAction({ from: newDate });
  };

  // Fetch data from API
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

  // Setup realtime updates via Supabase channel
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
          const newRecord = payload.new as QuoteHistory;
          const oldRecord = payload.old as QuoteHistory;

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

  // Filter activities by selected month
  const activitiesFilteredByMonth = useMemo(() => {
    return activities.filter((a) => getYearMonth(a.date_created) === selectedMonth);
  }, [activities, selectedMonth]);

  // Count quotes and SOs
  const totalQuotes = activitiesFilteredByMonth.filter((a) => a.status === "Quote-Done").length;
  const totalSO = activitiesFilteredByMonth.filter((a) => a.status === "SO-Done").length;

  // Percentage SO to Quote (avoid div zero)
  const percentageQuoteToSO = totalQuotes === 0 ? 0 : (totalSO / totalQuotes) * 100;

  // Last 12 months for dropdown
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
            <CardTitle>Quote and SO Summary</CardTitle>
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
                <TableCell>Number of Quotes (Quote-Done)</TableCell>
                <TableCell className="text-right">{totalQuotes}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Number of SO (SO-Done)</TableCell>
                <TableCell className="text-right">{totalSO}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Percentage of Quote to SO</TableCell>
                <TableCell className="text-right">{percentageQuoteToSO.toFixed(2)}%</TableCell>
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
          <p>The numbers represent counts of quotes and sales orders completed, based on their status.</p>
          <p>
            <strong>Number of Quotes:</strong> Counts all activities with status <code>Quote-Done</code>.
          </p>
          <p>
            <strong>Number of SO:</strong> Counts all activities with status <code>SO-Done</code>.
          </p>
          <p className="bg-gray-100 p-2 rounded">
            Percentage of Quote to SO: Calculated as (Number of SO ÷ Number of Quotes) × 100.
          </p>
          <p>Data filtered by selected month from dropdown.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteSO;
