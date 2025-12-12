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

import {
  requestFirebaseNotificationPermission,
  onMessageListener,
} from "@/firebase/firebase-messaging";

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
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function toDate(date: Timestamp | Date | string | number): Date {
  if (
    date &&
    typeof date === "object" &&
    "toDate" in date &&
    typeof (date as any).toDate === "function"
  ) {
    return (date as Timestamp).toDate();
  }
  if (date instanceof Date) {
    return date;
  }
  return new Date(date as any);
}

const LOCAL_STORAGE_MEETINGS_KEY = "dismissedMeetings";
const LOCAL_STORAGE_LOGOUT_KEY = "dismissedLogoutReminders";
const LOCAL_STORAGE_NOTE_REMINDERS_KEY = "dismissedNoteReminders";

function getTodayKey() {
  const now = new Date();
  return now.toISOString().split("T")[0]; // yyyy-mm-dd
}

function getDismissedItemsFromStorage(key: string): { [date: string]: string[] } {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveDismissedItemsToStorage(key: string, data: { [date: string]: string[] }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function getDismissedLogoutFromStorage(): { [date: string]: boolean } {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_LOGOUT_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveDismissedLogoutToStorage(data: { [date: string]: boolean }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LOGOUT_KEY, JSON.stringify(data));
  } catch {}
}

export function Reminders() {
  const [now, setNow] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [noteReminders, setNoteReminders] = useState<NoteReminder[]>([]);

  const [showMeetingReminder, setShowMeetingReminder] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);

  const [showNoteReminder, setShowNoteReminder] = useState(false);
  const [currentNoteReminder, setCurrentNoteReminder] = useState<NoteReminder | null>(null);

  const [showLogoutReminder, setShowLogoutReminder] = useState(false);

  const [dismissedMeetings, setDismissedMeetings] = useState<string[]>([]);
  const [dismissedNoteReminders, setDismissedNoteReminders] = useState<string[]>([]);
  const [dismissedLogoutToday, setDismissedLogoutToday] = useState(false);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // Audio ref for notification sound
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track previous show states to detect new popups
  const prevShowMeetingRef = React.useRef<boolean>(false);
  const prevShowNoteRef = React.useRef<boolean>(false);

  // Request permission for browser notifications AND get FCM token
  useEffect(() => {
    requestFirebaseNotificationPermission().then((token) => {
      if (token) {
        console.log("FCM Token:", token);
        // TODO: Send token to your backend if you want to send push notifications
      } else {
        console.log("Notification permission denied or token unavailable.");
      }
    });

    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/reminder-notification.mp3");
    }
  }, []);

  // Listen to incoming Firebase Messaging foreground messages
  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      console.log("Received foreground message:", payload);

      if (Notification.permission === "granted" && payload.notification) {
        const { title, body, icon } = payload.notification;
        new Notification(title || "Reminder", {
          body: body || "",
          icon: icon || "/notification-icon.png",
        });
      }

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    });

    return () => unsubscribe();
  }, []);

  // Load dismissed reminders from localStorage on mount
  useEffect(() => {
    const dismissedMeetingsData = getDismissedItemsFromStorage(LOCAL_STORAGE_MEETINGS_KEY);
    const dismissedNoteRemindersData = getDismissedItemsFromStorage(LOCAL_STORAGE_NOTE_REMINDERS_KEY);
    const todayKey = getTodayKey();

    setDismissedMeetings(dismissedMeetingsData[todayKey] || []);
    setDismissedNoteReminders(dismissedNoteRemindersData[todayKey] || []);

    const dismissedLogoutData = getDismissedLogoutFromStorage();
    setDismissedLogoutToday(!!dismissedLogoutData[todayKey]);
  }, []);

  // Subscribe to Firestore for meetings and notes reminders
  useEffect(() => {
    const qMeetings = query(collection(db, "meetings"), orderBy("start_date"));
    const unsubscribeMeetings = onSnapshot(qMeetings, (snapshot) => {
      const loadedMeetings: Meeting[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.start_date && data.type_activity) {
          loadedMeetings.push({
            id: doc.id,
            title: data.type_activity,
            start_date: data.start_date,
          });
        }
      });
      setMeetings(loadedMeetings);
    });

    const qNotes = query(
      collection(db, "notes"),
      where("remind_at", "!=", null),
      orderBy("remind_at")
    );
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const loadedNotes: NoteReminder[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.remind_at && data.type_activity && data.remarks) {
          loadedNotes.push({
            id: doc.id,
            type_activity: data.type_activity,
            remarks: data.remarks,
            remind_at: data.remind_at,
          });
        }
      });
      setNoteReminders(loadedNotes);
    });

    return () => {
      unsubscribeMeetings();
      unsubscribeNotes();
    };
  }, []);

  // Update current time every 10 seconds (helps reminders update even if inactive tab)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync dismissed reminders across browser tabs using storage event
  useEffect(() => {
    function onStorageChange(e: StorageEvent) {
      if (e.key === LOCAL_STORAGE_MEETINGS_KEY) {
        const dismissedMeetingsData = getDismissedItemsFromStorage(LOCAL_STORAGE_MEETINGS_KEY);
        const todayKey = getTodayKey();
        setDismissedMeetings(dismissedMeetingsData[todayKey] || []);
      }
      if (e.key === LOCAL_STORAGE_NOTE_REMINDERS_KEY) {
        const dismissedNoteRemindersData = getDismissedItemsFromStorage(LOCAL_STORAGE_NOTE_REMINDERS_KEY);
        const todayKey = getTodayKey();
        setDismissedNoteReminders(dismissedNoteRemindersData[todayKey] || []);
      }
      if (e.key === LOCAL_STORAGE_LOGOUT_KEY) {
        const dismissedLogoutData = getDismissedLogoutFromStorage();
        const todayKey = getTodayKey();
        setDismissedLogoutToday(!!dismissedLogoutData[todayKey]);
      }
    }
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  // Check and show reminders on interval and data updates
  useEffect(() => {
    const windowMs = 5 * 60 * 1000; // 5 minutes window

    let matchedMeeting: Meeting | null = null;
    for (const meeting of meetings) {
      if (dismissedMeetings.includes(meeting.id)) continue;
      const meetingDate = toDate(meeting.start_date);
      if (!isSameDay(now, meetingDate)) continue;

      const diff = now.getTime() - meetingDate.getTime();
      if (diff >= 0 && diff <= windowMs) {
        matchedMeeting = meeting;
        break;
      }
    }

    let matchedNote: NoteReminder | null = null;
    for (const note of noteReminders) {
      if (dismissedNoteReminders.includes(note.id)) continue;
      const noteDate = toDate(note.remind_at);
      if (!isSameDay(now, noteDate)) continue;

      const noteDiff = now.getTime() - noteDate.getTime();
      if (noteDiff >= 0 && noteDiff <= windowMs) {
        matchedNote = note;
        break;
      }
    }

    setCurrentMeeting(matchedMeeting);
    setShowMeetingReminder(!!matchedMeeting);

    setCurrentNoteReminder(matchedNote);
    setShowNoteReminder(!!matchedNote);

    const todayKey = getTodayKey();
    const dismissedLogoutData = getDismissedLogoutFromStorage();

    if (
      now.getHours() === 16 &&
      now.getMinutes() === 30 &&
      !dismissedLogoutData[todayKey] &&
      !showLogoutReminder
    ) {
      setShowLogoutReminder(true);
    }
  }, [
    now,
    meetings,
    dismissedMeetings,
    noteReminders,
    dismissedNoteReminders,
    showLogoutReminder,
  ]);

  // Play sound and show browser notification on new reminder popups
  useEffect(() => {
    const isNewMeeting = showMeetingReminder && !prevShowMeetingRef.current;
    const isNewNote = showNoteReminder && !prevShowNoteRef.current;

    if ((isNewMeeting || isNewNote) && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    if (isNewMeeting && currentMeeting) {
      if (Notification.permission === "granted") {
        new Notification("Meeting Reminder", {
          body: `You have a ${currentMeeting.title} at ${formatTime(toDate(currentMeeting.start_date))}.`,
          icon: "/notification-icon.png",
        });
      }
    }

    if (isNewNote && currentNoteReminder) {
      if (Notification.permission === "granted") {
        new Notification("Note Reminder", {
          body: `${currentNoteReminder.type_activity} - ${currentNoteReminder.remarks}`,
          icon: "/notification-icon.png",
        });
      }
    }

    prevShowMeetingRef.current = showMeetingReminder;
    prevShowNoteRef.current = showNoteReminder;
  }, [showMeetingReminder, showNoteReminder, currentMeeting, currentNoteReminder]);

  // Dismiss handlers
  function dismissMeeting() {
    if (!currentMeeting) return;

    const todayKey = getTodayKey();
    const dismissedData = getDismissedItemsFromStorage(LOCAL_STORAGE_MEETINGS_KEY);

    const todayDismissed = new Set(dismissedData[todayKey] || []);
    todayDismissed.add(currentMeeting.id);

    dismissedData[todayKey] = Array.from(todayDismissed);
    saveDismissedItemsToStorage(LOCAL_STORAGE_MEETINGS_KEY, dismissedData);
    setDismissedMeetings(dismissedData[todayKey]);

    setShowMeetingReminder(false);
    setCurrentMeeting(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function dismissNoteReminder() {
    if (!currentNoteReminder) return;

    const todayKey = getTodayKey();
    const dismissedData = getDismissedItemsFromStorage(LOCAL_STORAGE_NOTE_REMINDERS_KEY);

    const todayDismissed = new Set(dismissedData[todayKey] || []);
    todayDismissed.add(currentNoteReminder.id);

    dismissedData[todayKey] = Array.from(todayDismissed);
    saveDismissedItemsToStorage(LOCAL_STORAGE_NOTE_REMINDERS_KEY, dismissedData);
    setDismissedNoteReminders(dismissedData[todayKey]);

    setShowNoteReminder(false);
    setCurrentNoteReminder(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function dismissLogoutReminder() {
    const todayKey = getTodayKey();
    const dismissedLogoutData = getDismissedLogoutFromStorage();
    dismissedLogoutData[todayKey] = true;
    saveDismissedLogoutToStorage(dismissedLogoutData);
    setDismissedLogoutToday(true);
    setShowLogoutReminder(false);
  }

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-50 max-w-xs">
        {/* Meeting Reminder */}
        {showMeetingReminder && currentMeeting && (
          <div
            className="bg-white shadow-lg rounded-lg p-4"
            role="alert"
            aria-live="assertive"
          >
            <strong className="block font-semibold mb-1">Meeting Reminder</strong>
            <p className="text-sm">
              You have a <em>{currentMeeting.title}</em> at{" "}
              {formatTime(toDate(currentMeeting.start_date))}.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={dismissMeeting}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Note Reminder */}
        {showNoteReminder && currentNoteReminder && (
          <div
            className="bg-white shadow-lg rounded-lg p-4"
            role="alert"
            aria-live="assertive"
          >
            <strong className="block font-semibold mb-1">Note Reminder</strong>
            <p className="text-sm">
              <strong>Type:</strong> {currentNoteReminder.type_activity}
            </p>
            <p className="text-sm">
              <strong>Remarks:</strong> {currentNoteReminder.remarks}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={dismissNoteReminder}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {/* Logout Reminder Dialog (center modal) */}
      <Dialog open={showLogoutReminder} onOpenChange={setShowLogoutReminder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout Reminder</DialogTitle>
            <DialogDescription>
              Don't forget to logout the taskflow. Happy selling!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissLogoutReminder}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
