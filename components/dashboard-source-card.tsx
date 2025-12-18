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

/** 🔒 Allowed sources (LABELS ONLY) */
const ALLOWED_SOURCES = [
  "Outbound - Touchbase",
  "Outbound - Follow-up",
  "Existing Client",
  "CSR Inquiry",
  "Government",
  "Philgeps Website",
  "Philgeps",
  "Distributor",
  "Modern Trade",
  "Facebook Marketplace",
  "Walk-in Showroom",
];

export function SourceCard({ activities, loading, error }: SourceCardProps) {
  const data = useMemo(() => {
    if (!activities || activities.length === 0) {
      // 👉 walang ididisplay kapag walang activities
      return [];
    }

    // initialize all allowed sources with 0
    const counts: Record<string, number> = {};
    ALLOWED_SOURCES.forEach((label) => {
      counts[label] = 0;
    });

    // count only allowed sources
    activities.forEach((act) => {
      if (act.source && counts.hasOwnProperty(act.source)) {
        counts[act.source]++;
      }
    });

    // 👉 FILTER OUT ZERO VALUES HERE
    return ALLOWED_SOURCES
      .map((label) => ({
        source: label,
        count: counts[label],
      }))
      .filter((item) => item.count > 0);
  }, [activities]);

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
        <CardDescription>
          Counts based on predefined source labels only
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-12 text-lg font-semibold">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm">{error}</div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              height={360}
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
                width={160}
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
        <div className="text-muted-foreground leading-none">
          Only predefined sources are displayed
        </div>
      </CardFooter>
    </Card>
  );
}
