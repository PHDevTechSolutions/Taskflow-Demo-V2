"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CheckCircle2Icon, AlertCircleIcon, CheckCircle2, AlertCircle, PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp, Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter, Plus, MessageSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sileo } from "sileo";

import { CreateActivityDialog } from "../dialog/create";
import { CancelledDialog } from "../dialog/cancelled";
import { DoneDialog } from "../dialog/done";
import { DeliveredDialog } from "../dialog/delivered";
import { TransferDialog } from "../dialog/transfer";

import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface Activity {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  status: string;
  agent: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;
  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
}

interface Account {
  id: string;
  tsm: string;
  manager: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  type_client: string;
  address: string;
  region: string;
  account_reference_number: string;
  next_available_date?: string | null;
  status: string;
}

interface HistoryItem {
  id: string;
  activity_reference_number: string;
  callback?: string | null;
  date_followup?: string | null;
  quotation_number?: string | null;
  quotation_amount?: number | null;
  so_number?: string | null;
  so_amount?: number | null;
  call_type?: string;
  ticket_reference_number?: string;
  source?: string;
  call_status?: string;
  tsm_approved_status: string;
  type_activity: string;
  quotation_status: string;
  status?: string;
}

interface ScheduledProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  tsm: string;
  managername: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

const ALLOWED_STATUSES = ["Assisted", "Quote-Done", "On-Progress"];

// Cluster order for grouping
const clusterOrder = [
  "top 50",
  "next 30",
  "balance 20",
  "tsa client",
  "new client",
  "csr client",
];

export const Scheduled: React.FC<ScheduledProps> = ({
  referenceid,
  tsm,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  tsmDetails,
  managerDetails,
  signature,
  onCountChange,
}) => {
  // Activities and History state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Accounts state for cluster series
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDoneOpen, setDialogDoneOpen] = useState(false);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);
  const SCHEDULED_BATCH_SIZE = 10; // Show 10 initially, load more +10
  const [displayedScheduledCount, setDisplayedScheduledCount] = useState(SCHEDULED_BATCH_SIZE);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const todayStr = toLocalDateString(new Date());

  // Generate Activity Reference Number helper
  const generateActivityRef = (companyName: string, region: string) => {
    const words = companyName.trim().split(" ");
    const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
    const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
    const uniqueNumber = String(Date.now()).slice(-10);
    return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
  };

  // Fetch activities and history
  const fetchAllData = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      setHistory([]);
      return;
    }

    setActivitiesLoading(true);
    setHistoryLoading(true);

    // Use search API when debouncedSearchTerm is present, otherwise use regular fetch
    const isSearching = debouncedSearchTerm.trim().length > 0;
    const url = new URL(
      isSearching
        ? "/api/activity/tsa/planner/search"
        : "/api/activity/tsa/planner/fetch",
      window.location.origin,
    );
    url.searchParams.append("referenceid", referenceid);

    if (isSearching) {
      url.searchParams.append("search", debouncedSearchTerm);
    } else {
      // Only apply limit for regular fetch (not search)
      url.searchParams.append("limit", "500");
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities and history");
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities || []);
        setHistory(data.history || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setActivitiesLoading(false);
        setHistoryLoading(false);
      });
  }, [referenceid, debouncedSearchTerm]);

  // Fetch accounts for cluster series
  const fetchAccounts = useCallback(async () => {
    if (!referenceid) {
      setAccounts([]);
      return;
    }

    setAccountsLoading(true);
    try {
      const response = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (!response.ok) {
        setError("Failed to fetch accounts");
        return;
      }
      const data = await response.json();
      setAccounts(data.data || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    } finally {
      setAccountsLoading(false);
    }
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;

    fetchAllData();
    fetchAccounts();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity", filter: `referenceid=eq.${referenceid}` },
        () => fetchAllData()
      )
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        () => fetchAllData()
      )
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);
      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchAllData, fetchAccounts]);

  // Trigger fetch when debounced search term changes
  useEffect(() => {
    if (referenceid) {
      fetchAllData();
    }
  }, [debouncedSearchTerm, referenceid, fetchAllData]);

  // Normalize date string
  const normalizeDate = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Group accounts by cluster with date condition
  const groupByCluster = (accounts: Account[], dateCondition: (date: string | null) => boolean) => {
    const grouped: Record<string, Account[]> = {};
    for (const cluster of clusterOrder) {
      grouped[cluster] = accounts.filter(
        (acc) =>
          acc.type_client?.toLowerCase() === cluster &&
          dateCondition(normalizeDate(acc.next_available_date)) &&
          acc.status?.toLowerCase() !== "pending"
      );
    }
    return grouped;
  };

  // Filter accounts for search
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const status = acc.status?.toLowerCase();
      const isStatusAllowed =
        status !== "subject for transfer" &&
        status !== "removed" &&
        status !== "approved for deletion";
      return isStatusAllowed;
    });
  }, [accounts]);

  // Group accounts for today
  const groupedToday = useMemo(() => {
    return groupByCluster(filteredAccounts, (date) => date === todayStr);
  }, [filteredAccounts, todayStr]);

  // Group accounts for available (null dates)
  const groupedNull = useMemo(() => {
    return groupByCluster(filteredAccounts, (date) => date === null);
  }, [filteredAccounts]);

  // Calculate totals
  const totalTodayCount = useMemo(() => {
    return Object.values(groupedToday).reduce((sum, arr) => sum + arr.length, 0);
  }, [groupedToday]);

  const totalAvailableCount = useMemo(() => {
    return Object.values(groupedNull).reduce((sum, arr) => sum + arr.length, 0);
  }, [groupedNull]);

  // Find first non-empty cluster
  const getFirstNonEmptyCluster = (grouped: Record<string, Account[]>, orderedList: string[]) => {
    for (const cluster of orderedList) {
      if (grouped[cluster]?.length) return cluster;
    }
    return null;
  };

  const firstAvailableCluster = getFirstNonEmptyCluster(groupedNull, clusterOrder);
  const firstTodayCluster = getFirstNonEmptyCluster(groupedToday, clusterOrder);

  // Factory function to create handler for cluster accounts
  const createActivityHandler = (account: Account) => async () => {
    // Calculate next available date
    const now = new Date();
    let newDate: Date;
    if (account.type_client.toLowerCase() === "top 50") {
      newDate = new Date(now.setDate(now.getDate() + 14));
    } else {
      newDate = new Date(now.setMonth(now.getMonth() + 1));
    }

    const nextAvailableDate = newDate.toISOString().split("T")[0];

    try {
      await fetch("/api/act-update-account-next-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, next_available_date: nextAvailableDate }),
      });

      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
      await fetchAllData();
    } catch (err) {
      console.error("Error updating next available date:", err);
    }
  };

  // Filter activities
  const mergedActivities = useMemo(() => {
    return activities
      .filter((a) => ALLOWED_STATUSES.includes(a.status))
      .map((activity) => {
        const relatedHistoryItems = history.filter(
          (h) => h.activity_reference_number === activity.activity_reference_number
        );
        return { ...activity, relatedHistoryItems };
      });
  }, [activities, history]);

  const filteredActivities = useMemo(() => {
    return mergedActivities
      .filter((item) => {
        const itemScheduledDate = toLocalDateString(item.scheduled_date);

        // Search is now server-side, no client-side filtering needed
        if (dateCreatedFilterRange?.from) {
          const fromDate = toLocalDateString(dateCreatedFilterRange.from);
          const toDate = dateCreatedFilterRange.to ? toLocalDateString(dateCreatedFilterRange.to) : fromDate;
          if (itemScheduledDate < todayStr) return false;
          if (itemScheduledDate < fromDate || itemScheduledDate > toDate) return false;
        } else {
          if (itemScheduledDate !== todayStr) return false;
        }

        if (statusFilter !== "All" && item.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());
  }, [mergedActivities, dateCreatedFilterRange, todayStr, statusFilter]);

  // Paginated data for lazy loading
  const displayedScheduledData = filteredActivities.slice(0, displayedScheduledCount);
  const hasMoreScheduled = filteredActivities.length > displayedScheduledCount;

  // Reset pagination when search or filter changes
  useEffect(() => {
    setDisplayedScheduledCount(SCHEDULED_BATCH_SIZE);
  }, [debouncedSearchTerm, statusFilter]);

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities, onCountChange]);

  // Dialog handlers
  const openCancelledDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
  };

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId || !cancellationRemarks) return;

    try {
      setUpdatingId(selectedActivityId);
      setDialogOpen(false);

      const res = await fetch("/api/act-cancelled-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, cancellation_remarks: cancellationRemarks }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({
          title: "Failed",
          description: `Failed to update: ${result.error || "Unknown error"}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      await fetchAllData();
      window.location.reload();
      sileo.success({
        title: "Success",
        description: "Transaction marked as Cancelled.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "Error updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const openDeliveredDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogDeliveredOpen(true);
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);

      const res = await fetch("/api/act-update-status-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({
          title: "Failed",
          description: result.error || "Failed to update",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      setDialogDeliveredOpen(false);
      await fetchAllData();
      window.location.reload();
      sileo.success({
        title: "Success",
        description: "Transaction marked as Completed.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "Error updating status.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const openTransferDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogTransferOpen(true);
  };

  const handleConfirmTransfer = async (selectedUserReferenceID: string | undefined) => {
    if (!selectedActivityId || !selectedUserReferenceID) {
      sileo.error({
        title: "Failed",
        description: "Please select a user.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      setUpdatingId(selectedActivityId);
      setDialogTransferOpen(false);

      const res = await fetch("/api/act-transfer-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, newReferenceID: selectedUserReferenceID }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({
          title: "Failed",
          description: result.error || "Failed to transfer",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      await fetchAllData();
      sileo.success({
        title: "Success",
        description: "Transaction transferred.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed",
        description: "Error transferring.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  function getBadgeProps(status: string, isFutureDate: boolean) {
    switch (status) {
      case "Assisted":
        return { variant: "secondary" as const, className: "bg-orange-500 text-white" };
      case "On-Progress":
        return { variant: "secondary" as const, className: "bg-orange-500 text-white" };
      case "SO-Done":
        return { variant: "default" as const, className: "bg-yellow-400 text-white" };
      case "Quote-Done":
        return { variant: "outline" as const, className: isFutureDate ? "bg-blue-800 text-white" : "bg-blue-500 text-white" };
      case "Cancelled":
        return { variant: "destructive" as const, className: "bg-red-600 text-white" };
      default:
        return { variant: "default" as const };
    }
  }

  function getStatusStyles(status: string, isFutureDate: boolean) {
    switch (status) {
      case "Assisted":
        return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
      case "On-Progress":
        return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
      case "SO-Done":
        return { badgeClass: "bg-yellow-400 text-white", bgClass: "bg-yellow-100" };
      case "Quote-Done":
        return { badgeClass: isFutureDate ? "bg-blue-800 text-white" : "bg-blue-500 text-white", bgClass: "bg-blue-100" };
      case "Cancelled":
        return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
      default:
        return { badgeClass: "", bgClass: "bg-white" };
    }
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber = selectedActivity?.ticket_reference_number || null;

  const activeDateLabel = (() => {
    if (dateCreatedFilterRange?.from) {
      const from = toLocalDateString(dateCreatedFilterRange.from);
      const to = dateCreatedFilterRange.to ? toLocalDateString(dateCreatedFilterRange.to) : from;
      return from === to ? `Scheduled: ${from}` : `Scheduled: ${from} → ${to}`;
    }
    return `Scheduled today: ${todayStr}`;
  })();

  return (
    <>
      {/* ─── Search and Filter ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 w-full mb-2">
        <Input
          type="search"
          placeholder="Search..."
          className="text-xs grow rounded-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="whitespace-nowrap rounded-none">
              {statusFilter === "All" ? <Filter /> : statusFilter} Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setStatusFilter("All")}>
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
              All
            </DropdownMenuItem>
            {ALLOWED_STATUSES.map((status) => {
              const { badgeClass } = getStatusStyles(status, false);
              return (
                <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                  <span className="capitalize">{status}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active date indicator */}
      <p className="text-[10px] text-muted-foreground mb-1 px-1">{activeDateLabel}</p>

      <div className="max-h-[70vh] overflow-auto space-y-6 custom-scrollbar">
        {/* ─── OB Calls Account for Today (Cluster Series) ───────────────── */}
        {totalTodayCount > 0 && firstTodayCluster && (
          <section>
            <h2 className="text-xs font-bold mb-4">OB Calls Account for Today ({groupedToday[firstTodayCluster].length})</h2>

            <Alert className="font-mono rounded-xl shadow-lg mb-2">
              <CheckCircle2 />
              <AlertTitle className="text-xs font-bold">CLUSTER SERIES: {firstTodayCluster.toUpperCase()}</AlertTitle>
              <AlertDescription className="text-xs italic">
                {groupedToday[firstTodayCluster].length} account{groupedToday[firstTodayCluster].length !== 1 ? "s" : ""} scheduled for today
              </AlertDescription>
            </Alert>

            <Accordion type="single" collapsible className="w-full">
              {groupedToday[firstTodayCluster].map((account) => (
                <AccordionItem key={account.id} value={account.id} className="border border-green-300 rounded-sm mb-2 uppercase">
                  <div className="flex justify-between items-center p-2 select-none">
                    <AccordionTrigger className="flex-1 text-xs font-semibold font-mono">
                      {account.company_name}
                    </AccordionTrigger>
                    <div className="flex gap-2 ml-4">
                      <CreateActivityDialog
                        firstname={firstname}
                        lastname={lastname}
                        target_quota={target_quota}
                        email={email}
                        contact={contact}
                        tsmname={tsmname}
                        managername={managername}
                        referenceid={referenceid}
                        tsm={account.tsm}
                        manager={account.manager}
                        type_client={account.type_client}
                        contact_number={account.contact_number}
                        email_address={account.email_address}
                        activityReferenceNumber={generateActivityRef(account.company_name, account.region || "NCR")}
                        ticket_reference_number="-"
                        agent={`${firstname} ${lastname}`}
                        company_name={account.company_name}
                        contact_person={account.contact_person}
                        address={account.address}
                        accountReferenceNumber={account.account_reference_number}
                        onCreated={createActivityHandler(account)}
                        managerDetails={managerDetails ?? null}
                        tsmDetails={tsmDetails ?? null}
                        signature={signature}
                      />
                    </div>
                  </div>

                  <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                    <p><strong>Contact:</strong> {account.contact_number}</p>
                    <p><strong>Email:</strong> {account.email_address}</p>
                    <p><strong>Client Type:</strong> {account.type_client}</p>
                    <p><strong>Address:</strong> {account.address}</p>
                    <p className="text-[8px]">{account.account_reference_number}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* ─── Available OB Calls ───────────────────────────────────────── */}
        {totalAvailableCount > 0 && firstAvailableCluster && (
          <section>
            <h2 className="text-xs font-bold mb-4">Available OB Calls ({groupedNull[firstAvailableCluster].length})</h2>

            <Alert className="font-mono rounded-xl shadow-lg mb-2">
              <CheckCircle2 />
              <AlertTitle className="text-xs font-bold">CLUSTER SERIES: {firstAvailableCluster.toUpperCase()}</AlertTitle>
              <AlertDescription className="text-xs italic">
                Available accounts ready for scheduling
              </AlertDescription>
            </Alert>

            <Accordion type="single" collapsible className="w-full border rounded-none shadow-sm border-blue-200 uppercase">
              {groupedNull[firstAvailableCluster].map((account) => (
                <AccordionItem key={account.id} value={account.id}>
                  <div className="flex justify-between items-center p-2 select-none">
                    <AccordionTrigger className="flex-1 text-xs font-semibold font-mono">
                      {account.company_name}
                    </AccordionTrigger>
                    <div className="flex gap-2 ml-4">
                      <CreateActivityDialog
                        firstname={firstname}
                        lastname={lastname}
                        target_quota={target_quota}
                        email={email}
                        contact={contact}
                        tsmname={tsmname}
                        managername={managername}
                        referenceid={referenceid}
                        tsm={account.tsm}
                        manager={account.manager}
                        type_client={account.type_client}
                        contact_number={account.contact_number}
                        email_address={account.email_address}
                        activityReferenceNumber={generateActivityRef(account.company_name, account.region || "NCR")}
                        ticket_reference_number="-"
                        agent={`${firstname} ${lastname}`}
                        company_name={account.company_name}
                        contact_person={account.contact_person}
                        address={account.address}
                        accountReferenceNumber={account.account_reference_number}
                        onCreated={createActivityHandler(account)}
                        managerDetails={managerDetails ?? null}
                        tsmDetails={tsmDetails ?? null}
                        signature={signature}
                      />
                    </div>
                  </div>

                  <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                    <p><strong>Contact:</strong> {account.contact_number}</p>
                    <p><strong>Email:</strong> {account.email_address}</p>
                    <p><strong>Client Type:</strong> {account.type_client}</p>
                    <p><strong>Address:</strong> {account.address}</p>
                    <p className="text-[8px]">{account.account_reference_number}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        <Separator className="my-4" />

        {/* ─── Scheduled Activities ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold mb-4">Scheduled Activities ({filteredActivities.length})</h2>

          {activitiesLoading ? (
            <div className="flex justify-center items-center h-20">
              <Spinner className="size-6" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">No scheduled activities found.</p>
          ) : (
            <>
            <Accordion type="single" collapsible className="w-full">
              {displayedScheduledData.map((item) => {
                const itemDate = toLocalDateString(item.scheduled_date);
                const isFutureDate = itemDate > todayStr;
                const badgeProps = getBadgeProps(item.status, isFutureDate);
                const statusStyles = getStatusStyles(item.status, isFutureDate);

                return (
                  <AccordionItem key={item.id} value={item.id} className={`w-full border rounded-none shadow-sm mt-2 ${statusStyles.bgClass}`}>
                    <div className="p-2 select-none">
                      <div className="flex justify-between items-center">
                        <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
                          {item.company_name}
                        </AccordionTrigger>

                        <div className="flex gap-2 ml-4">
                          <CreateActivityDialog
                            firstname={firstname}
                            lastname={lastname}
                            target_quota={target_quota}
                            email={email}
                            contact={contact}
                            tsmname={tsmname}
                            managername={managername}
                            referenceid={item.referenceid}
                            tsm={item.tsm}
                            manager={item.manager}
                            type_client={item.type_client}
                            contact_number={item.contact_number}
                            email_address={item.email_address}
                            activityReferenceNumber={item.activity_reference_number}
                            ticket_reference_number={item.ticket_reference_number}
                            agent={item.agent}
                            company_name={item.company_name}
                            contact_person={item.contact_person}
                            address={item.address}
                            accountReferenceNumber={item.account_reference_number}
                            onCreated={() => fetchAllData()}
                            managerDetails={managerDetails ?? null}
                            tsmDetails={tsmDetails ?? null}
                            signature={signature}
                          />

                          {item.relatedHistoryItems.some(
                            (h) =>
                              h.tsm_approved_status &&
                              h.tsm_approved_status !== "-",
                          ) && (() => {
                            const feedbackItems = item.relatedHistoryItems.filter(
                              (h) => h.tsm_approved_status && h.tsm_approved_status !== "-"
                            );

                            return (
                              <Popover open={tsmFeedbackOpen === item.id} onOpenChange={(open) => setTsmFeedbackOpen(open ? item.id : null)}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 relative"
                                    title="TSM Feedback"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    <Badge
                                      variant="destructive"
                                      className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                                    >
                                      {feedbackItems.length}
                                    </Badge>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 rounded-none">
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase text-gray-700">TSM Feedback</p>
                                    <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
                                      {feedbackItems.map((h, idx) => (
                                        <div key={idx} className="border-b pb-2 last:border-0">
                                          <div className="font-semibold text-blue-600 uppercase py-1">
                                            {h.tsm_approved_status}
                                          </div>
                                          <div className="space-y-1 text-gray-600">
                                            {h.type_activity && h.type_activity !== "-" && (
                                              <div><span className="font-medium">Type:</span> {h.type_activity}</div>
                                            )}
                                            {h.quotation_number && h.quotation_number !== "-" && (
                                              <div><span className="font-medium">Quotation #:</span> {h.quotation_number}</div>
                                            )}
                                            {h.so_number && h.so_number !== "-" && (
                                              <div><span className="font-medium">SO #:</span> {h.so_number}</div>
                                            )}
                                            {h.call_type && h.call_type !== "-" && (
                                              <div><span className="font-medium">Call Type:</span> {h.call_type}</div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button className="cursor-pointer rounded-none">Actions <MoreVertical /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuGroup>
                                <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openDeliveredDialog(item.id); }}>
                                  <Check className="mr-2 h-4 w-4 text-green-600" /> Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openCancelledDialog(item.id); }}>
                                  <AlertCircle className="mr-2 h-4 w-4 text-red-600" /> Cancel
                                </DropdownMenuItem>
                                {item.ticket_remarks === "Reassigned" && (
                                  <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openTransferDialog(item.id); }}>
                                    <Repeat className="mr-2 h-4 w-4 text-blue-600" /> Transfer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="ml-1 flex flex-wrap gap-1 uppercase">
                        {!["assisted", "not assisted"].includes(item.status.toLowerCase()) && (
                          <Badge variant={badgeProps.variant} className={`font-mono rounded-sm shadow-md p-2 border-none text-[10px] ${badgeProps.className || ""}`}>
                            <CheckCircle2 />
                            {item.status.replace("-", " ")} /
                            {item.relatedHistoryItems.some((h) => h.quotation_status && h.quotation_status !== "-") && (
                              <span className="uppercase ml-1">
                                {Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_status ?? "-").filter((v) => v !== "-"))).join(", ")}
                              </span>
                            )}
                          </Badge>
                        )}

                        {item.relatedHistoryItems.some((h) => !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== "") &&
                          Array.from(new Set(item.relatedHistoryItems.map((h) => h.type_activity?.trim() ?? "").filter((v) => v && v !== "-"))).map((activity) => {
                            const getIcon = (act: string) => {
                              const lowerAct = act.toLowerCase();
                              if (lowerAct.includes("outbound") || lowerAct.includes("call")) return <PhoneOutgoing size={14} />;
                              if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) return <PackageCheck size={14} />;
                              if (lowerAct.includes("quotation") || lowerAct.includes("quote")) return <ReceiptText size={14} />;
                              return <Activity size={14} />;
                            };
                            return (
                              <HoverCard key={activity}>
                                <HoverCardTrigger asChild>
                                  <Badge variant="outline" className="flex items-center justify-center w-8 h-8 p-0 cursor-default">{getIcon(activity)}</Badge>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">{activity.toUpperCase()}</HoverCardContent>
                              </HoverCard>
                            );
                          })}

                        {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status.trim() !== "" && h.tsm_approved_status.trim() !== "-" && h.tsm_approved_status.toLowerCase() !== "pending") &&
                          (() => {
                            const statuses = Array.from(new Set(item.relatedHistoryItems.map((h) => h.tsm_approved_status?.trim().toLowerCase() ?? "").filter((v) => v && v !== "-" && v !== "pending")));
                            if (statuses.length === 0) return null;
                            const isDeclined = statuses.some((status) => status === "decline");
                            return (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Badge className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"}`}>
                                    {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">{isDeclined ? "Declined by TSM" : "Approved by TSM"}</HoverCardContent>
                              </HoverCard>
                            );
                          })()}
                      </div>
                    </div>

                    <AccordionContent className="text-xs px-4 py-2 uppercase">
                      <p><strong>Contact Number:</strong> {item.contact_number || "-"}</p>
                      <p><strong>Contact Person:</strong> {item.contact_person || "-"}</p>
                      <p><strong>Email Address:</strong> {item.email_address || "-"}</p>
                      <p><strong>Address:</strong> {item.address || "-"}</p>

                      <Separator className="mb-2 mt-2" />

                      {item.relatedHistoryItems.length === 0 ? (
                        <p>No quotation or SO history available.</p>
                      ) : (
                        <>
                          {item.relatedHistoryItems.some((h) => h.ticket_reference_number && h.ticket_reference_number !== "-") && (
                            <p><strong>Ticket Reference Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                            <p><strong>Sales Order Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                            <p><strong>Quotation Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                            <p><strong>Type:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                            <p><strong>Source:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.quotation_amount !== null && h.quotation_amount !== undefined) && (
                            <p><strong>Total Quotation Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.quotation_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                          )}
                          {item.relatedHistoryItems.some((h) => h.so_amount !== null && h.so_amount !== undefined) && (
                            <p><strong>Total SO Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.so_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                          )}
                          <Separator className="mb-2 mt-2" />
                          {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                            <p><strong>TSM Feedback:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                          )}
                        </>
                      )}

                      <p><strong>Date Scheduled:</strong> {new Date(item.scheduled_date).toLocaleDateString()}</p>
                      <div className="flex items-center gap-1 text-xs font-semibold">
                        <Dot />
                        <span className="text-[10px]">{item.activity_reference_number}</span>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* ─── Lazy Loading: Load More Button ─── */}
            {hasMoreScheduled && (
              <div className="flex justify-center py-4 mt-4">
                <Button
                  variant="outline"
                  className="rounded-none text-xs"
                  onClick={() => setDisplayedScheduledCount(prev => prev + SCHEDULED_BATCH_SIZE)}
                >
                  Load More ({filteredActivities.length - displayedScheduledCount} remaining)
                </Button>
              </div>
            )}
            </>
          )}
        </section>
      </div>

      <DoneDialog open={dialogDoneOpen} onOpenChange={setDialogDoneOpen} onConfirm={async () => {}} loading={updatingId !== null} />
      <DeliveredDialog open={dialogDeliveredOpen} onOpenChange={setDialogDeliveredOpen} onConfirm={handleConfirmDelivered} loading={updatingId !== null} />
      <TransferDialog open={dialogTransferOpen} onOpenChange={setDialogTransferOpen} onConfirm={(selectedUser) => { handleConfirmTransfer(selectedUser?.ReferenceID); setDialogTransferOpen(false); }} loading={updatingId === selectedActivityId} ticketReferenceNumber={selectedTicketReferenceNumber} tsm={selectedActivity?.tsm} account_reference_number={selectedActivity?.account_reference_number} />
      <CancelledDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={handleConfirmCancelled} loading={updatingId !== null} />
    </>
  );
};
