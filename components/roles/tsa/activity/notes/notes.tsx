"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Check, Trash, Pen } from "lucide-react";
import { type DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface NoteItem {
  id: number;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange?: DateRange;
}

const truncate = (text: string, len = 50) =>
  text.length > len ? text.slice(0, len) + "…" : text;

const toLocalDateTimeInput = (utc: string) => {
  const d = new Date(utc);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const getDurationHMS = (start: string, end: string) => {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return "0:00:00";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/* ================= Note Delete Dialog ================= */
interface NoteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteItem | null;
  onConfirmDelete: () => Promise<void>;
}

const NoteDeleteDialog: React.FC<NoteDeleteDialogProps> = ({ open, onOpenChange, note, onConfirmDelete }) => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startHold = () => {
    if (loading || !note) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);

    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalRef.current!);
          handleConfirm();
          return 100;
        }
        return prev + 1;
      });
    }, 20);
  };

  const cancelHold = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
  };

  const handleConfirm = async () => {
    if (!note) return;
    setLoading(true);
    try {
      await onConfirmDelete();
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Failed to delete note",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        onOpenChange(false);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none p-6">
        <DialogHeader>
          <DialogTitle>Delete Note</DialogTitle>
          <DialogDescription>
            Hold the button to permanently delete this note.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-none p-6"
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            disabled={loading}
            className="rounded-none p-6 overflow-hidden relative"
          >
            {loading ? "Deleting..." : "Hold to Delete"}
            <div
              className="absolute top-0 left-0 h-full bg-red-900/30 pointer-events-none transition-all"
              style={{ width: `${progress}%` }}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ================= Notes Component ================= */
export const Notes: React.FC<NotesProps> = ({
  referenceid,
  tsm,
  manager,
  dateCreatedFilterRange,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [deleteNote, setDeleteNote] = useState<NoteItem | null>(null);
  const [typeActivity, setTypeActivity] = useState("Documentation");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNotes = async () => {
    if (!referenceid) return;
    try {
      let q = supabase.from("documentation").select("*").eq("referenceid", referenceid).order("date_created", { ascending: false });

      if (dateCreatedFilterRange) {
        if (dateCreatedFilterRange.from) q = q.gte("date_created", dateCreatedFilterRange.from.toISOString());
        if (dateCreatedFilterRange.to) q = q.lte("date_created", dateCreatedFilterRange.to.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      setNotes(data ?? []);
    } catch (err: any) {
      sileo.error({
        title: "Failed",
        description: "Failed to fetch notes",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [referenceid, dateCreatedFilterRange]);

  const saveNote = async () => {
    if (!startDate || !endDate)
      return
    sileo.error({
      title: "Failed",
      description: "Start and End date required",
      duration: 4000,
      position: "top-right",
      fill: "black",
      styles: {
        title: "text-white!",
        description: "text-white",
      },
    });

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start)
      return
    sileo.error({
      title: "Failed",
      description: "End date cannot be earlier than start date",
      duration: 4000,
      position: "top-right",
      fill: "black",
      styles: {
        title: "text-white!",
        description: "text-white",
      },
    });

    setIsSubmitting(true);

    const payload = {
      referenceid,
      tsm,
      manager,
      type_activity: typeActivity,
      remarks: remarks || "No remarks",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };

    try {
      const { error } = selectedNote
        ? await supabase.from("documentation").update(payload).eq("id", selectedNote.id)
        : await supabase.from("documentation").insert(payload);
      if (error) throw error;

      sileo.success({
        title: "Success",
        description: "Meeting save successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });

      setSelectedNote(null);
      setRemarks("");
      setStartDate("");
      setEndDate("");
      await fetchNotes();
    } catch (err: any) {
      sileo.error({
        title: "Failed",
        description: "Failed to save note",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteNote) return;
    try {
      await supabase.from("documentation").delete().eq("id", deleteNote.id);
      sileo.success({
        title: "Success",
        description: "Deleted successfully",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      if (selectedNote?.id === deleteNote.id) setSelectedNote(null);
      await fetchNotes();
    } catch (err: any) {
      console.error("Error deleting note:", err.message);
      sileo.error({
        title: "Failed",
        description: "Failed to delete note",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  };

  return (
    <div className="flex gap-6">
      {/* LEFT: TABLE */}
      <div className="w-2/3 overflow-auto max-h-[600px] bg-white rounded-none border border-gray-200">
        <table className="w-full table-auto text-sm text-left border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">Remarks</th>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">Start</th>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">End</th>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">Duration</th>
              <th className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n, idx) => (
              <tr key={n.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}>
                <td className="px-4 py-2">{n.type_activity}</td>
                <td className="px-4 py-2">{truncate(n.remarks, 30)}</td>
                <td className="px-4 py-2">{new Date(n.start_date).toLocaleString()}</td>
                <td className="px-4 py-2">{new Date(n.end_date).toLocaleString()}</td>
                <td className="px-4 py-2 font-mono">{getDurationHMS(n.start_date, n.end_date)}</td>
                <td className="px-4 py-2 flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none p-6"
                    onClick={() => {
                      setSelectedNote(n);
                      setTypeActivity(n.type_activity);
                      setRemarks(n.remarks);
                      setStartDate(toLocalDateTimeInput(n.start_date));
                      setEndDate(toLocalDateTimeInput(n.end_date));
                    }}
                  >
                    <Pen className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-none p-6"
                    onClick={() => setDeleteNote(n)}
                  >
                    <Trash className="mr-1" /> Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RIGHT: FORM */}
      <div className="w-1/3 border rounded-none p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveNote();
          }}
          className="space-y-4"
        >
          <FieldSet>
            <FieldLegend>{selectedNote ? "Edit Documentation" : "New Documentation"}</FieldLegend>

            <Field>
              <FieldLabel>Type of Activity</FieldLabel>
              <Select value={typeActivity} onValueChange={setTypeActivity}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Documentation">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Remarks</FieldLabel>
              <Textarea className="rounded-none" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>

            <FieldGroup>
              <FieldLabel>Start Date</FieldLabel>
              <Input
                type="datetime-local"
                className="rounded-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <FieldLabel>End Date</FieldLabel>
              <Input
                type="datetime-local"
                className="rounded-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FieldGroup>
          </FieldSet>

          <Button type="submit" className="rounded-none p-6" disabled={isSubmitting}>
            <Check /> {selectedNote ? "Update" : "Submit"}
          </Button>
        </form>
      </div>

      {/* DELETE DIALOG */}
      {deleteNote && (
        <NoteDeleteDialog
          open={!!deleteNote}
          onOpenChange={(open) => !open && setDeleteNote(null)}
          note={deleteNote}
          onConfirmDelete={confirmDelete}
        />
      )}
    </div>
  );
};