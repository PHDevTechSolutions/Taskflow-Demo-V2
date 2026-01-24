"use client";

import React, { useState, useEffect } from "react";
import { MeetingDialog } from "./dialog/meeting";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { toast } from "sonner";

interface MeetingItem {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string; // stored as ISO string or similar
  end_date: string;
  date_created: Timestamp;
  date_updated: Timestamp;
}

interface MeetingProps {
  referenceid: string;
  tsm: string;
  manager: string;
}

// Helper to format date string to "November 23 2025 / 8:00 AM"
function formatDateTime(dateStr: string) {
  // Convert string to Date object
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr; // fallback if invalid

  // Options for date part
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  const datePart = dateObj.toLocaleDateString("en-US", options);

  // Format time with AM/PM
  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const timePart = `${hours}:${minutes} ${ampm}`;

  return `${datePart} / ${timePart}`;
}

export function Meeting({ referenceid, tsm, manager }: MeetingProps) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "meetings"),
          where("referenceid", "==", referenceid),
          orderBy("date_created", "desc")
        );

        const querySnapshot = await getDocs(q);

        const fetchedMeetings = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          } as MeetingItem;
        });

        // FILTER — only upcoming or ongoing
        const today = new Date().toISOString().split("T")[0];

        const upcomingMeetings = fetchedMeetings.filter(
          (m) => m.end_date >= today
        );

        setMeetings(upcomingMeetings);
      } catch (error) {
        console.error("Error loading meetings:", error);
        toast.error("Failed to load meetings.");
      }
      setLoading(false);
    }

    fetchMeetings();
  }, [referenceid]);

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    try {
      await deleteDoc(doc(db, "meetings", id));
      setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
      toast.success("Meeting deleted successfully!");
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast.error("Failed to delete meeting, try again.");
    }
  };

  const handleMeetingCreated = (newMeeting: MeetingItem) => {
    const today = new Date().toISOString().split("T")[0];

    // add only if upcoming
    if (newMeeting.end_date >= today) {
      setMeetings((prev) => [newMeeting, ...prev]);
    }
  };

  const displayedMeetings = meetings.slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Meeting</h2>
        <MeetingDialog
          referenceid={referenceid}
          tsm={tsm}
          manager={manager}
          onMeetingCreated={handleMeetingCreated}
        >
          <Button variant="outline" className="inline-flex items-center cursor-pointer">
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </MeetingDialog>
      </div>

      <Separator className="my-4" />

      <Accordion type="single" collapsible className="w-full">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading meetings...</p>
        ) : displayedMeetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming meetings.
          </p>
        ) : (
          displayedMeetings.map(
            ({ id, type_activity, remarks, start_date, end_date }) => (
              <AccordionItem key={id} value={id}>
                <AccordionTrigger className="text-[10px]">
                  {type_activity} — {formatDateTime(start_date)} to{" "}
                  {formatDateTime(end_date)}
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-2">
                  <p className="text-[10px]">
                    <strong>Remarks:</strong> {remarks}
                  </p>
                  <p className="text-[10px]">
                    <strong>Start Date:</strong> {formatDateTime(start_date)}
                  </p>
                  <p className="text-[10px]">
                    <strong>End Date:</strong> {formatDateTime(end_date)}
                  </p>
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMeeting(id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          )
        )}
      </Accordion>
    </div>
  );
}
