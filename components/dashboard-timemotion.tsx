"use client";

import React, { useEffect, useState } from "react";
import { PieChart, Pie, Sector } from "recharts";
import { type PieSectorDataItem } from "recharts/types/polar/Pie";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

// Firebase imports
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Activity {
  start_date?: string;
  end_date?: string;
  type_activity?: string;
}

interface MeetingItem {
  id: string;
  start_date: string;
  end_date: string;
  type_activity: string;
  date_created?: any; // timestamp or string
  [key: string]: any;
}

interface NoteItem {
  id: string;
  start_date: string;
  end_date: string;
  type_activity: string;
  date_created?: any; // timestamp or string
  [key: string]: any;
}

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
  referenceid: string;
  dateRange?: DateRange;
}

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  chrome: {
    label: "Chrome",
    color: "var(--chart-1)",
  },
  safari: {
    label: "Safari",
    color: "var(--chart-2)",
  },
  firefox: {
    label: "Firefox",
    color: "var(--chart-3)",
  },
  edge: {
    label: "Edge",
    color: "var(--chart-4)",
  },
  other: {
    label: "Other",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export function TimemotionCard({
  activities,
  loading,
  error,
  referenceid,
  dateRange,
}: Props) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [errorMeetings, setErrorMeetings] = useState<string | null>(null);

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [errorNotes, setErrorNotes] = useState<string | null>(null);

  // Convert Firestore timestamp or string to JS Date
  const toDate = (value: any): Date | null => {
    if (!value) return null;

    if (typeof value === "object" && "seconds" in value) {
      return new Date(value.seconds * 1000);
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  // Check if date is in the selected date range
  const isInRange = (value?: any) => {
    if (!dateRange?.from || !dateRange?.to) return true;

    const date = toDate(value);
    if (!date) return false;

    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    return date >= from && date <= to;
  };

  // Fetch meetings from Firestore and filter by dateRange
  useEffect(() => {
    if (!referenceid) return;

    async function fetchMeetings() {
      setLoadingMeetings(true);
      setErrorMeetings(null);

      try {
        const q = query(
          collection(db, "meetings"),
          where("referenceid", "==", referenceid),
          orderBy("date_created", "desc")
        );

        const querySnapshot = await getDocs(q);

        const fetchedMeetings = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MeetingItem[];

        const filteredMeetings = fetchedMeetings.filter((m) =>
          isInRange(m.date_created)
        );

        setMeetings(filteredMeetings);
      } catch (err) {
        console.error(err);
        setErrorMeetings("Failed to load meetings.");
        toast.error("Failed to load meetings.");
      } finally {
        setLoadingMeetings(false);
      }
    }

    fetchMeetings();
  }, [referenceid, dateRange]);

  // Fetch notes from Firestore and filter by dateRange
  useEffect(() => {
    if (!referenceid) return;

    async function fetchNotes() {
      setLoadingNotes(true);
      setErrorNotes(null);

      try {
        const q = query(
          collection(db, "notes"),
          where("referenceid", "==", referenceid),
          orderBy("date_created", "desc")
        );

        const querySnapshot = await getDocs(q);

        const fetchedNotes = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NoteItem[];

        const filteredNotes = fetchedNotes.filter((n) =>
          isInRange(n.date_created)
        );

        setNotes(filteredNotes);
      } catch (err) {
        console.error(err);
        setErrorNotes("Failed to load notes.");
        toast.error("Failed to load notes.");
      } finally {
        setLoadingNotes(false);
      }
    }

    fetchNotes();
  }, [referenceid, dateRange]);

  // Combine all activities, meetings, and notes
  const combinedEntries = [...activities, ...meetings, ...notes];

  // Calculate total duration in milliseconds
  const totalDurationMs = combinedEntries.reduce((total, entry) => {
    if (entry.start_date && entry.end_date) {
      const start = new Date(entry.start_date).getTime();
      const end = new Date(entry.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return total + (end - start);
      }
    }
    return total;
  }, 0);

  const totalSeconds = Math.floor(totalDurationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Duration aggregated per activity type
  const durationPerType = combinedEntries.reduce((acc, entry) => {
    if (entry.start_date && entry.end_date && entry.type_activity) {
      const start = new Date(entry.start_date).getTime();
      const end = new Date(entry.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        acc[entry.type_activity] = (acc[entry.type_activity] || 0) + (end - start);
      }
    }
    return acc;
  }, {} as Record<string, number>);

  // Count of entries per activity type
  const countPerType = combinedEntries.reduce((acc, entry) => {
    const type = entry.type_activity || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const colorKeys = Object.keys(chartConfig).filter((k) => k !== "visitors");

  const getColor = (type: string, index: number) => {
    const key = colorKeys[index % colorKeys.length] as keyof typeof chartConfig;
    const configEntry = chartConfig[key];
    return "color" in configEntry ? configEntry.color : "#8884d8";
  };

  const chartData = Object.entries(countPerType).map(([type, count], i) => ({
    browser: type,
    visitors: count,
    fill: getColor(type, i),
  }));

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  function ChartPieDonutActive() {
    return (
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Pie Chart - Activity Counts</CardTitle>
          <CardDescription>Count of activities by type</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="visitors"
                nameKey="browser"
                innerRadius={60}
                strokeWidth={5}
                activeIndex={0}
                activeShape={({ outerRadius = 0, ...props }: PieSectorDataItem) => (
                  <Sector {...props} outerRadius={outerRadius + 10} />
                )}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="text-muted-foreground leading-none">
            Showing total activities count by type
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-col items-center space-y-2 w-full max-w-lg mx-auto">
      <CardHeader className="w-full">
        <h3 className="text-sm font-medium">Total Work Time</h3>
      </CardHeader>

      <CardContent className="w-full flex flex-col items-center">
        {(loading || loadingMeetings || loadingNotes) ? (
          <div className="text-lg font-semibold">Loading...</div>
        ) : error || errorMeetings || errorNotes ? (
          <div className="text-red-500 text-xs text-center w-full">{error || errorMeetings || errorNotes}</div>
        ) : (
          <>
            <div className="text-3xl font-bold mb-4">
              {hours}h {minutes}m {seconds}s (of 8h)
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" aria-label="Show Breakdown" className="w-full cursor-pointer">
                  Show Breakdown
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="p-4 max-w-md">
                <SheetHeader>
                  <SheetTitle>Work Hours per Activity</SheetTitle>
                  <SheetDescription>
                    Breakdown of total work hours by activity type.
                  </SheetDescription>
                </SheetHeader>

                <ChartPieDonutActive />

                <div className="mt-4">
                  {Object.keys(durationPerType).length === 0 ? (
                    <p className="text-sm text-gray-500">No activities with time recorded.</p>
                  ) : (
                    Object.entries(durationPerType).map(([type, ms], i) => (
                      <React.Fragment key={type}>
                        {i > 0 && <Separator className="my-2" />}
                        <div className="flex justify-between text-xs font-medium py-1 w-full">
                          <span>{type}</span>
                          <span>{formatDuration(ms)}</span>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </CardContent>
    </Card>
  );
}
