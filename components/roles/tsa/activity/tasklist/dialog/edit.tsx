"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sileo } from "sileo";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, PenLine } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Completed {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  project_name?: string;
  type_activity?: string;
  product_category?: string;
  project_type?: string;
  source?: string;
  call_status?: string;
  call_type?: string;
  quotation_number?: string;
  quotation_amount?: number;
  quotation_status?: string;
  so_number?: string;
  so_amount?: number;
  actual_sales?: number;
  delivery_date?: string;
  dr_number?: string;
  remarks?: string;
  company_name: string;
  contact_number: string;
  contact_person?: string;
  email_address?: string;
  payment_terms?: string;
}

interface TaskListEditDialogProps {
  item: Completed;
  onClose: () => void;
  onSave: () => void;
  company?: {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
  };
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EDITABLE_FIELDS: (keyof Completed)[] = [
  "company_name",
  "contact_person",
  "contact_number",
  "email_address",
  "project_name",
  "project_type",
  "source",
  "type_activity",
  "call_type",
  "call_status",
  "quotation_amount",
  "quotation_status",
  "so_number",
  "so_amount",
  "actual_sales",
  "delivery_date",
  "dr_number",
  "remarks",
  "payment_terms",
];

const QUOTATION_STATUS_OPTIONS = [
  "Pending Client Approval",
  "For Bidding",
  "Nego",
  "Order Complete",
  "Convert to SO",
  "Loss Price is Too High",
  "Lead Time Issue",
  "Out of Stock",
  "Insufficient Stock",
  "Lost Bid",
  "Canvass Only",
  "Did Not Meet the Specs",
  "Declined / Disapproved",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(key: string): string {
  if (key === "call_type") return "Type";
  if (key === "company_name") return "Company Name";
  if (key === "contact_person") return "Contact Person";
  if (key === "contact_number") return "Contact Number";
  if (key === "email_address") return "Email Address";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInputType(key: string): string {
  switch (key) {
    case "delivery_date": return "date";
    case "quotation_amount":
    case "so_amount":
    case "actual_sales": return "number";
    case "email_address": return "email";
    default: return "text";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskListEditDialog({
  item,
  onClose,
  onSave,
}: TaskListEditDialogProps) {
  const [saving, setSaving] = useState(false);

  // FIX: initialize from item directly, include company fields even if empty
  const buildInitial = (src: Completed): Partial<Completed> =>
    EDITABLE_FIELDS.reduce((acc, key) => {
      const val = src[key];
      // Always include company_name and contact_number as they are required fields
      if (key === "company_name" || key === "contact_number") {
        (acc as any)[key] = val || "";
      } else if (val !== undefined && val !== null && String(val).trim() !== "") {
        (acc as any)[key] = val;
      }
      return acc;
    }, {} as Partial<Completed>);

  const [formData, setFormData] = useState<Partial<Completed>>(() => buildInitial(item));

  // FIX: reset form when item changes (dialog reused for different rows)
  useEffect(() => {
    setFormData(buildInitial(item));
  }, [item.id]);

  const handleChange = (field: keyof Completed, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    
    // Debug: Log what we're sending
    console.log("Saving edit:", { id: item.id, formData });
    
    try {
      const res = await fetch(`/api/activity/tsa/historical/update?id=${item.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Update failed:", errorData);
        throw new Error(errorData?.error || "Failed to update");
      }

      sileo.success({
        title: "Saved",
        description: "Activity updated successfully.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onSave();
    } catch (err: any) {
      console.error("Edit save error:", err);
      sileo.error({
        title: "Failed",
        description: err?.message || "Update failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(false);
    }
  };

  // Visible fields only — type_activity is hidden (read-only context)
  const visibleEntries = Object.entries(formData).filter(([key]) => key !== "type_activity");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-none p-0 overflow-hidden gap-0">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <PenLine className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Edit Activity
              </DialogTitle>
            </div>
            <p className="text-zinc-400 text-[11px] font-mono mt-0.5">
              {item.activity_reference_number}
            </p>
          </DialogHeader>
        </div>

        {/* ── Fields ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">

          {/* type_activity — read-only display, not editable */}
          {item.type_activity && (
            <div>
              <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
                Activity Type
              </Label>
              <div className="border border-zinc-200 rounded px-3 py-2 bg-zinc-50 text-xs text-zinc-600 font-mono">
                {item.type_activity}
              </div>
            </div>
          )}

          {visibleEntries.length === 0 && (
            <p className="text-xs text-zinc-400 italic text-center py-4">
              No editable fields with data for this record.
            </p>
          )}

          {visibleEntries.map(([key, value]) => {
            // ── call_status select ──────────────────────────────────
            if (key === "call_status") {
              return (
                <div key={key}>
                  <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
                    {getLabel(key)}
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) => handleChange(key as keyof Completed, val)}
                  >
                    <SelectTrigger className="w-full rounded-none text-xs">
                      <SelectValue placeholder="Select call status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Successful">Successful</SelectItem>
                        <SelectItem value="Unsuccessful">Unsuccessful</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            // ── quotation_status select ─────────────────────────────
            if (key === "quotation_status") {
              return (
                <div key={key}>
                  <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
                    Quotation Status
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) => handleChange("quotation_status", val)}
                  >
                    <SelectTrigger className="w-full rounded-none text-xs">
                      <SelectValue placeholder="Select quotation status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {QUOTATION_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            // ── remarks textarea ────────────────────────────────────
            if (key === "remarks") {
              return (
                <div key={key}>
                  <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
                    Remarks
                  </Label>
                  <Textarea
                    className="w-full rounded-none text-xs resize-none"
                    rows={3}
                    value={String(value ?? "")}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                  />
                </div>
              );
            }

            // ── default input ───────────────────────────────────────
            return (
              <div key={key}>
                <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
                  {getLabel(key)}
                </Label>
                <Input
                  className="w-full rounded-none text-xs"
                  type={getInputType(key)}
                  value={String(value ?? "")}
                  onChange={(e) => handleChange(key as keyof Completed, e.target.value)}
                />
              </div>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button
            variant="outline"
            className="rounded-none flex-1 text-xs h-10"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}