"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartArea } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner"

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
  const [loadingTime, setLoadingTime] = useState(false);

  const [userDetails, setUserDetails] = useState<{ referenceid: string; role: string }>({
    referenceid: "",
    role: "",
  });
  // Filtering Dates
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  // Activities
  const [activities, setActivities] = useState<any[]>([]);
  // Count Time Consumed
  const [timeByActivity, setTimeByActivity] = useState<TimeByActivity>({});
  const [timeConsumedMs, setTimeConsumedMs] = useState(0);
  // Count Total Sales
  const [totalSales, setTotalSales] = useState(0);
  // Count New Client Devt OB Touchbase Successful
  const [newClientCount, setNewClientCount] = useState(0);
  // Count Pending of Quotations
  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);

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
          role: data.Role || "", // fixed typo
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

  const userRole = userDetails.role || "";

  /* -------------------- Fetch Activities -------------------- */
  const fetchActivities = async () => {
    if (!userDetails.referenceid || !fromDate || !toDate) return;

    setLoadingActivities(true);
    try {
      const url =
        `/api/activity/tsa/breaches/fetch` +
        `?referenceid=${encodeURIComponent(userDetails.referenceid)}` +
        `&from=${encodeURIComponent(fromDate)}` +
        `&to=${encodeURIComponent(toDate)}`;

      const res = await fetch(url);
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

  /* -------------------- Metrics -------------------- */
  useEffect(() => {
    if (!activities.length) {
      setTotalSales(0);
      setNewClientCount(0);
      return;
    }

    // Filter activities with call_status "Successful"
    const filteredActivities = activities.filter(
      (act) => act.call_status === "Successful"
    );

    // Sum actual_sales for filtered activities
    const total = filteredActivities.reduce((sum, act) => {
      return sum + (act.actual_sales || 0);
    }, 0);
    setTotalSales(total);

    // Count of New Client activities among filtered ones
    const newClients = filteredActivities.filter(
      (act) => act.type_client === "New Client"
    ).length;
    setNewClientCount(newClients);

    // -------------------- Quotation & SPF Counts --------------------

    // 1. All quotations pending client approval
    const pendingClientApprovalCount = activities.filter(
      (act) =>
        act.status === "Quote-Done" &&
        act.quotation_status === "Pending Client Approval"
    ).length;

    // 2. SPF SPECIFIC COUNTS
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

    // If you’re using state to display these in the UI, don’t forget to set them:
    setPendingClientApprovalCount(pendingClientApprovalCount);
    setSpfPendingClientApproval(spfPendingClientApproval);
    setSpfPendingProcurement(spfPendingProcurement);
    setSpfPendingPD(spfPendingPD);

  }, [activities]);

  /* -------------------- UI -------------------- */
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed bottom-6 right-4 w-[500px] max-h-[80vh] bg-white rounded-lg shadow-xl z-50 overflow-auto">
          <DialogHeader>
            <DialogTitle>End of Day Report</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {loadingUser
                ? "Loading Reference ID..."
                : `Reference ID: ${userDetails.referenceid}`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex space-x-2 flex-wrap">
            <Input
              type="date"
              className="flex-1 min-w-[120px]"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              type="date"
              className="flex-1 min-w-[120px]"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <Button
              onClick={fetchActivities}
              disabled={loadingActivities}
              className="flex-shrink-0"
            >
              {loadingActivities ? <Spinner /> : "Fetch"}
            </Button>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <ul className="list-disc pl-5 space-y-1">
              <li>Outbound per Day</li>
              <li>500 Clients</li>
              <li>Overdue of Scheduled Activity</li>
              <li><strong>Count of New Account Devt (OB-Touchbase):</strong> {newClientCount}</li>
              <li>
                <strong>Time Consumed:</strong> {formatDuration(timeConsumedMs)}
                <ul className="pl-4 list-disc text-xs mt-1 space-y-1">
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
              <li><strong>Closing of Quotation</strong>
                <ul className="pl-4 list-disc text-xs mt-1 space-y-1">
                  <li>Quotation Pending Client Approval: {pendingClientApprovalCount}</li>
                  <li>SPF - Pending Client Approval: {spfPendingClientApproval}</li>
                  <li>SPF - Pending Procurement: {spfPendingProcurement}</li>
                  <li>SPF - Pending PD: {spfPendingPD}</li>
                </ul>
              </li>
            </ul>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>

      </Dialog>

      {!open && userRole === "Territory Sales Associate" && (
        <button
          className="
      fixed bottom-15 right-5 z-50 
      w-16 h-16 
      bg-blue-900 text-white 
      rounded-full 
      flex items-center justify-center 
      shadow-xl 
      hover:scale-110 
      transition-transform duration-200
    "
          onClick={() => setOpen(true)}
        >
          <ChartArea size={28} />
        </button>
      )}

    </>
  );
}
