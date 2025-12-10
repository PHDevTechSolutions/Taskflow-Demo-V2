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

interface SOSIHistory {
  id: number;
  source?: string;
  status?: string;
  date_created?: string;
  dr_number?: string;
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

  // Remove all quote counting here

  const totalSOCurrentMonth = activitiesCurrentMonth.filter(
    (a) => a.status === "SO-Done"
  ).length;

  const totalSOLastMonth = activitiesLastMonth.filter(
    (a) => a.status === "SO-Done"
  ).length;

  const totalSICurrentMonth = activitiesCurrentMonth.filter(
    (a) => a.dr_number && a.dr_number.trim() !== ""
  ).length;

  const totalSILastMonth = activitiesLastMonth.filter(
    (a) => a.dr_number && a.dr_number.trim() !== ""
  ).length;

  // Calculate percentage of SO to SI
  const percentageSOToSICurrentMonth =
    totalSICurrentMonth === 0 ? 0 : (totalSOCurrentMonth / totalSICurrentMonth) * 100;

  const percentageSOToSILastMonth =
    totalSILastMonth === 0 ? 0 : (totalSOLastMonth / totalSILastMonth) * 100;

  const chartData = [
    {
      month: "Current",
      SOs: totalSOCurrentMonth,
      SI: totalSICurrentMonth,
      "SO to SI %": Number(percentageSOToSICurrentMonth.toFixed(2)),
    },
    {
      month: "Last",
      SOs: totalSOLastMonth,
      SI: totalSILastMonth,
      "SO to SI %": Number(percentageSOToSILastMonth.toFixed(2)),
    },
  ];

  const chartConfig = {
    SOs: {
      label: "SO Done",
      color: "var(--color-desktop)",
    },
    SI: {
      label: "SI (dr_number)",
      color: "var(--color-mobile)",
    },
    "SO to SI %": {
      label: "SO to SI %",
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
          <CardTitle>SO and SI Summary</CardTitle>
          <CardDescription>
            Comparison of current and last month data based on status
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
                <TableCell>Number of SO</TableCell>
                <TableCell className="text-right">{totalSOCurrentMonth}</TableCell>
                <TableCell className="text-right">{totalSOLastMonth}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Number of SI (Actual Sales)</TableCell>
                <TableCell className="text-right">{totalSICurrentMonth}</TableCell>
                <TableCell className="text-right">{totalSILastMonth}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Percentage of SO to SI</TableCell>
                <TableCell className="text-right">{percentageSOToSICurrentMonth.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{percentageSOToSILastMonth.toFixed(2)}%</TableCell>
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
          <p>The numbers represent counts of sales orders and SI completed, based on their status and presence of dr_number.</p>
          <p>
            <strong>Number of SO:</strong> Counts all activities with status <code>SO-Done</code>.
          </p>
          <p>
            <strong>Number of SI:</strong> Counts all activities with a non-empty <code>dr_number</code>.
          </p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            Percentage of SO to SI: Calculated as (Number of SO ÷ Number of SI) × 100.
          </pre>
          <p>Comparison is made between the current month and the last month for the given metrics.</p>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Comparison Chart</CardTitle>
          <CardDescription>Current vs Last Month</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
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
          <div className="flex gap-2 leading-none font-medium">
            Trending by {(percentageSOToSICurrentMonth - percentageSOToSILastMonth).toFixed(2)}% this month{" "}
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            Showing SO, SI, and SO to SI percentage for the last 2 months
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SOSI;
