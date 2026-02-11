"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function BreachesDialog() {
  const [open, setOpen] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const [userDetails, setUserDetails] = useState<{ referenceid: string }>({
    referenceid: "",
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [timeConsumedMs, setTimeConsumedMs] = useState<number>(0);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details
  useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");

        const data = await res.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
        });

        toast.success("User data loaded successfully!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to load user data.");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch today's activities
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const url = `/api/activity/tsa/breaches/fetch?referenceid=${userDetails.referenceid}&date=${today}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch activities");

        const data = await res.json();
        setActivities(data.activities || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch today's activities.");
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [userDetails.referenceid]);

  // ================= METRICS LOGIC =================

  // Total sales today
  const totalSalesToday = activities.reduce(
    (sum, act) => sum + (act.actual_sales || 0),
    0
  );

  // 1. All quotations pending client approval
  const pendingClientApprovalCount = activities.filter(
    (act) =>
      act.status === "Quote-Done" &&
      act.quotation_status === "Pending Client Approval"
  ).length;

  // 2. SPF SPECIFIC COUNTS (HIWA-HIWALAY)

  const spfPendingClientApproval = activities.filter(
    (act) =>
      act.call_type === "Quotation with SPF Preparation" &&
      act.quotation_status === "Pending Client Approval"
  ).length;

  const spfPendingProcurement = activities.filter(
    (act) =>
      act.call_type === "Quotation with SPF Preparation" &&
      act.quotation_status === "Pending Procurement"
  ).length;

  const spfPendingPD = activities.filter(
    (act) =>
      act.call_type === "Quotation with SPF Preparation" &&
      act.quotation_status === "Pending PD"
  ).length;

  // =================================================

  // Helper: Compute total time consumed in milliseconds
  const computeTimeConsumed = (activities: any[]) => {
    return activities.reduce((total, act) => {
      if (!act.start_date || !act.end_date) return total;

      const start = new Date(act.start_date).getTime();
      const end = new Date(act.end_date).getTime();

      if (isNaN(start) || isNaN(end) || end < start) return total;

      return total + (end - start);
    }, 0);
  };

  // Calculate total time consumed
  useEffect(() => {
    if (!activities || activities.length === 0) {
      setTimeConsumedMs(0);
      return;
    }

    setLoadingTime(true);

    try {
      const totalMs = computeTimeConsumed(activities);
      setTimeConsumedMs(totalMs);
    } finally {
      setLoadingTime(false);
    }
  }, [activities]);

  // Helper: Format milliseconds to hh:mm:ss
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed bottom-6 right-4 w-200 bg-white rounded-lg shadow-xl z-50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              End of Day Report
            </DialogTitle>

            <DialogDescription className="text-xs text-muted-foreground">
              {loadingUser
                ? "Loading Reference ID..."
                : `Reference ID: ${userDetails.referenceid}`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2 text-sm">
            <ul className="list-disc pl-5">
              <li>Outbound per Day</li>
              <li>500 Clients</li>
              <li>Overdue of Scheduled Activity</li>
              <li>Count of New Account Dev Reach Outbound</li>

              <li>
                Time Consumed:{" "}
                {loadingTime ? "Calculating..." : formatDuration(timeConsumedMs)}
              </li>

              <li>
                Total Sales Today:{" "}
                {loadingActivities ? "Loading..." : totalSalesToday}
              </li>

              <li>CSR Metrics Tickets</li>

              <li>
                Quotation Pending Client Approval:{" "}
                {loadingActivities ? "Loading..." : pendingClientApprovalCount}
              </li>

              <li>
                SPF - Pending Client Approval:{" "}
                {loadingActivities ? "Loading..." : spfPendingClientApproval}
              </li>

              <li>
                SPF - Pending Procurement:{" "}
                {loadingActivities ? "Loading..." : spfPendingProcurement}
              </li>

              <li>
                SPF - Pending PD:{" "}
                {loadingActivities ? "Loading..." : spfPendingPD}
              </li>
            </ul>

            {loadingActivities ? (
              <p className="text-xs text-gray-500">Loading activities...</p>
            ) : activities.length > 0 ? (
              <p className="text-xs text-gray-600">
                {activities.length} activity records today.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                No activities recorded today.
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!open && (
        <Button
          variant="destructive"
          size="sm"
          className="fixed bottom-15 right-5 z-50 rounded-lg p-6"
          onClick={() => setOpen(true)}
        >
          <AlertCircle size={20} /> Breaches of the Day
        </Button>
      )}
    </>
  );
}
