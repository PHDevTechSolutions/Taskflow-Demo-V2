"use client";

import React, { useState, useEffect } from "react";
import { MeetingDialog } from "./dialog/meeting";
import { Plus, Trash2, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";

interface MeetingItem {
  id: number;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string;
  date_updated: string | null;
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
  const [viewAllOpen, setViewAllOpen] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .eq("referenceid", referenceid)
          .order("date_created", { ascending: false });

        if (error) throw error;

        setMeetings(data || []);
      } catch (error) {
        console.error("Error loading meetings:", error);
        toast.error("Failed to load meetings.");
      } finally {
        setLoading(false);
      }
    }

    fetchMeetings();
  }, [referenceid]);

  const handleDeleteMeeting = async (id: number) => {
    try {
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", id);

      if (error) throw error;

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

  const displayedMeetings = meetings.slice(0, 1);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Meetings</h2>

        <MeetingDialog
          referenceid={referenceid}
          tsm={tsm}
          manager={manager}
          onMeetingCreated={handleMeetingCreated}
        >
          <Button variant="outline" className="text-xs">
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </MeetingDialog>
      </div>

      <Separator className="my-3" />

      {/* Content */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : displayedMeetings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No meetings found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* View All Button */}
          <div className="flex justify-end">
            {meetings.length > 1 && (
              <Button className="text-xs"
                onClick={() => setViewAllOpen(true)}
              >
                <List />
                All
              </Button>
            )}
          </div>
          {displayedMeetings.map((meeting) => (
            <Card key={meeting.id} className="border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-medium">
                  {meeting.type_activity}
                </CardTitle>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 bg-red-100 rounded-full hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the
                        selected meeting.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => handleDeleteMeeting(meeting.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

              </CardHeader>

              <CardContent className="text-[10px] space-y-1">
                <p>
                  <strong>Start:</strong>{" "}
                  {formatDateTime(meeting.start_date)}
                </p>
                <p>
                  <strong>End:</strong>{" "}
                  {formatDateTime(meeting.end_date)}
                </p>
                <p>
                  <strong>Remarks:</strong> {meeting.remarks || "-"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* -------------------- View All Dialog -------------------- */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="w-[500px] max-h-[80vh] bg-white rounded-lg shadow-xl overflow-auto">
          <DialogHeader>
            <DialogTitle>All Meetings</DialogTitle>
            <DialogDescription>
              Showing all meetings for this reference ID.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="border">
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm font-medium">
                    {meeting.type_activity}
                  </CardTitle>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 bg-red-100 rounded-full hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the
                          selected meeting.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleDeleteMeeting(meeting.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                </CardHeader>

                <CardContent className="text-[10px] space-y-1">
                  <p>
                    <strong>Start:</strong>{" "}
                    {formatDateTime(meeting.start_date)}
                  </p>
                  <p>
                    <strong>End:</strong>{" "}
                    {formatDateTime(meeting.end_date)}
                  </p>
                  <p>
                    <strong>Remarks:</strong> {meeting.remarks || "-"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewAllOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
