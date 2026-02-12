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
import { Input } from "@/components/ui/input";
import { ChartArea } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

/* -------------------- Helpers -------------------- */
const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

type TimeByActivity = Record<string, number>;

const computeTimeByActivity = (activities: any[]): TimeByActivity => {
  return activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;

    const start = new Date(act.start_date).getTime();
    const end = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;

    const duration = end - start;
    const key = act.type_activity;
    acc[key] = (acc[key] || 0) + duration;
    return acc;
  }, {} as TimeByActivity);
};

/* -------------------- Component -------------------- */
export function BreachesDialog() {
  const [open, setOpen] = useState(false);

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const [userDetails, setUserDetails] = useState<{ referenceid: string; role: string }>({
    referenceid: "",
    role: "",
  });

  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  const [activities, setActivities] = useState<any[]>([]);
  const [timeByActivity, setTimeByActivity] = useState<TimeByActivity>({});
  const [timeConsumedMs, setTimeConsumedMs] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [newClientCount, setNewClientCount] = useState(0);

  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);

  const [overdueCount, setOverdueCount] = useState(0);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  /* -------------------- Sync URL userId -------------------- */
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  /* -------------------- Fetch User -------------------- */
  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");

        const data = await res.json();
        setUserDetails({
          referenceid: data.ReferenceID || "",
          role: data.Role || "",
        });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load user data.");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [userId]);

  /* -------------------- Fetch Activities (metrics) -------------------- */
  const fetchActivities = async () => {
    if (!userDetails.referenceid || !fromDate || !toDate) return;
    setLoadingActivities(true);

    try {
      const res = await fetch(
        `/api/activity/tsa/breaches/fetch?referenceid=${encodeURIComponent(
          userDetails.referenceid
        )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
      );
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch activities.");
    } finally {
      setLoadingActivities(false);
    }
  };

  /* -------------------- Fetch Overdue -------------------- */
  const fetchOverdue = async () => {
    if (!userDetails.referenceid || !fromDate || !toDate) return;

    setLoadingOverdue(true);

    try {
      const res = await fetch(
        `/api/activity/tsa/breaches/fetch-activity?referenceid=${encodeURIComponent(
          userDetails.referenceid
        )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
      );

      if (!res.ok) throw new Error("Failed to fetch overdue activities");

      const data = await res.json();

      // API na ang nagbigay ng overdue, no need to filter here
      setOverdueCount((data.activities || []).length);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch overdue activities.");
    } finally {
      setLoadingOverdue(false);
    }
  };

  /* -------------------- Compute Time Consumed -------------------- */
  useEffect(() => {
    if (!activities.length) {
      setTimeByActivity({});
      setTimeConsumedMs(0);
      return;
    }

    setLoadingTime(true);
    try {
      const grouped = computeTimeByActivity(activities);
      setTimeByActivity(grouped);

      const total = Object.values(grouped).reduce((sum, ms) => sum + ms, 0);
      setTimeConsumedMs(total);
    } finally {
      setLoadingTime(false);
    }
  }, [activities]);

  /* -------------------- Metrics Counts -------------------- */
  useEffect(() => {
    if (!activities.length) return;

    const filteredActivities = activities.filter((act) => act.call_status === "Successful");
    setTotalSales(filteredActivities.reduce((sum, act) => sum + (act.actual_sales || 0), 0));
    setNewClientCount(filteredActivities.filter((act) => act.type_client === "New Client").length);

    setPendingClientApprovalCount(
      activities.filter(
        (act) => act.status === "Quote-Done" && act.quotation_status === "Pending Client Approval"
      ).length
    );

    setSpfPendingClientApproval(
      activities.filter(
        (act) => act.call_type === "Quotation with SPF Preparation" && act.quotation_status === "Pending Client Approval"
      ).length
    );

    setSpfPendingProcurement(
      activities.filter(
        (act) => act.call_type === "Quotation with SPF Preparation" && act.quotation_status === "Pending Procurement"
      ).length
    );

    setSpfPendingPD(
      activities.filter(
        (act) => act.call_type === "Quotation with SPF Preparation" && act.quotation_status === "Pending PD"
      ).length
    );
  }, [activities]);

  /* -------------------- UI -------------------- */
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed bottom-6 right-4 bg-white rounded-lg shadow-xl z-50 overflow-auto"
          style={{ width: "90vh", height: "70vh" }}
        >
          <DialogHeader>
            <DialogTitle>End of Day Report</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {loadingUser ? "Loading Reference ID..." : `Reference ID: ${userDetails.referenceid}`}
            </DialogDescription>

            <div className="mt-2 flex space-x-2 flex-wrap">
              <Input type="date" className="flex-1 min-w-[120px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" className="flex-1 min-w-[120px]" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <Button
                onClick={() => {
                  fetchActivities(); // metrics
                  fetchOverdue();    // overdue
                  setOpen(true);
                }}
                disabled={loadingActivities || loadingOverdue}
              >
                {loadingActivities || loadingOverdue ? <Spinner /> : "Fetch"}
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>Outbound per Day</li>
              <li>500 Clients</li>
              <li>
                <strong className="text-red-500">
                  Overdue of Scheduled Activity (Not Call Within the Day):
                </strong>{" "}
                <span className="ml-1">{overdueCount}</span>
              </li>

              <li><strong>Count of New Account Devt (OB-Touchbase):</strong> {newClientCount}</li>
              <li>
                <strong>Time Consumed:</strong> {formatDuration(timeConsumedMs)}
                <ul className="pl-4 list-disc text-sm mt-1 space-y-1">
                  {loadingTime && <li>Computing...</li>}
                  {!loadingTime &&
                    Object.entries(timeByActivity).map(([type, ms]) => (
                      <li key={type}>
                        {type}: {formatDuration(ms)}
                      </li>
                    ))}
                </ul>
              </li>
              <li><strong>Total Sales Today:</strong> ₱{totalSales.toLocaleString()}</li>
              <li>CSR Metrics Tickets</li>
              <li>
                <strong>Closing of Quotation</strong>
                <ul className="pl-4 list-disc text-sm mt-1 space-y-1">
                  <li className="text-red-500">Quotation Pending Client Approval: {pendingClientApprovalCount}</li>
                  <li className="text-red-500">SPF - Pending Client Approval: {spfPendingClientApproval}</li>
                  <li className="text-red-500">SPF - Pending Procurement: {spfPendingProcurement}</li>
                  <li className="text-red-500">SPF - Pending PD: {spfPendingPD}</li>
                </ul>
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <button
        className="fixed bottom-15 right-5 z-50 w-16 h-16 bg-blue-900 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform duration-200"
        onClick={() => {
          setOpen(true);
          fetchActivities();
          fetchOverdue();
        }}
      >
        <ChartArea size={28} />
      </button>
    </>
  );
}
