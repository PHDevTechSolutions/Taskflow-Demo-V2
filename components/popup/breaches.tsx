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
import { Input } from "@/components/ui/input"; // Added for debugging
import { ChartArea, RefreshCcw } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/* -------------------- Helpers -------------------- */
const formatHoursToHMS = (hours: number) => {
  const totalSeconds = Math.round(hours * 3600);

  const h = Math.floor(totalSeconds / 3600);

  const m = Math.floor((totalSeconds % 3600) / 60);

  const s = totalSeconds % 60;

  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
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

  const [userDetails, setUserDetails] = useState<{
    referenceid: string;
    role: string;
  }>({
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

  // Outbound Metrics State (6-Day Week)
  const [outboundDaily, setOutboundDaily] = useState(0);
  const [outboundWeekly, setOutboundWeekly] = useState(0);
  const [outboundMonthly, setOutboundMonthly] = useState(0);

  // Sales Segmentation State (Territory Coverage Logic) - UPDATED
  const [uniqueClientReach, setUniqueClientReach] = useState(0);
  const [clientSegments, setClientSegments] = useState({
    top50: 0,
    next30: 0,
    bal20: 0,
    csrClient: 0,
    newClient: 0,
    inbound: 0,
    outbound: 0,
  });

  // Dynamic Denominators from Neon DB - UPDATED
  const [denominators, setDenominators] = useState({
    total: 0,
    top50: 0,
    next30: 0,
    bal20: 0,
  });

  const [pendingClientApprovalCount, setPendingClientApprovalCount] =
    useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const [loadingCsrMetrics, setLoadingCsrMetrics] = useState(false);

  const [avgTsaAck, setAvgTsaAck] = useState("-");
  const [avgTsaHandle, setAvgTsaHandle] = useState("-");
  const [avgTsmAck, setAvgTsmAck] = useState("-");
  const [avgTsmHandle, setAvgTsmHandle] = useState("-");
  const [avgResponseTime, setAvgResponseTime] = useState(0);

  const [avgNonQuotationHT, setAvgNonQuotationHT] = useState(0);

  const [avgQuotationHT, setAvgQuotationHT] = useState(0);

  const [avgSpfHT, setAvgSpfHT] = useState(0);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  /* -------------------- Sync URL userId -------------------- */
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  /* -------------------- Fetch Cluster Denominators -------------------- */
  const fetchClusterData = async (refId: string) => {
    if (!refId) return;
    try {
      const accRes = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(refId)}`,
      );
      if (accRes.ok) {
        const accData = await accRes.json();
        const activeOnly = (accData.data || []).filter(
          (a: any) => a.status === "Active",
        );
        setDenominators({
          total: activeOnly.length,
          top50: activeOnly.filter((a: any) => a.type_client === "Top 50")
            .length,
          next30: activeOnly.filter((a: any) => a.type_client === "Next 30")
            .length,
          bal20: activeOnly.filter((a: any) => a.type_client === "Bal 20")
            .length,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* -------------------- Fetch User & Master Account Cluster -------------------- */
  useEffect(() => {
    if (!userId) return;

    const fetchUserAndCluster = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");

        const data = await res.json();
        const refId = data.ReferenceID || "";
        setUserDetails({
          referenceid: refId,
          role: data.Role || "",
        });

        if (refId) {
          fetchClusterData(refId);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load territory cluster data.");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserAndCluster();
  }, [userId]);

  useEffect(() => {
    if (!userDetails.referenceid) return;

    fetchCsrMetrics(userDetails.referenceid);
  }, [userDetails.referenceid, fromDate, toDate]);

  const fetchCsrMetrics = async (referenceid: string) => {
    setLoadingCsrMetrics(true);

    try {
      const res = await fetch(
        `/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(referenceid)}`,
      );

      const result = await res.json();

      const data = result.data || [];

      let responseTotal = 0;
      let responseCount = 0;

      let nonQuotationTotal = 0;
      let nonQuotationCount = 0;

      let quotationTotal = 0;
      let quotationCount = 0;

      let spfTotal = 0;
      let spfCount = 0;

      const excludedWrapUps = [
        "CustomerFeedback/Recommendation",
        "Job Inquiry",
        "Job Applicants",
        "Supplier/Vendor Product Offer",
        "Internal Whistle Blower",
        "Threats/Extortion/Intimidation",
        "Prank Call",
      ];

      data.forEach((row: any) => {
        /* ================= DASHBOARD STATUS FILTER ================= */

        if (row.status !== "Closed" && row.status !== "Converted into Sales")
          return;

        /* ================= DASHBOARD DATE FILTER ================= */

        const created = new Date(row.date_created).getTime();

        const from = new Date(fromDate).getTime();

        const toDateEnd = new Date(toDate);
        toDateEnd.setHours(23, 59, 59, 999);

        const to = toDateEnd.getTime();

        if (isNaN(created) || created < from || created > to) return;

        /* ================= WRAP UP FILTER ================= */

        if (excludedWrapUps.includes(row.wrap_up)) return;

        /* ================= TSA RESPONSE TIME ================= */

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();

        const endorsed = new Date(row.ticket_endorsed).getTime();

        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          responseTotal += (tsaAck - endorsed) / 3600000;

          responseCount++;
        }

        /* ================= BASE HANDLING TIME ================= */

        let baseHT = 0;

        const tsaHandle = new Date(row.tsa_handling_time).getTime();

        const tsmHandle = new Date(row.tsm_handling_time).getTime();

        const received = new Date(row.ticket_received).getTime();

        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (
          !isNaN(tsmHandle) &&
          !isNaN(received) &&
          tsmHandle >= received
        ) {
          baseHT = (tsmHandle - received) / 3600000;
        }

        if (!baseHT) return;

        /* ================= REMARKS CLASSIFICATION ================= */

        const remarks = (row.remarks || "").toUpperCase();

        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          quotationTotal += baseHT;

          quotationCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT;

          spfCount++;
        } else {
          nonQuotationTotal += baseHT;

          nonQuotationCount++;
        }
      });

      /* ================= FINAL AVERAGES ================= */

      setAvgResponseTime(responseCount ? responseTotal / responseCount : 0);

      setAvgNonQuotationHT(
        nonQuotationCount ? nonQuotationTotal / nonQuotationCount : 0,
      );

      setAvgQuotationHT(quotationCount ? quotationTotal / quotationCount : 0);

      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch (err) {
      console.error("Dashboard-exact CSR Metrics error:", err);
    } finally {
      setLoadingCsrMetrics(false);
    }
  };

  /* -------------------- Fetch Activities (metrics) -------------------- */
  const fetchActivities = async () => {
    if (!userDetails.referenceid || !fromDate) return;
    setLoadingActivities(true);

    const selectedDate = new Date(fromDate);

    // Monthly Start: 1st of current month
    const startOfMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
    );

    // Weekly Start: 7 days ago (to ensure we have enough data for a 6-day rolling window)
    const sevenDaysAgo = new Date(selectedDate);
    sevenDaysAgo.setDate(selectedDate.getDate() - 7);

    // Fetch from whichever date is earlier to satisfy both Monthly and Weekly requirements
    const fetchFromDate = (
      sevenDaysAgo < startOfMonth ? sevenDaysAgo : startOfMonth
    )
      .toISOString()
      .split("T")[0];

    try {
      const res = await fetch(
        `/api/activity/tsa/breaches/fetch?referenceid=${encodeURIComponent(
          userDetails.referenceid,
        )}&from=${encodeURIComponent(fetchFromDate)}&to=${encodeURIComponent(fromDate)}`,
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
          userDetails.referenceid,
        )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch overdue activities");
      const data = await res.json();
      setOverdueCount((data.activities || []).length);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch overdue activities.");
    } finally {
      setLoadingOverdue(false);
    }
  };

  /* -------------------- Manual Debug Sync -------------------- */
  const handleManualSync = () => {
    fetchClusterData(userDetails.referenceid);
    fetchActivities();
    fetchOverdue();
    toast.info(
      `Debugging data for Ref: ${userDetails.referenceid} on ${fromDate}`,
    );
  };

  /* -------------------- Compute Time Consumed & Quotas -------------------- */
  useEffect(() => {
    if (!activities.length) {
      setTimeByActivity({});
      setTimeConsumedMs(0);
      setOutboundDaily(0);
      setOutboundWeekly(0);
      setOutboundMonthly(0);
      setUniqueClientReach(0);
      return;
    }

    setLoadingTime(true);
    try {
      const targetPoint = new Date(fromDate);

      const daily = activities.filter((act) => {
        const actDate = new Date(act.date_created);
        return (
          actDate.toDateString() === targetPoint.toDateString() &&
          (act.type_activity === "Outbound Calls" || act.source === "history")
        );
      }).length;

      const sixDaysAgo = new Date(targetPoint);
      sixDaysAgo.setDate(targetPoint.getDate() - 6);
      const weekly = activities.filter((act) => {
        const actDate = new Date(act.date_created);
        const actDateTime = new Date(actDate.toDateString()).getTime();
        const startRange = new Date(sixDaysAgo.toDateString()).getTime();
        const endRange = new Date(targetPoint.toDateString()).getTime();

        return (
          actDateTime >= startRange &&
          actDateTime <= endRange &&
          (act.type_activity === "Outbound Calls" || act.source === "history")
        );
      }).length;

      const monthly = activities.filter((act) => {
        const actDate = new Date(act.date_created);
        return (
          actDate.getMonth() === targetPoint.getMonth() &&
          actDate.getFullYear() === targetPoint.getFullYear() &&
          (act.type_activity === "Outbound Calls" || act.source === "history")
        );
      }).length;

      setOutboundDaily(daily);
      setOutboundWeekly(weekly);
      setOutboundMonthly(monthly);

      // Territory Coverage Logic (Unique Identifier Map)
      const uniqueMap = new Map();
      activities.forEach((act) => {
        const identifier = act.account_reference_number || act.company_name;
        if (!uniqueMap.has(identifier)) {
          uniqueMap.set(identifier, act);
        }
      });
      const uniqueActivities = Array.from(uniqueMap.values());

      setUniqueClientReach(uniqueActivities.length);

      setClientSegments({
        top50: uniqueActivities.filter((a) => a.type_client === "Top 50")
          .length,
        next30: uniqueActivities.filter((a) => a.type_client === "Next 30")
          .length,
        bal20: uniqueActivities.filter((a) => a.type_client === "Bal 20")
          .length,
        csrClient: uniqueActivities.filter(
          (a) => a.type_client === "CSR Client",
        ).length,
        newClient: uniqueActivities.filter(
          (a) => a.type_client === "New Client",
        ).length,
        inbound: activities.filter(
          (a) =>
            a.call_type === "Inbound" || a.type_activity?.includes("Inbound"),
        ).length,
        outbound: activities.filter(
          (a) =>
            a.call_type === "Outbound" || a.type_activity?.includes("Outbound"),
        ).length,
      });

      const grouped = computeTimeByActivity(activities);
      setTimeByActivity(grouped);

      const total = Object.values(grouped).reduce((sum, ms) => sum + ms, 0);
      setTimeConsumedMs(total);
    } finally {
      setLoadingTime(false);
    }
  }, [activities, fromDate]);

  /* -------------------- Metrics Counts -------------------- */
  useEffect(() => {
    if (!activities.length) return;

    const filteredActivities = activities.filter(
      (act) => act.call_status === "Successful",
    );
    setTotalSales(
      filteredActivities.reduce((sum, act) => sum + (act.actual_sales || 0), 0),
    );
    setNewClientCount(
      filteredActivities.filter((act) => act.type_client === "New Client")
        .length,
    );

    setPendingClientApprovalCount(
      activities.filter(
        (act) =>
          act.status === "Quote-Done" &&
          act.quotation_status === "Pending Client Approval",
      ).length,
    );

    setSpfPendingClientApproval(
      activities.filter(
        (act) =>
          act.call_type === "Quotation with SPF Preparation" &&
          act.quotation_status === "Pending Client Approval",
      ).length,
    );

    setSpfPendingProcurement(
      activities.filter(
        (act) =>
          act.call_type === "Quotation with SPF Preparation" &&
          act.quotation_status === "Pending Procurement",
      ).length,
    );

    setSpfPendingPD(
      activities.filter(
        (act) =>
          act.call_type === "Quotation with SPF Preparation" &&
          act.quotation_status === "Pending PD",
      ).length,
    );
  }, [activities]);

  /* -------------------- UI -------------------- */
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed bottom-6 right-4 bg-white rounded-lg shadow-xl z-50 overflow-auto border border-gray-100"
          style={{ width: "90vh", height: "75vh" }}
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-bold text-[#121212]">
              End of Day Report | SALES
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {loadingUser
                ? "Loading Reference ID..."
                : `Reference ID: ${userDetails.referenceid}`}
            </DialogDescription>
          </DialogHeader>

          {/* DEBUGGING PANEL */}
          {/* <div className="p-3 mb-4 bg-[#F9FAFA] border border-gray-200 rounded-md">
            <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2">
              Debugging Calibration
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] uppercase font-semibold text-gray-400">
                  Target Reference ID
                </label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={userDetails.referenceid}
                  onChange={(e) =>
                    setUserDetails({
                      ...userDetails,
                      referenceid: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-semibold text-gray-400">
                  Target Date
                </label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setToDate(e.target.value);
                  }}
                />
              </div>
            </div>
            <Button
              className="w-full mt-3 h-8 bg-[#121212] text-[10px] uppercase gap-2 rounded-md"
              onClick={handleManualSync}
            >
              <RefreshCcw
                size={12}
                className={loadingActivities ? "animate-spin" : ""}
              />
              Sync Debug Parameters
            </Button>
          </div> */}

          <div className="space-y-4 text-sm">
            <ul className="list-none space-y-4">
              {/* LI 1: Outbound Performance */}
              <li className="p-3 bg-[#F9FAFA] border border-gray-200 rounded-md shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-[#121212] uppercase text-[11px] tracking-tight">
                    Outbound Performance (20/Day Goal)
                  </strong>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${outboundDaily >= 20 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {Math.round((outboundDaily / 20) * 100)}% Today
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="border-r border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase">Daily</p>
                    <p className="font-bold text-sm">{outboundDaily} / 20</p>
                  </div>
                  <div className="border-r border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase">
                      Weekly
                    </p>
                    <p className="font-bold text-sm">{outboundWeekly} / 120</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Monthly
                    </p>
                    <p className="font-bold text-sm">{outboundMonthly} / 480</p>
                  </div>
                </div>
              </li>

              {/* LI 2: Dynamic Territory Coverage */}
              <li className="p-3 bg-[#F9FAFA] border border-gray-200 rounded-md shadow-sm">
                <div className="mb-2">
                  <strong className="text-[#121212] uppercase text-[11px] tracking-tight block">
                    Territory Coverage (Unique Reach)
                  </strong>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full"
                        style={{
                          width: `${(uniqueClientReach / (denominators.total || 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-blue-700 whitespace-nowrap">
                      {uniqueClientReach} / {denominators.total}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mt-3">
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">
                      Top 50
                    </p>
                    <p className="text-xs font-bold">
                      {clientSegments.top50}{" "}
                      <span className="text-[10px] text-gray-400">
                        / {denominators.top50}
                      </span>
                    </p>
                  </div>
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">
                      Next 30
                    </p>
                    <p className="text-xs font-bold">
                      {clientSegments.next30}{" "}
                      <span className="text-[10px] text-gray-400">
                        / {denominators.next30}
                      </span>
                    </p>
                  </div>
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">
                      Bal 20
                    </p>
                    <p className="text-xs font-bold">
                      {clientSegments.bal20}{" "}
                      <span className="text-[10px] text-gray-400">
                        / {denominators.bal20}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                  <span>
                    CSR Base: <strong>{clientSegments.csrClient}</strong>
                  </span>
                  <span>
                    New Leads: <strong>{clientSegments.newClient}</strong>
                  </span>
                  <span className="italic text-blue-600">
                    IN: {clientSegments.inbound} | OUT:{" "}
                    {clientSegments.outbound}
                  </span>
                </div>
              </li>

              <li className="pl-5 list-disc">
                <strong className="text-red-500">Overdue Activities:</strong>{" "}
                <span className="ml-1">{overdueCount}</span>
              </li>

              <li className="pl-5 list-disc">
                <strong>New Account Devt:</strong> {newClientCount}
              </li>

              <li className="pl-5 list-disc">
                <strong>Time Consumed:</strong> {formatDuration(timeConsumedMs)}
                <ul className="pl-4 list-disc text-xs mt-1 space-y-1">
                  {!loadingTime &&
                    Object.entries(timeByActivity).map(([type, ms]) => (
                      <li key={type}>
                        {type}: {formatDuration(ms)}
                      </li>
                    ))}
                </ul>
              </li>

              <li className="pl-5 list-disc">
                <strong>Total Sales Today:</strong> ₱
                {totalSales.toLocaleString()}
              </li>

              <li className="pl-5 list-disc">
                <strong>CSR Metrics Tickets</strong>

                {loadingCsrMetrics ? (
                  <div className="text-xs text-gray-400">Loading...</div>
                ) : (
                  <ul className="pl-4 text-xs">
                    <li>
                      TSA Response Time: {formatHoursToHMS(avgResponseTime)}
                    </li>

                    <li>
                      Non-Quotation HT: {formatHoursToHMS(avgNonQuotationHT)}
                    </li>

                    <li>Quotation HT: {formatHoursToHMS(avgQuotationHT)}</li>

                    <li>SPF Handling Duration: {formatHoursToHMS(avgSpfHT)}</li>
                  </ul>
                )}
              </li>

              <li className="pl-5 list-disc font-bold">
                Closing of Quotation
                <ul className="pl-4 list-none font-normal text-xs mt-1 space-y-1">
                  <li className="text-red-500">
                    • Pending Client Approval: {pendingClientApprovalCount}
                  </li>
                  <li className="text-red-500">
                    • SPF - Pending Client: {spfPendingClientApproval}
                  </li>
                  <li className="text-red-500">
                    • SPF - Pending Procurement: {spfPendingProcurement}
                  </li>
                  <li className="text-red-500">
                    • SPF - Pending PD: {spfPendingPD}
                  </li>
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

      {/* Floating Action Button */}
      <button
        className="fixed bottom-15 right-5 z-50 w-16 h-16 bg-[#121212] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all"
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
