"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

interface Meeting {
  id: string;
  title: string;
  start_date: Timestamp | Date | string | number;
}

type DismissedByDate = Record<string, string[]>;
type DismissedLogoutByDate = Record<string, boolean>;

function formatTime(date: Date) {
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDate(v: any): Date {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
}

const MEETINGS_KEY = "dismissedMeetings";
const LOGOUT_KEY = "dismissedLogoutReminders";

const todayKey = () => new Date().toISOString().split("T")[0];

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

interface UserDetails {
  referenceid: string;
}

export function Reminders() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string>("");

  const [now, setNow] = useState(new Date());

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);

  const [showMeeting, setShowMeeting] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const [dismissedMeetings, setDismissedMeetings] = useState<string[]>([]);
  const [dismissedLogout, setDismissedLogout] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMeeting = useRef(false);
  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "", });

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details including referenceId
  useEffect(() => {
    if (!userId) {
      setError("User ID is missing.");
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

      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  useEffect(() => {
    if (userDetails.referenceid) {
      setReferenceId(userDetails.referenceid);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    audioRef.current = new Audio("/reminder-notification.mp3");

    const meetingsLS = readLS<DismissedByDate>(MEETINGS_KEY, {});
    const logoutLS = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});

    setDismissedMeetings(meetingsLS[todayKey()] || []);
    setDismissedLogout(!!logoutLS[todayKey()]);

    (async () => {
      try {
        const messaging = await import("@/firebase/firebase-messaging");

        const token = await messaging.requestFirebaseNotificationPermission?.();
        if (token) console.log("FCM Token:", token);

        const unsub = messaging.onMessageListener?.((payload: any) => {
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            payload?.notification
          ) {
            new Notification(payload.notification.title || "Reminder", {
              body: payload.notification.body || "",
            });
          }
          audioRef.current?.play().catch(() => { });
        });

        return () => typeof unsub === "function" && unsub();
      } catch {
        console.warn("FCM not supported");
      }
    })();
  }, []);

  // Fetch meetings once we have referenceId
  useEffect(() => {
    if (!referenceId) return;

    const q = query(
      collection(db, "meetings"),
      where("referenceid", "==", referenceId)
    );

    const unsubMeetings = onSnapshot(q, (snap) => {
      setMeetings(
        snap.docs.map((d) => ({
          id: d.id,
          title: d.data().type_activity,
          start_date: d.data().start_date,
        }))
      );
    });

    return () => {
      unsubMeetings();
    };
  }, [referenceId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const FIVE_MINUTES = 5 * 60 * 1000;

    const meeting = meetings.find((m) => {
      if (dismissedMeetings.includes(m.id)) return false;
      const d = toDate(m.start_date);
      const diff = d.getTime() - now.getTime();

      return isSameDay(now, d) && diff <= THIRTY_MINUTES && diff >= -FIVE_MINUTES;
    });

    setCurrentMeeting(meeting || null);
    setShowMeeting(!!meeting);

    if (now.getHours() === 16 && now.getMinutes() === 30 && !dismissedLogout) {
      setShowLogout(true);
    }
  }, [now, meetings, dismissedMeetings, dismissedLogout]);

  useEffect(() => {
    const newMeeting = showMeeting && !prevMeeting.current;

    if (newMeeting && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    }

    prevMeeting.current = showMeeting;
  }, [showMeeting]);

  function dismissMeeting() {
    if (!currentMeeting) return;
    const data = readLS<DismissedByDate>(MEETINGS_KEY, {});
    data[todayKey()] = [...(data[todayKey()] || []), currentMeeting.id];
    writeLS(MEETINGS_KEY, data);
    setDismissedMeetings(data[todayKey()]);
    setShowMeeting(false);
  }

  function dismissLogout() {
    const data = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});
    data[todayKey()] = true;
    writeLS(LOGOUT_KEY, data);
    setDismissedLogout(true);
    setShowLogout(false);
  }

  if (loadingUser) {
    return <div>Loading user data...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <>
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {showMeeting && currentMeeting && (
          <div className="bg-white p-4 rounded shadow">
            <strong>Meeting Reminder</strong>
            <p>
              {currentMeeting.title} at {formatTime(toDate(currentMeeting.start_date))}
            </p>
            <Button size="sm" onClick={dismissMeeting}>
              Dismiss
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showLogout} onOpenChange={setShowLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout Reminder</DialogTitle>
            <DialogDescription>Don&apos;t forget to logout Taskflow.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissLogout}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
