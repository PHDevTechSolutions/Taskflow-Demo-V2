import React, { useEffect, useState, useMemo } from "react";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { type DateRange } from "react-day-picker";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet, } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { db } from "@/lib/firebase";
import {collection, addDoc, getDocs, query, orderBy, where, Timestamp, deleteDoc, doc, updateDoc, } from "firebase/firestore";
import { Check, Trash, X, Pen } from "lucide-react";
// Import your dialog component, adjust path accordingly
import { AccountsActiveDeleteDialog } from "./dialog/delete";

interface NoteItem {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string; // stored as ISO string
  end_date: string;   // stored as ISO string
  date_created: Timestamp;
  date_updated: Timestamp;
  remind_at?: Timestamp | null;
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
}

const truncate = (text: string, maxLength = 50) =>
  text.length > maxLength ? text.slice(0, maxLength) + "…" : text;

// Helper to calculate duration in hours from two ISO date strings
const getDurationHours = (startISO: string, endISO: string) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours.toFixed(2);
};

export const Notes: React.FC<NotesProps> = ({
  referenceid,
  tsm,
  manager,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [typeActivity, setTypeActivity] = useState("Documentation");
  const [remarks, setRemarks] = useState("");
  const [startDateTime, setStartDateTime] = useState(""); // ISO string, format: "YYYY-MM-DDTHH:mm"
  const [durationHours, setDurationHours] = useState("1"); // string representing number, e.g. "1.5"

  // Reminder datetime
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [remindDateTime, setRemindDateTime] = useState("");
  // Accordion state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Left side filters/search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTypeActivity, setFilterTypeActivity] = useState<string | "All">("All");
  // Tabs control (latest / past)
  const [tabValue, setTabValue] = useState("latest");
  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRemarks, setDeleteRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      setLoading(true);

      try {
        const notesRef = collection(db, "notes");

        let q;

        if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
          const fromTimestamp = Timestamp.fromDate(dateCreatedFilterRange.from);
          const toDate = new Date(dateCreatedFilterRange.to);
          toDate.setHours(23, 59, 59, 999);
          const toTimestamp = Timestamp.fromDate(toDate);

          q = query(
            notesRef,
            where("referenceid", "==", referenceid),
            where("date_created", ">=", fromTimestamp),
            where("date_created", "<=", toTimestamp),
            orderBy("date_created", "desc")
          );
        } else {
          q = query(
            notesRef,
            where("referenceid", "==", referenceid),
            orderBy("date_created", "desc")
          );
        }

        const querySnapshot = await getDocs(q);

        const fetchedNotes = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            referenceid: data.referenceid,
            tsm: data.tsm,
            manager: data.manager,
            type_activity: data.type_activity,
            remarks: data.remarks,
            start_date: data.start_date,
            end_date: data.end_date,
            date_created: data.date_created,
            date_updated: data.date_updated,
            // status removed
          };
        });

        setNotes(fetchedNotes);
      } catch (error) {
        console.error("Error loading notes:", error);
        toast.error("Failed to load notes.");
      }
      setLoading(false);
    }

    fetchNotes();
  }, [dateCreatedFilterRange, referenceid]);

  // Filter notes by search term and type_activity & tab (latest/past)
  const filteredNotes = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();

    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    return notes
      .filter((note) => {
        const noteDate = note.date_created.toDate();
        const isLatest = now.getTime() - noteDate.getTime() <= THIRTY_DAYS_MS;
        if (tabValue === "latest" && !isLatest) return false;
        if (tabValue === "past" && isLatest) return false;

        if (filterTypeActivity !== "All" && note.type_activity !== filterTypeActivity) {
          return false;
        }

        if (
          !note.type_activity.toLowerCase().includes(lowerSearch) &&
          !note.remarks.toLowerCase().includes(lowerSearch)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.date_created.toDate().getTime() - a.date_created.toDate().getTime());
  }, [notes, searchTerm, filterTypeActivity, tabValue]);

  // Reset form
  const resetForm = () => {
    setSelectedNote(null);
    setTypeActivity("Documentation");
    setRemarks("");
    setStartDateTime("");
    setDurationHours("1");
    setRemindDateTime("");
    setShowReminderPicker(false);
  };

  // Create note handler
  const handleCreateNote = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!startDateTime || !durationHours) {
      toast.error("Please fill in start date/time and duration.");
      setIsSubmitting(false);
      return;
    }

    const start = new Date(startDateTime);
    if (isNaN(start.getTime())) {
      toast.error("Invalid start date/time.");
      setIsSubmitting(false);
      return;
    }

    const durationNum = parseFloat(durationHours);
    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error("Invalid duration value.");
      setIsSubmitting(false);
      return;
    }

    const end = new Date(start.getTime() + durationNum * 60 * 60 * 1000);

    try {
      const now = Timestamp.fromDate(new Date());

      const remindTimestamp =
        remindDateTime ? Timestamp.fromDate(new Date(remindDateTime)) : null;

      const newNote = {
        referenceid,
        tsm,
        manager,
        type_activity: typeActivity,
        remarks: remarks || "No remarks",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        date_created: now,
        date_updated: now,
        remind_at: remindTimestamp,
      };

      const docRef = await addDoc(collection(db, "notes"), newNote);
      setNotes((prev) => [{ id: docRef.id, ...newNote }, ...prev]);

      toast.success("Note created successfully!");
      resetForm();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to save note, try again.");
    }

    setIsSubmitting(false);
  };

  // Update note handler
  const handleUpdateNote = async () => {
    if (!selectedNote) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!startDateTime || !durationHours) {
      toast.error("Please fill in start date/time and duration.");
      setIsSubmitting(false);
      return;
    }

    const start = new Date(startDateTime);
    if (isNaN(start.getTime())) {
      toast.error("Invalid start date/time.");
      setIsSubmitting(false);
      return;
    }

    const durationNum = parseFloat(durationHours);
    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error("Invalid duration value.");
      setIsSubmitting(false);
      return;
    }

    const end = new Date(start.getTime() + durationNum * 60 * 60 * 1000);

    try {
      const noteRef = doc(db, "notes", selectedNote.id);
      const now = Timestamp.fromDate(new Date());

      await updateDoc(noteRef, {
        type_activity: typeActivity,
        remarks,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        date_updated: now,
        remind_at: remindDateTime ? Timestamp.fromDate(new Date(remindDateTime)) : null,
      });

      setNotes((prev) =>
        prev.map((note) =>
          note.id === selectedNote.id
            ? {
                ...note,
                type_activity: typeActivity,
                remarks,
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                date_updated: now,
                remind_at: remindDateTime ? Timestamp.fromDate(new Date(remindDateTime)) : null,
              }
            : note
        )
      );

      toast.success("Note updated successfully!");
      resetForm();
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note, try again.");
    }

    setIsSubmitting(false);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = () => {
    if (!selectedNote) return;
    setDeleteRemarks("");
    setDeleteDialogOpen(true);
  };

  // Confirm delete after dialog
  const confirmDeleteNote = async () => {
    if (!selectedNote) return;

    try {
      await deleteDoc(doc(db, "notes", selectedNote.id));
      setNotes((prev) => prev.filter((note) => note.id !== selectedNote.id));
      toast.success("Note deleted successfully!");
      resetForm();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note, try again.");
    }
  };

  // Edit note click to populate form
  const handleEditClick = (note: NoteItem) => {
    setSelectedNote(note);
    setTypeActivity(note.type_activity);
    setRemarks(note.remarks);
    setStartDateTime(note.start_date.slice(0,16)); // "YYYY-MM-DDTHH:mm"
    const start = new Date(note.start_date);
    const end = new Date(note.end_date);
    const durationHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    setDurationHours(durationHrs.toFixed(2));

    if (note.remind_at) {
      const remindISO = note.remind_at.toDate().toISOString();
      setRemindDateTime(remindISO.slice(0,16));
      setShowReminderPicker(true);
    } else {
      setRemindDateTime("");
      setShowReminderPicker(false);
    }
  };

  // Accordion expand/collapse handler
  const handleAccordionChange = (value: string | string[] | undefined) => {
    if (typeof value === "string") {
      setExpandedId(expandedId === value ? null : value);
    } else {
      setExpandedId(null);
    }
  };

  // Unique activities for filter dropdown
  const uniqueTypeActivities = useMemo(() => {
    const types = new Set(notes.map((n) => n.type_activity));
    return ["All", ...Array.from(types)];
  }, [notes]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side with search, filter, tabs, notes */}
        <div className="max-h-[600px] overflow-auto space-y-4 custom-scrollbar">
          <h2 className="text-lg font-semibold mb-2">Daily Admin Task</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* LEFT — Search bar */}
            <div>
              <Input
                placeholder="Search by type or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            {/* RIGHT — Filter dropdown */}
            <div>
              <Select
                value={filterTypeActivity}
                onValueChange={(val) => setFilterTypeActivity(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by Type Activity" />
                </SelectTrigger>

                <SelectContent>
                  {uniqueTypeActivities.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tabValue} onValueChange={setTabValue} className="mb-4">
            <TabsList>
              <TabsTrigger value="latest">Latest</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="latest" className="p-0">
              {/* Accordion with filtered notes */}
              <Accordion
                type="single"
                collapsible
                className="w-full"
                value={expandedId || undefined}
                onValueChange={handleAccordionChange}
              >
                {filteredNotes.map(
                  ({ id, type_activity, remarks, start_date, end_date }) => {
                    const duration = getDurationHours(start_date, end_date);
                    return (
                      <AccordionItem
                        key={id}
                        value={id}
                        className="border rounded-lg shadow-sm flex flex-col mb-4"
                      >
                        <div className="flex items-center justify-between px-4 py-2">
                          <AccordionTrigger className="flex-1 flex items-center gap-2 cursor-pointer select-none">
                            <span className="font-semibold">{type_activity}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {truncate(remarks, 50)}
                            </span>
                          </AccordionTrigger>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditClick(notes.find((n) => n.id === id)!)
                            }
                          >
                          <Pen /> Edit
                          </Button>
                        </div>

                        <AccordionContent className="px-4 pt-0 pb-2 text-xs space-y-1">
                          <p>
                            <strong>Remarks:</strong> {remarks}
                          </p>
                          <p>
                            <strong>Duration:</strong> {duration} hours
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  }
                )}
                {filteredNotes.length === 0 && (
                  <p className="text-muted-foreground px-4 py-2">
                    No notes matching the criteria.
                  </p>
                )}
              </Accordion>
            </TabsContent>

            <TabsContent value="past" className="p-0">
              {/* Same accordion content filtered for past */}
              <Accordion
                type="single"
                collapsible
                className="w-full"
                value={expandedId || undefined}
                onValueChange={handleAccordionChange}
              >
                {filteredNotes.map(
                  ({ id, type_activity, remarks, start_date, end_date }) => {
                    const duration = getDurationHours(start_date, end_date);
                    return (
                      <AccordionItem
                        key={id}
                        value={id}
                        className="border rounded-lg shadow-sm flex flex-col mb-4"
                      >
                        <div className="flex items-center justify-between px-4 py-2">
                          <AccordionTrigger className="flex-1 flex items-center gap-2 cursor-pointer select-none">
                            <span className="font-semibold">{type_activity}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {truncate(remarks, 50)}
                            </span>
                          </AccordionTrigger>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditClick(notes.find((n) => n.id === id)!)
                            }
                          >
                            Edit
                          </Button>
                        </div>

                        <AccordionContent className="px-4 pt-0 pb-2 text-xs space-y-1">
                          <p>
                            <strong>Remarks:</strong> {remarks}
                          </p>
                          <p>
                            <strong>Duration:</strong> {duration} hours
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  }
                )}
                {filteredNotes.length === 0 && (
                  <p className="text-muted-foreground px-4 py-2">
                    No notes matching the criteria.
                  </p>
                )}
              </Accordion>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right side: Form for Create/Update */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {selectedNote ? "Edit Note" : "Create New Note"}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              selectedNote ? handleUpdateNote() : handleCreateNote();
            }}
            className="space-y-6"
          >
            <FieldSet>
              <FieldLegend>Note Details</FieldLegend>

              <Field>
                <FieldLabel htmlFor="typeActivity">Type of Activity</FieldLabel>
                <Select onValueChange={setTypeActivity} value={typeActivity}>
                  <SelectTrigger id="typeActivity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Documentation">Documentation</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks..."
                  rows={5}
                />
              </Field>

              <FieldGroup className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="startDateTime">Start Date & Time</FieldLabel>
                  <Input
                    id="startDateTime"
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="durationHours">Duration (hours)</FieldLabel>
                  <Input
                    id="durationHours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex gap-3 mt-4">
              <Button type="submit" disabled={isSubmitting}>
               <Check /> {isSubmitting
                  ? "Saving..."
                  : selectedNote
                  ? "Update"
                  : "Submit"}
              </Button>

              {selectedNote && (
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={openDeleteDialog}
                >
                <Trash /> Delete
                </Button>
              )}

              {selectedNote && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                >
                 <X /> Cancel
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AccountsActiveDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        removeRemarks={deleteRemarks}
        setRemoveRemarks={setDeleteRemarks}
        onConfirmRemove={confirmDeleteNote}
      />
    </>
  );
};
