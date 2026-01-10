"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Firebase imports
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface HistoryItem {
  source?: string;
  call_status?: string;
  type_activity?: string;
  start_date?: string;
  end_date?: string;
  date_created?: any;
  [key: string]: any;
}

interface SiteVisitItem {
  Type?: string;
  Status?: string;
  date_created: string;
  [key: string]: any;
}

interface OtherActivitiesCardProps {
  activities: HistoryItem[]; // original activities prop
  referenceid: string;
  dateRange?: { from?: Date; to?: Date };
}

// Helpers

function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
  if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

  return parts.join(" ") || "0 sec";
}

function averageDurationMs(items: HistoryItem[]) {
  if (items.length === 0) return 0;

  const totalMs = items.reduce((acc, curr) => {
    if (curr.start_date && curr.end_date) {
      const start = new Date(curr.start_date).getTime();
      const end = new Date(curr.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return acc + (end - start);
      }
    }
    return acc;
  }, 0);

  return totalMs / items.length;
}

const ACTIVITY_TYPES = [
  "Quotation Preparation",
  "Sales Order Preparation",
  "Delivered / Closed Transaction",
  "Admin - Supplier Accreditation",
  "Admin - Credit Terms Application",
  "Accounting Concerns",
  "After Sales Refunds",
  "After Sales Repair / Replacement",
  "Bidding Preparations",
  "Customer Orders",
  "Customer Inquiry Sales",
  "Delivery Concern",
  "Follow Up",
  "Sample Requests",
  "Site Visits / Demos",
  "Technical Concerns",
];

function isInRange(date: any, from?: Date, to?: Date) {
  if (!date) return false;
  if (!from && !to) return true;

  const d = new Date(date);
  if (isNaN(d.getTime())) return false;

  if (from && d < from) return false;
  if (to && d > to) return false;

  return true;
}

export function OtherActivitiesCard({ activities, referenceid, dateRange }: OtherActivitiesCardProps) {
  const [meetings, setMeetings] = useState<HistoryItem[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [errorMeetings, setErrorMeetings] = useState<string | null>(null);

  const [notes, setNotes] = useState<HistoryItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [errorNotes, setErrorNotes] = useState<string | null>(null);

  const [siteVisits, setSiteVisits] = useState<SiteVisitItem[]>([]);
  const [loadingSiteVisits, setLoadingSiteVisits] = useState(false);
  const [errorSiteVisits, setErrorSiteVisits] = useState<string | null>(null);

  // Fetch meetings
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

        const fetched = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as HistoryItem[];

        const filtered = fetched.filter((m) =>
          isInRange(m.date_created, dateRange?.from, dateRange?.to)
        );

        setMeetings(filtered);
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

  // Fetch notes
  useEffect(() => {
    if (!referenceid) return;

    async function fetchNotes() {
      setLoadingNotes(true);
      setErrorNotes(null);

      try {
        const q = query(
          collection(db, "notes"),
          where("tsm", "==", referenceid),
          orderBy("date_created", "desc")
        );

        const querySnapshot = await getDocs(q);

        const fetched = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as HistoryItem[];

        const filtered = fetched.filter((n) =>
          isInRange(n.date_created, dateRange?.from, dateRange?.to)
        );

        setNotes(filtered);
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

  // Fetch site visits from API
  useEffect(() => {
    if (!referenceid) return;

    async function fetchSiteVisits() {
      setLoadingSiteVisits(true);
      setErrorSiteVisits(null);

      try {
        const res = await fetch(`/api/fetch-tasklog?referenceid=${encodeURIComponent(referenceid)}`);
        if (!res.ok) throw new Error("Failed to fetch site visits");
        const data = await res.json();

        const filtered = (data.siteVisits || []).filter((visit: SiteVisitItem) =>
          isInRange(visit.date_created, dateRange?.from, dateRange?.to)
        );

        setSiteVisits(filtered);
      } catch (err: any) {
        setErrorSiteVisits(err.message);
        toast.error(err.message);
      } finally {
        setLoadingSiteVisits(false);
      }
    }

    fetchSiteVisits();
  }, [referenceid, dateRange]);

  // Combine all data into one array with consistent keys for activities, meetings, notes
  const combinedHistory = useMemo(() => {
    // Map site visits to have type_activity and start/end date (for averaging duration)
    const siteVisitsMapped = siteVisits.map((visit) => {
      // Treat "Site Visits / Demos" as type_activity for site visits
      // Use date_created for both start and end (or you can customize if you have more data)
      return {
        ...visit,
        type_activity: "Site Visits / Demos",
        start_date: visit.date_created,
        end_date: visit.date_created,
      } as HistoryItem;
    });

    return [...activities, ...meetings, ...notes, ...siteVisitsMapped].filter(item => item.type_activity);
  }, [activities, meetings, notes, siteVisits]);

  // Calculate stats as before using combinedHistory
  const stats = useMemo(() => {
    return ACTIVITY_TYPES.map((type) => {
      const filtered = combinedHistory.filter(
        (item) => item.type_activity === type
      );

      return {
        label: type,
        count: filtered.length,
        avg: averageDurationMs(filtered),
      };
    }).filter((row) => row.count > 0);
  }, [combinedHistory]);

  const totalAverageDurationMs = useMemo(
    () => stats.reduce((acc, s) => acc + s.avg, 0),
    [stats]
  );

  const totalCount = useMemo(
    () => stats.reduce((acc, s) => acc + s.count, 0),
    [stats]
  );

  const isLoading = loadingMeetings || loadingNotes || loadingSiteVisits;
  const isError = errorMeetings || errorNotes || errorSiteVisits;

  return (
    <Card className="flex flex-col min-h-[700px] max-h-[700px] bg-white text-black">
      <CardHeader>
        <CardTitle>Other Activities</CardTitle>
        <CardDescription>
          Summary of other activity types with counts and average durations for
          the selected agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <p className="text-center text-sm italic text-gray-500">Loading data...</p>
        ) : isError ? (
          <p className="text-center text-sm italic text-red-500">{errorMeetings || errorNotes || errorSiteVisits}</p>
        ) : stats.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">
            No records found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="font-mono">
                <TableHead className="text-xs">Activity</TableHead>
                <TableHead className="text-xs text-center">Count</TableHead>
                <TableHead className="text-xs text-right">
                  Avg Duration
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {stats.map((row) => (
                <TableRow key={row.label} className="text-xs">
                  <TableCell className="font-medium">
                    {row.label}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="rounded-full px-3 font-mono">
                      {row.count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right italic">
                    {formatDurationMs(row.avg)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t bg-white">
        {totalCount > 0 && (
          <>
            <p className="text-xs italic">
              Avg duration total: {formatDurationMs(totalAverageDurationMs)}
            </p>
            <Badge className="rounded-full px-4 font-mono">
              Total: {totalCount}
            </Badge>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
