"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2Icon, AlertCircleIcon, Plus, TicketIcon, CalendarCheck2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { Badge } from "@/components/ui/badge"
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
  wrap_up: string;
  inquiry: string;
  tsm: string;
  referenceid: string;
  agent: string;
  date_created: string;
  date_updated: string;
}

export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction
}) => {
  // State for Accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  // 🔔 sound refs
  const endorsedSoundRef = useRef<HTMLAudioElement | null>(null);
  const playedTicketIdsRef = useRef<Set<string>>(new Set());

  // Cluster order for grouping
  const clusterOrder = [
    "top 50",
    "next 30",
    "balance 20",
    "tsa client",
    "csr client",
  ];

  // Generate Activity Reference Number helper
  const generateActivityRef = (companyName: string, region: string) => {
    const words = companyName.trim().split(" ");
    const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
    const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
    const uniqueNumber = String(Date.now()).slice(-10);
    return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
  };

  // Add Account Handler
  const handleAdd = async (account: Account) => {
    const region = account.region || "NCR";
    const tsm = account.tsm;
    const manager = account.manager;

    if (!tsm || !manager) {
      alert("TSM or Manager information is missing. Please check the account data.");
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

      // Remove added account from state
      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));

      toast.success(`Successfully added and updated date for: ${account.company_name}`);
    } catch (err) {
      console.error(err);
      toast.error("Error saving or updating account. Please try again.");
    }
  };

  // Normalize date string or return null
  const normalizeDate = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Group accounts by cluster with a date filter condition
  const groupByCluster = (
    accounts: Account[],
    dateCondition: (date: string | null) => boolean
  ) => {
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
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`
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
      const res = await fetch(`/api/act-fetch-endorsed-ticket?referenceid=${encodeURIComponent(referenceid)}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

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
        }
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
    if (!selectedTicket) return;
    if (!userDetails) {
      toast.error("User details not available.");
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
        referenceid: userDetails.referenceid, // use userDetails.referenceid
        manager: userDetails.manager,         // use userDetails.manager here
        status: "On-Progress",
        type_client: "CSR Client",
        agent: ticket.agent,
        activity_reference_number: generateActivityRef(ticket.company_name, region),
      };

      // 1. Save endorsed ticket to activity
      const res = await fetch("/api/act-save-endorsed-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to use endorsed ticket");
        return;
      }

      // 2. Update endorsed ticket status
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
        toast.error(updateStatusData.error || "Failed to update ticket status");
        return;
      }

      // 3. Update company ticket referenceid using new API
      const updateCompanyRefRes = await fetch("/api/com-update-company-ticket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_reference_number: ticket.account_reference_number,
          referenceid: userDetails.referenceid, // use userDetails.referenceid here as well
        }),
      });

      const updateCompanyRefData = await updateCompanyRefRes.json();
      if (!updateCompanyRefRes.ok) {
        toast.error(updateCompanyRefData.error || "Failed to update company referenceid");
        return;
      }

      toast.success(`Ticket used successfully: ${ticket.company_name}`);

      // Optimistic UI remove + cleanup sound memory
      setEndorsedTickets((prev) => {
        playedTicketIdsRef.current.delete(ticket.id);
        return prev.filter((t) => t.id !== ticket.id);
      });

      // close dialog
      setConfirmOpen(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error(err);
      toast.error("Error using endorsed ticket.");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Filter accounts by search term - includes all regardless of date
  const filteredBySearch = React.useMemo(() => {
    if (!searchTerm.trim()) return accounts.filter(acc =>
      acc.status?.toLowerCase() !== "subject for transfer" &&
      acc.status?.toLowerCase() !== "removed"
    );

    const lowerSearch = searchTerm.toLowerCase();
    return accounts.filter((acc) => {
      const status = acc.status?.toLowerCase();
      const isStatusAllowed =
        status !== "subject for transfer" && status !== "removed";

      return (
        isStatusAllowed &&
        acc.company_name.toLowerCase().includes(lowerSearch)
      );
    });
  }, [accounts, searchTerm]);

  // Dates for grouping accounts
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;

  // Group accounts by date condition (only when no search term)
  const groupedToday = React.useMemo(() => {
    if (searchTerm.trim()) return {};
    return groupByCluster(filteredBySearch, (date) => date === todayStr);
  }, [filteredBySearch, searchTerm, todayStr]);

  const groupedNull = React.useMemo(() => {
    if (searchTerm.trim()) return {};
    return groupByCluster(filteredBySearch, (date) => date === null);
  }, [filteredBySearch, searchTerm]);

  // Totals for UI display when no search term
  const totalTodayCount = React.useMemo(() => {
    if (searchTerm.trim()) return 0;
    return Object.values(groupedToday).reduce((sum, arr) => sum + arr.length, 0);
  }, [groupedToday, searchTerm]);

  const totalAvailableCount = React.useMemo(() => {
    if (searchTerm.trim()) return 0;
    return Object.values(groupedNull).reduce((sum, arr) => sum + arr.length, 0);
  }, [groupedNull, searchTerm]);

  // Find first non-empty cluster for available OB calls
  const getFirstNonEmptyCluster = (
    grouped: Record<string, Account[]>,
    orderedList: string[]
  ) => {
    for (const cluster of orderedList) {
      if (grouped[cluster]?.length) return cluster;
    }
    return null;
  };

  const firstAvailableCluster = getFirstNonEmptyCluster(groupedNull, clusterOrder);

  useEffect(() => {
    endorsedSoundRef.current = new Audio("/ticket-endorsed.mp3");
    endorsedSoundRef.current.volume = 0.9;
  }, []);

  // === RENDER ===
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
          {/* Endorsed Tickets */}
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

              <Accordion type="single" collapsible className="w-full border rounded-sm shadow-sm mt-2 border-red-500">
                {endorsedTickets.map((ticket) => (
                  <AccordionItem key={ticket.id} value={ticket.id}>
                    <div className="flex justify-between items-center p-2 select-none">
                      <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono uppercase">
                        {ticket.company_name}
                      </AccordionTrigger>
                      <Button
                        type="button"
                        className="cursor-pointer"
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
                      <p>
                        <strong>Inquiry:</strong> {ticket.inquiry}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="text-xs">
              <DialogHeader>
                <DialogTitle>Use Endorsed Ticket</DialogTitle>
              </DialogHeader>
              <div>
                Are you sure you want to use this ticket? This action cannot be undone.
              </div>
              <DialogFooter className="flex gap-4 mt-4 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={confirmLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleConfirmUseEndorsed}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? "Processing..." : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2 w-full">
            {/* Search input */}
            <Input
              type="search"
              placeholder="Search Company Name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 rounded-md p-2 border border-gray-300 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Button
              className="shrink-0 cursor-pointer"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus /> Add
            </Button>
          </div>

          {/* Show results based on search or grouped */}
          {searchTerm.trim() ? (
            <section>
              <h2 className="text-xs font-bold mb-4">
                Search Results <span className="text-green-600">({filteredBySearch.length})</span>
              </h2>
              {filteredBySearch.length === 0 ? (
                <p className="text-xs text-gray-500">No companies found.</p>
              ) : (
                <Accordion type="single" collapsible className="w-full border rounded-sm shadow-sm mt-2 border-blue-200 uppercase">
                  {filteredBySearch.map((account) => (
                    <AccordionItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center p-2 select-none">
                        <AccordionTrigger className="flex flex-1 items-center justify-between text-xs font-semibold font-mono">
                          <span>{account.company_name}</span>

                          {account.next_available_date && (
                            <Badge className="bg-green-600">
                              <CalendarCheck2 /> Scheduled {new Date(account.next_available_date).toLocaleDateString("en-CA")}
                            </Badge>
                          )}
                        </AccordionTrigger>
                        <div className="flex gap-2 ml-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
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
                            Add
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
              )}
            </section>
          ) : (
            <>
              {/* OB Calls for Today */}
              {totalTodayCount > 0 && (
                <section>
                  <h2 className="text-xs font-bold mb-4">
                    OB Calls Account for Today ({totalTodayCount})
                  </h2>

                  {clusterOrder.map((cluster) => {
                    const clusterAccounts = groupedToday[cluster];
                    if (!clusterAccounts || clusterAccounts.length === 0) return null;

                    return (
                      <div key={cluster} className="mb-4">
                        <Accordion type="single" collapsible className="w-full">
                          {clusterAccounts.map((account) => (
                            <AccordionItem
                              key={account.id}
                              value={account.id}
                              className="border border-green-300 rounded-sm mb-2 uppercase"
                            >
                              <div className="flex justify-between items-center p-2 select-none">
                                <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                                  {account.company_name}
                                </AccordionTrigger>

                                <div className="flex gap-2 ml-4">
                                  <Button
                                    type="button"
                                    className="cursor-pointer"
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
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Available OB Calls */}
              {totalAvailableCount > 0 && firstAvailableCluster && (
                <section>
                  <h2 className="text-xs font-bold mb-4">
                    Available OB Calls ({groupedNull[firstAvailableCluster].length})
                  </h2>

                  <Alert className="font-mono">
                    <CheckCircle2Icon />
                    <AlertTitle className="text-xs">
                      Cluster Series: {firstAvailableCluster.toUpperCase()}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      This alert provides important information about the selected cluster.
                    </AlertDescription>
                  </Alert>

                  <Accordion type="single" collapsible className="w-full border rounded-sm shadow-sm mt-2 border-blue-200 uppercase">
                    {groupedNull[firstAvailableCluster].map((account) => (
                      <AccordionItem key={account.id} value={account.id}>
                        <div className="flex justify-between items-center p-2 select-none">
                          <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                            {account.company_name}
                          </AccordionTrigger>

                          <div className="flex gap-2 ml-4">
                            <Button
                              type="button"
                              className="cursor-pointer"
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
