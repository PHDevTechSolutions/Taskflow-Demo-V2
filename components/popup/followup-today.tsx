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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ================= TYPES ================= */

interface Activity {
  id: string;
  company_name: string; // ✅ already from history
  quotation_number?: string;
  quotation_amount?: number;
  remarks?: string;
  call_type?: string;
  date_followup?: string;
}

interface UserDetails {
  referenceid: string;
}

/* ================= CONSTANTS ================= */

const allowedCallTypes = [
  "Sent Quotation Standard",
  "Sent Quotation with Special Price",
  "Sent Quotation with SPF",
];

/* ================= HELPERS ================= */

const isToday = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const getDismissedActivities = (): string[] =>
  typeof window === "undefined"
    ? []
    : JSON.parse(localStorage.getItem("dismissedFollowups") || "[]");

const setDismissedActivities = (ids: string[]) => {
  localStorage.setItem("dismissedFollowups", JSON.stringify(ids));
};

/* ================= COMPONENT ================= */

export function FollowUpToday() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";
  const referenceid = userDetails.referenceid;

  /* ================= SYNC USER ================= */

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
        toast.error("Failed to load user details");
      }
    })();
  }, [userId]);

  /* ================= FETCH HISTORY ================= */

  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;

    const res = await fetch(
      `/api/act-fetch-tsm-history?referenceid=${encodeURIComponent(referenceid)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      setActivities([]);
      return;
    }

    const json = await res.json();
    setActivities(json.activities || []);
  }, [referenceid]);

  /* ================= REALTIME ================= */

  useEffect(() => {
    if (!referenceid) return;

    fetchActivities();

    const channel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `tsm=eq.${referenceid}`,
        },
        fetchActivities
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  /* ================= FILTER ================= */

  const dismissedIds = getDismissedActivities();

  const todayFollowups = activities
    .filter((a) => isToday(a.date_followup))
    .filter((a) => allowedCallTypes.includes(a.call_type ?? ""))
    .filter((a) => !dismissedIds.includes(a.id));

  /* ================= AUTO OPEN ================= */

  useEffect(() => {
    setOpen(todayFollowups.length > 0);
  }, [todayFollowups.length]);

  /* ================= DISMISS ================= */

  const confirmDismiss = () => {
    setDismissedActivities([
      ...new Set([...getDismissedActivities(), ...todayFollowups.map((a) => a.id)]),
    ]);
    setConfirmDismissOpen(false);
    setOpen(false);
  };

  /* ================= RENDER ================= */

  return (
    <>
      {/* MAIN DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-ups for Today</DialogTitle>
            <DialogDescription>
              <div className="space-y-3 mt-4 max-h-64 overflow-y-auto">
                {todayFollowups.map((a) => (
                  <div key={a.id} className="border rounded-md p-3 text-sm">
                    <p className="font-semibold uppercase">{a.company_name}</p>
                    <p>Quotation #: {a.quotation_number ?? "-"}</p>
                    <p>
                      Amount:{" "}
                      {(a.quotation_amount ?? 0).toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      })}
                    </p>
                    <Separator className="my-2" />
                    <Badge className="text-[10px]">{a.call_type}</Badge>
                    <Separator className="my-2" />
                    <p className="text-muted-foreground">
                      Remarks: {a.remarks ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmDismissOpen(true)}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DISMISS */}
      <Dialog open={confirmDismissOpen} onOpenChange={setConfirmDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              This alert will only reappear if new follow-ups are scheduled for today.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDismissOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDismiss}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
