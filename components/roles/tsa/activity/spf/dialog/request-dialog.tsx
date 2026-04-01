"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, Trash2, ImageIcon, Check,
  ShieldCheck, FileText, Package, Building2,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  isEditMode: boolean;
  prepared_by?: string;
  firstname?: string;
  lastname?: string;
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

interface SPFCreationRow {
  id: number;
  spf_number: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  item_code?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_packaging_details?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  product_offer_pcs_per_carton?: string;
  final_selling_cost?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  proj_lead_time?: string;
  status?: string;
}

interface SpecItem {
  key: string;
  value: string;
  multiValues: string[];
}

interface SpecCategory {
  name: string;
  items: SpecItem[];
}

interface OfferProduct {
  image: string;
  qty: string;
  spec: SpecCategory[];
  unit_cost: string;
  packaging: string;
  factory_address: string;
  port_of_discharge: string;
  subtotal: string;
  pcs_per_carton: string;
  company_name: string;
  supplier_brand: string;
  contact_number: string;
  item_code: string;
  lead_time: string;
  final_selling: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload";
const UPLOAD_PRESET = "Xchire";

const STEPS = [
  { id: 1, name: "Customer Info", key: "customer" },
  { id: 2, name: "Order Terms", key: "terms" },
  { id: 3, name: "Items", key: "items" },
];

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Separators:
 *   |ROW|  — splits item rows (groups of products)
 *   ||     — splits product variants within a row
 *   |      — splits multiple values within a single spec field (handled in parseSpec)
 *
 * e.g. "prodA || prodB |ROW| prodC |ROW| prodD || prodE"
 *   → Row 1: ["prodA", "prodB"]
 *   → Row 2: ["prodC"]
 *   → Row 3: ["prodD", "prodE"]
 */
/** For spec/qty/cost/etc. fields — variants separated by || */
const parseField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split("||").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

/** For image fields only — variants separated by , (comma) */
const parseImageField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

const parseSpec = (raw: string): SpecCategory[] => {
  if (!raw?.trim()) return [];
  return raw
    .split("@@")
    .map((catChunk) => {
      const [catName, rest] = catChunk.split("~~");
      if (!catName?.trim()) return null;
      const items: SpecItem[] = (rest || "")
        .split(";;")
        .map((entry) => {
          const colonIdx = entry.indexOf(":");
          if (colonIdx === -1) return null;
          const key = entry.slice(0, colonIdx).trim();
          const rawVal = entry.slice(colonIdx + 1).trim();
          const multiValues = rawVal.split("|").map((v) => v.trim()).filter(Boolean);
          return { key, value: rawVal, multiValues } as SpecItem;
        })
        .filter(Boolean) as SpecItem[];
      return { name: catName.trim(), items } as SpecCategory;
    })
    .filter(Boolean) as SpecCategory[];
};

const parseOfferRows = (row: SPFCreationRow): OfferProduct[][] => {
  const f = parseField2D;
  const images = parseImageField2D(row.product_offer_image);
  const qtys = parseImageField2D(row.product_offer_qty);
  const specs = f(row.product_offer_technical_specification);
  const costs = f(row.product_offer_unit_cost);
  const packs = f(row.product_offer_packaging_details);
  const factories = f(row.product_offer_factory_address);
  const ports = f(row.product_offer_port_of_discharge);
  const subtotals = f(row.product_offer_subtotal);
  const pcs = f(row.product_offer_pcs_per_carton);
  const companies = f(row.company_name);
  const brands = f(row.supplier_brand);
  const contacts = f(row.contact_number);
  const codes = parseImageField2D(row.item_code);
  const leads = parseImageField2D(row.proj_lead_time);
  const sellings = parseImageField2D(row.final_selling_cost);

  const numRows = Math.max(images.length, qtys.length, specs.length);

  return Array.from({ length: numRows }, (_, ri) => {
    const rImg = images[ri] ?? [""];
    const rQty = qtys[ri] ?? [""];
    const rSpc = specs[ri] ?? [""];
    const rCst = costs[ri] ?? [""];
    const rPck = packs[ri] ?? [""];
    const rFct = factories[ri] ?? [""];
    const rPrt = ports[ri] ?? [""];
    const rSub = subtotals[ri] ?? [""];
    const rPcs = pcs[ri] ?? [""];
    const rComp = companies[ri] ?? [""];
    const rBrnd = brands[ri] ?? [""];
    const rCont = contacts[ri] ?? [""];
    const rCode = codes[ri] ?? [""];
    const rLead = leads[ri] ?? [""];
    const rSell = sellings[ri] ?? [""];
    const numProds = Math.max(rImg.length, rQty.length, rSpc.length);

    return Array.from({ length: numProds }, (_, pi) => ({
      image: rImg[pi] ?? "",
      qty: rQty[pi] ?? "",
      spec: parseSpec(rSpc[pi] ?? ""),
      unit_cost: rCst[pi] ?? "",
      packaging: rPck[pi] ?? "",
      factory_address: rFct[pi] ?? "",
      port_of_discharge: rPrt[pi] ?? "",
      subtotal: rSub[pi] ?? "",
      pcs_per_carton: rPcs[pi] ?? "",
      company_name: rComp[pi] ?? "",
      supplier_brand: rBrnd[pi] ?? "",
      contact_number: rCont[pi] ?? "",
      item_code: rCode[pi] ?? "",
      lead_time: rLead[pi] ?? "",
      final_selling: rSell[pi] ?? "",
    }));
  });
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const F: React.CSSProperties = {
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

const SectionHeader = ({ children, accent = "#1f2937" }: { children: React.ReactNode; accent?: string }) => (
  <div style={{ background: accent, padding: "5px 12px", marginBottom: "10px" }}>
    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>
      {children}
    </span>
  </div>
);

const FormRow = ({ label, value, wide }: { label: string; value?: string; wide?: boolean }) => (
  <div className={`flex flex-col gap-0.5 ${wide ? "col-span-2" : ""}`}>
    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>
      {label}
    </span>
    <div style={{ ...F, borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: value ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
      {value || "—"}
    </div>
  </div>
);

const SpecDisplay = ({ categories }: { categories: SpecCategory[] }) => {
  if (!categories.length) return (
    <span style={{ ...F, fontSize: "10px", color: "#9ca3af", fontStyle: "italic" }}>No specifications</span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {categories.map((cat, ci) => (
        <div key={ci} style={{ border: "1px solid #dbeafe", overflow: "hidden" }}>
          <div style={{ background: "#eff6ff", borderBottom: "1px solid #dbeafe", padding: "3px 9px" }}>
            <span style={{ ...F, fontSize: "8px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1e40af" }}>
              {cat.name}
            </span>
          </div>
          <div>
            {cat.items.map((item, ii) => (
              <div key={ii} style={{ display: "grid", gridTemplateColumns: "38% 62%", borderBottom: ii < cat.items.length - 1 ? "1px solid #f0f9ff" : "none" }}>
                <div style={{ background: "#f8faff", borderRight: "1px solid #dbeafe", padding: "4px 9px" }}>
                  <span style={{ ...F, fontSize: "9.5px", color: "#374151", fontWeight: 600 }}>{item.key}</span>
                </div>
                <div style={{ padding: "4px 9px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "3px" }}>
                  {item.multiValues.length > 1
                    ? item.multiValues.map((v, vi) => (
                      <span key={vi} style={{ ...F, fontSize: "9px", background: "#dbeafe", color: "#1e40af", padding: "1px 6px", fontWeight: 600, border: "1px solid #bfdbfe" }}>
                        {v}
                      </span>
                    ))
                    : <span style={{ ...F, fontSize: "9.5px", color: "#1f2937" }}>{item.value}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">{children}</p>
);

const Field = ({ label, children, required, className = "" }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export function RequestDialog({
  open, onClose, isEditMode, prepared_by, firstname, lastname,
  currentSPF, setCurrentSPF, handleCreateSPF, handleEditSPF,
}: Props) {

  // Determine which view to show
  const isApprovedByProcurement =
    (currentSPF?.status || "").toLowerCase() === "approved by procurement";

  return isApprovedByProcurement ? (
    <QuotationView
      open={open}
      onClose={onClose}
      isEditMode={isEditMode}
      prepared_by={prepared_by}
      firstname={firstname}
      lastname={lastname}
      currentSPF={currentSPF}
      setCurrentSPF={setCurrentSPF}
      handleCreateSPF={handleCreateSPF}
      handleEditSPF={handleEditSPF}
    />
  ) : (
    <StepperView
      open={open}
      onClose={onClose}
      isEditMode={isEditMode}
      currentSPF={currentSPF}
      setCurrentSPF={setCurrentSPF}
      handleCreateSPF={handleCreateSPF}
      handleEditSPF={handleEditSPF}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTATION VIEW — shown when status === "Approved by Procurement"
// ═══════════════════════════════════════════════════════════════════════════════

function QuotationView({
  open, onClose, isEditMode, prepared_by, firstname, lastname,
  currentSPF, setCurrentSPF, handleCreateSPF, handleEditSPF,
}: Omit<Props, "referenceid">) {
  const [submitting, setSubmitting] = useState(false);
  const [offers, setOffers] = useState<SPFCreationRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const fullName = [firstname, lastname].filter(Boolean).join(" ").trim() || prepared_by || "";

  const items = (() => {
    const descs = (currentSPF?.item_description || "").split(",").map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "").split(",").map((s: string) => s.trim());
    const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
    return maxLen > 0
      ? Array.from({ length: maxLen }, (_, i) => ({ item_description: descs[i] || "", item_photo: photos[i] || "" }))
      : [];
  })();

  useEffect(() => {
    if (!open || !currentSPF?.spf_number) { setOffers([]); return; }
    setLoadingOffers(true);
    supabase
      .from("spf_creation")
      .select("*")
      .eq("spf_number", currentSPF.spf_number)
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setOffers(data as SPFCreationRow[]);
        setLoadingOffers(false);
      });
  }, [open, currentSPF?.spf_number]);

  const handleSubmit = async (status: "Approved by Sales Head") => {
    setSubmitting(true);
    const updated = { ...currentSPF, approved_by: fullName, status };
    setCurrentSPF(updated);
    try {
      if (isEditMode) await handleEditSPF(updated);
      else await handleCreateSPF(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

  const sl = (currentSPF?.status || "").toLowerCase();
  const statusColor = sl === "approved" ? "#065f46" : sl === "endorsed to sales head" ? "#1e40af" : "#92400e";
  const statusBg = sl === "approved" ? "#d1fae5" : sl === "endorsed to sales head" ? "#dbeafe" : "#fef3c7";
  const statusBorder = sl === "approved" ? "#6ee7b7" : sl === "endorsed to sales head" ? "#93c5fd" : "#fcd34d";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 overflow-hidden"
        style={{
          maxWidth: "1280px",
          width: "100%",
          borderRadius: "2px",
          border: "1px solid #d1d5db",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ background: "#f8f7f4", maxHeight: "calc(100vh - 60px)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

            {/* LEFT — SPF Form */}
            <div style={{ flex: "0 0 490px", minWidth: 0 }}>
              <div style={{ background: "#fff", margin: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>

                {/* Letterhead */}
                <div style={{ borderBottom: "3px solid #1f2937", padding: "16px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ ...F, fontSize: "15px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1f2937", lineHeight: 1 }}>SPF Form</div>
                    <div style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "4px", textTransform: "uppercase" }}>Internal Document · For Approval</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1f2937", padding: "4px 10px" }}>
                      <FileText style={{ width: "10px", height: "10px", color: "#f9fafb" }} />
                      <span style={{ ...F, fontSize: "10px", letterSpacing: "0.1em", color: "#f9fafb", fontWeight: 700 }}>{currentSPF?.spf_number || "SPF-PENDING"}</span>
                    </div>
                    <div style={{ ...F, fontSize: "9px", color: "#9ca3af", marginTop: "5px" }}>{today}</div>
                  </div>
                </div>

                {/* Status badge */}
                {currentSPF?.status && (
                  <div style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", padding: "5px 22px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ ...F, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Status:</span>
                    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: statusColor, fontWeight: 700, background: statusBg, padding: "2px 8px", border: `1px solid ${statusBorder}` }}>
                      Ready for Quotation
                    </span>
                  </div>
                )}

                <div style={{ padding: "14px 18px 18px", overflowY: "auto", maxHeight: "70vh" }}>
                  {/* 01 Customer Info */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>01 · Customer Information</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                      <FormRow label="Customer Name" value={currentSPF?.customer_name} wide />
                      <FormRow label="Contact Person" value={currentSPF?.contact_person} />
                      <FormRow label="Contact Number" value={currentSPF?.contact_number} />
                      <FormRow label="TIN Number" value={currentSPF?.tin_no} />
                      <FormRow label="Registered Address" value={currentSPF?.registered_address} wide />
                      <FormRow label="Delivery Address" value={currentSPF?.delivery_address} wide />
                      <FormRow label="Billing Address" value={currentSPF?.billing_address} />
                      <FormRow label="Collection Address" value={currentSPF?.collection_address} />
                    </div>
                  </div>

                  {/* 02 Order Terms */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>02 · Order Terms</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                      <FormRow label="Payment Terms" value={currentSPF?.payment_terms} />
                      <FormRow label="Warranty" value={currentSPF?.warranty} />
                      <FormRow label="Delivery Date" value={currentSPF?.delivery_date ? new Date(currentSPF.delivery_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : undefined} />
                      <FormRow label="Special Instructions" value={currentSPF?.special_instructions} wide />
                    </div>
                  </div>

                  {/* 03 Items */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>03 · Items ({items.length})</SectionHeader>
                    {items.length === 0 ? (
                      <div style={{ border: "1.5px dashed #d1d5db", padding: "18px", textAlign: "center" }}>
                        <span style={{ ...F, fontSize: "10px", color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>No items on record</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 2px" }}>
                        {items.map((item, i) => (
                          <div key={i} style={{ border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "76px 1fr" }}>
                            <div style={{ background: "#f3f4f6", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 6px", gap: "5px" }}>
                              <span style={{ ...F, fontSize: "7px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>Item</span>
                              <span style={{ ...F, fontSize: "18px", fontWeight: 900, color: "#374151", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                              {item.item_photo ? (
                                <div style={{ width: "50px", height: "50px", border: "1px solid #d1d5db", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <img src={item.item_photo} alt={`Item ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                </div>
                              ) : (
                                <div style={{ width: "50px", height: "50px", border: "1.5px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: "7px", color: "#d1d5db", ...F, textTransform: "uppercase" }}>No Photo</span>
                                </div>
                              )}
                            </div>
                            <div style={{ padding: "9px 10px" }}>
                              <span style={{ ...F, fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, display: "block", marginBottom: "4px" }}>Description</span>
                              <p
                                style={{
                                  ...F,
                                  fontSize: "11px",
                                  color: item.item_description ? "#111827" : "#9ca3af",
                                  margin: 0,
                                  whiteSpace: "pre-line",
                                }}
                              >
                                {(item.item_description || "No description provided.")
                                  .replace(/([A-Za-z ]+:\s*)/g, "\n$1")
                                  .trim()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 04 Signatories */}
                  <div>
                    <SectionHeader>04 · Signatories</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", padding: "0 2px" }}>
                      <FormRow label="Sales Person" value={currentSPF?.sales_person} />
                      <FormRow label="Prepared By" value={currentSPF?.prepared_by} />
                      <FormRow label="Approved By" value={currentSPF?.approved_by} />
                      <FormRow label="Noted By" value={fullName || currentSPF?.noted_by} />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "6px 18px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...F, fontSize: "8px", color: "#d1d5db", letterSpacing: "0.08em", textTransform: "uppercase" }}>Confidential · Internal Use Only</span>
                  <span style={{ ...F, fontSize: "8px", color: "#d1d5db" }}>{currentSPF?.spf_number || "—"}</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Product Offers */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: "#fff", margin: "16px 16px 16px 0", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", height: "calc(100% - 32px)" }}>

                <div style={{ borderBottom: "3px solid #1e3a8a", padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
                  <div>
                    <div style={{ ...F, fontSize: "13px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e3a8a", lineHeight: 1 }}>Product Offers</div>
                    <div style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "3px", textTransform: "uppercase" }}>Procurement Results</div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#1e3a8a", padding: "4px 10px" }}>
                    <Package style={{ width: "10px", height: "10px", color: "#93c5fd" }} />
                    <span style={{ ...F, fontSize: "10px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.08em" }}>
                      {offers.length} Offer{offers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                  {loadingOffers ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px", gap: "8px" }}>
                      <Loader2 style={{ width: "15px", height: "15px", color: "#6b7280", animation: "spin 1s linear infinite" }} />
                      <span style={{ ...F, fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading offers…</span>
                    </div>
                  ) : offers.length === 0 ? (
                    <div style={{ border: "1.5px dashed #dbeafe", padding: "28px", textAlign: "center" }}>
                      <Package style={{ width: "26px", height: "26px", color: "#bfdbfe", margin: "0 auto 8px" }} />
                      <span style={{ ...F, fontSize: "10px", color: "#93c5fd", letterSpacing: "0.08em", textTransform: "uppercase" }}>No offers recorded yet</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {offers.map((offer, oi) => {
                        const offerRows = parseOfferRows(offer);
                        const totalProducts = offerRows.reduce((sum, r) => sum + r.length, 0);
                        return (
                          <div key={offer.id} style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
                            <div style={{ background: "#1e3a8a", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <Building2 style={{ width: "11px", height: "11px", color: "#93c5fd", flexShrink: 0 }} />
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ ...F, fontSize: "8px", color: "#93c5fd", background: "rgba(255,255,255,0.1)", padding: "2px 7px", border: "1px solid rgba(147,197,253,0.3)" }}>
                                  {offerRows.length} row{offerRows.length !== 1 ? "s" : ""} · {totalProducts} product{totalProducts !== 1 ? "s" : ""}
                                </span>
                                <span style={{ ...F, fontSize: "10px", color: "#60a5fa", fontWeight: 900 }}>{String(oi + 1).padStart(2, "0")}</span>
                              </div>
                            </div>

                            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                              {offerRows.map((rowProducts, ri) => (
                                <div key={ri}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                                    <div style={{ background: "#1e3a8a", padding: "2px 8px" }}>
                                      <span style={{ ...F, fontSize: "7.5px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Item Row {ri + 1}</span>
                                    </div>
                                    <div style={{ flex: 1, height: "1px", background: "#dbeafe" }} />
                                    <span style={{ ...F, fontSize: "7.5px", color: "#93c5fd" }}>{rowProducts.length} variant{rowProducts.length !== 1 ? "s" : ""}</span>
                                  </div>

                                  <div style={{ display: "grid", gridTemplateColumns: rowProducts.length > 1 ? `repeat(${Math.min(rowProducts.length, 2)}, 1fr)` : "1fr", gap: "8px" }}>
                                    {rowProducts.map((prod, pi) => (
                                      <div key={pi} style={{ border: "1px solid #e5e7eb", overflow: "hidden" }}>
                                        <div style={{ background: "#f0f9ff", borderBottom: "1px solid #dbeafe", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <span style={{ ...F, fontSize: "7.5px", color: "#1e40af", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Variant {pi + 1}</span>
                                          {prod.image ? (
                                            <div style={{ width: "32px", height: "32px", border: "1px solid #bfdbfe", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <img src={prod.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                            </div>
                                          ) : (
                                            <div style={{ width: "32px", height: "32px", border: "1.5px dashed #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <span style={{ fontSize: "6px", color: "#bfdbfe", ...F, textTransform: "uppercase" }}>No Img</span>
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #e5e7eb" }}>
                                          {[
                                            { label: "Item Code", value: prod.item_code },
                                            { label: "Lead Time", value: prod.lead_time },
                                            { label: "Selling Cost", value: prod.final_selling },
                                            { label: "Qty", value: prod.qty },
                                          ].map(({ label, value }, mi) => (
                                            <div key={mi} style={{ padding: "4px 7px", borderRight: mi % 3 !== 2 ? "1px solid #f3f4f6" : "none", borderBottom: mi < 3 ? "1px solid #f3f4f6" : "none", background: mi % 2 === 0 ? "#fff" : "#fafafa" }}>
                                              <div style={{ ...F, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>{label}</div>
                                              <div style={{ ...F, fontSize: "10px", color: value ? "#1f2937" : "#d1d5db", fontWeight: 600 }}>{value || "—"}</div>
                                            </div>
                                          ))}
                                        </div>

                                        <div style={{ padding: "8px 9px" }}>
                                          <div style={{ ...F, fontSize: "7px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, marginBottom: "6px" }}>Technical Specifications</div>
                                          <SpecDisplay categories={prod.spec} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #dbeafe", background: "#f0f9ff", padding: "6px 14px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
                  <span style={{ ...F, fontSize: "8px", color: "#93c5fd", letterSpacing: "0.08em", textTransform: "uppercase" }}>Procurement Data</span>
                  <span style={{ ...F, fontSize: "8px", color: "#93c5fd" }}>{currentSPF?.spf_number || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#1f2937", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #374151" }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{ ...F, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", background: "transparent", border: "1px solid #4b5563", padding: "7px 16px", cursor: "pointer", fontWeight: 700 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "#4b5563"; }}
            >
              ← Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEPPER VIEW — shown when status !== "Approved by Procurement"
// ═══════════════════════════════════════════════════════════════════════════════

function StepperView({
  open, onClose, isEditMode,
  currentSPF, setCurrentSPF, handleCreateSPF, handleEditSPF,
}: Omit<Props, "referenceid" | "firstname" | "lastname" | "prepared_by">) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const descs = (currentSPF?.item_description || "").split(",").map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "").split(",").map((s: string) => s.trim());
    const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
    setItems(maxLen > 0 ? Array.from({ length: maxLen }, (_, i) => ({ item_description: descs[i] || "", item_photo: photos[i] || "" })) : []);
    setStep(1);
    setErrors([]);
  }, [open]);

  const setField = useCallback(
    (key: string, value: string) => setCurrentSPF({ ...currentSPF, [key]: value }),
    [currentSPF, setCurrentSPF]
  );

  const validateStep = (stepNum: number): boolean => {
    const newErrors: string[] = [];
    if (stepNum === 1 && !currentSPF?.customer_name?.trim()) newErrors.push("Customer Name is required");
    if (stepNum === 3) {
      if (items.length === 0) newErrors.push("Please add at least one item");
      items.forEach((it, i) => {
        if (!it.item_photo) newErrors.push(`Item ${i + 1}: Photo is required`);
        if (!it.item_description.trim()) newErrors.push(`Item ${i + 1}: Description is required`);
      });
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => { if (validateStep(step)) setStep(step + 1); };
  const handlePrev = () => setStep(step - 1);

  const handleUpload = async (file: File, index: number) => {
    setUploadingIdx(index);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
      const form = new FormData();
      form.append("file", compressed);
      form.append("upload_preset", UPLOAD_PRESET);
      form.append("folder", "spf_items");
      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      if (!json.secure_url) throw new Error("No URL returned");
      setItems((prev) => { const next = [...prev]; next[index] = { ...next[index], item_photo: json.secure_url }; return next; });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingIdx(null);
    }
  };

  const addItem = () => setItems((prev) => [...prev, { item_photo: "", item_description: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItemDesc = (i: number, val: string) =>
    setItems((prev) => { const next = [...prev]; next[i] = { ...next[i], item_description: val.replace(/,/g, "") }; return next; });

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    const updated = { ...currentSPF, item_description: items.map((it) => it.item_description).join(","), item_photo: items.map((it) => it.item_photo).join(",") };
    setCurrentSPF(updated);
    try {
      if (isEditMode) await handleEditSPF(updated);
      else await handleCreateSPF(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => {
    const fields = [
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
          {fields.map(({ label, key, required }) => (
            <Field key={key} label={label} required={required}>
              <Input className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0" placeholder={label} value={currentSPF?.[key] || ""} onChange={(e) => setField(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Payment Terms">
          <select className="h-9 text-sm border border-gray-300 rounded-sm px-3 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400" value={currentSPF?.payment_terms || ""} onChange={(e) => setField("payment_terms", e.target.value)}>
            <option value="">Select…</option>
            {["COD", "Check", "Cash", "Bank Deposit", "GCash", "Terms"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Warranty">
          <Input className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0" placeholder="e.g., 1 year" value={currentSPF?.warranty || ""} onChange={(e) => setField("warranty", e.target.value)} />
        </Field>
      </div>
      <Field label="Delivery Date">
        <Input type="date" className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0" value={currentSPF?.delivery_date || ""} onChange={(e) => setField("delivery_date", e.target.value)} />
      </Field>
      <Field label="Special Instructions">
        <Textarea className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0" placeholder="Any special instructions..." value={currentSPF?.special_instructions || ""} onChange={(e) => setField("special_instructions", e.target.value)} rows={4} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Sales Person">
          <Input className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0" placeholder="Name" value={currentSPF?.sales_person || ""} onChange={(e) => setField("sales_person", e.target.value)} />
        </Field>
        <Field label="Prepared By">
          <Input className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0" placeholder="Name" value={currentSPF?.prepared_by || ""} onChange={(e) => setField("prepared_by", e.target.value)} />
        </Field>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Items</SectionLabel>
        <button type="button" onClick={addItem} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-all border border-gray-300 px-3 py-2 hover:bg-gray-50">
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
          <div key={i} className="border border-gray-200 rounded-sm overflow-hidden hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Item {i + 1}</span>
              <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-sm"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <Field label="Reference Photo" required>
                <div>
                  <Input type="file" accept="image/*" className="rounded-sm h-9 text-xs border-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, i); e.target.value = ""; }}
                    disabled={uploadingIdx === i}
                  />
                  {uploadingIdx === i && <div className="flex items-center gap-2 text-xs text-gray-500 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading image…</div>}
                  {row.item_photo && uploadingIdx !== i && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="border border-gray-200 rounded-sm p-1 bg-gray-50"><img src={row.item_photo} alt={`Item ${i + 1}`} className="w-24 h-24 object-contain" /></div>
                      <button type="button" onClick={() => setItems((prev) => { const next = [...prev]; next[i] = { ...next[i], item_photo: "" }; return next; })} className="text-xs text-gray-500 hover:text-red-500 transition-colors">Remove</button>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Description" required>
                <Textarea className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0" placeholder="Describe the item in detail..." value={row.item_description} onChange={(e) => updateItemDesc(i, e.target.value)} rows={4} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl rounded-lg p-0 overflow-hidden">
        {/* Stepper Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">{isEditMode ? "Edit SPF Record" : "New SPF Request"}</h2>
              {currentSPF?.spf_number && <p className="text-xs text-gray-500 font-mono mt-1">{currentSPF.spf_number}</p>}
            </div>
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => (
                <React.Fragment key={s.id}>
                  <button type="button" onClick={() => idx < step && setStep(s.id)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${step === s.id ? "bg-gray-900 text-white" : step > s.id ? "bg-emerald-500 text-white cursor-pointer" : "bg-gray-200 text-gray-600"}`}
                  >
                    {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                  </button>
                  {idx < STEPS.length - 1 && <div className={`w-8 h-0.5 transition-colors ${step > s.id ? "bg-emerald-500" : "bg-gray-200"}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Step {step} of {STEPS.length}: {STEPS[step - 1].name}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-sm">
              <p className="text-xs font-semibold text-red-700 mb-2">{errors.length} issue{errors.length !== 1 ? "s" : ""} found:</p>
              <ul className="space-y-1">{errors.map((err, i) => <li key={i} className="text-xs text-red-600">• {err}</li>)}</ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handlePrev} disabled={submitting} className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 border-gray-300 hover:bg-gray-100">
                ← Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 border-gray-300 hover:bg-gray-100">Cancel</Button>
            {step < STEPS.length ? (
              <Button onClick={handleNext} disabled={submitting || uploadingIdx !== null} className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 bg-gray-900 hover:bg-gray-800 text-white">Next →</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || uploadingIdx !== null} className="rounded-sm h-9 text-xs uppercase font-bold tracking-wider px-6 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
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