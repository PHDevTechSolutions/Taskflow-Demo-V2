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

interface CallHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
}

interface CallQuoteProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const CallQuote: React.FC<CallQuoteProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<CallHistory[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  // Convert date string to "YYYY-MM"
  const getYearMonth = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Derive selectedMonth from external filter or default to current month
  const selectedMonth = useMemo(() => {
    if (!dateCreatedFilterRange?.from) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${dateCreatedFilterRange.from.getFullYear()}-${String(
      dateCreatedFilterRange.from.getMonth() + 1
    ).padStart(2, "0")}`;
  }, [dateCreatedFilterRange]);

  // On dropdown change, update external filter date
  const onMonthChange = (monthValue: string) => {
    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const newDate = new Date(year, month, 1);
    setDateCreatedFilterRangeAction({ from: newDate });
  };

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
          const newRecord = payload.new as CallHistory;
          const oldRecord = payload.old as CallHistory;

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

  const totalCalls = activitiesFilteredByMonth.filter(
    (a) => a.source === "Outbound - Touchbase"
  ).length;

  const totalQuotes = activitiesFilteredByMonth.filter((a) => a.status === "Quote-Done").length;

  const percentageCallsToQuote = totalCalls === 0 ? 0 : (totalQuotes / totalCalls) * 100;

  // Generate last 12 months for dropdown
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
            <CardTitle>Call Summary</CardTitle>
            <CardDescription>
              Data for:{" "}
              {monthOptions.find((opt) => opt.value === selectedMonth)?.label || selectedMonth}
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
                <TableCell>No. of Calls (Outbound - Touchbase)</TableCell>
                <TableCell className="text-right">{totalCalls}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Total Number of Quotes (Quote-Done)</TableCell>
                <TableCell className="text-right">{totalQuotes}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Percentage of Calls to Quote</TableCell>
                <TableCell className="text-right">{percentageCallsToQuote.toFixed(2)}%</TableCell>
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
            <strong>Percentage of Calls to Quote:</strong> This represents the ratio
            of successful quotes to total outbound calls. Calculated as:
          </p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            Percentage of Calls to Quote = (Total Number of Quotes ÷ No. of Calls) × 100%
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallQuote;
