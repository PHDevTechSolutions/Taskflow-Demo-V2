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
  date_created: string;
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

// ─── Minimal shapes needed for the block-check utility ──────────────────────
interface ActivityForCheck {
  id: string;
  account_reference_number: string;
  activity_reference_number: string;
  company_name: string;
  status: string;
  scheduled_date?: string;
  date_created: string;
}

interface HistoryForCheck {
  activity_reference_number: string;
  status?: string;
}

export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}) => {
  // State for Accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Activity/History state for the block check ──────────────────────────
  const [existingActivities, setExistingActivities] = useState<
    ActivityForCheck[]
  >([]);
  const [existingHistory, setExistingHistory] = useState<HistoryForCheck[]>([]);

  // ─── Activities state (same as page.tsx) ─────────────────────────────
  const [activities, setActivities] = useState<ActivityForCheck[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // ─── Lazy Loading: Show first 10, then load more ─────────────────────
  const NO_ACTIVITY_BATCH_SIZE = 10;
  const [displayedNoActivityCount, setDisplayedNoActivityCount] = useState(NO_ACTIVITY_BATCH_SIZE);

  // State for Endorsed Tickets
  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [loadingEndorsed, setLoadingEndorsed] = useState(false);
  const [errorEndorsed, setErrorEndorsed] = useState<string | null>(null);

  // Search Term for filtering accounts
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<EndorsedTicket | null>(
    null,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // 🔔 sound refs
  const endorsedSoundRef = useRef<HTMLAudioElement | null>(null);
  const playedTicketIdsRef = useRef<Set<string>>(new Set());

  // Generate Activity Reference Number helper
  const generateActivityRef = (companyName: string, region: string) => {
    const words = companyName.trim().split(" ");
    const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
    const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
    const uniqueNumber = String(Date.now()).slice(-10);
    return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
  };

  // ─── Fetch existing activities & history for the block check ────────────
  const fetchExistingActivities = useCallback(async () => {
    if (!referenceid) return;
    try {
      const url = new URL(
        "/api/activity/tsa/planner/fetch",
        window.location.origin,
      );
      url.searchParams.append("referenceid", referenceid);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      setExistingActivities(data.activities || []);
      setExistingHistory(data.history || []);
    } catch {
      // non-critical; silently ignore
    }
  }, [referenceid]);

  useEffect(() => {
    fetchExistingActivities();
  }, [fetchExistingActivities]);

  // ─── Fetch ALL activities from /api/activities (same as page.tsx) ─────────
  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;
    setLoadingActivities(true);
    try {
      // Use fetchAll=true to get ALL activities (not just first 1000)
      const activitiesUrl = `/api/activities?referenceid=${encodeURIComponent(referenceid)}&fetchAll=true`;
      const actRes = await fetch(activitiesUrl);
      if (actRes.ok) {
        const actData = await actRes.json();
        const list = Array.isArray(actData) ? actData : actData.data ?? [];
        setActivities(list);
        console.log("Activities fetched (all):", list.length);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  }, [referenceid]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Reset lazy loading when accounts change
  useEffect(() => {
    setDisplayedNoActivityCount(NO_ACTIVITY_BATCH_SIZE);
  }, [accounts.length]);

  // Add Account Handler
  const handleAdd = async (account: Account) => {
    
    // ─── CHANGE 2: Unlock when activity status is "Completed" ─────────────
    // If the existing activity for this company is already Completed,
    // bypass the lock and allow a new activity to be created.
    const hasCompletedActivity = existingActivities.some(
      (a) =>
        a.account_reference_number === account.account_reference_number &&
        a.status?.toLowerCase() === "completed",
    );

    setLoading(true); // <-- start loading

    const region = account.region || "NCR";
    const tsm = account.tsm;
    const manager = account.manager;

    if (!tsm || !manager) {
      alert(
        "TSM or Manager information is missing. Please check the account data.",
      );
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
      activity_reference_number: generateActivityRef(
        account.company_name,
        region,
      ),
    };

    try {
      const res = await fetch("/api/act-save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Save failed");

      // Calculate next available date
      const now = new Date();
      let newDate: Date;

      if (account.type_client.toLowerCase() === "top 50") {
        newDate = new Date(now.setDate(now.getDate() + 14));
      } else {
        newDate = new Date(now.setMonth(now.getMonth() + 1));
      }

      const nextAvailableDate = newDate.toISOString().split("T")[0];

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

      // Remove added account from state
      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
      // Refresh the activities list so subsequent checks are accurate
      await fetchExistingActivities();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: `Successfully added and updated date for: ${account.company_name}`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Error saving or updating account. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Accounts from API
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
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json.message || json.error || "Failed to fetch endorsed tickets",
        );
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

    // Initial fetch
    fetchEndorsedTickets();

    // Setup Supabase realtime subscription for endorsed-ticket table
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
        (payload) => {
          console.log("Realtime endorsed-ticket update:", payload);
          fetchEndorsedTickets();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchEndorsedTickets]);

  const openConfirmUseTicket = (ticket: EndorsedTicket) => {
    setSelectedTicket(ticket);
    setConfirmOpen(true);
  };

  // Use Endorsed Ticket handler
  const handleConfirmUseEndorsed = async () => {
    if (confirmLoading) return;
    if (!selectedTicket) return;

    if (!userDetails) {
      sileo.error({
        title: "Failed",
        description: "User details not available.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      return;
    }

    // ─── CHANGE 1: No block check for endorsed tickets ────────────────────
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

      // 1. Save endorsed ticket to activity
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
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      // 2. Update ticket status
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
          description:
            updateStatusData?.error || "Failed to update ticket status",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      // 3. Update company reference
      const updateCompanyRefRes = await fetch(
        "/api/com-update-company-ticket",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_reference_number: ticket.account_reference_number,
            referenceid: userDetails.referenceid,
            tsm: userDetails.tsm,
            manager: userDetails.manager,
          }),
        },
      );

      const updateCompanyRefData = await updateCompanyRefRes.json();
      if (!updateCompanyRefRes.ok) {
        sileo.error({
          title: "Failed",
          description:
            updateCompanyRefData?.error ||
            "Ticket processed but company update failed. Please contact admin.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      sileo.success({
        title: "Success",
        description: `Ticket used successfully: ${ticket.company_name}`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });

      // Optimistic UI update
      setEndorsedTickets((prev) => {
        playedTicketIdsRef.current.delete(ticket.id);
        return prev.filter((t) => t.id !== ticket.id);
      });

      // Cleanup
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
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  // ─── Filter to ONLY ACTIVE accounts (same as Account Management) ───
  const activeAccounts = React.useMemo(() => {
    const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];
    const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
    
    return accounts.filter((acc) => {
      const status = acc.status?.toLowerCase() || "";
      const typeClient = acc.type_client?.toLowerCase() || "";
      
      // Must have status and type_client
      if (!acc.status || !acc.type_client) return false;
      
      // Exclude removed/approved for deletion/subject for transfer
      if (excludedStatuses.includes(status)) return false;
      
      // Must be in allowed types
      if (!allowedTypes.includes(typeClient)) return false;
      
      return true;
    });
  }, [accounts]);

  // Filter accounts by search term (ONLY from active accounts)
  const filteredAccounts = React.useMemo(() => {
    if (!searchTerm.trim()) return activeAccounts;
    return activeAccounts.filter((acc) =>
      acc.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeAccounts, searchTerm]);

  // ─── Calculate accounts WITH activity (based on account_reference_number) ───
  const accountsWithActivity = React.useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a) => { 
      if (a.account_reference_number) s.add(a.account_reference_number); 
    });
    return s;
  }, [activities]);

  // ─── Calculate NO ACTIVITY accounts (from ACTIVE accounts only) ───
  const accountsWithNoActivity = React.useMemo(() => {
    return activeAccounts.filter((account) => {
      // Only check ACTIVE accounts without activity (based on account_reference_number)
      return !accountsWithActivity.has(account.account_reference_number);
    });
  }, [activeAccounts, accountsWithActivity]);

  const noActivityCount = accountsWithNoActivity.length;

  // ─── DEBUG: Log counts for verification ───
  useEffect(() => {
    console.log("=== NEW.TSX ACTIVITY COUNT ===");
    console.log("Total Accounts (all):", accounts.length);
    console.log("Active Accounts (filtered):", activeAccounts.length);
    console.log("Activities count:", activities.length);
    console.log("Unique accounts with activity (by ref):", accountsWithActivity.size);
    console.log("No Activity count (active only):", noActivityCount);
    console.log("==============================");
  }, [accounts.length, activeAccounts.length, activities.length, accountsWithActivity.size, noActivityCount]);

  // Helper function to calculate aging (days since a date)
  const calculateAging = (dateStr: string): number => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // ─── Get aging data for accounts with NO HISTORY (with LAZY LOADING) ───
  const accountsWithNoActivityAndAging = React.useMemo(() => {
    return accountsWithNoActivity
      .map((account: Account) => {
        const agingDays = calculateAging(account.date_created);
        return {
          ...account,
          agingDays,
          agingFrom: "account creation",
          lastActivityDate: null as string | null,
        };
      })
      .sort((a: Account & { agingDays: number }, b: Account & { agingDays: number }) => b.agingDays - a.agingDays) // Sort by oldest first
      .slice(0, displayedNoActivityCount); // LAZY LOADING: Only show first N
  }, [accountsWithNoActivity, displayedNoActivityCount]);

  useEffect(() => {
    endorsedSoundRef.current = new Audio("/ticket-endorsed.mp3");
    endorsedSoundRef.current.volume = 0.9;
  }, []);

  // ─── Reusable "Add" button with block guard ──────────────────────────────
  const AddButton = ({ account }: { account: Account }) => {
    

    // ─── CHANGE 2: Unlock when activity status is "Completed" ─────────────
    const hasCompletedActivity = existingActivities.some(
      (a) =>
        a.account_reference_number === account.account_reference_number &&
        a.status?.toLowerCase() === "completed",
    );

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

  // === RENDER ===
  return (
    <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
      {/* ─── Endorsed Tickets Section ─────────────────────────────────────────── */}
      {/* Always render endorsed tickets regardless of accounts status */}
      {loadingEndorsed ? (
        <div className="flex justify-center items-center h-20">
          <Spinner className="size-6" />
        </div>
      ) : errorEndorsed ? (
        <Alert variant="destructive" className="p-3 text-xs mb-4">
          <AlertCircleIcon className="inline-block mr-2" />
          {errorEndorsed}
        </Alert>
      ) : endorsedTickets.length > 0 ? (
        <section className="mb-6">
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

                  {/* Always show Use Ticket — no lock check for endorsed tickets */}
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
                    <strong>Contact Person:</strong>{" "}
                    {ticket.contact_person}
                  </p>
                  <p>
                    <strong>Contact Number:</strong>{" "}
                    {ticket.contact_number}
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
                    <strong>Inquiry / Notes:</strong> {ticket.ticket_remarks || ticket.inquiry}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

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

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner className="size-8" />
        </div>
      ) : error ? (
        <Alert
          variant="destructive"
          className="flex flex-col space-y-4 p-4 text-xs"
        >
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <div>
              <AlertTitle>
                No Companies Found or No Network Connection
              </AlertTitle>
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
          <div className="flex items-center gap-2 w-full">
            {/* Search input */}
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

          {/* ─── Client No Touch/Activities Section ─────────────────────────── */}
          {loadingActivities ? (
            <section className="mb-6">
              <div className="flex items-center gap-2 text-amber-600">
                <Spinner className="size-4" />
                <span className="text-xs">Loading activities...</span>
              </div>
            </section>
          ) : noActivityCount > 0 && !searchTerm.trim() && (
            <section className="mb-6">
              <h2 className="text-xs font-bold mb-2 text-amber-600">
                Client No Touch/Activities ({noActivityCount})
              </h2>
              <p className="text-[10px] text-gray-500 mb-1 italic">
                Clients with NO recorded history (never had any activity)
              </p>
              
              <Accordion
                type="single"
                collapsible
                className="w-full border rounded-none shadow-sm border-amber-200 uppercase"
              >
                {accountsWithNoActivityAndAging.map((account) => (
                  <AccordionItem key={account.id} value={account.id}>
                    <div className="flex justify-between items-center p-2 select-none bg-amber-50/50">
                      <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          {account.company_name}
                          <Badge
                            className={`text-[9px] ${
                              account.agingDays > 30
                                ? "bg-red-100 text-red-700 border-red-200"
                                : account.agingDays > 14
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-yellow-100 text-yellow-700 border-yellow-200"
                            }`}
                          >
                            {account.agingDays} days
                          </Badge>
                          <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200 uppercase">
                            {account.type_client}
                          </Badge>
                        </div>
                      </AccordionTrigger>

                      <div className="flex gap-2 ml-4">
                        <AddButton account={account} />
                      </div>
                    </div>

                    <AccordionContent className="flex flex-col gap-2 p-3 text-xs bg-amber-50/30">
                      <p className="text-[10px] text-amber-700">
                        <strong>Aging:</strong> {account.agingDays} days since {account.agingFrom}
                        {account.lastActivityDate && (
                          <span className="block text-[9px] text-gray-500">
                            Last activity: {new Date(account.lastActivityDate).toLocaleDateString("en-PH")}
                          </span>
                        )}
                        {!account.lastActivityDate && (
                          <span className="block text-[9px] text-gray-500">
                            Account created: {new Date(account.date_created).toLocaleDateString("en-PH")}
                          </span>
                        )}
                      </p>
                      <p>
                        <strong>Contact:</strong> {account.contact_number}
                      </p>
                      <p>
                        <strong>Email:</strong> {account.email_address}
                      </p>
                      <p>
                        <strong>Client Type:</strong> {account.type_client}
                      </p>
                      <p>
                        <strong>Address:</strong> {account.address}
                      </p>
                      <p className="text-[8px]">
                        {account.account_reference_number}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                
                {/* ─── LAZY LOADING: Load More Button ─── */}
                {noActivityCount > displayedNoActivityCount && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      className="rounded-none text-xs"
                      onClick={() => setDisplayedNoActivityCount(prev => prev + NO_ACTIVITY_BATCH_SIZE)}
                    >
                      Load More ({noActivityCount - displayedNoActivityCount} remaining)
                    </Button>
                  </div>
                )}
              </Accordion>
            </section>
          )}

          {/* All Accounts - only show when searching */}
          {searchTerm.trim() && (
            <section>
              <h2 className="text-xs font-bold mb-4">
                Search Results{" "}
                <span className="text-green-600">
                  ({filteredAccounts.length})
                </span>
              </h2>
              {filteredAccounts.length === 0 ? (
                <p className="text-xs text-gray-500">No companies found.</p>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full border rounded-none shadow-sm mt-2 border-blue-200 uppercase"
                >
                  {filteredAccounts.map((account) => (
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
                        <p>
                          <strong>Contact:</strong> {account.contact_number}
                        </p>
                        <p>
                          <strong>Email:</strong> {account.email_address}
                        </p>
                        <p>
                          <strong>Client Type:</strong> {account.type_client}
                        </p>
                        <p>
                          <strong>Address:</strong> {account.address}
                        </p>
                        <p className="text-[8px]">
                          {account.account_reference_number}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </section>
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