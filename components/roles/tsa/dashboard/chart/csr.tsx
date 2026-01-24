"use client";

import React, { useMemo, useState } from "react";
import { TrendingUp, Info } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig, } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

interface Activity {
  source?: string;
  status?: string;
  date_created?: string;
  start_date?: string;
  end_date?: string;
  activity_reference_number?: string;
}

interface CSRMetricsCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
}

interface CSRMetricRow {
  date: string;
  response: number;
  rfq: number;
  nonRfq: number;
}

function diffHours(start?: string, end?: string) {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? diff / (1000 * 60 * 60) : 0;
}

function formatDuration(hours: number) {
  const totalSeconds = Math.floor(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

const chartConfig = {
  response: { label: "Response Time", color: "var(--chart-1)" },
  rfq: { label: "RFQ Handling", color: "var(--chart-2)" },
  nonRfq: { label: "Non-RFQ Handling", color: "var(--chart-3)" },
} satisfies ChartConfig;

const METRICS = ["response", "rfq", "nonRfq"] as const;

type MetricKey = (typeof METRICS)[number];

const explanations: Record<MetricKey, React.ReactNode> = {
  response: (
    <>
      <p>
        <b>Response Time:</b> Calculated as the total hours elapsed between the
        first start date and the last end date of all activities under the same
        reference number.
      </p>
    </>
  ),
  rfq: (
    <>
      <p>
        <b>RFQ Handling:</b> Sum of durations (in hours) of activities with status{" "}
        <code>Quote-Done</code>, calculated from their start and end dates.
      </p>
    </>
  ),
  nonRfq: (
    <>
      <p>
        <b>Non-RFQ Handling:</b> Sum of durations (in hours) of activities with
        status <code>Assisted</code>, calculated from their start and end dates.
      </p>
    </>
  ),
};

export function CSRMetricsCard({ activities, loading, error }: CSRMetricsCardProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("response");
  const [showTooltipFor, setShowTooltipFor] = useState<MetricKey | null>(null);

  const csrActivities = useMemo(
    () => activities.filter((a) => a.source === "CSR Inquiry"),
    [activities]
  );

  const chartData: CSRMetricRow[] = useMemo(() => {
    const grouped: Record<string, Activity[]> = {};

    for (const act of csrActivities) {
      const ref = act.activity_reference_number || "unknown";
      if (!grouped[ref]) grouped[ref] = [];
      grouped[ref].push(act);
    }

    const rows: CSRMetricRow[] = [];

    for (const acts of Object.values(grouped)) {
      const sorted = acts
        .filter((a) => a.start_date)
        .sort(
          (a, b) =>
            new Date(a.start_date!).getTime() -
            new Date(b.start_date!).getTime()
        );

      if (!sorted.length) continue;

      const firstStart = sorted[0].start_date!;
      const lastEnd = new Date(
        Math.max(
          ...acts
            .map((a) => a.end_date)
            .filter(Boolean)
            .map((d) => new Date(d!).getTime())
        )
      ).toISOString();

      let rfq = 0;
      let nonRfq = 0;

      for (const a of acts) {
        if (a.status === "Quote-Done") rfq += diffHours(a.start_date, a.end_date);
        if (a.status === "Assisted") nonRfq += diffHours(a.start_date, a.end_date);
      }

      rows.push({
        date: new Date(acts[0].date_created || firstStart).toLocaleDateString(),
        response: diffHours(firstStart, lastEnd),
        rfq,
        nonRfq,
      });
    }

    return rows.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [csrActivities]);

  const totals = useMemo(() => {
    return {
      response: chartData.reduce((s, r) => s + r.response, 0),
      rfq: chartData.reduce((s, r) => s + r.rfq, 0),
      nonRfq: chartData.reduce((s, r) => s + r.nonRfq, 0),
    };
  }, [chartData]);

  return (
    <Card className="bg-white text-black z-10">
      <CardHeader>
        <CardTitle>CSR Metrics Overview</CardTitle>
        <CardDescription>Toggle metrics and view total handling durations</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toggle Buttons */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map((key) => (
            <Button
              key={key}
              size="sm"
              variant={activeMetric === key ? "default" : "outline"}
              onClick={() => setActiveMetric(key)}
            >
              {chartConfig[key].label}
            </Button>
          ))}
        </div>

        {/* Legend Totals with Info Icon and Tooltip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {METRICS.map((key) => (
            <div
              key={key}
              className={`relative rounded-lg border p-3 ${
                activeMetric === key ? "bg-blue-200" : "opacity-70"
              }`}
            >
              <div className="flex justify-between items-start relative">
                <div className="font-medium">{chartConfig[key].label}</div>

                {/* Info Icon container - relative so tooltip absolute works */}
                <div
                  className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
                  onMouseEnter={() => setShowTooltipFor(key)}
                  onMouseLeave={() => setShowTooltipFor(null)}
                  onFocus={() => setShowTooltipFor(key)}
                  onBlur={() => setShowTooltipFor(null)}
                  tabIndex={0}
                  aria-label={`Info about ${chartConfig[key].label}`}
                >
                  <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />

                  {/* Tooltip */}
                  {showTooltipFor === key && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
                      {explanations[key]}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-muted-foreground mt-1">
                Total: {formatDuration(totals[key])}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {loading ? (
          <div className="py-12 text-center font-medium"><Spinner /></div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No CSR data available
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

              <defs>
                <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${activeMetric})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${activeMetric})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>

              <Area
                dataKey={activeMetric}
                type="natural"
                fill="url(#fillMetric)"
                stroke={`var(--color-${activeMetric})`}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        Interactive CSR performance summary
      </CardFooter>
    </Card>
  );
}
