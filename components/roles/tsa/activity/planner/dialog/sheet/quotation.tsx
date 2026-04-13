"use client";

import React, { useState, useEffect } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sileo } from "sileo";
import { Separator } from "@/components/ui/separator"
import { Trash, Download, ImagePlus, Plus, RefreshCcw, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2Icon, XCircle } from "lucide-react";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/utils/supabase";

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface Props {
  step: number;
  setStep: (step: number) => void;
  source: string;
  setSource: (v: string) => void;
  productCat: string; // JSON string of selected products with qty and price
  setProductCat: (v: string) => void;
  productQuantity: string;
  setProductQuantity: (v: string) => void;
  productAmount: string;
  setProductAmount: (v: string) => void;
  productDescription: string;
  setProductDescription: (v: string) => void;
  productPhoto: string;
  setProductPhoto: (v: string) => void;
  productSku: string; // comma separated SKUs
  setProductSku: (v: string) => void;
  productTitle: string; // comma separated titles
  setProductTitle: (v: string) => void;
  projectType: string;
  setProjectType: (v: string) => void;
  projectName: string;
  setProjectName: (v: string) => void;
  quotationNumber: string;
  setQuotationNumber: (v: string) => void;
  quotationAmount: string;
  setQuotationAmount: (v: string) => void;
  quotationType: string;
  setQuotationType: (v: string) => void;
  //quotationStatus: string;
  //setQuotationStatus: (v: string) => void;
  callType: string;
  setCallType: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  remarks: string;
  setRemarks: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  tsm: string;
  setTSM: (v: string) => void;
  typeClient: string;
  setTypeClient: (value: string) => void;

  // --- TAX & LOGISTICS UPDATED ---
  vatType: string;         // e.g., "vat_inc", "vat_exe", "zero_rated"
  setVatType: (value: string) => void;
  whtType: string;         // e.g., "none", "wht_1", "wht_2"
  setWhtType: (value: string) => void;
  deliveryFee: string;
  setDeliveryFee: (value: string) => void;
  restockingFee: string;
  setRestockingFee: (value: string) => void;
  itemRemarks: string;
  setItemRemarks: (value: string) => void;
  quotationSubject: string;
  setQuotationSubject: (value: string) => void;
  tsmApprovalStatus: string;
  setTsmApprovalStatus: (value: string) => void;

  // --- ACTIONS ---
  handleBack: () => void;
  handleNext: () => void;
  handleSave: () => void;

  // --- USER & CLIENT DATA ---
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  company_name: string;
  address: string;
  contact_number: string;
  email_address: string;
  contact_person: string;

  // --- SUPERVISOR & TRACEABILITY ---
  salesManagerContact?: string;
  salesManagerEmail?: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;

  /** Logged-in TSA cluster id — SPF 1 list is filtered to this user's requests when set */
  referenceid?: string;
}

const Quotation_SOURCES = [
  { label: "Existing Client", description: "Clients with active accounts or previous transactions.", },
  { label: "CSR Endorsement", description: "Customer Service Representative inquiries.", },
  { label: "Government", description: "Calls coming from government agencies.", },
  { label: "Philgeps Website", description: "Inquiries from Philgeps online platform.", },
  { label: "Philgeps", description: "Other Philgeps related contacts.", },
  { label: "Distributor", description: "Calls from product distributors or resellers.", },
  { label: "Modern Trade", description: "Contacts from retail or modern trade partners.", },
  { label: "Facebook Marketplace", description: "Leads or inquiries from Facebook Marketplace.", },
  { label: "Walk-in Showroom", description: "Visitors physically coming to showroom.", },
];

interface Product {
  id: string | number;
  title: string;
  description?: string;
  itemRemarks?: string;
  brand?: string;
  images?: Array<{
    src: string;
  }>;
  skus?: string[];
}

interface SelectedProduct extends Product {
  uid: string;
  quantity: number;
  price: number;
  discount: number;
  isDiscounted?: boolean;
  cloudinaryPublicId?: string;
  /** Minimum order qty from PD/procurement — sales may enter equal or higher */
  procurementMinQty?: number;
  procurementLeadTime?: string;
  procurementLockedPrice?: boolean;
  originalPrice?: number;
  procurementItemCode?: string;
}

type SpfCreationRow = {
  id: number;
  spf_number?: string | null;
  status?: string | null;
  company_name?: string | null;
  supplier_brand?: string | null;
  contact_name?: string | null;
  contact_number?: string | null;
  final_selling_cost?: string | null;
  proj_lead_time?: string | null;
  project_lead_time?: string | null;
  manager?: string | null;
  item_code?: string | null;
  // NOTE: Column names vary in DB; we read via fallbacks below.
  [key: string]: any;
};

type SpfOfferProduct = {
  title: string;
  sku: string;
  quantity: number;
  /** Shown as unit price — from procurement `final_selling_cost` (not unit cost) */
  finalSellingPrice: number;
  imageUrl: string;
  technicalSpecification: string;
  packagingDetails: string;
  factoryDetails: string;
  url: string;
  leadTime: string;
};

function extractTsmPrefix(tsm: string): string {
  if (!tsm) return "";
  const firstSegment = tsm.split("-")[0];
  return firstSegment.substring(0, 2);
}

// Isang function lang para sa prefix mapping
function getQuotationPrefix(type: string): string {
  const map: Record<string, string> = {
    "Ecoshift Corporation": "EC",
    "Disruptive Solutions Inc": "DSI",
  };

  return map[type.trim()] || "";
}

export function QuotationSheet(props: Props) {
  const {
    step, setStep,
    source, setSource,
    productCat, setProductCat,
    productQuantity, setProductQuantity,
    productAmount, setProductAmount,
    productDescription, setProductDescription,
    productPhoto, setProductPhoto,
    productSku, setProductSku,
    productTitle, setProductTitle,
    projectType, setProjectType,
    projectName, setProjectName,
    quotationNumber, setQuotationNumber,
    quotationAmount, setQuotationAmount,
    quotationType, setQuotationType,
    //quotationStatus, setQuotationStatus,
    tsmApprovalStatus, setTsmApprovalStatus,

    // --- TAX & FINANCIALS ---
    vatType, setVatType,
    whtType, setWhtType,       // Added Withholding Tax State
    deliveryFee, setDeliveryFee,
    restockingFee, setRestockingFee,
    itemRemarks, setItemRemarks,
    quotationSubject, setQuotationSubject,

    // --- CRM & STATUS ---
    callType, setCallType,
    followUpDate, setFollowUpDate,
    remarks, setRemarks,
    status, setStatus,
    tsm, setTSM,
    typeClient, setTypeClient,

    // --- ACTIONS ---
    handleBack,
    handleNext,
    handleSave,

    // --- USER / REP DETAILS ---
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,

    // --- CLIENT DETAILS ---
    company_name,
    address,
    contact_number,
    email_address,
    contact_person,

    // --- SUPERVISOR & TRACEABILITY ---
    salesManagerContact,
    salesManagerEmail,
    managerDetails,
    tsmDetails,
    signature,
    referenceid: tsaReferenceId,
  } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleDescriptions, setVisibleDescriptions] = useState<Record<string, boolean>>({});
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [noProductsAvailable, setNoProductsAvailable] = useState(false);
  const [showConfirmFollowUp, setShowConfirmFollowUp] = useState(false);
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = React.useState(0);

  const [useToday, setUseToday] = useState(false);

  const [showQuotationAlert, setShowQuotationAlert] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localQuotationNumber, setLocalQuotationNumber] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [productSource, setProductSource] = useState<
    "shopify" | "firebase_shopify" | "firebase_taskflow"
  >("shopify");
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<"search" | "products">("search");

  const [expandedRows, setExpandedRows] = useState<{ [uid: string]: boolean }>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragRowUid, setDragRowUid] = useState<string | null>(null);
  const [dragOverRowUid, setDragOverRowUid] = useState<string | null>(null);
  const [isSpfMode, setIsSpfMode] = useState(false);
  const [isSpf1Mode, setIsSpf1Mode] = useState(false);
  const [spf1Loading, setSpf1Loading] = useState(false);
  const [spf1Error, setSpf1Error] = useState<string | null>(null);
  const [spf1Records, setSpf1Records] = useState<SpfCreationRow[]>([]);
  const [spf1Search, setSpf1Search] = useState("");
  const [spf1Selected, setSpf1Selected] = useState<SpfCreationRow | null>(null);
  const [spfUploading, setSpfUploading] = useState(false);
  const [spfManualProduct, setSpfManualProduct] = useState({
    title: "",
    sku: "",
    price: 0,
    quantity: 1,
    description: "",
    imageUrl: "",
    cloudinaryPublicId: "",
  });

  // Delete image from Cloudinary when product is removed
  const deleteCloudinaryImage = async (publicId: string) => {
    if (!publicId) return;
    try {
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
    } catch (err) {
      console.error("Failed to delete Cloudinary image:", err);
    }
  };

  function addDaysToDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format for input[type=date]
  }

  useEffect(() => {
    if (!callType) {
      setFollowUpDate("");
      return;
    }

    // ✅ PRIORITY: Today checkbox
    if (useToday) {
      const today = new Date().toISOString().split("T")[0];
      if (followUpDate !== today) {
        setFollowUpDate(today);
      }
      return; // ⛔ stop here, wag na mag auto
    }

    // 🔁 AUTO FOLLOW UP LOGIC
    if (
      callType === "Quotation Standard Preparation" ||
      callType === "Quotation with Special Price Preparation"
    ) {
      setFollowUpDate(addDaysToDate(1)); // tomorrow
    } else if (callType === "Quotation with SPF Preparation") {
      setFollowUpDate(addDaysToDate(5)); // after 5 days
    } else {
      setFollowUpDate("");
    }
  }, [callType, useToday]);

  const splitByPipe = (value?: string | null) =>
    (value || "")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const splitByRow = (value?: string | null) =>
    (value || "")
      .split("|ROW|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const splitComma = (value?: string | null) =>
    (value || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const explodeRowGroups = (value?: string | null): string[] => {
    const groups = splitByRow(value);
    if (groups.length === 0) return splitComma(value);
    return groups.flatMap((g) => splitComma(g));
  };

  const summarizeProcField = (value?: string | null, max = 2): string => {
    const items = explodeRowGroups(value)
      .map((v) => v.replace(/\|ROW\|/g, "").trim())
      .filter((v) => v && v !== "-" && v !== "--");
    const unique = Array.from(new Set(items));
    if (unique.length === 0) return "—";
    const head = unique.slice(0, max).join(", ");
    return unique.length > max ? `${head}...` : head;
  };

  const explodeTechSpecs = (value?: string | null): string[] => {
    const v = (value || "").trim();
    if (!v) return [];

    // Prefer the |ROW| separator — this is the clean multi-item format
    const rowGroups = splitByRow(v);
    if (rowGroups.length > 0) return rowGroups;

    // NOTE: Do NOT split on plain "||" here.
    // The DB sometimes embeds "||" inside a single item's field value as an
    // artifact (e.g. "Dimensions: 631mm || LAMP DETAILS~~CCT: ...").
    // Splitting on "||" would create phantom extra spec blocks from one item.
    // Treat the entire string as one spec block per item instead.
    return [v];
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatSpfTechSpecToHtml = (raw: string): string => {
    const text = (raw || "").trim();
    if (!text) return '<span class="text-gray-400 italic">No specifications provided.</span>';

    // ── DB ARTIFACT CLEANUP ───────────────────────────────────────────────────
    // The DB sometimes writes a field value that ends with "|| NEXT_GROUP~~..."
    // (a legacy artifact where the multi-item separator `||` leaked into the
    // last column of a spec table).  We normalise this into the standard `@@`
    // group-separator format so the parser below handles it correctly.
    //
    // Pattern:  "...some value || GROUP_NAME~~key: value"
    // Fix:      replace " || GROUP_NAME~~" with "@@GROUP_NAME~~"
    //
    // We only do this when the token after `||` looks like a spec-group header,
    // i.e. it is followed by `~~` (the key:value separator used in this format).
    const normalised = text.replace(/\s*\|\|\s*([^|@~]+~~)/g, "@@$1");

    // Example format after normalisation:
    // GROUP~~key: value;;key: value@@GROUP 2~~key: value
    const groups = normalised.split("@@").map((g) => g.trim()).filter(Boolean);

    const out: string[] = [];
    for (const g of groups) {
      const [groupTitleRaw, ...rest] = g.split("~~");
      const groupTitle = escapeHtml((groupTitleRaw || "").trim());
      const body = rest.join("~~").trim();
      const lines = body
        .split(";;")
        .map((l) => l.trim())
        .filter(Boolean);

      out.push(`
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
${groupTitle || "SPECIFICATIONS"}
</div>`);

      if (lines.length === 0) {
        continue;
      }

      out.push(`<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`);
      for (const line of lines) {
        const idx = line.indexOf(":");
        const name = escapeHtml((idx >= 0 ? line.slice(0, idx) : line).trim());
        const value = escapeHtml((idx >= 0 ? line.slice(idx + 1) : "").trim());
        out.push(`
<tr>
  <td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>${name}</strong></td>
  <td style="border:1px solid #e5e7eb;padding:4px">${value}</td>
</tr>`);
      }
      out.push(`</table>`);
    }

    return out.join("\n");
  };

  const formatProcurementLeadHtml = (lead: string): string => {
    const t = (lead || "").trim();
    if (!t) return "";
    return `
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
Procurement
</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">
<tr>
  <td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>Project lead time</strong></td>
  <td style="border:1px solid #e5e7eb;padding:4px">${escapeHtml(t)}</td>
</tr>
</table>`;
  };

  const parseSpfCreationProducts = (row: SpfCreationRow): SpfOfferProduct[] => {
    // In `spf_creation` export, multi-items are stored as:
    // - groups separated by `|ROW|`
    // - inside each group, items separated by commas
    const skus = explodeRowGroups(row.item_code);
    const qtys = explodeRowGroups(row.product_offer_qty);
    const sellingPrices = explodeRowGroups(row.final_selling_cost);
    const leadRaw = row.proj_lead_time ?? row.project_lead_time;
    const leadTimes = explodeRowGroups(leadRaw);
    const imgs = explodeRowGroups(row.product_offer_image);
    const techSpecs = explodeTechSpecs(row.product_offer_technical_specification);
    const packaging = explodeRowGroups(row.product_offer_packaging_details);
    const factory = explodeRowGroups(row.product_offer_factory_address);
    const urls: string[] = [];

    const maxLen = skus.length || Math.max(
      qtys.length,
      sellingPrices.length,
      leadTimes.length,
      imgs.length,
      1
    );

    return Array.from({ length: maxLen }, (_, i) => ({
      title: (skus[i] || `SPF ITEM ${i + 1}`).toUpperCase(),
      sku: (skus[i] || skus[0] || "").toUpperCase(),
      quantity: Math.max(0, parseInt(qtys[i] || "0", 10) || 0),
      finalSellingPrice: Math.max(0, parseFloat(sellingPrices[i] || "0") || 0),
      imageUrl: imgs[i] || "",
      technicalSpecification: techSpecs[i] || "",
      packagingDetails: packaging[i] || "",
      factoryDetails: factory[i] || "",
      url: urls[i] || "",
      leadTime: leadTimes[i] || leadTimes[0] || "",
    })).filter((p) => p.sku.trim().length > 0);
  };

  useEffect(() => {
    if (!isSpf1Mode) return;
    let cancelled = false;

    (async () => {
      setSpf1Loading(true);
      setSpf1Error(null);
      try {
        let q = supabase
          .from("spf_creation")
          .select("*")
          .eq("status", "Approved By Procurement");
        if (tsaReferenceId?.trim()) {
          q = q.eq("referenceid", tsaReferenceId.trim());
        }
        const { data, error } = await q.order("date_created", { ascending: false });

        if (error) throw error;
        const rows = (data || []) as unknown as SpfCreationRow[];
        if (!cancelled) setSpf1Records(rows);
      } catch (err: any) {
        if (!cancelled) setSpf1Error(err?.message || "Failed to load SPF 1 records.");
      } finally {
        if (!cancelled) setSpf1Loading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSpf1Mode, tsaReferenceId]);

  useEffect(() => {
    setUseToday(false);
  }, [callType]);

  async function handleGenerateQuotation() {
    if (!quotationType || !tsm || isGenerating) return;

    setIsGenerating(true);

    try {
      // reset previous generated state (optional but recommended)
      setHasGenerated(false);
      setLocalQuotationNumber("");
      setQuotationNumber("");

      const cleanQuotationType = quotationType.trim();
      const prefixBase = `${getQuotationPrefix(cleanQuotationType)}-${extractTsmPrefix(tsm)}`;
      const currentYear = new Date().getFullYear();

      const nextSeq = await fetchNextQuotationSequence(prefixBase);
      const newQuotationNumber = `${prefixBase}-${currentYear}-${nextSeq}`;

      setLocalQuotationNumber(newQuotationNumber);
      setQuotationNumber(newQuotationNumber);
      setHasGenerated(true);
    } catch (err) {
      console.error("Generate quotation failed", err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function fetchNextQuotationSequence(prefixBase: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefixWithYear = `${prefixBase}-${currentYear}`;

    try {
      const response = await fetch(`/api/fetch-quotation-number?prefix=${encodeURIComponent(prefixWithYear)}`);
      const data = await response.json();

      const existingNumbers: string[] = data.quotationNumbers || [];

      const sequences = existingNumbers
        .map((q) => {
          const parts = q.split("-");
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          return isNaN(num) ? 0 : num;
        })
        .filter((num) => num > 0);

      const maxSeq = sequences.length > 0 ? Math.max(...sequences) : 0;
      const nextSeq = (maxSeq + 1).toString().padStart(4, "0");

      return nextSeq;
    } catch (error) {
      console.error("Failed to fetch quotation sequence", error);
      return "0001";
    }
  }

  useEffect(() => {
    // Calculate total quotation amount considering discount per product
    const productTotal = selectedProducts.reduce((acc, p) => {
      const isDiscounted = p.isDiscounted ?? false;
      const baseAmount = p.price * p.quantity;
      const rowDiscount = isDiscounted ? (p.discount ?? 0) : 0; // per-product discount
      const discountedAmount = (baseAmount * rowDiscount) / 100;
      const totalAfterDiscount = baseAmount - discountedAmount;

      return acc + totalAfterDiscount;
    }, 0);

    const deliveryFeeNumber = parseFloat(deliveryFee) || 0;
    const restockingFeeNumber = parseFloat(restockingFee) || 0;
    const totalWithDelivery = productTotal + deliveryFeeNumber + restockingFeeNumber;

    setQuotationAmount(totalWithDelivery.toFixed(2));
  }, [selectedProducts, deliveryFee, restockingFee, discount]);

  useEffect(() => {
    setLocalQuotationNumber(quotationNumber);
  }, [quotationNumber]);

  useEffect(() => {
    // Ensure VAT Inc is selected by default
    if (!vatType) {
      setVatType("vat_inc");
    }
  }, [vatType, setVatType]);

  useEffect(() => {
    const ids = selectedProducts.map((p) => p.id.toString());
    const quantities = selectedProducts.map((p) => p.quantity.toString());
    const amounts = selectedProducts.map((p) => p.price.toString());

    // Dito: I-save ang buong description, hindi lang table
    const descriptions = selectedProducts.map((p) => p.description || "");

    const photos = selectedProducts.map((p) => p.images?.[0]?.src || "");
    const skus = selectedProducts.map((p) => (p.skus && p.skus.length > 0 ? p.skus[0] : ""));
    const titles = selectedProducts.map((p) => p.title);
    const remarks = selectedProducts.map((p) => p.itemRemarks || "");

    setProductCat(ids.join(","));
    setProductQuantity(quantities.join(","));
    setProductAmount(amounts.join(","));
    setProductDescription(descriptions.join(" || ")); // <-- buong description
    setProductPhoto(photos.join(","));
    setProductSku(skus.join(","));
    setProductTitle(titles.join(","));
    setItemRemarks(remarks.join(","));
  }, [
    selectedProducts,
    setProductCat,
    setProductQuantity,
    setProductAmount,
    setProductDescription,
    setProductPhoto,
    setProductSku,
    setProductTitle,
    setItemRemarks,
  ]);

  // Save handler with validation
  const saveWithSelectedProducts = () => {
    setShowQuotationAlert(true);  // Show the Shadcn alert
    //handleDownloadQuotationPDF(); // Generate PDF before saving
    handleSave();
  };

  const filteredSources =
    typeClient === "CSR Client"
      ? [
        {
          label: "CSR Endorsement",
          description: "Customer Service Representative inquiries.",
        },
      ]
      : Quotation_SOURCES.filter(
        (source) => source.label !== "CSR Endorsement"
      );

  const handleSaveClick = () => {
    // Show confirmation alert muna bago save
    setShowConfirmFollowUp(true);
  };

  // Handler kapag OK na sa follow up alert
  const handleConfirmFollowUp = () => {
    setShowConfirmFollowUp(false);
    // Dito talaga ang save
    saveWithSelectedProducts();
  };

  // Handler kapag Cancel sa alert
  const handleCancelFollowUp = () => {
    setShowConfirmFollowUp(false);
  };

  function formatCurrency(value: number | null | undefined): string {
    if (value == null) return "₱0.00";
    return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handleDownloadQuotation = async () => {
    if (!productCat || productCat.trim() === "") {
      sileo.error({
        title: "Failed",
        description: "Cannot export quotation: Product Category is empty.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      return;
    }

    try {
      // --- SAFE DEFAULTS (OPTIONAL FIELDS) ---
      const safeCompanyName = company_name ?? "";
      const safeAddress = address ?? "";
      const safeContactNumber = contact_number ?? "";
      const safeEmailAddress = email_address ?? "";
      const safeContactPerson = contact_person ?? "";

      // --- SALES DETAILS ---
      const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
      const emailUsername = email?.split("@")[0] ?? "";

      let emailDomain = "";
      if (quotationType === "Disruptive Solutions Inc") {
        emailDomain = "disruptivesolutionsinc.com";
      } else if (quotationType === "Ecoshift Corporation") {
        emailDomain = "ecoshiftcorp.com";
      } else {
        emailDomain = email?.split("@")[1] ?? "";
      }

      const salesemail = emailUsername && emailDomain
        ? `${emailUsername}@${emailDomain}`
        : "";

      const salescontact = contact ?? "";
      const salestsmname = tsmname ?? "";
      const salesmanagername = managername ?? "";

      // --- ITEMS ---
      const items = selectedProducts.map((p, index) => {
        const qty = p.quantity ?? 0;
        const unitPrice = p.price ?? 0;
        const isDiscounted = p.isDiscounted ?? false;

        const baseAmount = qty * unitPrice;
        const discountedAmount =
          isDiscounted && discount > 0 ? (baseAmount * discount) / 100 : 0;

        const totalAmount = baseAmount - discountedAmount;

        const title = p.title ?? "";
        const sku = p.skus?.join(", ") ?? "";
        const description = p.description ?? "";
        const photo = p.images?.[0]?.src ?? "";

        const descriptionTable = `
        <table>
          <tr><td>${title}</td></tr>
          <tr><td>${sku}</td></tr>
          <tr><td>${description}</td></tr>
        </table>
      `;

        return {
          itemNo: index + 1,
          qty,
          referencePhoto: photo,
          description: descriptionTable,
          unitPrice: formatCurrency(unitPrice),
          totalAmount: formatCurrency(totalAmount),
        };
      });

      const formattedDate = new Date().toLocaleDateString();

      // --- QUOTATION DATA (ALL OPTIONAL SAFE) ---
      const quotationData = {
        referenceNo: quotationNumber ?? "",
        date: formattedDate,
        companyName: safeCompanyName,
        address: safeAddress,
        telNo: safeContactNumber,
        email: safeEmailAddress,
        attention: safeContactPerson ? safeContactPerson : "",
        subject: quotationSubject || "For Quotation",
        items,

        // --- TAX & WITHHOLDING LOGIC ---
        // VAT Type (Tax property of the Sale)
        vatType: vatType,
        vatTypeLabel:
          vatType === "vat_inc" ? "VAT Inc" :
            vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",

        // Withholding Tax (Tax property of the Buyer/Relationship)
        whtType: whtType, // value like "wht_1", "wht_2", or "none"
        whtLabel:
          whtType === "wht_1" ? "EWT 1% (Goods)" :
            whtType === "wht_2" ? "EWT 2% (Services)" : "None",

        // --- CALCULATION LOGIC ---
        totalPrice: Number(quotationAmount ?? 0),
        deliveryFee: Number(deliveryFee ?? 0),
        restockingFee: Number(restockingFee ?? 0),

        // EWT is calculated on Net of VAT (Total / 1.12)
        whtAmount: whtType !== "none"
          ? (Number(quotationAmount ?? 0) / 1.12) * (whtType === "wht_1" ? 0.01 : 0.02)
          : 0,

        // This is the actual cash expected to be received
        netAmountToCollect: Number(quotationAmount ?? 0) - (
          whtType !== "none" ? (Number(quotationAmount ?? 0) / 1.12) * (whtType === "wht_1" ? 0.01 : 0.02) : 0
        ),

        // --- REPRESENTATIVE DETAILS ---
        salesRepresentative: salesRepresentativeName,
        salesemail,
        salescontact,
        salestsmname,
        salesmanagername,
      };

      let apiEndpoint = "/api/quotation/disruptive";
      if (quotationType === "Ecoshift Corporation") {
        apiEndpoint = "/api/quotation/ecoshift";
      }

      const resExport = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationData),
      });

      if (!resExport.ok) {
        const errorText = await resExport.text();
        sileo.error({
          title: "Failed",
          description: "Failed to download quotation: " + errorText,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      const blob = await resExport.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation_${quotationNumber || "unknown"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to download quotation. Please try again.",
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

  const getQuotationPayload = () => {
    const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
    const emailUsername = email?.split("@")[0] ?? "";

    let emailDomain = "";
    if (quotationType === "Disruptive Solutions Inc") {
      emailDomain = "disruptivesolutionsinc.com";
    } else if (quotationType === "Ecoshift Corporation") {
      emailDomain = "ecoshiftcorp.com";
    } else {
      emailDomain = email?.split("@")[1] ?? "";
    }

    const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

    const items = selectedProducts.map((p, index) => {
      const qty = p.quantity ?? 0;
      const unitPrice = p.price ?? 0;
      const isDiscounted = p.isDiscounted ?? false;
      const discount = isDiscounted ? (p.discount ?? 0) : 0;

      const baseAmount = qty * unitPrice;
      const discountedAmount = isDiscounted && discount > 0 ? (baseAmount * discount) / 100 : 0;
      const totalAmount = baseAmount - discountedAmount;

      return {
        itemNo: index + 1,
        qty,
        photo: p.images?.[0]?.src ?? "",
        title: p.title ?? "",
        sku: p.skus?.join(", ") ?? "",
        description: p.description ?? "",
        itemRemarks: p.itemRemarks ?? "",
        unitPrice,
        discount,
        totalAmount,
        isSpf1: typeof p.id === "string" && p.id.startsWith("spf1-"),
        procurementLeadTime: p.procurementLeadTime ?? "",
      };
    });

    // --- CALCULATION LOGIC ---
    const totalInvoiceAmount = Number(quotationAmount ?? 0);

    // Define the Taxable Base for Withholding
    // If VAT Inc, base = Total / 1.12. Otherwise, base = Total.
    const whtBase = vatType === "vat_inc"
      ? totalInvoiceAmount / 1.12
      : totalInvoiceAmount;

    // Define the Withholding Rate
    const whtRate = whtType === "wht_1" ? 0.01 : whtType === "wht_2" ? 0.02 : 0;

    // Calculate final EWT Amount
    const whtAmount = whtBase * whtRate;

    // Actual cash to be collected from the client
    const netAmountToCollect = totalInvoiceAmount - whtAmount;

    return {
      referenceNo: quotationNumber ?? "DRAFT-XXXX",
      date: new Date().toLocaleDateString(),
      companyName: company_name ?? "",
      address: address ?? "",
      telNo: contact_number ?? "",
      email: email_address ?? "",
      attention: contact_person ? contact_person : "",
      subject: quotationSubject || "For Quotation",
      items,

      // --- TAX LOGIC ---
      vatType,
      vatTypeLabel: vatType === "vat_inc" ? "VAT Inc" : vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",

      // --- WITHHOLDING TAX LOGIC ---
      whtType,
      whtLabel: whtType === "wht_1" ? "EWT 1% (Goods)" : whtType === "wht_2" ? "EWT 2% (Services)" : "No Withholding",
      whtAmount,
      whtBase, // Useful for the preview table to show the calculation source

      // --- TOTALS ---
      totalPrice: totalInvoiceAmount,
      deliveryFee: Number(deliveryFee ?? 0),
      netAmountToCollect,

      // --- STAFF DETAILS ---
      salesRepresentative: salesRepresentativeName,
      salesemail,
      salescontact: contact ?? "",
      salestsmname: tsmname ?? "",
      salesmanagername: managername ?? "",
      salesManagerContact: salesManagerContact ?? "",
      salesManagerEmail: salesManagerEmail ?? "",
      tsmDetails,
      managerDetails,
      signature,
    };
  };

  const payload = getQuotationPayload();

  // 1. BRAND SELECTION LOGIC
  const isEcoshift = quotationType === "Ecoshift Corporation";

  // 2. ASSET PATH RESOLUTION
  const headerImagePath = isEcoshift
    ? "/ecoshift-banner.png"
    : "/disruptive-banner.png";

  const handleDownloadQuotationPDF = async () => {
    console.log('pdf dl');
    if (typeof window === 'undefined') return;
    const PRIMARY_CHARCOAL = '#121212';
    const OFF_WHITE = '#F9FAFA';
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const payload = getQuotationPayload();
      const isEcoshift = quotationType === "Ecoshift Corporation";

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [612, 936] // Legal Format
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const BOTTOM_MARGIN = 0;

      // 1. CREATE VIRTUAL CANVAS
      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {
        position: 'fixed',
        right: '1000%',
        width: '816px',
        visibility: 'hidden'
      });
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Initialization Failed");

      iframeDoc.open();
      iframeDoc.write(`
          <html>
            <head>
            <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 0; 
            background: white; /* Changed from OFF_WHITE to white for seamless capture */
            width: 816px; 
            color: ${PRIMARY_CHARCOAL};
            overflow: hidden; /* Prevents scrollbar padding */
            }
            
            .header-img { width: 100%; display: block; }
            .content-area { 
            padding: 0px 60px; 
            margin: 0 !important; /* Ensure no external margins */
            }
            
            /* 1. CLIENT INFORMATION GRID */
            .client-grid { border-left: 1.5px solid black; border-right: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: center; min-height: 20px; padding: 2px 15px; }
            .border-t { border-top: 1.5px solid black; }
            .border-b { border-bottom: 1.5px solid black; padding-bottom: 10px;}
            .label { width: 140px; font-weight: 900; font-size: 10px; flex-shrink: 0; }
            .value { flex-grow: 1; font-size: 11px; font-weight: bold; color: #374151; padding-left: 15px; }
            .intro-text { font-size: 10px; font-style: italic; color: #6b7280; font-weight: 500; padding: 5px 0; }
            
            /* 2. SPECIFICATION TABLE */
            .table-container { 
            border: 1.5px solid black; 
            border-bottom: none; /* Let the row blocks handle the bottom border */
            background: white; 
            margin: 0;
            }
            
            .main-table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
            margin: 0;
            }
            
            .main-table thead tr { background: ${OFF_WHITE}; border-bottom: 1.5px solid black;}
            .main-table th { 
            padding: 5px 8px; font-size: 9px; font-weight: 900; color: ${PRIMARY_CHARCOAL}; 
            text-transform: uppercase; border-right: 1px solid black;
            }
            
            .main-table td { 
            padding: 15px 10px; vertical-align: top; border-right: 1px solid black; 
            border-bottom: 1px solid black; font-size: 10px; 
            }
            
            .main-table td:last-child, .main-table th:last-child { border-right: none; }
            .item-no { color: #9ca3af; font-weight: bold; text-align: center; }
            .qty-col { font-weight: 900; text-align: center; color: ${PRIMARY_CHARCOAL}; }
            .ref-photo { mix-blend-mode: multiply; width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; }
            .sku-text { color: #2563eb; font-weight: bold; font-size: 9px; margin-bottom: 10px; letter-spacing: -0.025em; }
            .desc-text { width: 100%; font-size: 9px; color: #000000; line-height: 1.2; }
            .variance-footnote { margin-top: 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 4px; }
            
            /* LOGISTICS GRID */
            .logistics-container { margin-top: 15px; border: 1px solid black; font-size: 9.5px; line-height: 1.3; }
            .logistics-row { display: flex; border-bottom: 1px solid black; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 100px; padding: 8px; font-weight: 900; border-right: 1px solid black; flex-shrink: 0; }
            .logistics-value { padding: 8px; flex-grow: 1; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 4px; }

            /* 3. EXTENDED TERMS & CONDITIONS */
            .terms-section { margin-top: 25px; border-top: 2.5px solid black; padding-top: 10px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 4px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
            .terms-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 9px; line-height: 1.4; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 0; }
            .terms-val { padding: 4px 12px; border-left: 1px solid #e5e7eb; }
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            
            /* SUMMARY BAR */
            .summary-bar { background: ${PRIMARY_CHARCOAL}; color: white; height: 45px; }
            .summary-bar td { border: none; vertical-align: middle; padding: 0 15px; }
            .tax-label { color: #f87171; font-style: italic; font-weight: 900; font-size: 9px; text-transform: uppercase; }
            .tax-options { display: flex; gap: 15px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
            .tax-active { color: white; }
            .tax-inactive { color: rgba(255,255,255,0.3); }
            .grand-total-label { text-align: right; font-weight: 900; font-size: 10px; text-transform: uppercase; }
            .grand-total-value { text-align: right; font-weight: 900; font-size: 18px; }
            
            /* 4. OFFICIAL SIGNATURE HIERARCHY */
            .sig-hierarchy { margin-top: 48px; padding-top: 16px; border-top: 4px solid #1d4ed8; padding-bottom: 80px; }
            .sig-message { font-size: 9px; margin-bottom: 20px; font-weight: 500; line-height: 1.4; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 10px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 40px; }
            .sig-line { border-bottom: 1px solid black; width: 256px; }
            .sig-rep-box { width: 256px; height: 40px; background: rgba(248, 113, 113, 0.1); 
            border: 1px solid #f87171; display: flex; align-items: center; 
            justify-content: center; text-align: center; font-size: 8px; 
            font-weight: 900; color: #dc2626; text-transform: uppercase; padding: 0 8px;
            }
            
            .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

            /* WATERMARK */
            .watermark-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              z-index: 1000;
              overflow: hidden;
            }
            .watermark-text {
              position: absolute;
              font-size: 9px;
              font-weight: bold;
              color: rgba(18, 18, 18, 0.06);
              text-transform: uppercase;
              transform: rotate(-25deg);
              white-space: nowrap;
              width: 800px;
              letter-spacing: 1px;
            }
            </style>
          </head>
        <body></body>
      </html>
      `);
      iframeDoc.close();

      const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";
      const watermarkText = `${companyLabel} · OFFICIAL QUOTATION · ${payload.referenceNo}`;

      // 2. HELPER: ATOMIC SECTION CAPTURE
      const renderBlock = async (html: string, showWatermark = false) => {
        let finalHtml = html;
        if (showWatermark) {
          let watermarks = "";
          let rowIdx = 0;
          for (let y = -400; y < 1400; y += 75) {
            const offset = (rowIdx % 2 === 0) ? 0 : 400;
            for (let x = -800 + offset; x < 1200; x += 800) {
              watermarks += `<div class="watermark-text" style="top:${y}px; left:${x}px;">${watermarkText}</div>`;
            }
            rowIdx++;
          }
          finalHtml = `<div class="watermark-container">${watermarks}</div>${html}`;
        }
        iframeDoc.body.innerHTML = finalHtml;
        // Allow time for images to resolve
        const images = iframeDoc.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        return {
          img: canvas.toDataURL('image/jpeg', 1.0),
          h: (canvas.height * pdfWidth) / canvas.width
        };
      };

      let currentY = 0;
      let pageCount = 1;

      const drawPageNumber = (currentCount: number) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Page ${currentCount}`, pdfWidth - 60, pdfHeight - 20);
      };

      const initiateNewPage = async () => {
        const banner = await renderBlock(`<img src="${headerImagePath}" class="header-img" />`, true);
        pdf.addImage(banner.img, 'JPEG', 0, 0, pdfWidth, banner.h);

        // Draw number for the CURRENT page
        drawPageNumber(pageCount);

        return banner.h;
      };

      // --- START GENERATION ---
      currentY = await initiateNewPage();

      // A. CLIENT INFO BLOCK
      const clientBlock = await renderBlock(`
        <div class="content-area">
        <div style="text-align:right; font-weight:900; font-size:10px; margin-bottom:10px;">
        REFERENCE NO: ${payload.referenceNo}<br>DATE: ${payload.date}
        </div>
        
        <div class="client-grid">
        <div class="grid-row border-t">
        <div class="label">COMPANY NAME:</div>
        <div class="value">${payload.companyName}</div>
        </div>
        
        <div class="grid-row"><div class="label">ADDRESS:</div>
        <div class="value">${payload.address}</div></div>
        <div class="grid-row">
        <div class="label">TEL NO:</div>
        <div class="value">${payload.telNo}</div>
        </div>
        
        <div class="grid-row border-b">
        <div class="label">EMAIL ADDRESS:</div>
        <div class="value">${payload.email}</div>
        </div>
        
        <div class="grid-row">
        <div class="label">ATTENTION:</div>
        <div class="value">${payload.attention}</div>
        </div>
        
        <div class="grid-row border-b">
        <div class="label">EMAIL ADDRESS:</div>
        <div class="value">${payload.email}</div>
        </div>
        
        <div class="grid-row border-b">
        <div class="label">SUBJECT:</div>
        <div class="value">${payload.subject}</div>
        </div>
        </div>
        <p class="intro-text">We are pleased to offer you the following products for consideration:</p>
        </div>
        `, true);
      pdf.addImage(clientBlock.img, 'JPEG', 0, currentY, pdfWidth, clientBlock.h);
      currentY += clientBlock.h;

      // B. TABLE HEADER BLOCK
      const headerBlock = await renderBlock(`
        <div class="content-area">
        <div class="table-container" style="border-bottom: 1.5px solid black;">
        <table class="main-table">
        <thead>
        <tr>
        <th style="width: 40px;">ITEM NO</th>
        <th style="width: 40px;">QTY</th>
        <th style="width: 120px;">REFERENCE PHOTO</th>
        <th style="width: 200px;">PRODUCT DESCRIPTION</th>
        <th style="width: 80px; text-align:right;">UNIT PRICE</th>
        <th style="width: 80px; text-align:right;">TOTAL AMOUNT</th>
        </tr>
        </thead>
        </table>
        </div>
        </div>
        `, true);
      pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
      currentY += 28; // Header height minus stitch to first row

      // C. ITEM ROWS
      for (const [index, item] of payload.items.entries()) {
        const rowBlock = await renderBlock(`
          <div class="content-area">
          <table class="main-table" style="border: 1.5px solid black; border-top: none;">
          <tr>
          <td style="width: 40px;" class="item-no">${index + 1}</td>
          <td style="width: 40px;" class="qty-col">${item.qty}</td>
          <td style="width: 120px;"><img src="${item.photo}" class="ref-photo"></td>
          <td style="width: 200px;">
          <div class="product-title" style="font-size: 7px;">${item.title}</div>
          <div class="sku-text">${item.sku}</div>
          <div class="desc-text">${item.description}</div>
          </td>
          <td style="width: 80px; text-align:right;">₱${item.unitPrice.toLocaleString()}</td>
          <td style="width: 80px; text-align:right; font-weight:900;">₱${item.totalAmount.toLocaleString()}</td>
          </tr>
          </table>
          </div>
          `, true);

        // Handle Page Breaks (Same logic)
        if (currentY + rowBlock.h > (pdfHeight - 50)) {
          pdf.addPage([612, 936]);
          pageCount++;
          currentY = await initiateNewPage();
          pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
          currentY += 28; // Re-apply stitch on new page
        }

        pdf.addImage(rowBlock.img, 'JPEG', 0, currentY, pdfWidth, rowBlock.h);

        // UPDATE: Maintain the stitch for the next row
        currentY += rowBlock.h;
      }

      // D. GRAND TOTAL & LOGISTICS
      const footerBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0; padding-bottom:0;">
        <div class="table-container">
        <table class="main-table">
        <tr class="summary-bar">
        <td colspan="2"></td>
        <td class="tax-label">Tax Type:</td>
        <td style="width: 200px;">
        <div class="tax-options">
        <span class="${payload.vatTypeLabel === "VAT Inc" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
        </span>
        <span class="${payload.vatTypeLabel === "VAT Exe" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
        </span>
        </div>
        </td>
        <td style="width: 80px; text-align:right;" class="grand-total-label">Grand Total:</td>
        <td style="width: 80px; text-align:right;" class="grand-total-value">₱${payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
        </table>
        </div>
        </div>
        `, true);
      if (currentY + footerBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
        pageCount++;
      }
      pdf.addImage(footerBlock.img, 'JPEG', 0, currentY, pdfWidth, footerBlock.h);
      currentY += footerBlock.h;

      // --- SECTION E.1: LOGISTICS & EXCLUSIONS ---
      const logisticsBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>
        <div class="logistics-container">
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Included:</div>
        <div class="logistics-value bg-yellow-content">
        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
        </div>
        </div>
        
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Excluded:</div>
        <div class="logistics-value bg-yellow-content">
        <p>All lamp poles are subject to a delivery charge.</p>
        <p>Installation and all hardware/accessories not indicated above.</p>
        <p>Freight charges, arrastre, and other processing fees.</p>
        </div>
        </div>
        <div class="logistics-row">
        <div class="logistics-label">Notes:</div>
        <div class="logistics-value bg-yellow-note" style="font-style: italic;">
        <p>Deliveries are up to the vehicle unloading point only.</p>
        <p>Additional shipping fee applies for other areas not mentioned above.</p>
        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
        <span class="text-red-strong"><u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u></span>
        </div>
        </div>
        </div>
        
        <div class="terms-section">
        <div class="terms-header">Terms and Conditions</div>
        <div class="terms-grid">
        <div class="terms-label">Availability:</div>
        <div class="terms-val terms-highlight">
        <p>*5-7 days if on stock upon receipt of approved PO.</p>
        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
        </div>
        
        <div class="terms-label">Warranty:</div>
        <div class="terms-val terms-highlight">
        <p>One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
        <p>The warranty will be VOID under the following circumstances:</p>
        <p>*If the unit is being tampered with.</p>
        <p>*If the item(s) is/are altered in any way by unauthorized technicians.</p>
        <p>*If it has been subjected to misuse, mishandling, neglect, or accident.</p>
        <p>*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.</p>
        <p>*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.</p>
        <p>*Shipping costs for warranty claims are for customers' account.</p>
        <p>*If the product purchased is already phased out when the warranty is claimed, the latest model or closest product SKU will be given as a replacement.</p>
        </div>
        
        <div class="terms-label">SO Validity:</div>
        <div class="terms-val">
        <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b></p>
        </div>
        
        <div class="terms-label">Storage:</div>
        <div class="terms-val terms-highlight">
        <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b></p>
        </div>
        
        <div class="terms-label">Return:</div>
        <div class="terms-val terms-highlight">
        <p><b style="color:red;"><u>7 days return policy -</u></b>  if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
        </div>
        </div>
        </div>
        </div>
        `, true);

      if (currentY + logisticsBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
      }
      pdf.addImage(logisticsBlock.img, 'JPEG', 0, currentY, pdfWidth, logisticsBlock.h);
      currentY += logisticsBlock.h;

      // --- SECTION E.2: FULL TERMS & SIGNATURE HIERARCHY ---
      const termsAndSigBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="terms-grid">
        <div class="terms-label">Payment:</div>
        <div class="terms-val">
        <p><strong style="color:red;">Cash on Delivery (COD)</strong></p>
        <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
        <p>For special items, Seventy Percent (70%) down payment, 30% upon delivery.</p>
        <br>
        <p><strong>BANK DETAILS</strong></p>
        <p><b>Payee to: </b><strong>${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</strong></p>
        <br>
        
        <div class="bank-grid" style="display: flex; gap: 20px;">
        <div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</div>
        <div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</div>
        </div>
        </div>
        
        <div class="terms-label">DELIVERY:</div>
        <div class="terms-val terms-highlight">
        <p>Delivery/Pick up is subject to confirmation.</p>
        </div>
        
        <div class="terms-label">Validity:</div>
        <div class="terms-val">
        <p><b style="color:red;"><u>Thirty (30) calendar days from the date of this offer.</u></b></p>
        <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
        </div>
        
        <div class="terms-label">CANCELLATION:</div>
        <div class="terms-val terms-highlight">
        <p>1. Above quoted items are non-cancellable.</p>
        <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
        <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
        <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
        <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
        </div>
        </div>
        
        <div class="sig-hierarchy">
        <p class="sig-message">
        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
        </p>
        
        <div class="sig-grid">
        <div class="sig-side-internal">
        <div>
        <p style="font-style: italic; font-size: 10px; font-weight: 900; margin-bottom: 25px;">${isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
        <div style="position: relative; display: inline-block;">
          <img src="${payload.signature || ''}" class="sig-rep-box" />
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 8px; font-weight: 900; color: rgba(18, 18, 18, 0.03); text-transform: uppercase; letter-spacing: 0.5em; pointer-events: none; white-space: nowrap;">Official Verified</div>
        </div>
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salesRepresentative}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">Sales Representative</p>
        <p style="font-size: 8px; font-style: italic;">Mobile: ${payload.salescontact || 'N/A'}</p>
        <p style="font-size: 8px; font-style: italic;">Email: ${payload.salesemail || 'N/A'}</p>
        </div>
        <div>
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Approved By:</p>
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salestsmname}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">SALES MANAGER</p>
        <p style="font-size: 8px; font-style: italic;">Mobile: ${payload.tsmDetails?.contact || 'N/A'}</p>
        <p style="font-size: 8px; font-style: italic;">Email: ${payload.tsmDetails?.email || 'N/A'}</p>
        </div>
        <div>
        
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Noted By:</p>
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salesmanagername}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">Sales-B2B</p>
        </div>
        </div>
        
        <div class="sig-side-client">
        <div>
        <div class="sig-line" style="margin-top: 73px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Company Authorized Representative</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Payment Release Date</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Position in the Company</p>
        </div>
        </div>
        </div>
        </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px dashed #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8px; color: #9ca3af; font-weight: 500;">
          <div>Document ID: <b>${payload.referenceNo}</b> · Issued: ${new Date().toISOString()} · ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</div>
          <div style="font-style: italic;">Valid only when downloaded from Taskflow.</div>
        </div>
        `, true);

      if (currentY + termsAndSigBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
      }
      pdf.addImage(termsAndSigBlock.img, 'JPEG', 0, currentY, pdfWidth, termsAndSigBlock.h);

      // 3. FINALIZATION
      pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
      document.body.removeChild(iframe);
    } catch (error) {
      console.error("Critical Export Error:", error);
    }
  }

  const toggleRow = (uid: string) => {
    setExpandedRows((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  return (
    <>
      {/* STEP 2 — SOURCE */}
      {step === 2 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Source</FieldLabel>
              <RadioGroup value={source} onValueChange={setSource}>
                {filteredSources.map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only visible if selected */}
                        {source === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>
                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 3 — PRODUCT DETAILS */}
      {step === 3 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Type</FieldLabel>
              <RadioGroup value={callType} onValueChange={setCallType}>
                {[
                  {
                    label: "Quotation Standard Preparation",
                    description: "Preparation of Standard quotation to client.",
                  },
                  {
                    label: "Quotation with Special Price Preparation",
                    description: "Preparation of Quotation with a special pricing offer.",
                  },
                  {
                    label: "Quotation with SPF Preparation",
                    description: "Preparation of Quotation including SPF.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>

              <FieldLabel className="font-bold">Quotation For</FieldLabel>
              <RadioGroup
                value={quotationType}
                onValueChange={setQuotationType}
                required
                className="space-y-4"
              >
                {[
                  {
                    label: "Ecoshift Corporation",
                    description:
                      "The Fastest-Growing Provider of Innovative Lighting Solutions",
                  },
                  {
                    label: "Disruptive Solutions Inc",
                    description:
                      "future-ready lighting solutions that brighten spaces, cut costs, and power smarter business",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only visible if selected */}
                        {quotationType === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>

                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 4 — PROJECT DETAILS */}
      {step === 4 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Project Name (Optional)</FieldLabel>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="capitalize rounded-none"
              />

              <FieldLabel className="font-bold">Project Type</FieldLabel>
              <RadioGroup
                value={projectType}
                onValueChange={setProjectType}
              >
                {[
                  {
                    label: "B2B",
                    description: "Business to Business transactions.",
                  },
                  {
                    label: "B2C",
                    description: "Business to Consumer transactions.",
                  },
                  {
                    label: "B2G",
                    description: "Business to Government contracts.",
                  },
                  {
                    label: "Gentrade",
                    description: "General trade activities.",
                  },
                  {
                    label: "Modern Trade",
                    description: "Retail and modern trade partners.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only show if selected */}
                        {projectType === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>

                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 5 — QUOTATION DETAILS */}
      {step === 5 && (
        <div>
          <FieldGroup>
            <FieldSet>
              {/* <label className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={isManualEntry}
                  onChange={(e) => {
                    const manual = e.target.checked;
                    setIsManualEntry(manual);
                    if (!manual) setManualProducts([]);
                  }}
                />
                <span className="text-xs font-medium">Add New Products</span>
              </label> */}

              {/* No Products Available Checkbox */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={noProductsAvailable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNoProductsAvailable(checked);

                    if (checked) {
                      // Reset product related states kapag no products available
                      setSearchTerm("");
                      setSearchResults([]);
                    }
                  }}
                  className="h-6 w-6"
                />
                <span className="text-sm font-medium">No products available</span>
              </label>

              {/* Selected Products with quantity and price inputs */}
              {!noProductsAvailable && (
                <Button
                  onClick={() => setOpen(true)}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed bg-white text-black h-40 w-full hover:bg-gray-100 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ImagePlus className="h-10 w-10 text-gray-500" />
                  <span className="text-sm font-bold">
                    Select Products
                  </span>
                  {selectedProducts.length > 0 && (
                    <span className="text-xs text-green-700">
                      ({selectedProducts.length}) product{selectedProducts.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    Browse and add items to this quotation
                  </span>
                </Button>
              )}

              <FieldLabel className="font-bold">Quotation Amount</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                placeholder="Enter quotation amount"
                className="rounded-none"
              />
              {Number(quotationAmount) === 0 && (<span className="text-red-600 text-sm block">Amount is Empty</span>)}
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" className="rounded-none" onClick={handleBack}>
              <ArrowLeft /> Back
            </Button>
            <Button className="rounded-none" onClick={handleNext}>
              Next <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 6 — REMARKS & STATUS */}
      {step === 6 && (
        <div>
          <FieldGroup>
            <FieldSet>
              {followUpDate ? (
                <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-3 bg-cyan-100">
                  <div>
                    <AlertTitle className="font-bold">Follow Up Date:</AlertTitle>
                    <AlertDescription>
                      {followUpDate} — This is the scheduled date to reconnect with the client.
                    </AlertDescription>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Input
                      type="checkbox"
                      checked={useToday}
                      onChange={(e) => setUseToday(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold">Today <span className="text-red-500 italic text-[10px]">(check if today)</span></span>
                  </label>
                </Alert>
              ) : (
                <></>
              )}

              <FieldLabel className="font-bold">Remarks</FieldLabel>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any remarks here..."
                rows={3}
                className="capitalize rounded-none"
              />

    <FieldLabel className="font-bold">Status </FieldLabel>
    {/*<Select value={quotationStatus} onValueChange={setQuotationStatus} required>
      <SelectTrigger className="w-full rounded-none">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="Pending Client Approval">Pending Client Approval</SelectItem>
          <SelectItem value="For Bidding">For Bidding</SelectItem>
          <SelectItem value="Nego">Nego</SelectItem>
          <SelectItem value="Order Completed">Order Completed</SelectItem>
          <SelectItem value="Convert to SO">Convert to SO</SelectItem>
          <SelectItem value="Loss Price is Too High">Loss Price is Too High</SelectItem>
          <SelectItem value="Lead Time Issue">Lead Time Issue</SelectItem>
          <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          <SelectItem value="Insufficient Stock">Insufficient Stock</SelectItem>
          <SelectItem value="Lost Bid">Lost Bid</SelectItem>
          <SelectItem value="Canvass Only">Canvass Only</SelectItem>
          <SelectItem value="Did Not Meet the Specs">Did Not Meet the Specs</SelectItem>
          <SelectItem value="Declined / Disapproved">Decline / Disapproved</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>*/}

              <FieldLabel className="font-bold">Approval Process </FieldLabel>
              <Select value={tsmApprovalStatus} onValueChange={setTsmApprovalStatus} required>
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue placeholder="Select Approval Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Pending">Endorsed to TSM</SelectItem>
                    {Number(quotationAmount) <= 500000 && (
                      <SelectItem value="Endorsed to Sales Head">Endorsed to Sales Head</SelectItem>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>

    {/* Quote-Done action — only visible once both Status and Approval Process are filled */}
    { tsmApprovalStatus ? (
      <>
        <FieldLabel className="mt-3">Action</FieldLabel>
        <RadioGroup value={status} onValueChange={setStatus} className="space-y-4">
          {[
            {
              value: "Quote-Done",
              title: "Quote-Done",
              desc: "The quotation process is complete and finalized.",
            },
          ].map((item) => (
            <FieldLabel key={item.value}>
              <Field orientation="horizontal" className="w-full items-start">
                {/* LEFT */}
                <FieldContent className="flex-1">
                  <FieldTitle>{item.title}</FieldTitle>
                  <FieldDescription>{item.desc}</FieldDescription>

                            {/* Buttons only visible if selected */}
                            {status === item.value && (
                              <div className="mt-4 flex gap-2">
                                <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                  <ArrowLeft /> Back
                                </Button>
                                <Button className="rounded-none" onClick={handleSaveClick}>
                                  Save <CheckCircle2Icon />
                                </Button>
                              </div>
                            )}
                          </FieldContent>

                          {/* RIGHT */}
                          <RadioGroupItem value={item.value} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </>
              ) : (
                <p className="mt-3 text-xs text-gray-400 italic">
                  Complete the Status and Approval Process fields above to proceed.
                </p>
              )}
            </FieldSet>
          </FieldGroup>

          {/* Confirmation alert modal/dialog */}
          {showConfirmFollowUp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-black">
              <div className="max-w-md rounded-none bg-white p-6 shadow-lg">
                <Alert variant="default" className="p-4 flex items-center gap-3 w-full min-w-[400px] rounded-none">
                  <div className="flex-1">
                    <div className="mb-1">
                      <AlertTitle className="font-bold">Quotation Number</AlertTitle>
                    </div>

                    {isGenerating ? (
                      <AlertDescription className="text-sm text-gray-700 flex items-center gap-2">
                        <p>Generating your quotation number, please wait...</p>
                      </AlertDescription>
                    ) : hasGenerated ? (
                      <AlertDescription className="text-sm text-black">
                        Your quotation number is{" "}
                        <strong className="text-lg">{localQuotationNumber}</strong>
                        <br />
                        <p className="mt-1 text-xs text-gray-600">
                          It is automatically generated based on the quotation type, TSM
                          prefix, current year, and a sequential number.
                        </p>
                      </AlertDescription>
                    ) : (
                      <AlertDescription className="text-sm text-gray-500">
                        Click Generate to create a quotation number.
                      </AlertDescription>
                    )}
                  </div>
                </Alert>

                {/* Action buttons */}
                <div className="mt-4 flex flex-col gap-3">
                  <Button onClick={handleGenerateQuotation} variant="outline" className="w-full flex items-center justify-center gap-2 border border-dashed rounded-none p-10">
                    {isGenerating ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : hasGenerated ? (
                      <>
                        <RefreshCcw className="h-4 w-4" />
                        Generate Again
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="h-4 w-4" />
                        Generate Quotation Number
                      </>
                    )}
                  </Button>

                  {/*<Button onClick={handleDownloadQuotation} disabled={!hasGenerated} hidden={false} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation Excel
                  </Button>

                  <Button onClick={handleDownloadQuotationPDF} disabled={!hasGenerated} hidden={false} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation PDF
                  </Button>*/}

                  {!hasDownloaded && hasGenerated && (
                    <p className="text-sm text-yellow-600 mt-2 border border-dashed p-2 bg-red-100" hidden={false}>
                      ⚠️ Please download the quotation before saving.
                      <span className="text-sm text-red-600 italic ml-1">
                        Note: If there are no products or the quotation is empty, please do not download.
                      </span>
                    </p>
                  )}

                  <div className="flex justify-end gap-4 pt-10">
                    <Button variant="outline" className="rounded-none p-6" onClick={handleCancelFollowUp} disabled={isGenerating}>
                      Cancel
                    </Button>

                    <Button onClick={handleConfirmFollowUp} className="rounded-none p-6" disabled={!hasGenerated}>
                      Submit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* product selection dialog/modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-[95vh] sm:max-h-[95vh] overflow-hidden p-0 sm:p-0 w-full sm:w-[90vw] flex flex-col"
          style={{
            maxWidth: "2300px",
            width: "100vw",
          }}
        >
          {/* HEADER */}
          <div className="flex flex-col border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between pl-8 pr-5 py-4 sm:pl-10 sm:pr-6">
              <div className="flex items-center gap-3">
                <DialogTitle className="font-black text-base tracking-tight">Select Products</DialogTitle>
                {selectedProducts.length > 0 && (
                  <span className="hidden lg:inline-flex items-center justify-center bg-[#121212] text-white text-[10px] font-black rounded-full w-5 h-5">
                    {selectedProducts.length}
                  </span>
                )}
              </div>
              {/* Desktop: show total in header when products selected */}
              {selectedProducts.length > 0 && (
                <div className="hidden lg:flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2">
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Total</span>
                  <span className="font-black text-xl text-[#121212] tabular-nums">
                    PHP {Number(quotationAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            {/* Mobile Tab Switcher — always shown on mobile */}
            <div className="flex lg:hidden border-t border-gray-100 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setMobilePanelTab("search")}
                className={`flex-1 py-2.5 transition-colors border-b-2 ${mobilePanelTab === "search" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
              >
                🔍 Search
              </button>
              <button
                type="button"
                onClick={() => setMobilePanelTab("products")}
                className={`flex-1 py-2.5 transition-colors border-b-2 ${mobilePanelTab === "products" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
              >
                🛒 Products ({selectedProducts.length})
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-hidden">
            <div
              className="h-full grid gap-0 lg:gap-5 lg:pl-8 lg:pr-4 lg:py-4 p-0 overflow-y-auto grid-cols-1 lg:grid-cols-[minmax(22rem,28rem)_1fr] lg:overflow-hidden"
            >

              {/* Left side: Search + checkbox selected */}
              <div className={`flex-col gap-3 overflow-y-auto px-4 pl-5 sm:pl-6 lg:pl-2 lg:pr-3 pt-3 lg:pt-0 h-full min-w-0 ${mobilePanelTab === "products" && selectedProducts.length > 0 ? "hidden lg:flex" : "flex"}`}>
                <div className="flex flex-col gap-3 sticky top-0 bg-white z-10 pb-2">

                  {/* Source Switcher */}
                  <div className="grid grid-cols-4 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    {[
                      { source: "shopify", label: "Shopify", icon: "🛍️" },
                      // { source: "firebase_shopify", label: "CMS", icon: "📦" },
                      { source: "firebase_taskflow", label: "DB", icon: "🗄️" },
                    ].map(({ source: s, label, icon }) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setProductSource(s as any); setSearchTerm(""); setSearchResults([]); setIsSpfMode(false); setIsSpf1Mode(false); }}
                        className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all ${productSource === s && !isSpfMode && !isSpf1Mode ? "bg-[#121212] text-white" : "bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`}
                      >
                        <span className="text-sm mb-0.5">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(false); setIsSpfMode(true); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all border-l border-gray-200 ${isSpfMode ? "bg-green-600 text-white" : "bg-white text-red-500 hover:bg-red-50"}`}
                    >
                      <span className="text-sm mb-0.5">🛠️</span>
                      <span>Services</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(true); setIsSpfMode(false); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all border-l border-gray-200 ${isSpf1Mode ? "bg-red-600 text-white" : "bg-white text-red-500 hover:bg-red-50"}`}
                    >
                      <span className="text-sm mb-0.5">🧾</span>
                      <span>SPF</span>
                    </button>
                  </div>

                  {/* SPF Manual Entry Form OR Normal Search Input — never both */}
                  {isSpfMode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SRF</span>
                        <span className="text-[9px] text-red-400 italic">— Service Request Form</span>
                      </div>

                      {/* Cloudinary Image Upload */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Service Image (optional)</label>
                        <div className="flex items-center gap-2">
                          <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-red-300 bg-white px-3 py-2 cursor-pointer hover:bg-red-50 transition ${spfUploading ? "opacity-50 pointer-events-none" : ""}`}>
                            <ImagePlus className="w-4 h-4 text-red-400" />
                            <span className="text-[10px] font-bold uppercase text-red-500">
                              {spfUploading ? "Uploading..." : spfManualProduct.imageUrl ? "Change Image" : "Upload Image"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={spfUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setSpfUploading(true);
                                try {
                                  // Delete old image if replacing
                                  if (spfManualProduct.cloudinaryPublicId) {
                                    await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId);
                                  }
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  const res = await fetch("/api/cloudinary/upload", {
                                    method: "POST",
                                    body: formData,
                                  });
                                  const data = await res.json();
                                  if (data.url) {
                                    setSpfManualProduct(prev => ({
                                      ...prev,
                                      imageUrl: data.url,
                                      cloudinaryPublicId: data.publicId || "",
                                    }));
                                  }
                                } catch (err) {
                                  console.error("Upload failed:", err);
                                } finally {
                                  setSpfUploading(false);
                                }
                              }}
                            />
                          </label>
                          {spfManualProduct.imageUrl && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId);
                                setSpfManualProduct(prev => ({ ...prev, imageUrl: "", cloudinaryPublicId: "" }));
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                              title="Remove image"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {spfManualProduct.imageUrl && (
                          <img
                            src={spfManualProduct.imageUrl}
                            alt="preview"
                            className="w-20 h-20 object-cover border border-gray-200 mt-1 rounded-sm"
                          />
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Service Name *</label>
                        <Input
                          type="text"
                          placeholder="Enter service name..."
                          value={spfManualProduct.title}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, title: e.target.value }))}
                          className="rounded-none text-xs uppercase"
                        />
                      </div>

                      {/* SKU */}
                      {/* <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Item Code / SKU</label>
                        <Input
                          type="text"
                          placeholder="Enter item code..."
                          value={spfManualProduct.sku}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, sku: e.target.value }))}
                          className="rounded-none text-xs uppercase"
                        />
                      </div> */}

                      {/* Quantity & Price */}
                      <div className="grid grid-cols-1 gap-1.5">
                        {/* <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Qty</label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={spfManualProduct.quantity}
                            onChange={(e) => setSpfManualProduct(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="rounded-none text-xs"
                          />
                        </div> */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Service Price</label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={spfManualProduct.price}
                            onChange={(e) => setSpfManualProduct(prev => ({ ...prev, price: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="rounded-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Description</label>
                        <Textarea
                          placeholder="Enter service details"
                          value={spfManualProduct.description}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          className="rounded text-xs"
                        />
                      </div>

                      {/* Add Button */}
                      <Button
                        type="button"
                        disabled={!spfManualProduct.title}
                        onClick={() => {
                          setSelectedProducts(prev => [
                            ...prev,
                            {
                              id: `spf-${crypto.randomUUID()}`,
                              uid: crypto.randomUUID(),
                              title: spfManualProduct.title.toUpperCase(),
                              description: spfManualProduct.description,
                              skus: spfManualProduct.sku ? [spfManualProduct.sku] : [],
                              images: spfManualProduct.imageUrl ? [{ src: spfManualProduct.imageUrl }] : [],
                              quantity: spfManualProduct.quantity,
                              price: spfManualProduct.price,
                              discount: 0,
                              isDiscounted: false,
                              cloudinaryPublicId: spfManualProduct.cloudinaryPublicId,
                            }
                          ]);
                          setSpfManualProduct({ title: "", sku: "", price: 0, quantity: 1, description: "", imageUrl: "", cloudinaryPublicId: "" });
                          setMobilePanelTab("products"); // auto-switch to products view on mobile
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 h-9 mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Service
                      </Button>
                    </div>
                  ) : isSpf1Mode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SPF</span>
                          <span className="text-[9px] text-red-400 italic">— approved SPF list</span>
                        </div>
                        {spf1Loading && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                            Loading…
                          </span>
                        )}
                      </div>

                      <Input
                        type="text"
                        className="uppercase rounded-none bg-white"
                        placeholder="Search SPF number..."
                        value={spf1Search}
                        onChange={(e) => setSpf1Search(e.target.value)}
                      />

                      {spf1Error && (
                        <div className="text-[11px] text-red-600 font-medium">
                          {spf1Error}
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {spf1Records
                          .filter((r) => {
                            const q = spf1Search.trim().toLowerCase();
                            if (!q) return true;
                            return (r.spf_number || "").toLowerCase().includes(q);
                          })
                          .map((r) => (
                            <div
                              key={r.id}
                              className={`w-full rounded-none border transition overflow-hidden ${spf1Selected?.id === r.id
                                ? "border-red-500 bg-white ring-1 ring-red-200 shadow-sm"
                                : "border-red-200 bg-white shadow-sm"
                                }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (spf1Selected?.id === r.id) {
                                    setSpf1Selected(null);
                                    return;
                                  }
                                  setSpf1Selected(r);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-red-50/70 transition flex items-center justify-between gap-2"
                              >
                                <div className="font-black text-[11px] uppercase tracking-widest text-gray-800 truncate">
                                  {r.spf_number || `SPF #${r.id}`}
                                </div>
                                <span className="text-[10px] font-black text-red-500 tabular-nums w-4 text-center shrink-0">
                                  {spf1Selected?.id === r.id ? "▾" : "▸"}
                                </span>
                              </button>

                              {spf1Selected?.id === r.id && (
                                <div className="border-t border-red-100 bg-gray-50/90">
                                  <div className="ml-2 border-l-2 border-red-400 pl-3 pr-2 py-2.5 space-y-3">
                                    <div className="text-[10px] text-gray-700 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                      <span className="truncate col-span-2 text-[9px] text-gray-500 font-mono">
                                        Ref: {r.referenceid || "—"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setMobilePanelTab("products")}
                                      className="w-full text-left text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 py-1 border-t border-red-100/80"
                                    >
                                      View selected in quotation list →
                                    </button>

                                    <div className="space-y-2 pt-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Line items</span>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setSpf1Selected(null); }}
                                          className="text-[9px] font-black uppercase tracking-wider text-red-600 hover:text-red-800"
                                        >
                                          Collapse
                                        </button>
                                      </div>
                                      {parseSpfCreationProducts(r).map((p, idx) => (
                                        <div key={`${r.id}-${idx}`} className="border border-gray-200 bg-white p-2 shadow-sm">
                                          <div className="flex items-start gap-2">
                                            {p.imageUrl ? (
                                              <img
                                                src={p.imageUrl}
                                                alt={p.title}
                                                className="w-12 h-12 object-cover border border-gray-200 shrink-0"
                                              />
                                            ) : (
                                              <div className="w-12 h-12 bg-gray-50 border border-gray-200 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[10px] font-black uppercase tracking-wider text-gray-800 truncate font-mono">
                                                {p.sku || p.title}
                                              </div>
                                              <div className="text-[10px] text-gray-500 mt-0.5 grid grid-cols-2 gap-x-2">
                                                <span className="truncate"><span className="font-bold">Min qty:</span> {p.quantity}</span>
                                                <span className="truncate"><span className="font-bold">Price:</span> ₱{p.finalSellingPrice.toFixed(2)}</span>
                                                <span className="truncate col-span-2"><span className="font-bold">Lead:</span> {p.leadTime || "—"}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-2">
                                            <Button
                                              type="button"
                                              disabled={p.quantity <= 0}
                                              className="w-full rounded-none bg-red-600 hover:bg-red-700 text-white h-8 text-[11px] font-black uppercase tracking-wider"
                                              onClick={() => {
                                                const specHtml = formatSpfTechSpecToHtml(p.technicalSpecification || "");
                                                const leadHtml = formatProcurementLeadHtml(p.leadTime || "");
                                                setSelectedProducts((prev) => [
                                                  ...prev,
                                                  {
                                                    id: `spf1-${crypto.randomUUID()}`,
                                                    uid: crypto.randomUUID(),
                                                    title: p.sku ? p.sku.toUpperCase() : p.title,
                                                    description: `${specHtml}${leadHtml}`,
                                                    skus: p.sku ? [p.sku] : [],
                                                    images: p.imageUrl ? [{ src: p.imageUrl }] : [],
                                                    quantity: Math.max(1, p.quantity),
                                                    price: p.finalSellingPrice,
                                                    discount: 0,
                                                    isDiscounted: false,
                                                    procurementMinQty: p.quantity,
                                                    procurementLeadTime: p.leadTime,
                                                    procurementLockedPrice: true,
                                                    originalPrice: p.finalSellingPrice,
                                                    procurementItemCode: p.sku || "",
                                                  },
                                                ]);
                                                setMobilePanelTab("products");
                                              }}
                                            >
                                              {p.quantity <= 0 ? "No PD qty" : "Add to quotation"}
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    !isManualEntry && (
                      <>
                        <FieldLabel>Products:</FieldLabel>
                        <Input
                          type="text"
                          className="uppercase rounded-none"
                          placeholder="Search Product Name or Item Code.."
                          value={searchTerm}
                          onChange={async (e) => {
                            if (isManualEntry) return;
                            const rawValue = e.target.value;
                            setSearchTerm(rawValue);

                            if (rawValue.length < 2) {
                              setSearchResults([]);
                              return;
                            }

                            setIsSearching(true);
                            try {
                              if (productSource === 'shopify') {
                                const res = await fetch(`/api/shopify/products?q=${rawValue.toLowerCase()}`);
                                let data = await res.json();
                                setSearchResults(data.products || []);
                              } else if (
                                productSource === "firebase_shopify" ||
                                productSource === "firebase_taskflow"
                              ) {
                                const searchUpper = rawValue.toUpperCase();

                                const websiteFilter =
                                  productSource === "firebase_shopify"
                                    ? "Shopify"
                                    : "Taskflow";

                                const q = query(
                                  collection(db, "products"),
                                  where("websites", "array-contains", websiteFilter)
                                );

                                const querySnapshot = await getDocs(q);

                                const firebaseResults = querySnapshot.docs
                                  .map(doc => {
                                    const data = doc.data();

                                    let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
                                    let rawSpecsText = "";

                                    if (Array.isArray(data.technicalSpecs)) {
                                      data.technicalSpecs.forEach((group: any) => {
                                        rawSpecsText += ` ${group.specGroup}`;

                                        specsHtml += `
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
${group.specGroup}
</div>`;

                                        specsHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;

                                        group.specs?.forEach((spec: any) => {
                                          rawSpecsText += ` ${spec.name} ${spec.value}`;

                                          specsHtml += `
<tr>
<td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%">
<b>${spec.name}</b>
</td>
<td style="border:1px solid #e5e7eb;padding:4px">
${spec.value}
</td>
</tr>`;
                                        });

                                        specsHtml += `</table>`;
                                      });
                                    }

                                    return {
                                      id: doc.id,
                                      title: data.name || "No Name",
                                      price: data.salePrice || data.regularPrice || 0,
                                      description: specsHtml,
                                      images: data.mainImage ? [{ src: data.mainImage }] : [],
                                      skus: data.itemCode ? [data.itemCode] : [],
                                      discount: 0,
                                      tempSearchMetadata: (
                                        data.name +
                                        " " +
                                        (data.itemCode || "") +
                                        " " +
                                        rawSpecsText
                                      ).toUpperCase()
                                    };
                                  })
                                  .filter(p => p.tempSearchMetadata.includes(searchUpper));

                                setSearchResults(firebaseResults);
                              }
                            } catch (err) {
                              console.error("Search Protocol Failure:", err);
                            } finally {
                              setIsSearching(false);
                            }
                          }}
                        />
                        {isSearching && <p className="text-[10px] animate-pulse">Searching...</p>}
                      </>
                    )
                  )}
                </div>

                {/* Search Results — only shown when not in SPF mode */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && searchResults.length > 0 && (
                  <>
                    <div className="text-xs text-green-600 mb-2 flex items-center gap-2">
                      <span>Note: you can choose the same products.</span>
                      <span className="text-[10px] text-blue-500 font-semibold bg-green-100 border border-blue-100 px-3 py-0.5 rounded-full">
                        ℹ️ Drag cards to add
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 gap-4">
                      {searchResults.map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-grab active:cursor-grabbing hover:bg-gray-50 rounded-xs select-none border-2 border-transparent hover:border-blue-200 transition-all"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData("application/json", JSON.stringify(item));
                          }}
                        >
                          <CardHeader className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <Button
                                onClick={() => {
                                  setSelectedProducts((prev) => [
                                    ...prev,
                                    {
                                      ...item,
                                      uid: crypto.randomUUID(),
                                      quantity: 1,
                                      price: 0,
                                      discount: 0,
                                      description: item.description || "",
                                    },
                                  ]);
                                  setMobilePanelTab("products"); // auto-switch to products view on mobile
                                }}
                                className="w-6 h-6 p-0 flex items-center justify-center rounded-full cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <CardTitle className="text-base text-xs font-semibold">
                                {item.title}
                              </CardTitle>
                            </label>
                          </CardHeader>

                          <CardContent className="flex justify-center p-2">
                            {item.images?.[0]?.src ? (
                              <img
                                src={item.images[0].src}
                                alt={item.title}
                                className="w-24 h-24 object-cover rounded"
                              />
                            ) : (
                              <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 cursor-not-allowed">
                                No Image
                              </div>
                            )}
                          </CardContent>

                          <CardFooter className="text-xs text-gray-600">
                            {item.skus && item.skus.length > 0
                              ? `ITEM CODE${item.skus.length > 1 ? "s" : ""}: ${item.skus.join(", ")}`
                              : "No item code available"}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                {/* Selected Products checkboxes */}
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[20vh] lg:max-h-[35vh] border border-dashed p-2 rounded-lg">
                  {selectedProducts.length === 0 && (
                    <p className="text-xs text-gray-500">No products selected.</p>
                  )}

                  {selectedProducts.map((item, index) => (
                    <div key={item.uid} className="flex flex-col">
                      {index !== 0 && <Separator className="my-1" />}
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked
                          className="accent-blue-500"
                          onChange={() => {
                            const toRemove = selectedProducts.find((p) => p.uid === item.uid);
                            if (toRemove?.cloudinaryPublicId) {
                              deleteCloudinaryImage(toRemove.cloudinaryPublicId);
                            }
                            setSelectedProducts((prev) =>
                              prev.filter((p) => p.uid !== item.uid)
                            );
                            setVisibleDescriptions((prev) => {
                              const copy = { ...prev };
                              delete copy[item.uid];
                              return copy;
                            });
                          }}
                        />
                        <span>{item.title}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right side: Selected Products as Table with Image & Editable Description */}
              <div
                className={`overflow-y-auto px-3 lg:px-0 pb-3 lg:pb-0 min-h-0 ${selectedProducts.length > 0 && mobilePanelTab === "search" ? "hidden lg:block" : "block"} ${isDragOver ? "ring-2 ring-blue-400 ring-inset rounded-lg bg-blue-50/30" : ""} transition-all`}
                onDragOver={(e) => {
                  // Only show drop highlight for product cards from left panel, not row reorders
                  if (!e.dataTransfer.types.includes("application/json")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  try {
                    const raw = e.dataTransfer.getData("application/json");
                    if (!raw) return;
                    const item = JSON.parse(raw) as Product;
                    setSelectedProducts((prev) => [
                      ...prev,
                      {
                        ...item,
                        uid: crypto.randomUUID(),
                        quantity: 1,
                        price: 0,
                        discount: 0,
                        description: item.description || "",
                      },
                    ]);
                    setMobilePanelTab("products");
                  } catch (err) {
                    console.error("Drop failed:", err);
                  }
                }}
              >
                {selectedProducts.length === 0 && (
                  <div className={`flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed rounded-lg transition-all ${isDragOver ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-200 text-gray-300"}`}>
                    <div className="text-5xl mb-3">{isDragOver ? "📥" : "📋"}</div>
                    <p className="font-black text-sm uppercase tracking-widest">
                      {isDragOver ? "Drop to add product" : "No products selected"}
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                      {isDragOver ? "" : "Search and drag items here, or click ＋"}
                    </p>
                  </div>
                )}
                {selectedProducts.length > 0 && (
                  <>
                    {/* Controls bar - desktop horizontal, mobile compact */}
                    <div className="flex flex-col gap-2 mb-3">
                      <div className="hidden lg:flex items-center justify-between mb-1">
                        <h4 className="font-black text-sm tracking-tight">
                          Product List
                          <span className="ml-2 text-xs font-normal text-gray-400">({selectedProducts.length} item{selectedProducts.length !== 1 ? "s" : ""})</span>
                        </h4>
                      </div>
                      <h4 className="font-bold text-xs lg:hidden">Selected Products: ({selectedProducts.length})</h4>

                      {/* Subject + VAT + WHT — single compact toolbar */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-0 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden text-[10px]">
                        {/* Subject */}
                        <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                          <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">Subject</span>
                          <input
                            type="text"
                            value={quotationSubject}
                            onChange={(e) => setQuotationSubject(e.target.value)}
                            placeholder="For Quotation"
                            className="border-0 bg-transparent px-0 py-0 text-[10px] font-bold uppercase flex-1 min-w-0 focus:outline-none placeholder-gray-300"
                          />
                        </div>

                        {/* VAT */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                          <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">VAT</span>
                          <RadioGroup value={vatType} onValueChange={setVatType} className="flex gap-2">
                            {[{ v: "vat_inc", l: "Inc" }, { v: "vat_exe", l: "Exe" }, { v: "zero_rated", l: "0%" }].map(({ v, l }) => (
                              <div key={v} className="flex items-center gap-0.5">
                                <RadioGroupItem value={v} id={`vat-${v}`} />
                                <label htmlFor={`vat-${v}`} className={`font-black uppercase cursor-pointer transition-colors ${vatType === v ? "text-[#121212]" : "text-gray-300"}`}>{l}</label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>

                        {/* EWT */}
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">EWT</span>
                          <RadioGroup value={whtType} onValueChange={setWhtType} className="flex gap-2">
                            {[{ v: "none", l: "None" }, { v: "wht_1", l: "1%" }, { v: "wht_2", l: "2%" }].map(({ v, l }) => (
                              <div key={v} className="flex items-center gap-0.5">
                                <RadioGroupItem value={v} id={`wht-${v}`} />
                                <label htmlFor={`wht-${v}`} className={`font-black uppercase cursor-pointer transition-colors ${whtType === v ? "text-[#121212]" : "text-gray-300"}`}>{l}</label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      {isDragOver && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none rounded border-2 border-dashed border-blue-400 bg-blue-50/70">
                          <p className="font-black text-blue-500 text-base uppercase tracking-widest">📥 Drop to add product</p>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-[#121212] text-white text-[10px] uppercase tracking-wider">
                              <th className="border border-gray-700 p-2 text-center w-7 text-gray-400 select-none" title="Drag to reorder">⠿</th>
                              <th className="border border-gray-700 p-2 text-center w-8 font-bold">#</th>
                              <th className="border border-gray-700 p-2 text-center w-10">
                                <label className="flex items-center justify-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedProducts.every((p) => p.isDiscounted)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedProducts((prev) =>
                                        prev.map((p) => ({
                                          ...p,
                                          isDiscounted: checked,
                                          discount: checked ? (vatType === "vat_exe" ? 12 : 0) : 0,
                                        }))
                                      );
                                    }}
                                  />
                                  <span className="font-bold">Disc%</span>
                                </label>
                              </th>
                              <th className="border border-gray-700 p-2 text-left hidden sm:table-cell font-bold">Remarks</th>
                              <th className="border border-gray-700 p-2 text-left font-bold">Product</th>
                              <th className="border border-gray-700 p-2 text-center font-bold w-24">Qty</th>
                              <th className="border border-gray-700 p-2 text-center font-bold w-24">Unit Price</th>
                              <th className="border border-gray-700 p-2 text-center hidden sm:table-cell font-bold">Discount</th>
                              <th className="border border-gray-700 p-2 text-center font-bold">Subtotal</th>
                              <th className="border border-gray-700 p-2 text-center font-bold w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProducts.map((p, idx) => {
                              const isDiscounted = p.isDiscounted ?? false;

                              // default discount based on VAT type
                              const defaultDiscount = vatType === "vat_exe" ? 12 : 0;
                              const rowDiscount = p.discount ?? defaultDiscount;

                              const baseAmount = p.price * p.quantity;
                              const discountedAmount = isDiscounted ? (baseAmount * rowDiscount) / 100 : 0;
                              const totalAfterDiscount = baseAmount - discountedAmount;

                              const isExpanded = expandedRows[p.uid] ?? false;

                              return (
                                <React.Fragment key={p.uid}>
                                  <tr
                                    className={`even:bg-gray-50 cursor-pointer transition-all ${dragOverRowUid === p.uid && dragRowUid !== p.uid
                                        ? "border-t-2 border-t-blue-400"
                                        : ""
                                      } ${dragRowUid === p.uid ? "opacity-40" : ""}`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/x-row-uid", p.uid);
                                      setDragRowUid(p.uid);
                                    }}
                                    onDragEnd={() => {
                                      setDragRowUid(null);
                                      setDragOverRowUid(null);
                                    }}
                                    onDragOver={(e) => {
                                      // Only process row reorder, not product-from-left drops
                                      if (!e.dataTransfer.types.includes("text/x-row-uid")) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (dragOverRowUid !== p.uid) setDragOverRowUid(p.uid);
                                    }}
                                    onDrop={(e) => {
                                      const fromUid = e.dataTransfer.getData("text/x-row-uid");
                                      if (!fromUid || fromUid === p.uid) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedProducts((prev) => {
                                        const arr = [...prev];
                                        const fromIdx = arr.findIndex((x) => x.uid === fromUid);
                                        const toIdx = arr.findIndex((x) => x.uid === p.uid);
                                        if (fromIdx === -1 || toIdx === -1) return prev;
                                        const [moved] = arr.splice(fromIdx, 1);
                                        arr.splice(toIdx, 0, moved);
                                        return arr;
                                      });
                                      setDragRowUid(null);
                                      setDragOverRowUid(null);
                                    }}
                                  >
                                    {/* Drag handle */}
                                    <td className="border border-gray-300 p-2 text-center text-gray-300 cursor-grab active:cursor-grabbing select-none text-base">
                                      ⠿
                                    </td>
                                    {/* Row order number */}
                                    <td className="border border-gray-300 p-2 text-center text-gray-400 font-mono font-bold text-[11px]">
                                      {idx + 1}
                                    </td>
                                    <td className="border border-gray-300 p-4">
                                      <div className="flex items-center justify-start gap-2">
                                        {/* Styled Checkbox */}
                                        <input
                                          type="checkbox"
                                          checked={isDiscounted}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSelectedProducts((prev) => {
                                              const copy = [...prev];
                                              copy[idx] = {
                                                ...copy[idx],
                                                isDiscounted: checked,
                                                discount: checked ? (vatType === "vat_exe" ? 12 : 0) : 0, // reset if unchecked
                                              };
                                              return copy;
                                            });
                                          }}
                                        />

                                        {/* Discount Input */}
                                        {isDiscounted && (
                                          <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={p.discount ?? 0}
                                            onChange={(e) => {
                                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                                              setSelectedProducts((prev) => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], discount: val };
                                                return copy;
                                              });
                                            }}
                                            className="w-15 p-0 border-none rounded-none"
                                          />
                                        )}
                                      </div>
                                    </td>

                                    <td className="hidden sm:table-cell">
                                      <Textarea
                                        value={p.itemRemarks || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setSelectedProducts((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], itemRemarks: val };
                                            return copy;
                                          });
                                        }}
                                        placeholder="Enter any remarks here..."
                                        rows={3}
                                        className="capitalize rounded-none text-[10px] w-full p-1"
                                      />
                                    </td>

                                    <td className="p-1 sm:p-2">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        {/* Product Image */}
                                        <img
                                          src={p.images?.[0]?.src || "/Taskflow.png"}
                                          alt={p.title}
                                          className="w-8 h-8 sm:w-12 sm:h-12 object-cover rounded shrink-0"
                                        />

                                        {/* Product Title (Editable) */}
                                        <div
                                          contentEditable
                                          suppressContentEditableWarning
                                          className="flex-1 outline-none text-[10px] sm:text-xs min-w-0 break-words"
                                          onBlur={(e) => {
                                            const html = e.currentTarget.innerHTML; // keep HTML
                                            setSelectedProducts((prev) => {
                                              const copy = [...prev];
                                              copy[idx] = { ...copy[idx], description: html };
                                              return copy;
                                            });
                                          }}
                                        >
                                          {p.title}
                                        </div>
                                        {p.procurementLeadTime && (
                                          <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">
                                            Lead Time: {p.procurementLeadTime}
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    <td className="border border-gray-300 p-1 sm:p-2">
                                      <Input
                                        type="number"
                                        min={p.procurementMinQty && p.procurementMinQty > 0 ? p.procurementMinQty : 1}
                                        value={p.quantity}
                                        onChange={(e) => {
                                          const raw = parseInt(e.target.value, 10) || 1;
                                          const floor = p.procurementMinQty && p.procurementMinQty > 0 ? p.procurementMinQty : 1;
                                          const val = Math.max(floor, raw);
                                          setSelectedProducts((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], quantity: val };
                                            return copy;
                                          });
                                        }}
                                        className="w-12 sm:w-full p-1 sm:p-2 rounded-none text-xs"
                                      />
                                      {p.procurementMinQty != null && p.procurementMinQty > 0 && (
                                        <div className="text-[9px] text-gray-500 mt-1">
                                          Min (PD): <span className="font-bold">{p.procurementMinQty}</span>
                                        </div>
                                      )}
                                    </td>

                                    <td className="border border-gray-300 p-1 sm:p-2">
                                      <Input
                                        type="number"
                                        min={p.procurementLockedPrice ? (p.originalPrice ?? 0) : 0}
                                        step="0.01"
                                        value={p.price}
                                        readOnly={false}
                                        onChange={(e) => {
                                          const raw = parseFloat(e.target.value) || 0;
                                          const minPrice = p.procurementLockedPrice ? (p.originalPrice ?? 0) : 0;
                                          const val = Math.max(minPrice, raw);
                                          setSelectedProducts((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], price: val };
                                            return copy;
                                          });
                                        }}
                                        onBlur={(e) => {
                                          if (p.procurementLockedPrice) {
                                            const val = parseFloat(e.target.value) || 0;
                                            const minPrice = p.originalPrice ?? 0;
                                            if (val < minPrice) {
                                              setSelectedProducts((prev) => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], price: minPrice };
                                                return copy;
                                              });
                                            }
                                          }
                                        }}
                                        className={`w-16 sm:w-full p-1 sm:p-2 rounded-none text-xs ${p.procurementLockedPrice ? "bg-gray-50 font-bold" : ""}`}
                                      />
                                      {p.procurementLockedPrice && (
                                        <div className="text-[9px] text-gray-500 mt-1">
                                          Final selling price (locked at ₱{(p.originalPrice ?? 0).toLocaleString(undefined,{ minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                        </div>
                                      )}
                                    </td>

                                    <td className="border border-gray-300 p-2 font-semibold text-center hidden sm:table-cell">
                                      {isDiscounted && discountedAmount > 0
                                        ? `₱${discountedAmount.toFixed(2)}`
                                        : "₱0.00"}
                                    </td>

                                    {/* <td className="border border-gray-300 p-2 text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="text-gray-400 text-xs">₱</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={p.discount || 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setSelectedProducts((prev) => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], discount: val };
                                        return copy;
                                      });
                                    }}
                                    className="border-none shadow-none w-full p-2"
                                  />
                                </div>
                              </td> */}

                                    <td className="border border-gray-300 p-2 font-semibold text-center">
                                      ₱{totalAfterDiscount.toFixed(2)}
                                    </td>

                                    <td className="border border-gray-300 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Button
                                          variant="outline"
                                          onClick={() => toggleRow(p.uid)}
                                          className="flex items-center rounded-none gap-1 px-2"
                                        >
                                          {expandedRows[p.uid] ? (
                                            <>
                                              <EyeOff className="w-4 h-4" />
                                              <span className="hidden sm:inline">Hide</span>
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-4 h-4" />
                                              <span className="hidden sm:inline">View</span>
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="flex items-center rounded-none gap-1"
                                          onClick={() => {
                                            if (p.cloudinaryPublicId) {
                                              deleteCloudinaryImage(p.cloudinaryPublicId);
                                            }
                                            setSelectedProducts((prev) =>
                                              prev.filter((item) => item.uid !== p.uid)
                                            );
                                            setVisibleDescriptions((prev) => {
                                              const copy = { ...prev };
                                              delete copy[p.uid];
                                              return copy;
                                            });
                                          }}
                                        >
                                          <Trash className="text-red-600" />
                                        </Button>

                                      </div>
                                    </td>
                                  </tr>
                                  {/* need to fix */}
                                  {/* <tr className="even:bg-gray-50">
                              <td colSpan={7} className="border border-gray-300 p-2">
                                <label className="block text-xs font-medium mb-1">Description:</label>
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="w-full max-h-90 overflow-auto border border-gray-300 rounded p-2 text-xs"
                                  dangerouslySetInnerHTML={{
                                    __html: extractTableHtml(p.description || ""),
                                  }}
                                  onBlur={(e) => {
                                    const html = e.currentTarget.innerHTML;
                                    setSelectedProducts((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], description: html };
                                      return copy;
                                    });
                                  }}
                                />
                              </td>
                            </tr> */}
                                  {/* SECTION: Product Technical Specifications (Read-Only) */}
                                  {isExpanded && (
                                    <tr className="even:bg-[#F9FAFA]">
                                      <td colSpan={7} className="border border-gray-300 p-4 align-top">
                                        <label className="block text-xs font-medium mb-1">Description:</label>
                                        <div
                                          className="w-full max-h-90 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                          dangerouslySetInnerHTML={{
                                            __html:
                                              p.description ||
                                              '<span class="text-gray-400 italic">No specifications provided.</span>',
                                          }}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}

                          </tbody>
                          <tfoot className="bg-gray-100 font-bold text-xs">
                            <tr>
                              <td className="border border-gray-300 p-2 text-center"></td>
                              <td className="border border-gray-300 p-2 text-center"></td>
                              <td className="border border-gray-300 p-2 text-center"></td>
                              <td className="border border-gray-300 p-2 text-center"></td>
                              <td className="border border-gray-300 p-2"></td>
                              <td className="border border-gray-300 p-2 text-center font-black">
                                {selectedProducts.reduce((acc, p) => acc + p.quantity, 0)}
                              </td>
                              <td className="border border-gray-300 p-2 text-center font-black">
                                {selectedProducts.reduce((acc, p) => acc + p.price, 0).toFixed(2)}
                              </td>
                              <td className="border border-gray-300 p-2 text-center hidden sm:table-cell">
                                ₱{selectedProducts.reduce((acc, p) => {
                                  const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                  const baseAmount = p.price * p.quantity;
                                  return acc + (baseAmount * discount) / 100;
                                }, 0).toFixed(2)}
                              </td>
                              <td className="border border-gray-300 p-2 text-center font-black">
                                ₱{selectedProducts.reduce((acc, p) => {
                                  const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                  const baseAmount = p.price * p.quantity;
                                  return acc + baseAmount - (baseAmount * discount) / 100;
                                }, 0).toFixed(2)}
                              </td>
                              <td className="border border-gray-300 p-2"></td>
                            </tr>

                            {/* Delivery & Restocking Fee Row — desktop only inside table */}
                            <tr className="hidden sm:table-row">
                              <td colSpan={6} className="border border-gray-300 p-2"></td>
                              <td colSpan={4} className="border border-gray-300 p-2">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs whitespace-nowrap font-bold">Delivery Fee:</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                      placeholder="0.00"
                                      value={deliveryFee}
                                      onChange={(e) => setDeliveryFee(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs whitespace-nowrap font-bold">Restocking Fee:</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                      placeholder="0.00"
                                      value={restockingFee}
                                      onChange={(e) => setRestockingFee(e.target.value)}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Delivery & Restocking Fee — mobile only, below table */}
                    <div className="sm:hidden border border-gray-200 bg-gray-50 p-3 mt-1">
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-200">
                        <span className="text-xs font-bold uppercase text-gray-600">Delivery Fee</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                          placeholder="0.00"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs font-bold uppercase text-gray-600">Restocking Fee</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                          placeholder="0.00"
                          value={restockingFee}
                          onChange={(e) => setRestockingFee(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>{/* end BODY */}

          {/* Note bar - compact */}
          <div className="text-[10px] text-red-500 text-center italic px-3 py-1.5 bg-red-50 border-t border-red-200 shrink-0">
            ⚠️ Quotation Number only appears on the final downloaded quotation.
          </div>

          <DialogFooter className="flex flex-col gap-2 pl-8 pr-5 py-3 sm:pl-10 sm:pr-6 border-t border-gray-200 shrink-0 sm:flex-row sm:items-center sm:justify-between">
            {/* Mobile total — hidden on desktop (shown in header instead) */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center justify-between lg:hidden">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Total:</span>
                <span className="text-lg font-black text-[#121212] tabular-nums">
                  PHP {Number(quotationAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 w-full lg:w-auto lg:ml-auto">
              {selectedProducts.length > 0 && (
                <Button
                  className="flex-1 lg:flex-none bg-[#121212] hover:bg-black text-white flex gap-2 items-center rounded-lg h-10 px-6 shadow-md"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
                </Button>
              )}
              <Button
                className="flex-1 lg:flex-none rounded-lg h-10 px-6 border-2"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                <XCircle className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW QUOTATION MODAL */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-[#F9FAFA] shadow-2xl"
          style={{ maxWidth: "950px", width: "100vw" }}
        >
          {(() => {
            return (
              <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]">

                {/* CORPORATE BRANDING HEADER */}
                <div className="w-full flex justify-center py-5 border-b border-gray-100 bg-white">
                  <div className="w-full max-w-[900px] h-[110px] relative flex items-center justify-center overflow-hidden">
                    <img
                      key={quotationType}
                      src={headerImagePath}
                      alt={`${quotationType} Header`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                      <div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                        <span class="font-black text-2xl tracking-[0.2em] uppercase">${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</span>
                        <span class="text-[10px] tracking-[0.5em] font-light opacity-70">OFFICIAL QUOTATION PROTOCOL</span>
                      </div>
                    `;
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="px-6 py-5 space-y-1">
                  {/* REFERENCE & DATE SECTION */}
                  <div className="text-right text-[11px] font-medium uppercase space-y-1">
                    <p className="flex justify-end gap-2">
                      <span className="font-black text-[#121212]">Reference No:</span>
                      <span className="text-gray-600">{payload.referenceNo}</span>
                    </p>
                    <p className="flex justify-end gap-2">
                      <span className="font-black text-[#121212]">Date:</span>
                      <span className="text-gray-600">{payload.date}</span>
                    </p>
                  </div>

                  {/* CLIENT INFORMATION GRID */}
                  <div className="mt-5 border-l border-r border-black uppercase">
                    {[
                      { label: "COMPANY NAME", value: payload.companyName, borderTop: true },
                      { label: "ADDRESS", value: payload.address },
                      { label: "TEL NO", value: payload.telNo },
                      { label: "EMAIL ADDRESS", value: payload.email, borderBottom: true },
                      { label: "ATTENTION", value: payload.attention },
                      { label: "SUBJECT", value: payload.subject, borderBottom: true },
                    ].map((info, i) => (
                      <div
                        key={i}
                        className={`grid grid-cols-6 py-1 px-4 items-center min-h-[30px]
                    ${info.borderTop ? 'border-t border-black' : ''} 
                    ${info.borderBottom ? 'border-b border-black' : ''}
                  `}
                      >
                        <span className="col-span-1 font-black text-[10px] text-[#121212]">{info.label}:</span>
                        <span className="col-span-5 text-[11px] font-bold text-gray-700 pl-4">{info.value || "---"}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] italic mt-5 text-gray-500 font-medium">
                    We are pleased to offer you the following products for consideration:
                  </p>

                  {/* ITEM SPECIFICATION TABLE */}
                  <div className="border border-black overflow-hidden shadow-sm">
                    <table className="w-full text-[12px] border-collapse">
                      <thead>
                        <tr className="bg-[#F9FAFA] border-b border-black font-black font-black uppercase text-[#121212]">
                          <th className="p-3 border-r border-black w-16 text-center">ITEM NO</th>
                          <th className="p-3 border-r border-black w-16 text-center">QTY</th>
                          <th className="p-3 border-r border-black w-32 text-center">REFERENCE PHOTO</th>
                          <th className="p-3 border-r border-black text-left">PRODUCT DESCRIPTION</th>
                          <th className="p-3 border-r border-black w-32 text-right">UNIT PRICE</th>
                          <th className="p-3 w-32 text-right">TOTAL AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {payload.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400 capitalize"><span className="font-bold text-black">{item.itemNo}.</span></td>
                            <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                            <td className="p-3 border-r border-black align-top bg-white">
                              {item.photo ? (
                                <img src={item.photo} className="w-24 h-24 object-contain mx-auto mix-blend-multiply" alt="sku-ref" />
                              ) : (
                                <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic">No Image</div>
                              )}
                            </td>
                            <td className="p-4 border-r border-black align-top">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-black text-[#121212] text-xs uppercase">{item.title}</p>
                                {item.isSpf1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-600 text-white shrink-0">
                                    SPF
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
                              {item.isSpf1 && item.procurementLeadTime && (
                                <div className="mb-2 flex items-center gap-1.5">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Lead Time:</span>
                                  <span className="text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                    {item.procurementLeadTime}
                                  </span>
                                </div>
                              )}
                              <div
                                className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: item.description }}
                              />
                              <span className="bg-orange-400 mt-2 p-1 capitalize text-red-800">{item.itemRemarks}</span>
                            </td>
                            <td className="p-4 text-right border-r border-black align-top font-medium">
                              ₱{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}

                            </td>
                            <td className="p-4 text-right font-black align-top text-[#121212]">
                              ₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}

                        {/* SUMMARY BAR */}
                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={2} className="border-r border-gray-400"></td>

                          <td className="px-4 border-r border-gray-400 font-bold text-red-600 italic text-[14px] uppercase">
                            Tax Type:
                          </td>

                          <td className="px-4 border-r border-gray-400">
                            <div className="flex gap-4 text-[12px] font-bold uppercase tracking-tight">
                              <span className={payload.vatTypeLabel === "VAT Inc" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                              </span>

                              <span className={payload.vatTypeLabel === "VAT Exe" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                              </span>

                              <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                              </span>
                            </div>
                          </td>

                          <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                            Delivery Fee:
                          </td>

                          <td className="px-4 text-right font-black text-lg text-gray-900">
                            ₱{payload.deliveryFee}
                          </td>
                        </tr> */}

                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={4} className="border-r border-gray-400"></td>

                          <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                            Grand Total:
                          </td>

                          <td className="px-4 text-right font-black text-lg text-green-700">
                            ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr> */}

                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={4} className="border-r border-gray-400"></td>
                          <td colSpan={2}>
                            <tr>
                              <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                                Grand Total:
                              </td>
                              <td className="px-4 text-right font-black text-lg text-green-700">
                                ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                                Grand Total:
                              </td>
                              <td className="px-4 text-right font-black text-lg text-green-700">
                                ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </td>
                       

                        </tr> */}

                        {/* --- DETAILED SUMMARY BREAKDOWN --- */}
                        <tr className="border-t-2 border-black bg-white text-gray-900">
                          <td colSpan={4} className="border-r-2 border-black p-4 align-top">
                            <div className="flex flex-col gap-4 h-full pt-2">
                              <div className="flex items-center gap-6">
                                <span className="font-bold text-red-600 italic text-[14px] uppercase whitespace-nowrap tracking-tighter">
                                  Tax Type:
                                </span>
                                <div className="flex gap-4 text-[11px] font-black uppercase tracking-tight">
                                  <span className={payload.vatTypeLabel === "VAT Inc" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                                  </span>
                                  <span className={payload.vatTypeLabel === "VAT Exe" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                                  </span>
                                  <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                                  </span>
                                </div>
                              </div>

                              {payload.whtType !== "none" && (
                                <div className="flex items-center gap-6 border-t border-gray-100 pt-2">
                                  <span className="font-bold text-blue-600 italic text-[12px] uppercase whitespace-nowrap tracking-tighter">
                                    Withholding:
                                  </span>
                                  <span className="text-[10px] font-black uppercase text-blue-800">
                                    ● {payload.whtLabel} (Applied to Net of VAT)
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td colSpan={2} className="p-0">
                            <table className="w-full border-collapse">
                              <tbody className="text-[10px]">

                                {/* Row 1: Net Sales */}
                                <tr className="border-b border-gray-100">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black w-[55%] text-[9px] text-gray-500">
                                    Net Sales {payload.vatTypeLabel === "VAT Inc" ? "(VAT Inclusive)" : "(Non-VAT)"}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{(payload.totalPrice - payload.deliveryFee).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 2: Delivery */}
                                <tr className="border-b border-gray-100">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                    Delivery Charge
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{Number(payload.deliveryFee).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 3: Restocking Fee */}
                                <tr className="border-b-2 border-black">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                    Restocking Fee
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{(restockingFee || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 4: Total Invoice Amount */}
                                <tr className="bg-gray-50 border-b border-black">
                                  <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-[10px]">
                                    Total Invoice Amount
                                  </td>
                                  <td className="px-3 py-2 text-right font-black text-[13px] text-blue-900">
                                    ₱{payload.totalPrice.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* VAT & WHT Logic */}
                                {payload.vatTypeLabel === "VAT Inc" ? (
                                  <>
                                    <tr className="border-b border-gray-100">
                                      <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                        Less: VAT (12%)
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-bold text-gray-400">
                                        ₱{(payload.totalPrice * (12 / 112)).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                    </tr>

                                    <tr className={payload.whtType !== "none" ? "border-b border-gray-100" : "border-b-2 border-black"}>
                                      <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                        Net of VAT (Tax Base)
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-bold text-gray-400">
                                        ₱{(payload.totalPrice / 1.12).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                    </tr>

                                    {payload.whtType !== "none" && (
                                      <tr className="border-b-2 border-black bg-blue-50/50">
                                        <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-blue-700 text-[8px]">
                                          LESS: {payload.whtLabel}
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-blue-700">
                                          - ₱{payload.whtAmount.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                          })}
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                ) : (
                                  <tr className="border-b-2 border-black">
                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                      Tax Status
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-bold text-gray-400 italic">
                                      {payload.vatTypeLabel === "VAT Exe" ? "Exempted" : "Zero-Rated"}
                                    </td>
                                  </tr>
                                )}

                                {/* Final Total */}
                                <tr className="bg-black text-white">
                                  <td className="px-3 py-3 text-right font-black uppercase border-r border-white/20 text-[10px] tracking-tight">
                                    {payload.whtType !== "none" ? "Net Amount to Collect" : "Total Amount Due"}
                                  </td>
                                  <td className="px-3 py-3 text-right font-black text-[16px]">
                                    ₱{payload.netAmountToCollect.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 1. PRODUCT VARIANCE FOOTNOTE */}
                  <div className="mt-4 text-[10px] font-black uppercase tracking-tight border-b border-black pb-1">
                    *PHOTO MAY VARY FROM ACTUAL UNIT
                  </div>

                  {/* 2. LOGISTICS & NOTES GRID */}
                  <div className="mt-4 border border-black text-[9.5px] leading-tight">
                    <div className="grid grid-cols-6 border-b border-black">
                      <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Included:</div>
                      <div className="col-span-5 p-2 bg-yellow-100">
                        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
                        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 border-b border-black">
                      <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Excluded:</div>
                      <div className="col-span-5 p-2 bg-yellow-100">
                        <p>All lamp poles are subject to a delivery charge.</p>
                        <p>Installation and all hardware/accessories not indicated above.</p>
                        <p>Freight charges, arrastre, and other processing fees.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 bg-yellow-50">
                      <div className="col-span-1 p-2 font-black border-r border-black">Notes:</div>
                      <div className="col-span-5 p-2 italic">
                        <p>Deliveries are up to the vehicle unloading point only.</p>
                        <p>Additional shipping fee applies for other areas not mentioned above.</p>
                        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
                        <span className="font-black underline block mt-1 text-red-600">In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. EXTENDED TERMS & CONDITIONS */}
                  <div className="mt-6 border-t-2 border-black pt-2">
                    <h3 className="bg-[#121212] text-white px-3 py-1 text-[10px] font-black inline-block mb-4 uppercase">Terms and Conditions</h3>

                    <div className="grid grid-cols-12 gap-y-4 text-[9px]">
                      <div className="col-span-2 font-black uppercase">Availability:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>*5-7 days if on stock upon receipt of approved PO.</p>
                        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
                        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Warranty:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p><b>Regular Item:</b> One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
                        <p><b>Promo Item:</b> Three (3) months from the time of delivery for all busted lights except the damaged fixture.</p>
                        <p>The warranty will be VOID under the following circumstances:</p>
                        <p>*If the unit is being tampered with.</p>
                        <p>*If the item(s) is/are altered in any way by unauthorized technicians.</p>
                        <p>*If it has been subjected to misuse, mishandling, neglect, or accident.</p>
                        <p>*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.</p>
                        <p>*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.</p>
                        <p>*Shipping costs for warranty claims are for customers' account.</p>
                        <p>*If the product purchased is already phased out when the warranty is claimed, the latest model or closest product SKU will be given as a replacement.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">SO Validity:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100">
                        <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <span className="text-red-600 font-black">14-day period will be automatically cancelled</span>.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Storage:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <span className="text-red-600 font-black"> (10% / 30 days =  0.33% per day)</span>.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Return:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p><span className="text-red-600 font-black"><u>7 days return policy - </u></span>if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
                      </div>

                      {/* <div className="col-span-2 font-black uppercase">Bank Details:</div> */}
                      <div className="col-span-2 font-black uppercase">Payment:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 ">
                        <p><span className="text-red-600 font-black">Cash on Delivery (COD)</span></p>
                        <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
                        <p>For special items,  Seventy Percent (70%) down payment, 30% upon delivery.</p>
                        <p className="mt-5"><b>BANK DETAILS</b></p>
                        <p className="mb-5"><strong>Payee to: <b>{isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</b></strong></p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-black">BANK: METROBANK</p>
                            <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                            <p>Account Number: {isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</p>
                          </div>
                          <div>
                            <p className="font-black">BANK: BDO</p>
                            <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                            <p>Account Number: {isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 font-black uppercase">DELIVERY:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>Delivery/Pick up is subject to confirmation.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Validity:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100">
                        <p className="text-red-600 font-black underline">Thirty (30) calendar days from the date of this offer.</p>
                        <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">CANCELLATION:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>1. Above quoted items are non-cancellable.</p>
                        <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
                        <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
                        <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
                        <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. OFFICIAL SIGNATURE HIERARCHY */}
                  <div className="mt-12 pt-4 border-t-4 border-blue-700 pb-20">
                    <p className="text-[9px] mb-8 font-medium">
                      Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                      Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                    </p>

                    <div className="grid grid-cols-2 gap-x-20 gap-y-12">
                      {/* Left Side: Internal Team */}
                      <div className="space-y-10">
                        <div>
                          <p className="italic text-[10px] font-black mb-10">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                          <img src={payload.signature || ""} alt="Signature" className="w-34 h-10 object-contain" />
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Representative</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salescontact || "N/A"}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salesemail || "N/A"}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Approved By:</p>
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">SALES MANAGER</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.tsmDetails?.contact || "N/A"}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.tsmDetails?.email || "N/A"}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salesmanagername}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales-B2B</p>
                          {/* <p className="text-[9px] font-black uppercase tracking-tighter">SALES HEAD</p> */}
                        </div>
                      </div>

                      {/* Right Side: Client Side */}
                      <div className="space-y-10 flex flex-col items-end">
                        <div className="w-64">

                          <div className="border-b border-black w-64 mt-19"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Company Authorized Representative</p>
                          <p className="text-[9px] text-center font-bold text-gray-500 uppercase tracking-widest">(PLEASE SIGN OVER PRINTED NAME)</p>
                        </div>

                        <div className="w-64">
                          <div className="border-b border-black w-64 mt-20"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Payment Release Date</p>
                        </div>

                        <div className="w-64">
                          <div className="border-b border-black w-64 mt-25"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Position in the Company</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS BAR */}
                <div className="p-8 bg-white border-t border-gray-100 flex justify-between items-center sticky bottom-0 z-50">
                  <Button
                    variant="outline"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-none border-2 border-[#121212] font-black uppercase text-[10px] px-8 h-12 hover:bg-gray-50 transition-all"
                  >
                    Back to Editor
                  </Button>

                  <div className="flex gap-4 items-center">
                    <Button
                      onClick={() => { handleDownloadQuotation(); setIsPreviewOpen(false); }}
                      className="bg-[#121212] hover:bg-black rounded-full px-10 h-12 text-white font-black uppercase text-[11px] flex gap-3 items-center shadow-2xl hover:scale-[1.02] transition-all"
                      hidden={true}
                    >
                      <Download className="w-4 h-4 text-blue-400" />
                      Generate Official (.xlsx)
                    </Button>
                    <Button
                      onClick={handleDownloadQuotationPDF}
                      className="bg-[#121212] text-white px-10 h-12 rounded-full font-black uppercase shadow-xl hover:scale-105 transition-transform"
                      hidden={true}
                    >
                      Confirm & Generate PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
