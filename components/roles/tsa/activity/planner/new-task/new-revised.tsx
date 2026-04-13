"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  Plus,
  TicketIcon,
  CalendarCheck2,
  Lock,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { sileo } from "sileo";
import { supabase } from "@/utils/supabase";
import { Badge } from "@/components/ui/badge";
import { AccountDialog } from "../dialog/active";
import {
  checkCompanyBlocked,
  BLOCK_NEW_TASK,
} from "@/utils/activityBlockUtils";

// ─── Constants ───────────────────────────────────────────────────────────────
const DAILY_LIMIT = 25;
const MAX_CARRYOVER = 10;
const TOP_50_RETURN_DAYS = 15;
const DEFAULT_RETURN_DAYS = 30;

// ─── Types ───────────────────────────────────────────────────────────────────
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

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface NewTaskProps {
  referenceid: string;
  onEmptyStatusChange?: (isEmpty: boolean) => void;
  userDetails: UserDetails;
  onSaveAccountAction: (data: any) => void;
  onRefreshAccountsAction: () => Promise<void>;
}

interface EndorsedTicket {
  id: string;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  wrap_up: string;
  inquiry: string;
  tsm: string;
  referenceid: string;
  agent: string;
  date_created: string;
  date_updated: string;
}

interface ActivityForCheck {
  id: string;
  account_reference_number: string;
  activity_reference_number: string;
  status: string;
  scheduled_date?: string;
  date_created: string;
}

interface HistoryForCheck {
  activity_reference_number: string;
  status?: string;
}

interface DailyAssignment {
  id: string;
  referenceid: string;
  account_reference_number: string;
  company_name: string;
  type_client: string;
  assigned_date: string;
  is_called: boolean;
  called_at: string | null;
  is_carryover: boolean;
  original_assigned_date: string | null;
  next_call_date: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const normalizeDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const computeNextCallDate = (typeClient: string): string => {
  const now = new Date();
  const days =
    typeClient.toLowerCase() === "top 50" ? TOP_50_RETURN_DAYS : DEFAULT_RETURN_DAYS;
  now.setDate(now.getDate() + days);
  return now.toISOString().split("T")[0];
};

const generateActivityRef = (companyName: string, region: string): string => {
  const words = companyName.trim().split(" ");
  const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
  const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
  const uniqueNumber = String(Date.now()).slice(-10);
  return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
};

const CLUSTER_ORDER = [
  "top 50",
  "next 30",
  "balance 20",
  "new client",
  "tsa client",
  "csr client",
];

// ─── Build today's 25-account list ───────────────────────────────────────────
const buildDailyList = (
  accounts: Account[],
  carryoverAssignments: DailyAssignment[],
  todayStr: string,
): Account[] => {
  const result: Account[] = [];
  const includedRefs = new Set<string>();

  const carryoverSlice = carryoverAssignments.slice(0, MAX_CARRYOVER);
  for (const assignment of carryoverSlice) {
    const match = accounts.find(
      (a) => a.account_reference_number === assignment.account_reference_number,
    );
    if (match && !includedRefs.has(match.account_reference_number)) {
      result.push({ ...match, _isCarryover: true } as any);
      includedRefs.add(match.account_reference_number);
    }
  }

  const remaining = () => DAILY_LIMIT - result.length;
  if (remaining() <= 0) return result;

  const BLOCKED_STATUSES = [
    "subject for transfer",
    "approved for deletion",
    "removed",
    "pending",
  ];
  const eligible = accounts.filter(
    (acc) =>
      !includedRefs.has(acc.account_reference_number) &&
      acc.status?.toLowerCase() === "active" &&
      !BLOCKED_STATUSES.includes(acc.status?.toLowerCase()),
  );

  const scheduledToday = eligible.filter(
    (acc) => normalizeDate(acc.next_available_date) === todayStr,
  );
  const neverCalled = eligible.filter(
    (acc) => normalizeDate(acc.next_available_date) === null,
  );

  const fillFromPool = (pool: Account[]) => {
    if (remaining() <= 0) return;
    for (const cluster of CLUSTER_ORDER) {
      if (remaining() <= 0) break;
      const clusterAccounts = pool.filter(
        (a) => a.type_client?.toLowerCase() === cluster,
      );
      for (const acc of clusterAccounts) {
        if (remaining() <= 0) break;
        if (!includedRefs.has(acc.account_reference_number)) {
          result.push(acc);
          includedRefs.add(acc.account_reference_number);
        }
      }
    }
  };

  fillFromPool(scheduledToday);
  fillFromPool(neverCalled);

  return result;
};

// ─── Component ───────────────────────────────────────────────────────────────
export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingActivities, setExistingActivities] = useState<ActivityForCheck[]>([]);
  const [existingHistory, setExistingHistory] = useState<HistoryForCheck[]>([]);

  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [loadingEndorsed, setLoadingEndorsed] = useState(false);
  const [errorEndorsed, setErrorEndorsed] = useState<string | null>(null);

  const [dailyAssignments, setDailyAssignments] = useState<DailyAssignment[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<EndorsedTicket | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const endorsedSoundRef = useRef<HTMLAudioElement | null>(null);
  const playedTicketIdsRef = useRef<Set<string>>(new Set());

  const todayStr = getTodayStr();

  // ── Fetch existing activities for block check ─────────────────────────────
  const fetchExistingActivities = useCallback(async () => {
    if (!referenceid) return;
    try {
      const url = new URL("/api/activity/tsa/planner/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      setExistingActivities(data.activities || []);
      setExistingHistory(data.history || []);
    } catch {
      // non-critical
    }
  }, [referenceid]);

  useEffect(() => {
    fetchExistingActivities();
  }, [fetchExistingActivities]);

  // ── Fetch today's daily assignments ──────────────────────────────────────
  const fetchDailyAssignments = useCallback(async () => {
    if (!referenceid) return;
    setLoadingDaily(true);
    try {
      const { data, error } = await supabase
        .from("agent_daily_accounts")
        .select("*")
        .eq("referenceid", referenceid)
        .eq("assigned_date", todayStr);

      if (!error && data) {
        setDailyAssignments(data as DailyAssignment[]);
      }
    } catch {
      // non-critical
    } finally {
      setLoadingDaily(false);
    }
  }, [referenceid, todayStr]);

  useEffect(() => {
    fetchDailyAssignments();
  }, [fetchDailyAssignments]);

  // ── Fetch carryover from yesterday ───────────────────────────────────────
  const [carryoverAccounts, setCarryoverAccounts] = useState<DailyAssignment[]>([]);

  const fetchCarryover = useCallback(async () => {
    if (!referenceid) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    try {
      const { data, error } = await supabase
        .from("agent_daily_accounts")
        .select("*")
        .eq("referenceid", referenceid)
        .eq("assigned_date", yesterdayStr)
        .eq("is_called", false)
        .order("type_client", { ascending: true })
        .limit(MAX_CARRYOVER);

      if (!error && data) {
        setCarryoverAccounts(data as DailyAssignment[]);
      }
    } catch {
      // non-critical
    }
  }, [referenceid]);

  useEffect(() => {
    fetchCarryover();
  }, [fetchCarryover]);

  // ── Fetch Accounts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) {
      setAccounts([]);
      onEmptyStatusChange?.(true);
      return;
    }

    const fetchAccounts = async () => {
      setError(null);
      setLoading(true);
      try {
        const response = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`,
        );
        if (!response.ok) {
          setError("Failed to fetch accounts");
          onEmptyStatusChange?.(true);
          setLoading(false);
          return;
        }
        const data = await response.json();
        setAccounts(data.data || []);
        onEmptyStatusChange?.(!(data.data && data.data.length > 0));
      } catch (err) {
        console.error("Error fetching accounts:", err);
        setError("Error fetching accounts. You can still add new accounts.");
        onEmptyStatusChange?.(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [referenceid, onEmptyStatusChange]);

  // ── Compute daily 25-account list ────────────────────────────────────────
  const dailyList = React.useMemo(() => {
    if (!accounts.length) return [];
    return buildDailyList(accounts, carryoverAccounts, todayStr);
  }, [accounts, carryoverAccounts, todayStr]);

  // ── Persist today's assignments to Supabase (once per day) ───────────────
  useEffect(() => {
    if (!dailyList.length || !referenceid || loadingDaily) return;
    if (dailyAssignments.length > 0) return;

    const saveAssignments = async () => {
      const rows = dailyList.map((acc) => ({
        referenceid,
        account_reference_number: acc.account_reference_number,
        company_name: acc.company_name,
        type_client: acc.type_client,
        assigned_date: todayStr,
        is_called: false,
        is_carryover: !!(acc as any)._isCarryover,
        original_assigned_date: (acc as any)._isCarryover
          ? (carryoverAccounts.find(
              (c) => c.account_reference_number === acc.account_reference_number,
            )?.original_assigned_date ?? null)
          : todayStr,
      }));

      await supabase
        .from("agent_daily_accounts")
        .upsert(rows, {
          onConflict: "referenceid,account_reference_number,assigned_date",
        });

      fetchDailyAssignments();
    };

    saveAssignments();
  }, [dailyList, dailyAssignments.length, referenceid, loadingDaily]);

  // ── Handle Add (OB Call) ──────────────────────────────────────────────────
  const handleAdd = async (account: Account) => {
    const blockCheck = checkCompanyBlocked(
      account.account_reference_number,
      existingActivities,
      existingHistory,
      BLOCK_NEW_TASK.statuses,
      BLOCK_NEW_TASK.checkScheduled,
    );

    // ── CHANGE 2: Unlock only when activity status is "Completed" ─────────
    // If the existing activity for this company is already Completed,
    // bypass the lock and allow a new activity to be created.
    const hasCompletedActivity = existingActivities.some(
      (a) =>
        a.account_reference_number === account.account_reference_number &&
        a.status?.toLowerCase() === "completed",
    );

    if (blockCheck.blocked && !hasCompletedActivity) {
      sileo.error({
        title: "Cannot Add Activity",
        description: blockCheck.reason,
        duration: 6000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    setLoading(true);

    const region = account.region || "NCR";
    const tsm = account.tsm;
    const manager = account.manager;

    if (!tsm || !manager) {
      alert("TSM or Manager information is missing. Please check the account data.");
      setLoading(false);
      return;
    }

    const payload = {
      referenceid,
      tsm,
      manager,
      account_reference_number: account.account_reference_number,
      status: "On-Progress",
      company_name: account.company_name,
      contact_person: account.contact_person,
      contact_number: account.contact_number,
      email_address: account.email_address,
      address: account.address,
      type_client: account.type_client,
      activity_reference_number: generateActivityRef(account.company_name, region),
    };

    try {
      const res = await fetch("/api/act-save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const nextAvailableDate = computeNextCallDate(account.type_client);

      const updateRes = await fetch("/api/act-update-account-next-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account.id,
          next_available_date: nextAvailableDate,
        }),
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || "Update failed");

      await supabase
        .from("agent_daily_accounts")
        .update({
          is_called: true,
          called_at: new Date().toISOString(),
          next_call_date: nextAvailableDate,
        })
        .eq("referenceid", referenceid)
        .eq("account_reference_number", account.account_reference_number)
        .eq("assigned_date", todayStr);

      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
      await fetchExistingActivities();
      await fetchDailyAssignments();

      sileo.success({
        title: "Success",
        description: `Successfully added and updated date for: ${account.company_name}`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      window.location.reload();
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Error saving or updating account. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch Endorsed Tickets ────────────────────────────────────────────────
  const fetchEndorsedTickets = useCallback(async () => {
    if (!referenceid) {
      setEndorsedTickets([]);
      return;
    }
    setLoadingEndorsed(true);
    setErrorEndorsed(null);
    try {
      const res = await fetch(
        `/api/act-fetch-endorsed-ticket?referenceid=${encodeURIComponent(referenceid)}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.error || "Failed to fetch endorsed tickets");
      }
      const json = await res.json();
      setEndorsedTickets(json.activities || []);
    } catch (err: any) {
      setErrorEndorsed(err.message || "Error fetching endorsed tickets");
    } finally {
      setLoadingEndorsed(false);
    }
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;
    fetchEndorsedTickets();
    const channel = supabase
      .channel(`endorsed-ticket-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "endorsed-ticket",
          filter: `referenceid=eq.${referenceid}`,
        },
        () => fetchEndorsedTickets(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchEndorsedTickets]);

  useEffect(() => {
    endorsedSoundRef.current = new Audio("/ticket-endorsed.mp3");
    endorsedSoundRef.current.volume = 0.9;
  }, []);

  // ── Use Endorsed Ticket ───────────────────────────────────────────────────
  const openConfirmUseTicket = (ticket: EndorsedTicket) => {
    setSelectedTicket(ticket);
    setConfirmOpen(true);
  };

  const handleConfirmUseEndorsed = async () => {
    if (confirmLoading || !selectedTicket) return;
    if (!userDetails) {
      sileo.error({
        title: "Failed",
        description: "User details not available.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    // ── CHANGE 1: No block check for endorsed tickets ─────────────────────
    // Endorsed tickets bypass the lock entirely — agents can always use them
    // regardless of any existing activity status for that company.

    try {
      setConfirmLoading(true);
      const ticket = selectedTicket;
      const region = "NCR";

      const payload = {
        ticket_reference_number: ticket.ticket_reference_number,
        account_reference_number: ticket.account_reference_number,
        company_name: ticket.company_name,
        contact_person: ticket.contact_person,
        contact_number: ticket.contact_number,
        email_address: ticket.email_address,
        address: ticket.address,
        tsm: userDetails.tsm,
        referenceid: userDetails.referenceid,
        manager: userDetails.manager,
        status: "On-Progress",
        type_client: "CSR Client",
        ticket_remarks: ticket.ticket_remarks,
        agent: ticket.agent,
        activity_reference_number: generateActivityRef(
          ticket.company_name || "Taskflow",
          region,
        ),
      };

      const res = await fetch("/api/act-save-endorsed-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        sileo.error({
          title: "Failed",
          description: "Failed to use endorsed ticket",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      const updateStatusRes = await fetch("/api/act-update-ticket-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_reference_number: ticket.ticket_reference_number,
          status: "Received",
        }),
      });

      const updateStatusData = await updateStatusRes.json();
      if (!updateStatusRes.ok) {
        sileo.error({
          title: "Failed",
          description: updateStatusData?.error || "Failed to update ticket status",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      const updateCompanyRefRes = await fetch("/api/com-update-company-ticket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_reference_number: ticket.account_reference_number,
          referenceid: userDetails.referenceid,
          tsm: userDetails.tsm,
          manager: userDetails.manager,
        }),
      });

      const updateCompanyRefData = await updateCompanyRefRes.json();
      if (!updateCompanyRefRes.ok) {
        sileo.error({
          title: "Failed",
          description: updateCompanyRefData?.error || "Company update failed.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }

      sileo.success({
        title: "Success",
        description: `Ticket used successfully: ${ticket.company_name}`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      setEndorsedTickets((prev) => {
        playedTicketIdsRef.current.delete(ticket.id);
        return prev.filter((t) => t.id !== ticket.id);
      });

      window.location.reload();
      setConfirmOpen(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error(err);
      sileo.error({
        title: "Failed",
        description: "Unexpected error while using endorsed ticket.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Derived display lists ─────────────────────────────────────────────────
  const calledAccountRefs = new Set(
    dailyAssignments
      .filter((a) => a.is_called)
      .map((a) => a.account_reference_number),
  );

  const groupedDailyList = React.useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    for (const cluster of CLUSTER_ORDER) {
      grouped[cluster] = dailyList.filter(
        (acc) => acc.type_client?.toLowerCase() === cluster,
      );
    }
    return grouped;
  }, [dailyList]);

  const BLOCKED_STATUSES_SET = new Set([
    "subject for transfer",
    "approved for deletion",
    "removed",
  ]);
  const filteredBySearch = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerSearch = searchTerm.toLowerCase();
    return accounts.filter(
      (acc) =>
        !BLOCKED_STATUSES_SET.has(acc.status?.toLowerCase()) &&
        acc.company_name.toLowerCase().includes(lowerSearch),
    );
  }, [accounts, searchTerm]);

  // ── Progress counters ─────────────────────────────────────────────────────
  const calledToday = dailyAssignments.filter((a) => a.is_called).length;
  const totalToday = dailyAssignments.length || dailyList.length;
  const carryoverCount = dailyAssignments.filter((a) => a.is_carryover).length;

  // ── Reusable Add Button — lock releases on "Completed" ───────────────────
  const AddButton = ({ account }: { account: Account }) => {
    const blockCheck = checkCompanyBlocked(
      account.account_reference_number,
      existingActivities,
      existingHistory,
      BLOCK_NEW_TASK.statuses,
      BLOCK_NEW_TASK.checkScheduled,
    );

    // ── CHANGE 2: If existing activity is Completed, treat as unlocked ────
    const hasCompletedActivity = existingActivities.some(
      (a) =>
        a.account_reference_number === account.account_reference_number &&
        a.status?.toLowerCase() === "completed",
    );

    if (blockCheck.blocked && !hasCompletedActivity) {
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button
              type="button"
              disabled
              variant="outline"
              className="cursor-not-allowed rounded-none opacity-60 text-xs"
            >
              <Lock size={13} className="mr-1" /> Locked
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="end"
            className="text-xs max-w-xs leading-relaxed"
          >
            <p className="font-semibold text-red-600 mb-1 flex items-center gap-1">
              <Lock size={12} /> Activity Locked
            </p>
            <p>{blockCheck.reason}</p>
            <p className="mt-1 text-muted-foreground">
              Unlocks when activity status is marked as{" "}
              <strong>Completed</strong>.
            </p>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return (
      <Button
        type="button"
        className="cursor-pointer rounded-none"
        onClick={(e) => {
          e.stopPropagation();
          handleAdd(account);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleAdd(account);
          }
        }}
      >
        <Plus /> Add
      </Button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner className="size-8" />
        </div>
      ) : error ? (
        <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <div>
              <AlertTitle>No Companies Found or No Network Connection</AlertTitle>
              <AlertDescription className="text-xs">
                Please check your internet connection or try again later.
              </AlertDescription>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle2Icon className="h-6 w-6 text-green-600" />
            <div>
              <AlertTitle className="text-black">Add New Companies</AlertTitle>
              <AlertDescription className="text-xs">
                You can start by adding new entries to populate your database.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      ) : (
        <>
          {/* ── Endorsed Tickets — no lock, always show Use Ticket ────────── */}
          {loadingEndorsed ? (
            <div className="flex justify-center items-center h-20">
              <Spinner className="size-6" />
            </div>
          ) : errorEndorsed ? (
            <Alert variant="destructive" className="p-3 text-xs">
              <AlertCircleIcon className="inline-block mr-2" />
              {errorEndorsed}
            </Alert>
          ) : endorsedTickets.length > 0 ? (
            <section>
              <h2 className="text-xs font-bold mb-4">
                Endorsed Tickets ({endorsedTickets.length})
              </h2>
              <Accordion
                type="single"
                collapsible
                className="w-full border-3 rounded-none shadow-sm mt-2 border-red-500"
              >
                {endorsedTickets.map((ticket) => (
                  <AccordionItem key={ticket.id} value={ticket.id}>
                    <div className="flex justify-between items-center p-2 select-none">
                      <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono uppercase">
                        {ticket.company_name}
                      </AccordionTrigger>

                      {/* CHANGE 1: Always show Use Ticket — no lock check for tickets */}
                      <Button
                        type="button"
                        className="cursor-pointer rounded-none"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfirmUseTicket(ticket);
                        }}
                      >
                        <TicketIcon /> Use Ticket
                      </Button>
                    </div>

                    <AccordionContent className="flex flex-col gap-2 p-3 text-xs uppercase">
                      <p>
                        <strong>Contact Person:</strong> {ticket.contact_person}
                      </p>
                      <p>
                        <strong>Contact Number:</strong> {ticket.contact_number}
                      </p>
                      <p>
                        <strong>Email Address:</strong> {ticket.email_address}
                      </p>
                      <p>
                        <strong>Address:</strong> {ticket.address}
                      </p>
                      <p>
                        <strong>Ticket Reference #:</strong>{" "}
                        {ticket.ticket_reference_number}
                      </p>
                      <p>
                        <strong>Wrap Up:</strong> {ticket.wrap_up}
                      </p>
                      <p className="border border-red-500 border-dashed rounded-none p-4 bg-red-100">
                        <strong>Inquiry / Notes:</strong> {ticket.inquiry}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}

          {/* ── Confirm Use Ticket Dialog ─────────────────────────────────── */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="text-xs rounded-none">
              <DialogHeader>
                <DialogTitle>Use Endorsed Ticket</DialogTitle>
              </DialogHeader>
              <div>
                Are you sure you want to use this ticket? This action cannot be
                undone.
              </div>
              <DialogFooter className="flex gap-4 mt-4 justify-end">
                <Button
                  variant="outline"
                  className="rounded-none p-6"
                  onClick={() => setConfirmOpen(false)}
                  disabled={confirmLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="rounded-none p-6"
                  onClick={handleConfirmUseEndorsed}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? "Processing..." : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Search + Add button ───────────────────────────────────────── */}
          <div className="flex items-center gap-2 w-full">
            <Input
              type="search"
              placeholder="Search Company Name..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 rounded-none p-2 border border-gray-300 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button
              className="shrink-0 cursor-pointer rounded-none"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus /> Add
            </Button>
          </div>

          {/* ── Daily progress bar ────────────────────────────────────────── */}
          {!searchTerm.trim() && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  OB Calls Today:{" "}
                  <strong className="text-green-600">{calledToday}</strong> /{" "}
                  {totalToday}
                  {carryoverCount > 0 && (
                    <span className="ml-2 text-yellow-600">
                      ({carryoverCount} carryover)
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  Max carryover tomorrow:{" "}
                  {Math.min(totalToday - calledToday, MAX_CARRYOVER)}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width:
                      totalToday > 0
                        ? `${(calledToday / totalToday) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Search results / Daily list ───────────────────────────────── */}
          {searchTerm.trim() ? (
            <section>
              <h2 className="text-xs font-bold mb-4">
                Search Results{" "}
                <span className="text-green-600">({filteredBySearch.length})</span>
              </h2>
              {filteredBySearch.length === 0 ? (
                <p className="text-xs text-gray-500">No companies found.</p>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full border rounded-none shadow-sm mt-2 border-blue-200 uppercase"
                >
                  {filteredBySearch.map((account) => (
                    <AccordionItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center p-2 select-none">
                        <AccordionTrigger className="flex flex-1 items-center justify-between text-xs font-semibold font-mono">
                          <span>{account.company_name}</span>
                          {account.next_available_date && (
                            <Badge className="bg-green-600">
                              <CalendarCheck2 /> Scheduled{" "}
                              {new Date(
                                account.next_available_date,
                              ).toLocaleDateString("en-CA")}
                            </Badge>
                          )}
                        </AccordionTrigger>
                        <div className="flex gap-2 ml-4">
                          <AddButton account={account} />
                        </div>
                      </div>
                      <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                        <p><strong>Contact:</strong> {account.contact_number}</p>
                        <p><strong>Email:</strong> {account.email_address}</p>
                        <p><strong>Client Type:</strong> {account.type_client}</p>
                        <p><strong>Address:</strong> {account.address}</p>
                        <p className="text-[8px]">
                          {account.account_reference_number}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </section>
          ) : (
            <>
              {dailyList.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold mb-4">
                    OB Calls Account for Today ({dailyList.length})
                  </h2>

                  {CLUSTER_ORDER.map((cluster) => {
                    const clusterAccounts = groupedDailyList[cluster];
                    if (!clusterAccounts || clusterAccounts.length === 0)
                      return null;

                    return (
                      <div key={cluster} className="mb-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-widest">
                          {cluster} ({clusterAccounts.length})
                        </p>
                        <Accordion type="single" collapsible className="w-full">
                          {clusterAccounts.map((account) => {
                            const isCalled = calledAccountRefs.has(
                              account.account_reference_number,
                            );
                            const isCarryover =
                              !!(account as any)._isCarryover ||
                              dailyAssignments.find(
                                (d) =>
                                  d.account_reference_number ===
                                  account.account_reference_number,
                              )?.is_carryover;

                            return (
                              <AccordionItem
                                key={account.id}
                                value={account.id}
                                className={`border rounded-sm mb-2 uppercase ${
                                  isCalled
                                    ? "border-gray-200 opacity-50"
                                    : "border-green-300"
                                }`}
                              >
                                <div className="flex justify-between items-center p-2 select-none">
                                  <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                                    <span className="flex items-center gap-2">
                                      {account.company_name}
                                      {isCarryover && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] border-yellow-400 text-yellow-600 py-0"
                                        >
                                          carryover
                                        </Badge>
                                      )}
                                      {isCalled && (
                                        <Badge className="text-[9px] bg-gray-400 py-0">
                                          called
                                        </Badge>
                                      )}
                                    </span>
                                  </AccordionTrigger>
                                  <div className="flex gap-2 ml-4">
                                    {!isCalled && <AddButton account={account} />}
                                  </div>
                                </div>
                                <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                                  <p>
                                    <strong>Contact:</strong>{" "}
                                    {account.contact_number}
                                  </p>
                                  <p>
                                    <strong>Email:</strong>{" "}
                                    {account.email_address}
                                  </p>
                                  <p>
                                    <strong>Client Type:</strong>{" "}
                                    {account.type_client}
                                  </p>
                                  <p>
                                    <strong>Address:</strong> {account.address}
                                  </p>
                                  <p className="text-[8px]">
                                    {account.account_reference_number}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </>
      )}

      <AccountDialog
        mode="create"
        userDetails={userDetails}
        onSaveAction={async (data) => {
          await onSaveAccountAction(data);
          setIsCreateDialogOpen(false);
        }}
        open={isCreateDialogOpen}
        onOpenChangeAction={setIsCreateDialogOpen}
      />
    </div>
  );
};