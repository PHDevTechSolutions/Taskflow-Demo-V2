"use client";

import React, { useEffect, useState, useCallback } from "react";
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

/* ================= TYPES ================= */

interface Activity {
  id: string;
  scheduled_date: string;
  account_reference_number: string;
  company_name: string; // ⬅️ galing na mismo sa activity
  status: string;
  date_updated: string;
  activity_reference_number: string;
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

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
  });
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
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  /* ================= FILTER ONLY (NO MERGE) ================= */

  const dismissedIds = getDismissedActivities();

  const filteredActivities = activities
    .filter((a) => isScheduledToday(a.scheduled_date))
    .filter((a) => allowedStatuses.includes(a.status))
    .filter((a) => !dismissedIds.includes(a.id));

  /* ================= AUTO OPEN ================= */

  useEffect(() => {
    setOpen(filteredActivities.length > 0);
  }, [filteredActivities]);

  /* ================= DISMISS ================= */

  function handleDismiss() {
    setShowDismissConfirm(true);
  }

  function confirmDismiss() {
    const stored = getDismissedActivities();
    const updated = Array.from(
      new Set([...stored, ...filteredActivities.map((a) => a.id)])
    );

    localStorage.setItem("dismissedActivities", JSON.stringify(updated));
    setShowDismissConfirm(false);
    setOpen(false);
  }

  /* ================= RENDER ================= */

  return (
    <>
      {/* MAIN DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Activities Scheduled for Today</DialogTitle>
            <DialogDescription>
              <ul className="list-disc pl-6 space-y-2 mt-3 max-h-60 overflow-y-auto uppercase">
                {filteredActivities.map((a) => (
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
            <Button className="rounded-none p-6" onClick={handleDismiss}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DISMISS */}
      <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              This alert will only reappear if new activities are scheduled today.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none p-6"
              onClick={() => setShowDismissConfirm(false)}
            >
              Cancel
            </Button>
            <Button className="rounded-none p-6" onClick={confirmDismiss}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
