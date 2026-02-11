"use client";

import React, { useState, useEffect } from "react";
import { MeetingDialog } from "./dialog/meeting";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  start_date: string;
  end_date: string;
  date_created: Timestamp;
  date_updated: Timestamp;
}

interface MeetingProps {
  referenceid: string;
  tsm: string;
  manager: string;
}

// Helper to format date string
function formatDateTime(dateStr: string) {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  const datePart = dateObj.toLocaleDateString("en-US", options);

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

        setMeetings(fetchedMeetings);
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
    setMeetings((prev) => [newMeeting, ...prev]);
  };

  // Show up to 3 meetings
  const displayedMeetings = meetings.slice(0, 3);

  return (
    <div>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Meetings</h2>
        <MeetingDialog
          referenceid={referenceid}
          tsm={tsm}
          manager={manager}
          onMeetingCreated={handleMeetingCreated}
        >
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </MeetingDialog>
      </div>

      <Separator className="my-3" />

      {/* Loading / Empty State */}
      {loading ? (
        <p></p>
      ) : displayedMeetings.length === 0 ? (
        <p></p>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedMeetings.map((meeting) => (
            <Card key={meeting.id} className="border">
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium">
                  {meeting.type_activity}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 bg-red-100 rounded-full hover:text-red-800"
                  onClick={() => handleDeleteMeeting(meeting.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </CardHeader>
              <CardContent className="text-[10px] space-y-1">
                <p>
                  <strong>Start:</strong> {formatDateTime(meeting.start_date)}
                </p>
                <p>
                  <strong>End:</strong> {formatDateTime(meeting.end_date)}
                </p>
                <p>
                  <strong>Remarks:</strong> {meeting.remarks || "-"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
