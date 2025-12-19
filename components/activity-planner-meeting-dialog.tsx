"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { toast } from "sonner";

interface MeetingDialogProps {
  referenceid: string;
  tsm: string;
  manager: string;
  onMeetingCreated?: (meeting: any) => void; // callback to parent
  children: React.ReactNode; // button trigger passed from parent
}

export function MeetingDialog({
  referenceid,
  tsm,
  manager,
  onMeetingCreated,
  children,
}: MeetingDialogProps) {
  const [open, setOpen] = useState(false);

  // Form state
  const [typeActivity, setTypeActivity] = useState("Client Meeting");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Reset form on dialog open
  useEffect(() => {
    if (open) {
      setTypeActivity("Client Meeting");
      setRemarks("");
      setStartDate("");
      setEndDate("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referenceid || !tsm || !manager || !startDate || !endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      const now = Timestamp.fromDate(new Date());

      const newMeeting = {
        referenceid,
        tsm,
        manager,
        type_activity: typeActivity,
        remarks: remarks || "No remarks",
        start_date: startDate,
        end_date: endDate,
        date_created: now,
        date_updated: now,
      };

      const docRef = await addDoc(collection(db, "meetings"), newMeeting);

      const createdMeeting = { id: docRef.id, ...newMeeting };

      toast.success("Meeting created successfully!");
      onMeetingCreated?.(createdMeeting);
      setOpen(false);
    } catch (error) {
      console.error("Error adding meeting:", error);
      toast.error("Failed to save meeting, try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle>Create Meeting</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new meeting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Type of Activity */}
          <div className="grid gap-2 w-full">
            <Label htmlFor="typeActivity">Type of Activity</Label>
            <Select onValueChange={setTypeActivity} value={typeActivity}>
              <SelectTrigger id="typeActivity" className="w-full">
                <SelectValue placeholder="Select an activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                <SelectItem value="Group Meeting">Group Meeting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="grid gap-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add remarks..."
              rows={3}
            />
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
