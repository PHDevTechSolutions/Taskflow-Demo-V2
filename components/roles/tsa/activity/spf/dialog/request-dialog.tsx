"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, ImageIcon, Clock } from "lucide-react";
import imageCompression from "browser-image-compression";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  isEditMode: boolean;
  prepared_by?: string;
  currentSPF: any;
  setCurrentSPF: (data: any) => void;
  handleCreateSPF: (payload?: any) => void;
  handleEditSPF: (payload?: any) => void;
  referenceid: string;
}

interface ItemRow {
  item_photo: string;
  item_description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (startISO: string, endISO: string): string => {
  const diff = Math.max(0, Math.floor(
    (new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000
  ));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${h}h ${m}m ${s}s`;
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload";
const UPLOAD_PRESET = "Xchire";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
    {children}
  </p>
);

const Field = ({
  label, children, required, className = "",
}: {
  label: string; children: React.ReactNode; required?: boolean; className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestDialog({
  open, onClose, isEditMode,
  currentSPF, setCurrentSPF,
  handleCreateSPF, handleEditSPF,
}: Props) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Load items when dialog opens ─────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const descs = (currentSPF?.item_description || "").split(",").map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "").split(",").map((s: string) => s.trim());
    const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
    if (maxLen > 0) {
      setItems(Array.from({ length: maxLen }, (_, i) => ({
        item_description: descs[i] || "",
        item_photo: photos[i] || "",
      })));
    } else {
      setItems([]);
    }
  }, [open]);

  // ─── Field change helper ────────────────────────────────────────────────

  const setField = useCallback(
    (key: string, value: string) =>
      setCurrentSPF({ ...currentSPF, [key]: value }),
    [currentSPF, setCurrentSPF]
  );

  // ─── Image upload ───────────────────────────────────────────────────────

  const handleUpload = async (file: File, index: number) => {
    setUploadingIdx(index);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      const form = new FormData();
      form.append("file", compressed);
      form.append("upload_preset", UPLOAD_PRESET);
      form.append("folder", "spf_items");

      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      if (!json.secure_url) throw new Error("No URL returned");

      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], item_photo: json.secure_url };
        return next;
      });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingIdx(null);
    }
  };

  // ─── Item management ────────────────────────────────────────────────────

  const addItem = () =>
    setItems((prev) => [...prev, { item_photo: "", item_description: "" }]);

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const updateItemDesc = (i: number, val: string) =>
    setItems((prev) => {
      const next = [...prev];
      // Strip commas so they don't corrupt the comma-joined storage format
      next[i] = { ...next[i], item_description: val.replace(/,/g, "") };
      return next;
    });

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (items.length === 0) { alert("Please add at least one item."); return; }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].item_photo) { alert(`Item ${i + 1}: Photo is required.`); return; }
      if (!items[i].item_description.trim()) { alert(`Item ${i + 1}: Description is required.`); return; }
    }

    setSubmitting(true);
    const updated = {
      ...currentSPF,
      item_description: items.map((it) => it.item_description).join(","),
      item_photo: items.map((it) => it.item_photo).join(","),
    };
    setCurrentSPF(updated);

    try {
      if (isEditMode) await handleEditSPF(updated);
      else await handleCreateSPF(updated);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Left fields ────────────────────────────────────────────────────────

  const leftFields = [
    { label: "Customer Name", key: "customer_name", required: true },
    { label: "Contact Person", key: "contact_person" },
    { label: "Contact Number", key: "contact_number" },
    { label: "Registered Address", key: "registered_address" },
    { label: "Delivery Address", key: "delivery_address" },
    { label: "Billing Address", key: "billing_address" },
    { label: "Collection Address", key: "collection_address" },
    { label: "TIN Number", key: "tin_no" },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-7xl rounded-none p-6">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isEditMode ? "bg-blue-500" : "bg-emerald-500"}`} />
            {isEditMode ? "Edit SPF Record" : "New SPF Request"}
          </DialogTitle>
          {currentSPF?.spf_number && (
            <p className="text-[11px] font-mono text-gray-400 mt-0.5">
              {currentSPF.spf_number}
            </p>
          )}
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── LEFT: Customer info ───────────────────────────────────── */}
            <div className="space-y-3">
              <SectionLabel>Customer Information</SectionLabel>
              <div className="border border-gray-200 bg-white p-4 space-y-3">
                {leftFields.map(({ label, key, required }) => (
                  <Field key={key} label={label} required={required}>
                    <Input
                      className="rounded-none h-8 text-xs"
                      value={currentSPF?.[key] || ""}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Terms + Items ──────────────────────────────────── */}
            <div className="space-y-4">

              {/* Terms */}
              <div>
                <SectionLabel>Order Terms</SectionLabel>
                <div className="border border-gray-200 bg-white p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Payment Terms">
                      <select
                        className="h-8 text-xs border border-gray-200 rounded-none px-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        value={currentSPF?.payment_terms || ""}
                        onChange={(e) => setField("payment_terms", e.target.value)}
                      >
                        <option value="">Select…</option>
                        {["COD", "Check", "Cash", "Bank Deposit", "GCash", "Terms"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Warranty">
                      <Input className="rounded-none h-8 text-xs"
                        value={currentSPF?.warranty || ""}
                        onChange={(e) => setField("warranty", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Delivery Date">
                    <Input type="date" className="rounded-none h-8 text-xs"
                      value={currentSPF?.delivery_date || ""}
                      onChange={(e) => setField("delivery_date", e.target.value)} />
                  </Field>
                  <Field label="Special Instructions">
                    <Textarea className="rounded-none text-xs resize-none min-h-[72px]"
                      value={currentSPF?.special_instructions || ""}
                      onChange={(e) => setField("special_instructions", e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sales Person">
                      <Input className="rounded-none h-8 text-xs"
                        value={currentSPF?.sales_person || ""}
                        onChange={(e) => setField("sales_person", e.target.value)} />
                    </Field>
                    <Field label="Prepared By">
                      <Input className="rounded-none h-8 text-xs"
                        value={currentSPF?.prepared_by || ""}
                        onChange={(e) => setField("prepared_by", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Approved By">
                    <Input className="rounded-none h-8 text-xs bg-gray-50 text-gray-400"
                      disabled value={currentSPF?.approved_by || ""} />
                  </Field>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel>Items</SectionLabel>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 px-2 py-1 hover:border-gray-400"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-gray-200 text-gray-300 gap-2">
                      <ImageIcon className="w-7 h-7 opacity-30" />
                      <p className="text-[11px] text-gray-400">No items added yet</p>
                    </div>
                  )}

                  {items.map((row, i) => (
                    <div key={i} className="border border-gray-200 bg-white overflow-hidden">
                      {/* Item header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                          Item {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-3 space-y-3">
                        {/* Photo upload */}
                        <Field label="Reference Photo" required>
                          <Input
                            type="file"
                            accept="image/*"
                            className="rounded-none h-8 text-xs"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(file, i);
                              e.target.value = "";
                            }}
                            disabled={uploadingIdx === i}
                          />
                          {uploadingIdx === i && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Uploading…
                            </div>
                          )}
                          {row.item_photo && uploadingIdx !== i && (
                            <div className="mt-2 border border-gray-200 p-1 inline-block">
                              <img
                                src={row.item_photo}
                                alt={`Item ${i + 1}`}
                                className="w-24 h-24 object-contain"
                              />
                            </div>
                          )}
                        </Field>

                        {/* Description */}
                        <Field label="Description" required>
                          <Textarea
                            className="rounded-none text-xs resize-none min-h-[80px]"
                            value={row.item_description}
                            onChange={(e) => updateItemDesc(i, e.target.value)}
                            placeholder="Describe the item (commas are stripped automatically)"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
          {/* Request timer */}
          {!isEditMode && currentSPF?.start_date && currentSPF?.end_date && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {formatDuration(currentSPF.start_date, currentSPF.end_date)}
            </div>
          )}
          {isEditMode && <span />}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}
              className="rounded-none h-8 text-xs uppercase font-bold tracking-wider px-5">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || uploadingIdx !== null}
              className={`rounded-none h-8 text-xs uppercase font-black tracking-wider px-5 gap-1.5 ${
                isEditMode ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-900 hover:bg-gray-800"
              }`}>
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                : isEditMode ? "Update Record" : "Submit Request"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}