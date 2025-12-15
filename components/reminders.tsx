"use client";

import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  where,
} from "firebase/firestore";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ===================== HELPERS ===================== */

interface Meeting {
  id: string;
  title: string;
  start_date: Timestamp | Date | string | number;
}

interface NoteReminder {
  id: string;
  type_activity: string;
  remarks: string;
  remind_at: Timestamp;
}

function formatTime(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDate(val: any): Date {
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
}

const MEETINGS_KEY = "dismissedMeetings";
const NOTES_KEY = "dismissedNoteReminders";
const LOGOUT_KEY = "dismissedLogoutReminders";

const todayKey = () => new Date().toISOString().split("T")[0];

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, val: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

/* ===================== COMPONENT ===================== */

export function Reminders() {
  const [now, setNow] = useState(new Date());

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<NoteReminder[]>([]);

  const [showMeeting, setShowMeeting] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteReminder | null>(null);

  const [dismissedMeetings, setDismissedMeetings] = useState<string[]>([]);
  const [dismissedNotes, setDismissedNotes] = useState<string[]>([]);
  const [dismissedLogout, setDismissedLogout] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMeeting = useRef(false);
  const prevNote = useRef(false);

  /* ===================== INIT ===================== */

  useEffect(() => {
    if (typeof window === "undefined") return;

    audioRef.current = new Audio("/reminder-notification.mp3");

    setDismissedMeetings(readLS(MEETINGS_KEY, {})[todayKey()] || []);
    setDismissedNotes(readLS(NOTES_KEY, {})[todayKey()] || []);
    setDismissedLogout(!!readLS(LOGOUT_KEY, {})[todayKey()]);

    /* Firebase Messaging (SAFE dynamic import) */
    (async () => {
      try {
        const messaging = await import("@/firebase/firebase-messaging");

        const token = await messaging.requestFirebaseNotificationPermission();
        if (token) console.log("FCM Token:", token);

        const unsub = messaging.onMessageListener((payload: any) => {
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            payload?.notification
          ) {
            new Notification(payload.notification.title || "Reminder", {
              body: payload.notification.body || "",
            });
          }
          audioRef.current?.play().catch(() => {});
        });

        return () => typeof unsub === "function" && unsub();
      } catch (e) {
        console.warn("FCM not supported", e);
      }
    })();
  }, []);

  /* ===================== FIRESTORE ===================== */

  useEffect(() => {
    const unsubMeetings = onSnapshot(
      query(collection(db, "meetings"), orderBy("start_date")),
      (snap) => {
        setMeetings(
          snap.docs.map((d) => ({
            id: d.id,
            title: d.data().type_activity,
            start_date: d.data().start_date,
          }))
        );
      }
    );

    const unsubNotes = onSnapshot(
      query(
        collection(db, "notes"),
        where("remind_at", ">", Timestamp.fromDate(new Date(0))),
        orderBy("remind_at")
      ),
      (snap) => {
        setNotes(
          snap.docs.map((d) => ({
            id: d.id,
            type_activity: d.data().type_activity,
            remarks: d.data().remarks,
            remind_at: d.data().remind_at,
          }))
        );
      }
    );

    return () => {
      unsubMeetings();
      unsubNotes();
    };
  }, []);

  /* ===================== CLOCK ===================== */

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  /* ===================== MATCH REMINDERS ===================== */

  useEffect(() => {
    const windowMs = 5 * 60 * 1000;

    const meeting = meetings.find((m) => {
      if (dismissedMeetings.includes(m.id)) return false;
      const d = toDate(m.start_date);
      const diff = now.getTime() - d.getTime();
      return isSameDay(now, d) && diff >= 0 && diff <= windowMs;
    });

    const note = notes.find((n) => {
      if (dismissedNotes.includes(n.id)) return false;
      const d = toDate(n.remind_at);
      const diff = now.getTime() - d.getTime();
      return isSameDay(now, d) && diff >= 0 && diff <= windowMs;
    });

    setCurrentMeeting(meeting || null);
    setShowMeeting(!!meeting);

    setCurrentNote(note || null);
    setShowNote(!!note);

    if (
      now.getHours() === 16 &&
      now.getMinutes() === 30 &&
      !dismissedLogout
    ) {
      setShowLogout(true);
    }
  }, [now, meetings, notes, dismissedMeetings, dismissedNotes, dismissedLogout]);

  /* ===================== SOUND + NOTIF ===================== */

  useEffect(() => {
    const newMeeting = showMeeting && !prevMeeting.current;
    const newNote = showNote && !prevNote.current;

    if ((newMeeting || newNote) && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

    prevMeeting.current = showMeeting;
    prevNote.current = showNote;
  }, [showMeeting, showNote]);

  /* ===================== DISMISS ===================== */

  function dismissMeeting() {
    const data = readLS(MEETINGS_KEY, {});
    data[todayKey()] = [...(data[todayKey()] || []), currentMeeting!.id];
    writeLS(MEETINGS_KEY, data);
    setDismissedMeetings(data[todayKey()]);
    setShowMeeting(false);
  }

  function dismissNote() {
    const data = readLS(NOTES_KEY, {});
    data[todayKey()] = [...(data[todayKey()] || []), currentNote!.id];
    writeLS(NOTES_KEY, data);
    setDismissedNotes(data[todayKey()]);
    setShowNote(false);
  }

  function dismissLogout() {
    const data = readLS(LOGOUT_KEY, {});
    data[todayKey()] = true;
    writeLS(LOGOUT_KEY, data);
    setDismissedLogout(true);
    setShowLogout(false);
  }

  /* ===================== UI ===================== */

  return (
    <>
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {showMeeting && currentMeeting && (
          <div className="bg-white p-4 rounded shadow">
            <b>Meeting Reminder</b>
            <p>
              {currentMeeting.title} at{" "}
              {formatTime(toDate(currentMeeting.start_date))}
            </p>
            <Button size="sm" onClick={dismissMeeting}>
              Dismiss
            </Button>
          </div>
        )}

        {showNote && currentNote && (
          <div className="bg-white p-4 rounded shadow">
            <b>Note Reminder</b>
            <p>{currentNote.type_activity}</p>
            <p>{currentNote.remarks}</p>
            <Button size="sm" onClick={dismissNote}>
              Dismiss
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showLogout} onOpenChange={setShowLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout Reminder</DialogTitle>
            <DialogDescription>
              Don&apos;t forget to logout Taskflow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissLogout}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}