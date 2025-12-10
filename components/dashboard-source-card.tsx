"use client";

import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Activity {
  source?: string;
}

interface SourceCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
}

export function SourceCard({ activities, loading, error }: SourceCardProps) {
  // Prepare data grouped by source with counts
  const data = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    const counts: Record<string, number> = {};
    activities.forEach((act) => {
      const src = act.source || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });

    return Object.entries(counts).map(([source, count]) => ({
      source,
      count,
    }));
  }, [activities]);

  // Chart config for styling labels and colors
  const chartConfig = {
    count: {
      label: "Count",
      color: "var(--chart-1)",
    },
  } satisfies Record<string, { label: string; color: string }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activities by Source</CardTitle>
        <CardDescription>Counts of activities grouped by source</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12 text-lg font-semibold">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm">{error}</div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No data available</div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              height={300}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                type="category"
                dataKey="source"
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
              />
              <ChartTooltip
                cursor={{ fill: "transparent" }}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar
                dataKey="count"
                fill="var(--color-desktop)"
                radius={[8, 8, 8, 8]}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing activity counts grouped by source
        </div>
      </CardFooter>
    </Card>
  );
}
