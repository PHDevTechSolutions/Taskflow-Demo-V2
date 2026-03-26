"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, ImageIcon, Check } from "lucide-react";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload";
const UPLOAD_PRESET = "Xchire";

const STEPS = [
  { id: 1, name: "Customer Info", key: "customer" },
  { id: 2, name: "Order Terms", key: "terms" },
  { id: 3, name: "Items", key: "items" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">
    {children}
  </p>
);

const Field = ({
  label,
  children,
  required,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestDialog({
  open,
  onClose,
  isEditMode,
  currentSPF,
  setCurrentSPF,
  handleCreateSPF,
  handleEditSPF,
}: Props) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // ─── Load items when dialog opens ─────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const descs = (currentSPF?.item_description || "")
      .split(",")
      .map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "")
      .split(",")
      .map((s: string) => s.trim());
    const maxLen = Math.max(
      descs.filter(Boolean).length,
      photos.filter(Boolean).length
    );
    if (maxLen > 0) {
      setItems(
        Array.from({ length: maxLen }, (_, i) => ({
          item_description: descs[i] || "",
          item_photo: photos[i] || "",
        }))
      );
    } else {
      setItems([]);
    }
    setStep(1);
    setErrors([]);
  }, [open]);

  // ─── Field change helper ────────────────────────────────────────────────

  const setField = useCallback(
    (key: string, value: string) =>
      setCurrentSPF({ ...currentSPF, [key]: value }),
    [currentSPF, setCurrentSPF]
  );

  // ─── Validation ─────────────────────────────────────────────────────────

  const validateStep = (stepNum: number): boolean => {
    const newErrors: string[] = [];

    if (stepNum === 1) {
      if (!currentSPF?.customer_name?.trim()) {
        newErrors.push("Customer Name is required");
      }
    }

    if (stepNum === 3) {
      if (items.length === 0) {
        newErrors.push("Please add at least one item");
      }
      for (let i = 0; i < items.length; i++) {
        if (!items[i].item_photo) {
          newErrors.push(`Item ${i + 1}: Photo is required`);
        }
        if (!items[i].item_description.trim()) {
          newErrors.push(`Item ${i + 1}: Description is required`);
        }
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // ─── Navigation ─────────────────────────────────────────────────────────

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

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
      next[i] = { ...next[i], item_description: val.replace(/,/g, "") };
      return next;
    });

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

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

  // ─── Step 1: Customer Information ──────────────────────────────────────

  const renderStep1 = () => {
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

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leftFields.map(({ label, key, required }) => (
            <Field key={key} label={label} required={required}>
              <Input
                className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                placeholder={label}
                value={currentSPF?.[key] || ""}
                onChange={(e) => setField(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>
    );
  };

  // ─── Step 2: Order Terms ───────────────────────────────────────────────

  const renderStep2 = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Payment Terms">
            <select
              className="h-9 text-sm border border-gray-300 rounded-sm px-3 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              value={currentSPF?.payment_terms || ""}
              onChange={(e) => setField("payment_terms", e.target.value)}
            >
              <option value="">Select…</option>
              {["COD", "Check", "Cash", "Bank Deposit", "GCash", "Terms"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Warranty">
            <Input
              className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
              placeholder="e.g., 1 year"
              value={currentSPF?.warranty || ""}
              onChange={(e) => setField("warranty", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Delivery Date">
          <Input
            type="date"
            className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
            value={currentSPF?.delivery_date || ""}
            onChange={(e) => setField("delivery_date", e.target.value)}
          />
        </Field>

        <Field label="Special Instructions">
          <Textarea
            className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0"
            placeholder="Any special instructions..."
            value={currentSPF?.special_instructions || ""}
            onChange={(e) => setField("special_instructions", e.target.value)}
            rows={4}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="Sales Person">
            <Input
              className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
              placeholder="Name"
              value={currentSPF?.sales_person || ""}
              onChange={(e) => setField("sales_person", e.target.value)}
            />
          </Field>
          <Field label="Prepared By">
            <Input
              className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
              placeholder="Name"
              value={currentSPF?.prepared_by || ""}
              onChange={(e) => setField("prepared_by", e.target.value)}
            />
          </Field>
          <Field label="Approved By">
            <Input
              className="rounded-sm h-9 text-sm bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed"
              disabled
              value={currentSPF?.approved_by || ""}
            />
          </Field>
        </div>
      </div>
    );
  };

  // ─── Step 3: Items ────────────────────────────────────────────────────

  const renderStep3 = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Items</SectionLabel>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-all border border-gray-300 px-3 py-2 hover:bg-gray-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-300 text-gray-400 gap-2 rounded-sm">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <p className="text-sm">No items added yet</p>
              <p className="text-xs text-gray-400">Click "Add Item" to get started</p>
            </div>
          )}

          {items.map((row, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-sm overflow-hidden hover:border-gray-300 transition-colors"
            >
              {/* Item header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Item {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Photo upload */}
                <Field label="Reference Photo" required>
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      className="rounded-sm h-9 text-xs border-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, i);
                        e.target.value = "";
                      }}
                      disabled={uploadingIdx === i}
                    />
                    {uploadingIdx === i && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading image…
                      </div>
                    )}
                    {row.item_photo && uploadingIdx !== i && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="border border-gray-200 rounded-sm p-1 bg-gray-50">
                          <img
                            src={row.item_photo}
                            alt={`Item ${i + 1}`}
                            className="w-24 h-24 object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], item_photo: "" };
                              return next;
                            })
                          }
                          className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </Field>

                {/* Description */}
                <Field label="Description" required>
                  <Textarea
                    className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0"
                    placeholder="Describe the item in detail..."
                    value={row.item_description}
                    onChange={(e) => updateItemDesc(i, e.target.value)}
                    rows={4}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Stepper Header ────────────────────────────────────────────────────

  const isStepComplete = (stepNum: number): boolean => {
    if (stepNum === 1) return !!currentSPF?.customer_name?.trim();
    if (stepNum === 2) return true; // Optional step
    if (stepNum === 3)
      return items.length > 0 && items.every((it) => it.item_photo && it.item_description.trim());
    return false;
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl rounded-lg p-0 overflow-hidden">
        {/* Stepper Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-5">
            {/* Title */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {isEditMode ? "Edit SPF Record" : "New SPF Request"}
              </h2>
              {currentSPF?.spf_number && (
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {currentSPF.spf_number}
                </p>
              )}
            </div>

            {/* Step Progress */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => (
                <React.Fragment key={s.id}>
                  <button
                    type="button"
                    onClick={() => idx < step && setStep(s.id)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                      step === s.id
                        ? "bg-gray-900 text-white"
                        : step > s.id
                        ? "bg-emerald-500 text-white cursor-pointer"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-0.5 transition-colors ${
                        step > s.id ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Name */}
          <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Step {step} of {STEPS.length}: {STEPS[step - 1].name}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-sm">
              <p className="text-xs font-semibold text-red-700 mb-2">
                {errors.length} issue{errors.length !== 1 ? "s" : ""} found:
              </p>
              <ul className="space-y-1">
                {errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">
                    • {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {/* Left: Previous Button */}
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={submitting}
                className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 border-gray-300 hover:bg-gray-100"
              >
                ← Previous
              </Button>
            )}
          </div>

          {/* Right: Cancel & Next/Submit Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </Button>

            {step < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={submitting || uploadingIdx !== null}
                className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 bg-gray-900 hover:bg-gray-800 text-white"
              >
                Next →
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploadingIdx !== null}
                className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving..." : isEditMode ? "Update Record" : "Submit Request"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}