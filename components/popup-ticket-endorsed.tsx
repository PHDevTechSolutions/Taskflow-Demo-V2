"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";

interface EndorsedTicket {
  id: string;
  company_name: string;
  date_created: string;
  agent: string; // Assuming this holds ReferenceID of agent who sent the ticket
}

interface UserDetails {
  referenceid: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
}

export function TicketEndorsed() {
  const searchParams = useSearchParams();
  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [open, setOpen] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const { userId, setUserId } = useUser();
  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [errorTickets, setErrorTickets] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundPlayed, setSoundPlayed] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details based on userId
  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
        });

        toast.success("User data loaded successfully!");
      } catch (err) {
        console.error("Error fetching user data:", err);
        toast.error("Failed to connect to server. Please try again later or refresh your network connection");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch agents once on mount
  useEffect(() => {
    async function fetchAgents() {
      setAgentsLoading(true);
      try {
        const res = await fetch("/api/fetch-agent");
        if (!res.ok) throw new Error("Failed to fetch agents");
        const data = await res.json();
        setAgents(data);
      } catch (err) {
        console.error(err);
        setAgents([]);
      } finally {
        setAgentsLoading(false);
      }
    }
    fetchAgents();
  }, []);

  // Fetch endorsed tickets
  const fetchEndorsedTickets = useCallback(async () => {
    if (!userDetails.referenceid) {
      setEndorsedTickets([]);
      return;
    }

    setLoadingTickets(true);
    setErrorTickets(null);

    try {
      const res = await fetch(`/api/act-fetch-endorsed-ticket?referenceid=${encodeURIComponent(userDetails.referenceid)}`, {
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
      const tickets: EndorsedTicket[] = json.activities || [];

      // Get today's date string in YYYY-MM-DD local timezone
      const today = new Date().toISOString().split("T")[0];

      // Load dismissed ticket IDs from localStorage
      const dismissedTickets: string[] = JSON.parse(localStorage.getItem("dismissedEndorsedTickets") || "[]");

      // Filter tickets that are:
      // 1) Not dismissed
      // 2) Have date_created that is today (YYYY-MM-DD match)
      const newTickets = tickets.filter(ticket => {
        const ticketDate = new Date(ticket.date_created).toISOString().split("T")[0];
        return !dismissedTickets.includes(ticket.id) && ticketDate === today;
      });

      if (newTickets.length > 0) {
        setEndorsedTickets(newTickets);
        setOpen(true);
      } else {
        setEndorsedTickets([]);
        setOpen(false);
      }
    } catch (err: any) {
      setErrorTickets(err.message || "Error fetching endorsed tickets");
      setEndorsedTickets([]);
      setOpen(false);
    } finally {
      setLoadingTickets(false);
    }
  }, [userDetails.referenceid]);

  // Play sound once on dialog open if not already played
  useEffect(() => {
    if (open && endorsedTickets.length > 0 && !soundPlayed) {
      const soundKey = "ticketSoundPlayedFor";
      const dismissedFor = localStorage.getItem(soundKey);

      // Only play sound if not played yet for this set of ticket IDs
      const currentIds = endorsedTickets.map(t => t.id).sort().join(",");
      if (dismissedFor !== currentIds) {
        if (!audioRef.current) {
          audioRef.current = new Audio("/ticket-endorsed.mp3");
        }
        audioRef.current.play().catch(() => {
          // Autoplay might be blocked, ignore
        });
        localStorage.setItem(soundKey, currentIds);
        setSoundPlayed(true);
      }
    }
  }, [open, endorsedTickets, soundPlayed]);

  // Initial fetch and subscribe to realtime updates
  useEffect(() => {
    if (!userDetails.referenceid) return;

    fetchEndorsedTickets();

    const channel = supabase
      .channel(`endorsed-ticket-${userDetails.referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "endorsed-ticket",
          filter: `referenceid=eq.${userDetails.referenceid}`,
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
  }, [userDetails.referenceid, fetchEndorsedTickets]);

  function handleDismiss() {
    setShowDismissConfirm(true);
  }

  function confirmDismiss() {
    // Save dismissed ticket IDs in localStorage
    const dismissedTickets: string[] = JSON.parse(localStorage.getItem("dismissedEndorsedTickets") || "[]");
    const newDismissed = [...dismissedTickets, ...endorsedTickets.map(t => t.id)];
    localStorage.setItem("dismissedEndorsedTickets", JSON.stringify(newDismissed));

    // Clear sound played flag so next new tickets will play again
    localStorage.removeItem("ticketSoundPlayedFor");
    setSoundPlayed(false);

    setShowDismissConfirm(false);
    setOpen(false);
  }

  function cancelDismiss() {
    setShowDismissConfirm(false);
  }

  if (loadingUser || loadingTickets || agentsLoading) return null;
  if (error || errorTickets) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Ticket Endorsed From Ecodesk</DialogTitle>
            <DialogDescription>
              {endorsedTickets.length > 0 ? (
                <>
                  <div>
                    {endorsedTickets.length} {endorsedTickets.length === 1 ? "ticket has" : "tickets have"} been endorsed to your account recently:
                  </div>
                  <div className="max-h-[300px] overflow-y-auto mt-2">
                    <ul className="list-disc pl-5 space-y-4 text-black">
                      {endorsedTickets.map((t, i) => {
                        // Find agent details based on ticket.agent (ReferenceID)
                        const agentDetails = agents.find((a) => a.ReferenceID === t.agent);
                        const fullName = agentDetails ? `${agentDetails.Firstname} ${agentDetails.Lastname}` : "(Unknown Agent)";
                        return (
                          <li key={t.id || i}>
                            <strong>{t.company_name || "No subject"}</strong>
                            <div>Created on: {formatDate(t.date_created)}</div>
                            <div className="capitalize font-semibold">Sent by CSR Agent: {fullName}</div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDismiss}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss confirmation dialog */}
      <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              Once you dismiss this alert, you won&apos;t see it again until new tickets are endorsed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDismiss}>Cancel</Button>
            <Button onClick={confirmDismiss}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
