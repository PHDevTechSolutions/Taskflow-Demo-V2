"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, TrendingUp } from "lucide-react";
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
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface CallSIHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
  dr_number?: string;
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

  const getYearMonth = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const lastMonth = useMemo(() => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    if (month === 0) {
      year--;
      month = 12;
    }
    return `${year}-${String(month).padStart(2, "0")}`;
  }, []);

  const activitiesCurrentMonth = useMemo(() => {
    return activities.filter((a) => getYearMonth(a.date_created) === currentMonth);
  }, [activities, currentMonth]);

  const activitiesLastMonth = useMemo(() => {
    return activities.filter((a) => getYearMonth(a.date_created) === lastMonth);
  }, [activities, lastMonth]);

  // ✅ Number of Calls (Outbound - Touchbase)
  const totalCallsCurrentMonth = activitiesCurrentMonth.filter(
    (a) => a.source === "Outbound - Touchbase"
  ).length;

  const totalCallsLastMonth = activitiesLastMonth.filter(
    (a) => a.source === "Outbound - Touchbase"
  ).length;

  // SI stays the same
  const totalSICurrentMonth = activitiesCurrentMonth.filter(
    (a) => a.dr_number && a.dr_number.trim() !== ""
  ).length;

  const totalSILastMonth = activitiesLastMonth.filter(
    (a) => a.dr_number && a.dr_number.trim() !== ""
  ).length;

  // Percentage of Calls to SI
  const percentageCallsToSICurrentMonth =
    totalSICurrentMonth === 0 ? 0 : (totalCallsCurrentMonth / totalSICurrentMonth) * 100;

  const percentageCallsToSILastMonth =
    totalSILastMonth === 0 ? 0 : (totalCallsLastMonth / totalSILastMonth) * 100;

  const chartData = [
    {
      month: "Current",
      Calls: totalCallsCurrentMonth,
      SI: totalSICurrentMonth,
      "Calls to SI %": Number(percentageCallsToSICurrentMonth.toFixed(2)),
    },
    {
      month: "Last",
      Calls: totalCallsLastMonth,
      SI: totalSILastMonth,
      "Calls to SI %": Number(percentageCallsToSILastMonth.toFixed(2)),
    },
  ];

  const chartConfig = {
    Calls: {
      label: "Number of Calls",
      color: "var(--color-desktop)",
    },
    SI: {
      label: "SI (dr_number)",
      color: "var(--color-mobile)",
    },
    "Calls to SI %": {
      label: "Calls to SI %",
      color: "var(--color-accent)",
    },
  } satisfies ChartConfig;

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
            Current vs Last Month (Calls, SI & Conversion)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Current Month</TableHead>
                <TableHead className="text-right">Last Month</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Target Quota</TableCell>
                <TableCell className="text-right" colSpan={2}>
                  {targetQuotaNumber.toLocaleString()}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Number of Calls (Outbound - Touchbase)</TableCell>
                <TableCell className="text-right">{totalCallsCurrentMonth}</TableCell>
                <TableCell className="text-right">{totalCallsLastMonth}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Number of SI (Actual Sales)</TableCell>
                <TableCell className="text-right">{totalSICurrentMonth}</TableCell>
                <TableCell className="text-right">{totalSILastMonth}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Percentage of Calls to SI</TableCell>
                <TableCell className="text-right">
                  {percentageCallsToSICurrentMonth.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right">
                  {percentageCallsToSILastMonth.toFixed(2)}%
                </TableCell>
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
          <p><strong>Number of Calls:</strong> Counted where <code>source === "Outbound - Touchbase"</code>.</p>
          <p><strong>Number of SI:</strong> Counted where <code>dr_number</code> is not empty.</p>

          <pre className="bg-gray-100 p-2 rounded text-sm">
Percentage of Calls to SI = (Number of Calls ÷ Number of SI) × 100
          </pre>

          <p>Comparison shows performance for current and last month.</p>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Comparison Chart</CardTitle>
          <CardDescription>Calls, SI & Conversion Rate</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />

                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />

                {Object.keys(chartConfig).map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={chartConfig[key as keyof typeof chartConfig].color}
                    radius={4}
                    maxBarSize={24}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium">
            Trending by {(percentageCallsToSICurrentMonth - percentageCallsToSILastMonth).toFixed(2)}% this month
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground">
            Showing Calls, SI, and Calls-to-SI percentage for the last 2 months
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CallSI;
