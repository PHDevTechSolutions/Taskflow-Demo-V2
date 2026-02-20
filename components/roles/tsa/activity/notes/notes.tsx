"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Check, Trash, Pen } from "lucide-react";
import { AccountsActiveDeleteDialog } from "./dialog/delete";
import { type DateRange } from "react-day-picker";

/* ================= TYPES ================= */

interface NoteItem {
  id: number;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string; // timestamptz
  end_date: string;   // timestamptz
  created_at: string;
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange: DateRange | undefined;
}

/* ================= HELPERS ================= */

const toTimestamp = (datetime: string) => new Date(datetime).toISOString();
const truncate = (text: string, len = 50) => (text.length > len ? text.slice(0, len) + "…" : text);
const formatDateTimeLocal = (dt: string) => dt.slice(0, 16); // YYYY-MM-DDTHH:mm
const getDurationDays = (start: string, end: string) => Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000*60*60*24));

/* ================= COMPONENT ================= */

export const Notes: React.FC<NotesProps> = ({
  referenceid,
  tsm,
  manager,
  dateCreatedFilterRange,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [typeActivity, setTypeActivity] = useState("Documentation");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRemarks, setDeleteRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchNotes = async () => {
      let q = supabase
        .from("documentation")
        .select("*")
        .eq("referenceid", referenceid)
        .order("created_at", { ascending: false });

      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        q = q
          .gte("created_at", dateCreatedFilterRange.from.toISOString())
          .lte("created_at", new Date(dateCreatedFilterRange.to.setHours(23, 59, 59, 999)).toISOString());
      }

      const { data, error } = await q;
      if (!error) setNotes(data ?? []);
    };
    fetchNotes();
  }, [referenceid, dateCreatedFilterRange]);

  /* ================= SAVE ================= */
  const saveNote = async () => {
    if (!startDate || !endDate) return toast.error("Start and End date required");
    if (new Date(endDate) < new Date(startDate)) return toast.error("End date cannot be earlier than start date");

    setIsSubmitting(true);
    const payload = {
      referenceid,
      tsm,
      manager,
      type_activity: typeActivity,
      remarks: remarks || "No remarks",
      start_date: toTimestamp(startDate),
      end_date: toTimestamp(endDate),
    };

    const { error } = selectedNote
      ? await supabase.from("documentation").update(payload).eq("id", selectedNote.id)
      : await supabase.from("documentation").insert(payload);

    if (error) toast.error(error.message);
    else {
      toast.success(selectedNote ? "Updated" : "Saved");
      setSelectedNote(null);
      setRemarks("");
      setStartDate("");
      setEndDate("");
      // refresh notes
      const { data } = await supabase.from("documentation").select("*").eq("referenceid", referenceid).order("created_at", { ascending: false });
      setNotes(data ?? []);
    }
    setIsSubmitting(false);
  };

  /* ================= DELETE ================= */
  const confirmDelete = async () => {
    if (!selectedNote) return;
    await supabase.from("documentation").delete().eq("id", selectedNote.id);
    setNotes((p) => p.filter((n) => n.id !== selectedNote.id));
    setSelectedNote(null);
    setDeleteOpen(false);
    toast.success("Deleted");
  };

  /* ================= UI ================= */
  return (
    <div className="flex gap-6">
      {/* LEFT: TABLE */}
      <div className="w-2/3 border rounded p-2 overflow-auto max-h-[600px]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Type</th>
              <th className="border p-2">Remarks</th>
              <th className="border p-2">Start</th>
              <th className="border p-2">End</th>
              <th className="border p-2">Duration (days)</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.id} className="border-b hover:bg-gray-50">
                <td className="border p-1">{n.type_activity}</td>
                <td className="border p-1">{truncate(n.remarks, 30)}</td>
                <td className="border p-1">{new Date(n.start_date).toLocaleString()}</td>
                <td className="border p-1">{new Date(n.end_date).toLocaleString()}</td>
                <td className="border p-1">{getDurationDays(n.start_date, n.end_date)}</td>
                <td className="border p-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedNote(n);
                      setTypeActivity(n.type_activity);
                      setRemarks(n.remarks);
                      setStartDate(formatDateTimeLocal(n.start_date));
                      setEndDate(formatDateTimeLocal(n.end_date));
                    }}
                  >
                    <Pen /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RIGHT: FORM */}
      <div className="w-1/3 border rounded p-4">
        <form onSubmit={(e) => { e.preventDefault(); saveNote(); }} className="space-y-4">
          <FieldSet>
            <FieldLegend>{selectedNote ? "Edit Documentation" : "New Documentation"}</FieldLegend>
            <Field>
              <FieldLabel>Type of Activity</FieldLabel>
              <Select value={typeActivity} onValueChange={setTypeActivity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Documentation">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Remarks</FieldLabel>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>

            <FieldGroup>
              <FieldLabel>Start Date</FieldLabel>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <FieldLabel>End Date</FieldLabel>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FieldGroup>
          </FieldSet>

          <Button type="submit" disabled={isSubmitting}>
            <Check /> {selectedNote ? "Update" : "Submit"}
          </Button>

          {selectedNote && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash /> Delete
            </Button>
          )}
        </form>
      </div>

      <AccountsActiveDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        removeRemarks={deleteRemarks}
        setRemoveRemarks={setDeleteRemarks}
        onConfirmRemove={confirmDelete}
      />
    </div>
  );
};