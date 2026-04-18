"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  Plus,
  TicketIcon,
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
import { sileo } from "sileo";
import { supabase } from "@/utils/supabase";
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
  date_created: string;
}

export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
  userDetails,
  onSaveAccountAction,
}) => {
  // State for Accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activity state for the block check
  const [existingActivities, setExistingActivities] = useState<ActivityForCheck[]>([]);

  // State for Endorsed Tickets
  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [loadingEndorsed, setLoadingEndorsed] = useState(false);
  const [errorEndorsed, setErrorEndorsed] = useState<string | null>(null);

  // Search Term for filtering accounts
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<EndorsedTicket | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Generate Activity Reference Number helper
  const generateActivityRef = (companyName: string, region: string) => {
    const words = companyName.trim().split(" ");
    const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
    const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
    const uniqueNumber = String(Date.now()).slice(-10);
    return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
  };

  // Fetch existing activities for the block check
  const fetchExistingActivities = useCallback(async () => {
    if (!referenceid) return;
    try {
      const url = new URL("/api/activity/tsa/planner/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      setExistingActivities(data.activities || []);
    } catch {
      // non-critical; silently ignore
    }
  }, [referenceid]);

  useEffect(() => {
    fetchExistingActivities();
  }, [fetchExistingActivities]);

  // Add Account Handler
  const handleAdd = async (account: Account) => {
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

      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
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
        activity_reference_number: generateActivityRef(ticket.company_name || "Taskflow", region),
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
          styles: {
            title: "text-white!",
            description: "text-white",
          },
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
          styles: {
            title: "text-white!",
            description: "text-white",
          },
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
          description: updateCompanyRefData?.error || "Ticket processed but company update failed. Please contact admin.",
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

      setEndorsedTickets((prev) => prev.filter((t) => t.id !== ticket.id));
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

  // Filter accounts by search term
  const filteredBySearch = React.useMemo(() => {
    if (!searchTerm.trim()) return [];

    const lowerSearch = searchTerm.toLowerCase();
    return accounts.filter((acc) => {
      const status = acc.status?.toLowerCase();
      const isStatusAllowed =
        status !== "subject for transfer" &&
        status !== "removed" &&
        status !== "approved for deletion";

      return isStatusAllowed && acc.company_name.toLowerCase().includes(lowerSearch);
    });
  }, [accounts, searchTerm]);

  // === RENDER ===
  return (
    <div className="max-h-[70vh] overflow-auto space-y-6 custom-scrollbar">
      {/* ─── Endorsed Tickets Section ─────────────────────────────────────────── */}
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

          <Accordion type="single" collapsible className="w-full border-2 rounded-none shadow-sm border-red-500">
            {endorsedTickets.map((ticket) => (
              <AccordionItem key={ticket.id} value={ticket.id}>
                <div className="flex justify-between items-center p-2 select-none">
                  <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono uppercase">
                    {ticket.company_name}
                  </AccordionTrigger>

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
                    <strong>Ticket Reference #:</strong> {ticket.ticket_reference_number}
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

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="text-xs rounded-none">
          <DialogHeader>
            <DialogTitle>Use Endorsed Ticket</DialogTitle>
          </DialogHeader>
          <div>
            Are you sure you want to use this ticket? This action cannot be undone.
          </div>
          <DialogFooter className="flex gap-4 mt-4 justify-end">
            <Button variant="outline" className="rounded-none p-6" onClick={() => setConfirmOpen(false)} disabled={confirmLoading}>
              Cancel
            </Button>
            <Button variant="default" className="rounded-none p-6" onClick={handleConfirmUseEndorsed} disabled={confirmLoading}>
              {confirmLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Search Section ─────────────────────────────────────────── */}
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

        <Button className="shrink-0 cursor-pointer rounded-none" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus /> Add
        </Button>
      </div>

      {/* Search Results */}
      {searchTerm.trim() && (
        <section>
          {loading ? (
            <div className="flex justify-center items-center h-20">
              <Spinner className="size-6" />
            </div>
          ) : error ? (
            <Alert variant="destructive" className="p-3 text-xs">
              <AlertCircleIcon className="inline-block mr-2" />
              {error}
            </Alert>
          ) : filteredBySearch.length === 0 ? (
            <p className="text-xs text-gray-500">No companies found.</p>
          ) : (
            <>
              <h2 className="text-xs font-bold mb-4">
                Search Results <span className="text-green-600">({filteredBySearch.length})</span>
              </h2>
              <Accordion type="single" collapsible className="w-full border rounded-none shadow-sm border-blue-200 uppercase">
                {filteredBySearch.map((account) => (
                  <AccordionItem key={account.id} value={account.id}>
                    <div className="flex justify-between items-center p-2 select-none">
                      <AccordionTrigger className="flex-1 text-xs font-semibold font-mono">
                        {account.company_name}
                      </AccordionTrigger>
                      <div className="flex gap-2 ml-4">
                        <Button
                          type="button"
                          className="cursor-pointer rounded-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdd(account);
                          }}
                        >
                          <Plus /> Add
                        </Button>
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
                      <p className="text-[8px]">{account.account_reference_number}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </section>
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
