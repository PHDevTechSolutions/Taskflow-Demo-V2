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

import { supabase } from "@/utils/supabase";
import { toast } from "sonner";

interface MeetingDialogProps {
  referenceid: string;
  tsm: string;
  manager: string;
  onMeetingCreated?: (meeting: any) => void;
  children: React.ReactNode;
}

export function MeetingDialog({
  referenceid,
  tsm,
  manager,
  onMeetingCreated,
  children,
}: MeetingDialogProps) {
  const [open, setOpen] = useState(false);

  const [typeActivity, setTypeActivity] = useState("Client Meeting");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
      const { data, error } = await supabase
        .from("meetings")
        .insert([
          {
            referenceid,
            tsm,
            manager,
            type_activity: typeActivity,
            remarks: remarks || "No remarks",
            start_date: startDate,
            end_date: endDate,
            date_updated: new Date(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Meeting created successfully!");
      onMeetingCreated?.(data);
      setOpen(false);
    } catch (err) {
      console.error("Supabase insert error:", err);
      toast.error("Failed to save meeting, try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg sm:p-8 rounded-none">
        <DialogHeader>
          <DialogTitle>Create Meeting</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new meeting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Type of Activity */}
          <div className="grid gap-2">
            <Label className="font-bold">Type of Activity</Label>
            <Select value={typeActivity} onValueChange={setTypeActivity} >
              <SelectTrigger className="rounded-none w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                <SelectItem value="Group Meeting">Group Meeting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="grid gap-2">
            <Label className="font-bold">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="rounded-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="font-bold">Start Date</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-bold">End Date</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button type="submit" className="rounded-none p-6">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
