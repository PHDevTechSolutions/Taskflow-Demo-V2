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
import { ChartArea, RefreshCcw } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// -------------------- TYPES --------------------
interface Activity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

interface UserDetails {
  referenceid: string;
  firstname: string;
  lastname: string;
  role: string;
}

interface ClientSegments {
  top50: number;
  next30: number;
  balance20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  inbound: number;
  outbound: number;
}

interface Denominators {
  total: number;
  top50: number;
  next30: number;
  bal20: number;
  csrClient: number;
  tsaClient: number;
  newClient: number;
}

// -------------------- COMPONENT --------------------
export function BreachesTSMDialog() {
  const [open, setOpen] = useState(false);
  const [showVisitedDetails, setShowVisitedDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompanyActivities, setShowCompanyActivities] = useState(false);

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    firstname: "",
    lastname: "",
    role: "",
  });

  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [clusterAccounts, setClusterAccounts] = useState<Activity[]>([]);
  const [uniqueActivitiesList, setUniqueActivitiesList] = useState<Activity[]>([]);
  const [uniqueClientReach, setUniqueClientReach] = useState(0);

  const [clientSegments, setClientSegments] = useState<ClientSegments>({
    top50: 0,
    next30: 0,
    balance20: 0,
    csrClient: 0,
    newClient: 0,
    tsaClient: 0,
    inbound: 0,
    outbound: 0,
  });

  const [denominators, setDenominators] = useState<Denominators>({
    total: 0,
    top50: 0,
    next30: 0,
    bal20: 0,
    csrClient: 0,
    newClient: 0,
    tsaClient: 0,
  });

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  // -------------------- Sync URL userId --------------------
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // -------------------- Fetch Cluster Data --------------------
  const fetchClusterData = async (refId: string) => {
    if (!refId) return;

    try {
      const res = await fetch(
        `/api/com-fetch-cluster-account-tsm?tsm=${encodeURIComponent(refId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch cluster");

      const data = await res.json();
      const allAccounts = data.data || [];

      // ✅ Filter only ACTIVE accounts first
      const activeOnly = allAccounts.filter(
        (a: any) => (a.status || "").toLowerCase() === "active"
      );

      // Denominators based only on ACTIVE accounts
      setDenominators({
        total: activeOnly.length,
        top50: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "top 50"
        ).length,
        next30: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "next 30"
        ).length,
        bal20: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "balance 20"
        ).length,
        csrClient: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "csr client"
        ).length,
        newClient: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "new client"
        ).length,
        tsaClient: activeOnly.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === "tsa client"
        ).length,
      });

      // Set cluster accounts with normalized type_client
      setClusterAccounts(
        activeOnly.map((a: any) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, ""), // remove spaces
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch cluster data.");
    }
  };

  // -------------------- Fetch User --------------------
  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        const refId = data.ReferenceID || "";
        setUserDetails({
          referenceid: refId,
          firstname: data.Firstname || "",
          lastname: data.Lastname || "",
          role: data.Role || "",
        });
        if (refId) fetchClusterData(refId);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load user");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [userId]);

  // -------------------- Fetch Activities --------------------
  const fetchActivities = async () => {
    if (!userDetails.referenceid || !fromDate) return;
    setLoadingActivities(true);

    const selectedDate = new Date(fromDate);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const sevenDaysAgo = new Date(selectedDate);
    sevenDaysAgo.setDate(selectedDate.getDate() - 7);
    const fetchFromDate = (sevenDaysAgo < startOfMonth ? sevenDaysAgo : startOfMonth).toISOString().split("T")[0];

    try {
      const res = await fetch(
        `/api/activity/tsm/breaches/fetch?tsm=${encodeURIComponent(userDetails.referenceid)}&from=${encodeURIComponent(fetchFromDate)}&to=${encodeURIComponent(fromDate)}`
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

  // -------------------- Compute Unique Client Reach --------------------
  useEffect(() => {
    if (!clusterAccounts.length) {
      setUniqueClientReach(0);
      setUniqueActivitiesList([]);
      setClientSegments({
        top50: 0,
        next30: 0,
        balance20: 0,
        csrClient: 0,
        newClient: 0,
        tsaClient: 0,
        inbound: 0,
        outbound: 0,
      });
      return;
    }

    setLoadingTime(true);

    try {
      const fromDateObj = new Date(fromDate);
      const selectedMonth = fromDateObj.getMonth();
      const selectedYear = fromDateObj.getFullYear();

      // 🔹 FILTER INBOUND / OUTBOUND ACTIVITIES SA SELECTED MONTH
      const filteredActivities = activities.filter(
        (act) =>
          act.account_reference_number &&
          act.date_created &&
          (act.type_activity === "Inbound Calls" || act.type_activity === "Outbound Calls") &&
          new Date(act.date_created).getMonth() === selectedMonth &&
          new Date(act.date_created).getFullYear() === selectedYear
      );

      setUniqueActivitiesList(filteredActivities);

      // 🔹 COUNT INBOUND / OUTBOUND
      let inboundCount = 0;
      let outboundCount = 0;
      filteredActivities.forEach((act) => {
        if (act.type_activity === "Inbound Calls") inboundCount++;
        if (act.type_activity === "Outbound Calls") outboundCount++;
      });

      // 🔹 COUNT PER SEGMENT
      const segmentCounts: Pick<ClientSegments, 'top50' | 'next30' | 'balance20' | 'csrClient' | 'newClient' | 'tsaClient'> = {
        top50: 0,
        next30: 0,
        balance20: 0,
        csrClient: 0,
        newClient: 0,
        tsaClient: 0,
      };

      filteredActivities.forEach((act) => {
        const account = clusterAccounts.find(
          (acc) => acc.account_reference_number === act.account_reference_number
        );
        if (!account?.type_client) return;

        switch (account.type_client.toLowerCase()) {
          case "top50":
            segmentCounts.top50++;
            break;
          case "next30":
            segmentCounts.next30++;
            break;
          case "balance20":
            segmentCounts.balance20++;
            break;
          case "csrclient":
            segmentCounts.csrClient++;
            break;
          case "newclient":
            segmentCounts.newClient++;
            break;
          case "tsaclient":
            segmentCounts.tsaClient++;
            break;
        }
      });

      // 🔹 MISSING CLIENTS (clients na wala sa activities)
      const totalAccountsBySegment = {
        top50: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "top50").length,
        next30: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "next30").length,
        balance20: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "balance20").length,
        csrClient: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "csrclient").length,
        newClient: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "newclient").length,
        tsaClient: clusterAccounts.filter((c) => c.type_client?.toLowerCase() === "tsaclient").length,
      };

      const missingClientsCount =
        totalAccountsBySegment.top50 - segmentCounts.top50 +
        totalAccountsBySegment.next30 - segmentCounts.next30 +
        totalAccountsBySegment.balance20 - segmentCounts.balance20 +
        totalAccountsBySegment.csrClient - segmentCounts.csrClient +
        totalAccountsBySegment.newClient - segmentCounts.newClient +
        totalAccountsBySegment.tsaClient - segmentCounts.tsaClient;

      // 🔹 SET STATE SAFELY
      setUniqueClientReach(filteredActivities.length);
      setClientSegments({
        ...segmentCounts,      // top50, next30, balance20, csrClient, newClient, tsaClient
        inbound: inboundCount,
        outbound: outboundCount,
      });
    } finally {
      setLoadingTime(false);
    }
  }, [activities, clusterAccounts, fromDate]);
  // -------------------- Manual Sync --------------------
  const handleManualSync = () => {
    fetchClusterData(userDetails.referenceid);
    fetchActivities();
    toast.info(`Debugging data for Ref: ${userDetails.referenceid} on ${fromDate}`);
  };

  // -------------------- UI --------------------
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed bottom-6 right-4 bg-white rounded-none shadow-xl z-50 overflow-auto border border-gray-100"
          style={{ width: "95vw", maxWidth: "1000px", height: "75vh" }}
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-bold text-[#121212]">
              End of Day Report | SALES
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {loadingUser
                ? "Loading Reference ID..."
                : `Name: ${userDetails?.lastname ?? ""}, ${userDetails?.firstname ?? ""}`}
            </DialogDescription>
          </DialogHeader>

          {/* Debug Panel */}
          <div className="p-3 mb-4 bg-[#F9FAFA] border border-gray-200 rounded-md">
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
                    setUserDetails({ ...userDetails, referenceid: e.target.value })
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
              <RefreshCcw size={12} className={loadingActivities ? "animate-spin" : ""} />
              Sync Debug Parameters
            </Button>
          </div>

          {/* Territory Coverage */}
          <div className="grid grid-cols-1 gap-4 text-sm font-sans">
            <ul className="list-none">
              <li className="p-3 bg-[#F9FAFA] border border-gray-200 rounded-none shadow-sm cursor-pointer">
                <div className="mb-2">
                  <strong className="text-[#121212] uppercase text-[11px] tracking-tight block">
                    Database Coverage
                  </strong>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full"
                        style={{ width: `${(uniqueClientReach / denominators.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-blue-700 whitespace-nowrap">
                      {uniqueClientReach} / {denominators.total}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mt-3">
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Top 50</p>
                    <p className="text-xs font-bold">
                      {clientSegments.top50} <span className="text-[10px] text-gray-400">/ {denominators.top50}</span>
                    </p>
                  </div>
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Next 30</p>
                    <p className="text-xs font-bold">
                      {clientSegments.next30} <span className="text-[10px] text-gray-400">/ {denominators.next30}</span>
                    </p>
                  </div>
                  <div className="bg-white p-1.5 border border-gray-100 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Balance 20</p>
                    <p className="text-xs font-bold">
                      {clientSegments.balance20} <span className="text-[10px] text-gray-400">/ {denominators.bal20}</span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                  <span>CSR Base: <strong>{clientSegments.csrClient} / {denominators.csrClient}</strong></span>
                  <span>New Leads: <strong>{clientSegments.newClient} / {denominators.newClient}</strong></span>
                  <span>TSA Leads: <strong>{clientSegments.tsaClient} / {denominators.tsaClient}</strong></span>
                  <span className="italic text-blue-600">
                    IN: {clientSegments.inbound} | OUT: {clientSegments.outbound}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-none p-6" onClick={() => setOpen(false)}>
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
        }}
      >
        <ChartArea size={28} />
      </button>
    </>
  );
}
