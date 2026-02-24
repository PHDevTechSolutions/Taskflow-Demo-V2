"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Check, Trash, Pen } from "lucide-react";
import { type DateRange } from "react-day-picker";

interface NoteItem {
  id: number;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string; // your column
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange?: DateRange;
}

const truncate = (text: string, len = 50) =>
  text.length > len ? text.slice(0, len) + "…" : text;

// Convert UTC to local datetime string for input
const toLocalDateTimeInput = (utc: string) => {
  const d = new Date(utc);
  const tzOffset = d.getTimezoneOffset() * 60000; // offset in ms
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

// Calculate duration as H:M:S
const getDurationHMS = (start: string, end: string) => {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return "0:00:00";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= FETCH NOTES ================= */
  const fetchNotes = async () => {
    if (!referenceid) return;
    try {
      let q = supabase
        .from("documentation")
        .select("*")
        .eq("referenceid", referenceid)
        .order("date_created", { ascending: false });

      if (dateCreatedFilterRange) {
        if (dateCreatedFilterRange.from) {
          q = q.gte("date_created", dateCreatedFilterRange.from.toISOString());
        }
        if (dateCreatedFilterRange.to) {
          q = q.lte("date_created", dateCreatedFilterRange.to.toISOString());
        }
      }

      const { data, error } = await q;
      if (error) throw error;

      setNotes(data ?? []);
    } catch (err: any) {
      console.error("Error fetching notes:", err.message);
      toast.error("Failed to fetch notes");
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [referenceid, dateCreatedFilterRange]);

  /* ================= SAVE NOTE ================= */
  const saveNote = async () => {
    if (!startDate || !endDate) return toast.error("Start and End date required");

    // convert input local datetime to UTC before saving
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) return toast.error("End date cannot be earlier than start date");

    setIsSubmitting(true);

    const payload = {
      referenceid,
      tsm,
      manager,
      type_activity: typeActivity,
      remarks: remarks || "No remarks",
      start_date: start.toISOString(), // saved as UTC
      end_date: end.toISOString(),
    };

    try {
      const { error } = selectedNote
        ? await supabase.from("documentation").update(payload).eq("id", selectedNote.id)
        : await supabase.from("documentation").insert(payload);

      if (error) throw error;

      toast.success(selectedNote ? "Updated" : "Saved");

      setSelectedNote(null);
      setRemarks("");
      setStartDate("");
      setEndDate("");

      await fetchNotes();
    } catch (err: any) {
      console.error("Error saving note:", err.message);
      toast.error(err.message || "Failed to save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= DELETE NOTE ================= */
  const handleDelete = async (note: NoteItem) => {
    try {
      await supabase.from("documentation").delete().eq("id", note.id);
      toast.success("Deleted successfully");
      if (selectedNote?.id === note.id) setSelectedNote(null);
      await fetchNotes();
    } catch (err: any) {
      console.error("Error deleting note:", err.message);
      toast.error(err.message || "Failed to delete note");
    }
  };

  /* ================= UI ================= */
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
              <tr
                key={n.id}
                className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}
              >
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
                    onClick={() => handleDelete(n)}
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
    </div>
  );
};