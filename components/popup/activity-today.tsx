"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";

/* ================= TYPES ================= */

interface Activity {
  id: string;
  scheduled_date: string;
  account_reference_number: string;
  status: string;
  date_updated: string;
  activity_reference_number: string;
}

interface Company {
  account_reference_number: string;
  company_name: string;
}

interface UserDetails {
  referenceid: string;
}

const allowedStatuses = ["Assisted", "Quote-Done"];

/* ================= HELPERS ================= */

const isScheduledToday = (dateStr: string) => {
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const getDismissedActivities = (): string[] => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem("dismissedActivities") || "[]");
};

/* ================= COMPONENT ================= */

export function ActivityToday() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [open, setOpen] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";
  const referenceid = userDetails.referenceid;

  /* ================= SYNC USER ID ================= */

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  /* ================= FETCH USER ================= */

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        setUserDetails({ referenceid: data.ReferenceID });
      } catch {
        toast.error("Failed to load user");
      }
    })();
  }, [userId]);

  /* ================= FETCH COMPANIES ================= */

  useEffect(() => {
    if (!referenceid) return;

    fetch("/api/com-fetch-companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.data || []));
  }, [referenceid]);

  /* ================= FETCH ACTIVITIES ================= */

  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;

    const res = await fetch(
      `/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`,
      { cache: "no-store" }
    );

    const json = await res.json();
    setActivities(json.data || []);
  }, [referenceid]);

  /* ================= REALTIME ================= */

  useEffect(() => {
    if (!referenceid) return;

    fetchActivities();

    const channel = supabase
      .channel(`activity-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity",
          filter: `referenceid=eq.${referenceid}`,
        },
        fetchActivities
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  /* ================= MERGED + FILTERED ================= */

  const dismissedIds = getDismissedActivities();

  const mergedActivities = activities
    .filter((a) => isScheduledToday(a.scheduled_date))
    .filter((a) => allowedStatuses.includes(a.status))
    .filter((a) => !dismissedIds.includes(a.id))
    .map((activity) => {
      const company = companies.find(
        (c) => c.account_reference_number === activity.account_reference_number
      );

      return {
        ...activity,
        company_name: company?.company_name ?? "Unknown Company",
      };
    });

  /* ================= AUTO OPEN ================= */

  useEffect(() => {
    setOpen(mergedActivities.length > 0);
  }, [mergedActivities]);

  /* ================= DISMISS ================= */

  function handleDismiss() {
    setShowDismissConfirm(true);
  }

  function confirmDismiss() {
    const stored = getDismissedActivities();
    const updated = Array.from(
      new Set([...stored, ...mergedActivities.map((a) => a.id)])
    );

    localStorage.setItem("dismissedActivities", JSON.stringify(updated));

    setShowDismissConfirm(false);
    setOpen(false);
  }

  /* ================= RENDER ================= */

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activities Scheduled for Today</DialogTitle>
            <DialogDescription>
              <ul className="list-disc pl-6 space-y-2 mt-3 max-h-60 overflow-y-auto uppercase">
                {mergedActivities.map((a) => (
                  <li key={a.id}>
                    <strong>{a.company_name}</strong>
                    <br />
                    Scheduled today
                  </li>
                ))}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDismiss}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              This alert will only reappear if new activities are scheduled today.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDismissConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDismiss}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
