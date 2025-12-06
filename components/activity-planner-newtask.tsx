"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Account {
  id: string;
  tsm: string;
  manager: string;
  company_name: string;
  contact_number: string;
  email_address: string;
  type_client: string;
  address: string;
  region: string;
  account_reference_number: string;
  next_available_date?: string | null;
  status: string;
}

interface NewTaskProps {
  referenceid: string;
  onEmptyStatusChange?: (isEmpty: boolean) => void;
}


interface EndorsedTicket {
  _id: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  ticket_reference_number: string;
  wrap_up: string;
  inquiry: string;
  manager: string;
  agent: string;
  date_created: string;
  date_updated: string;
}

export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [loadingEndorsed, setLoadingEndorsed] = useState(false);
  const [errorEndorsed, setErrorEndorsed] = useState<string | null>(null);

  const clusterOrder = [
    "TOP 50",
    "NEXT 30",
    "BALANCE 20",
    "TSA CLIENT",
    "CSR CLIENT",
  ].map(c => c.toLowerCase()); // normalize clusterOrder too for consistent comparison

  const clusterOrderNull = [
    "TOP 50",
    "BALANCE 20",
    "NEXT 30",
    "TSA CLIENT",
    "CSR CLIENT",
  ].map(c => c.toLowerCase());

  // -----------------------------------
  // Generate Activity Reference Number
  // -----------------------------------
  const generateActivityRef = (companyName: string, region: string) => {
    const words = companyName.trim().split(" ");
    const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
    const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";

    // unique 10-digit tail
    const uniqueNumber = String(Date.now()).slice(-10);

    return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
  };

  // -----------------------------------
  // Handle Add (POST to API)
  // -----------------------------------
  const handleAdd = async (account: Account) => {
    const region = account.region || "NCR";
    const tsm = (account as any).tsm;
    const manager = (account as any).manager;

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
      activity_reference_number: generateActivityRef(account.company_name, region),
    };

    try {
      // 1. Save activity
      const res = await fetch("/api/act-save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Save failed");

      // 2. Calculate new next_available_date based on type_client (case-insensitive)
      const now = new Date();
      let newDate: Date;

      if (account.type_client.toLowerCase() === "top 50") {
        newDate = new Date(now.setDate(now.getDate() + 15)); // after 15 days
      } else {
        newDate = new Date(now.setMonth(now.getMonth() + 1)); // after 1 month
      }

      // Format date as YYYY-MM-DD
      const nextAvailableDate = newDate.toISOString().split("T")[0];

      // 3. Update next_available_date via API
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

      toast.success(`Successfully added and updated date for: ${account.company_name}`);
    } catch (err) {
      console.error(err);
      toast.error("Error saving or updating account. Please try again.");
    }
  };

  // -----------------------------------
  // Date Normalizer
  // -----------------------------------
  const normalizeDate = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

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
          acc.status?.toLowerCase() !== "pending" // exclude Pending status
      );
    }
    return grouped;
  };

  // -----------------------------------
  // Fetch Accounts
  // -----------------------------------
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
          `/api/com-fetch-account?referenceid=${encodeURIComponent(referenceid)}`
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

  useEffect(() => {
    if (!referenceid) {
      setEndorsedTickets([]);
      return;
    }

    const fetchEndorsedTickets = async () => {
      setErrorEndorsed(null);
      setLoadingEndorsed(true);
      try {
        // 'referenceid' dito ay ginagamit bilang 'agent' sa API query
        const response = await fetch(
          `/api/act-endorsed-ticket?referenceid=${encodeURIComponent(referenceid)}`
        );
        if (!response.ok) {
          setErrorEndorsed("Failed to fetch endorsed tickets");
          setLoadingEndorsed(false);
          return;
        }

        const data = await response.json();
        setEndorsedTickets(data.data || []);
      } catch (err) {
        console.error("Error fetching endorsed tickets:", err);
        setErrorEndorsed("Error fetching endorsed tickets.");
      } finally {
        setLoadingEndorsed(false);
      }
    };

    fetchEndorsedTickets();
  }, [referenceid]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  // Today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const groupedToday = groupByCluster(accounts, (date) => date === todayStr);
  const groupedNull = groupByCluster(accounts, (date) => date === null);

  const totalTodayCount = Object.values(groupedToday).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const totalAvailableCount = Object.values(groupedNull).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className="max-h-[400px] overflow-auto space-y-8 custom-scrollbar">
      {/* SECTION: TODAY */}
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
          <h2 className="text-xs font-bold mb-4">Endorsed Tickets ({endorsedTickets.length})</h2>

          <Accordion type="single" collapsible className="w-full">
            {endorsedTickets.map((ticket) => (
              <AccordionItem key={ticket._id} value={ticket._id}>
                <div className="flex justify-between items-center p-2 cursor-pointer select-none">
                  <AccordionTrigger className="flex-1 text-xs font-semibold">
                    {ticket.company_name}
                  </AccordionTrigger>
                </div>
                <AccordionContent className="flex flex-col gap-2 p-3 text-xs text-gray-700">
                  <p><strong>Contact Person:</strong> {ticket.contact_person}</p>
                  <p><strong>Contact Number:</strong> {ticket.contact_number}</p>
                  <p><strong>Email Address:</strong> {ticket.email_address}</p>
                  <p><strong>Address:</strong> {ticket.address}</p>
                  <p><strong>Ticket Reference #:</strong> {ticket.ticket_reference_number}</p>
                  <p><strong>Wrap Up:</strong> {ticket.wrap_up}</p>
                  <p><strong>Inquiry:</strong> {ticket.inquiry}</p>
                  <p><strong>Manager:</strong> {ticket.manager}</p>
                  <p><strong>Agent:</strong> {ticket.agent}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}


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
                      className="bg-green-100 border border-green-300 rounded mb-2"
                    >
                      <div className="flex justify-between items-center p-2 cursor-pointer select-none">
                        <AccordionTrigger className="flex-1 text-xs font-semibold">
                          {account.company_name}
                        </AccordionTrigger>

                        <div className="flex gap-2 ml-4">
                          <Button
                            type="button"
                            variant="outline"
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

                      <AccordionContent className="flex flex-col gap-2 p-3 text-xs text-green-800">
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

      {/* SECTION: NULL / AVAILABLE */}
      {totalAvailableCount > 0 && (
        <section>
          <h2 className="text-xs font-bold mb-4">
            Available OB Calls ({totalAvailableCount})
          </h2>

          {clusterOrderNull.map((cluster) => {
            const clusterAccounts = groupedNull[cluster];
            if (!clusterAccounts || clusterAccounts.length === 0) return null;

            return (
              <div key={cluster} className="mb-4">
                <Alert>
                  <CheckCircle2Icon />
                  <AlertTitle className="text-xs">Cluster Series: {cluster}</AlertTitle>
                  <AlertDescription className="text-xs">
                    This alert provides important information about the selected cluster.
                  </AlertDescription>
                </Alert>

                <Accordion type="single" collapsible className="w-full">
                  {clusterAccounts.map((account) => (
                    <AccordionItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center p-2 cursor-pointer select-none">
                        <AccordionTrigger className="flex-1 text-xs font-semibold">
                          {account.company_name}
                        </AccordionTrigger>

                        <div className="flex gap-2 ml-4">
                          <Button
                            type="button"
                            variant="outline"
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

                      <AccordionContent className="flex flex-col gap-2 text-xs p-3 text-gray-700">
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
    </div>
  );
};
