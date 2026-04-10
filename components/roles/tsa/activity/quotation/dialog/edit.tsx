"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sileo } from "sileo";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Download,
  Eye,
  Trash,
  FileSpreadsheet,
  FileText,
  EyeOff,
  ImagePlus,
  Plus,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FieldLabel } from "@/components/ui/field";

import { Preview } from "./preview";
import ConfirmationDialog from "./confirmation";

interface Completed {
  id: number;
  start_date?: string;
  end_date?: string;
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  item_remarks?: string;
  quotation_number?: string;
  quotation_amount?: number | string;
  quotation_type: string;
  version?: string;
  activity_reference_number?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
  company_name?: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;
  address?: string;
  region?: string;
  delivery_fee?: string;
  restocking_fee?: string;
  quotation_vatable?: string;
  quotation_subject?: string;
}

interface ProductItem {
  description: string;
  skus: any;
  title: string;
  images: any;
  isDiscounted: boolean;
  price: number;
  quantity: number;
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  item_remarks?: string;
  discount?: number;
  procurementMinQty?: number;
  procurementLeadTime?: string;
  procurementLockedPrice?: boolean;
  cloudinaryPublicId?: string;
}

function splitAndTrim(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
  if (!value) return [];
  return value.split("||").map((v) => v.trim());
}

// ── SPF 1 types ──────────────────────────────────────────────────────────────
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
  referenceid?: string | null;
  [key: string]: any;
};

type SpfOfferProduct = {
  title: string;
  sku: string;
  quantity: number;
  finalSellingPrice: number;
  imageUrl: string;
  technicalSpecification: string;
  packagingDetails: string;
  factoryDetails: string;
  url: string;
  leadTime: string;
};

function spfSplitByRow(value?: string | null): string[] {
  return (value || "").split("|ROW|").map((s) => s.trim()).filter((s) => s.length > 0);
}
function spfSplitComma(value?: string | null): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function spfExplodeRowGroups(value?: string | null): string[] {
  const groups = spfSplitByRow(value);
  if (groups.length === 0) return spfSplitComma(value);
  return groups.flatMap((g) => spfSplitComma(g));
}
function spfExplodeTechSpecs(value?: string | null): string[] {
  const v = (value || "").trim();
  if (!v) return [];
  const rowGroups = spfSplitByRow(v);
  if (rowGroups.length > 0) return rowGroups;
  return [v];
}
function spfSummarizeField(value?: string | null, max = 2): string {
  const items = spfExplodeRowGroups(value)
    .map((v) => v.replace(/\|ROW\|/g, "").trim())
    .filter((v) => v && v !== "-" && v !== "--");
  const unique = Array.from(new Set(items));
  if (unique.length === 0) return "—";
  const head = unique.slice(0, max).join(", ");
  return unique.length > max ? `${head}...` : head;
}
function parseSpfCreationProducts(row: SpfCreationRow): SpfOfferProduct[] {
  const skus = spfExplodeRowGroups(row.item_code);
  const qtys = spfExplodeRowGroups(row.product_offer_qty);
  const sellingPrices = spfExplodeRowGroups(row.final_selling_cost);
  const leadRaw = row.proj_lead_time ?? row.project_lead_time;
  const leadTimes = spfExplodeRowGroups(leadRaw);
  const imgs = spfExplodeRowGroups(row.product_offer_image);
  const techSpecs = spfExplodeTechSpecs(row.product_offer_technical_specification);
  const packaging = spfExplodeRowGroups(row.product_offer_packaging_details);
  const factory = spfExplodeRowGroups(row.product_offer_factory_address);
  const maxLen = skus.length || Math.max(qtys.length, sellingPrices.length, leadTimes.length, imgs.length, 1);
  return Array.from({ length: maxLen }, (_, i) => ({
    title: (skus[i] || `SPF ITEM ${i + 1}`).toUpperCase(),
    sku: (skus[i] || skus[0] || "").toUpperCase(),
    quantity: Math.max(0, parseInt(qtys[i] || "0", 10) || 0),
    finalSellingPrice: Math.max(0, parseFloat(sellingPrices[i] || "0") || 0),
    imageUrl: imgs[i] || "",
    technicalSpecification: techSpecs[i] || "",
    packagingDetails: packaging[i] || "",
    factoryDetails: factory[i] || "",
    url: "",
    leadTime: leadTimes[i] || leadTimes[0] || "",
  })).filter((p) => p.sku.trim().length > 0);
}
function escapeHtmlSpf(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatSpfTechSpecToHtml(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return '<span style="color:#9ca3af;font-style:italic;">No specifications provided.</span>';
  const normalised = text.replace(/\s*\|\|\s*([^|@~]+~~)/g, "@@$1");
  const groups = normalised.split("@@").map((g) => g.trim()).filter(Boolean);
  const out: string[] = [];
  for (const g of groups) {
    const [groupTitleRaw, ...rest] = g.split("~~");
    const groupTitle = escapeHtmlSpf((groupTitleRaw || "").trim());
    const body = rest.join("~~").trim();
    const lines = body.split(";;").map((l) => l.trim()).filter(Boolean);
    out.push(`<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">${groupTitle || "SPECIFICATIONS"}</div>`);
    if (lines.length === 0) continue;
    out.push(`<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`);
    for (const line of lines) {
      const idx = line.indexOf(":");
      const name = escapeHtmlSpf((idx >= 0 ? line.slice(0, idx) : line).trim());
      const value = escapeHtmlSpf((idx >= 0 ? line.slice(idx + 1) : "").trim());
      out.push(`<tr><td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>${name}</strong></td><td style="border:1px solid #e5e7eb;padding:4px">${value}</td></tr>`);
    }
    out.push(`</table>`);
  }
  return out.join("\n");
}
function formatProcurementLeadHtml(lead: string): string {
  const t = (lead || "").trim();
  if (!t) return "";
  return `<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">Procurement</div><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px"><tr><td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>Project lead time</strong></td><td style="border:1px solid #e5e7eb;padding:4px">${escapeHtmlSpf(t)}</td></tr></table>`;
}

interface Product {
  id: string;
  title: string;
  description?: string;
  images?: { src: string }[];
  skus?: string[];
  price?: string;
  remarks?: string;
}

interface RevisedQuotation {
  id: number;
  quotation_number?: string;
  product_title?: string;
  quotation_amount?: number;
  version: string;
  start_date?: string | Date;
  end_date?: string | Date;
  products?: Product[];
  product_description: string;
  product_quantity: string;
  product_amount: string;
  product_photo: string;
  product_sku: string;
  item_remarks: string;
}

interface TaskListEditDialogProps {
  item: Completed;
  onClose: () => void;
  onSave: () => void;
  company?: {
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
  tsmemail?: string;
  tsmcontact?: string;
  managername?: string;
  activity_reference_number?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
  company_name?: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;
  address?: string;
  quotation_number?: string;
  vatType?: string;
  deliveryFee?: string;
  restockingFee?: string;
  whtType?: string;
  quotationSubject?: string;
  agentSignature?: string;
  agentContactNumber?: string;
  agentEmailAddress?: string;
  TsmSignature?: string;
  TsmEmailAddress?: string;
  TsmContactNumber?: string;
  ManagerSignature?: string;
  ManagerContactNumber?: string;
  ManagerEmailAddress?: string;
  ApprovedStatus?: string;
  /**
   * When set by the notification bell:
   *   "preview"  → auto-open the Review Quotation modal (same as clicking the black button)
   *   "download" → auto-trigger the jsPDF download (same as clicking the yellow PDF button)
   * When null / undefined → normal manual open, no auto-action.
   */
  autoAction?: "preview" | "download" | null;
}

export default function TaskListEditDialog({
  item,
  onClose,
  onSave,
  company,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  tsmemail,
  tsmcontact,
  managername,
  vatType,
  deliveryFee,
  restockingFee,
  whtType,
  quotationSubject,
  agentSignature,
  agentContactNumber,
  agentEmailAddress,
  TsmSignature,
  TsmContactNumber,
  TsmEmailAddress,
  ManagerSignature,
  ManagerContactNumber,
  ManagerEmailAddress,
  ApprovedStatus,
  autoAction,
}: TaskListEditDialogProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [previewStates, setPreviewStates] = useState<boolean[]>([]);
  const [quotationAmount, setQuotationAmount] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isManualEntry, setIsManualEntry] = useState<boolean>(false);

  const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
  const [hasDeleted, setHasDeleted] = useState(false);
  const [discount, setDiscount] = React.useState(0);
  const initialVatType: "vat_inc" | "vat_exe" | "zero_rated" =
    vatType === "vat_inc" || vatType === "vat_exe" || vatType === "zero_rated"
      ? vatType
      : "zero_rated";

  const [vatTypeState, setVatTypeState] = React.useState<
    "vat_inc" | "vat_exe" | "zero_rated"
  >(initialVatType);
  const [deliveryFeeState, setDeliveryFeeState] = useState<string>(
    deliveryFee ?? "",
  );
  const [restockingFeeState, setRestockingFeeState] = useState<string>(
    restockingFee ?? "",
  );
  const [whtTypeState, setWhtTypeState] = useState<string>(
    whtType ?? "none",
  );
  const [quotationSubjectState, setQuotationSubjectState] = useState<string>(
    quotationSubject ?? "For Quotation",
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedRevisedQuotation, setSelectedRevisedQuotation] =
    useState<RevisedQuotation | null>(null);
  const [revisedQuotations, setRevisedQuotations] = useState<
    RevisedQuotation[]
  >([]);

  const activityReferenceNumber = item.activity_reference_number;

  const [startDate, setStartDate] = useState<string>(() =>
    new Date().toISOString(),
  );
  const [liveTime, setLiveTime] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<string>(() =>
    new Date().toISOString(),
  );

  const [productSource, setProductSource] = useState<
    "shopify" | "firebase_shopify" | "firebase_taskflow"
  >("shopify");
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
  const [mobilePanelTab, setMobilePanelTab] = useState<"search" | "products">("search");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const deleteCloudinaryImage = async (publicId: string) => {
    if (!publicId) return;
    try {
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: publicId }),
      });
    } catch (err) {
      console.error("Failed to delete Cloudinary image:", err);
    }
  };
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [openDescription, setOpenDescription] = useState<
    Record<number, boolean>
  >({});

  // Tracks whether the autoAction has already been fired for this dialog instance
  const autoActionFiredRef = useRef(false);

  const hasSPF = products.some((p: ProductItem) =>
    p.product_sku?.toUpperCase().includes("SPF")
  );

  useEffect(() => {
    const now = new Date();
    setStartDate(now.toISOString());
  }, []);

  useEffect(() => {
    let baseTime = liveTime;
    let secondsPassed = 0;
    const interval = setInterval(() => {
      secondsPassed++;
      const newLiveTime = new Date(baseTime.getTime() + secondsPassed * 1000);
      setLiveTime(newLiveTime);
      setEndDate(newLiveTime.toISOString());
    }, 1000);
    return () => clearInterval(interval);
  }, [liveTime]);

  const company_name = company?.company_name || "";
  const contact_number = company?.contact_number || "";
  const quotation_type = item.quotation_type;
  const quotationNumber = item.quotation_number || "";
  const quotationAmountNum = quotationAmount;
  const productQuantity = item.product_quantity || "";
  const productAmount = item.product_amount || "";
  const productPhoto = item.product_photo || "";
  const productTitle = item.product_title || "";
  const productSku = item.product_sku || "";
  const productDescription = item.product_description || "";
  const itemRemarks = item.item_remarks || "";
  const address = company?.address || "";
  const email_address = company?.email_address || "";
  const contact_person = company?.contact_person || "";
  const quotation_number = quotationNumber;
  const activityRef = "";
  const formattedDate = new Date().toLocaleDateString();

  useEffect(() => {
    const quantities = splitAndTrim(item.product_quantity);
    const amounts = splitAndTrim(item.product_amount);
    const titles = splitAndTrim(item.product_title);
    const descriptions = splitDescription(item.product_description);
    const photos = splitAndTrim(item.product_photo);
    const sku = splitAndTrim(item.product_sku);
    const remarks = splitAndTrim(item.item_remarks);

    const maxLen = Math.max(
      quantities.length,
      amounts.length,
      titles.length,
      descriptions.length,
      photos.length,
      sku.length,
      remarks.length,
    );

    // Parse lead time out of saved description HTML
    const parseLeadTime = (desc: string): string => {
      const match = desc.match(/Project lead time<\/strong><\/td><td[^>]*>([^<]+)/);
      return match?.[1]?.trim() ?? "";
    };

    // Detect SPF1 product by presence of procurement block in description
    const isSpf1Desc = (desc: string): boolean =>
      desc.includes("Project lead time") || desc.includes(">Procurement<");

    const arr: ProductItem[] = [];
    for (let i = 0; i < maxLen; i++) {
      const desc = descriptions[i] ?? "";
      const qty = quantities[i] ?? "";
      const amt = amounts[i] ?? "";
      const leadTime = parseLeadTime(desc);
      const isSpf1 = isSpf1Desc(desc);

      arr.push({
        product_quantity: qty,
        product_amount: amt,
        product_title: titles[i] ?? "",
        product_description: desc,
        product_photo: photos[i] ?? "",
        product_sku: sku[i] ?? "",
        item_remarks: remarks[i] ?? "",
        quantity: parseFloat(qty) || 0,
        description: desc,
        skus: sku[i] ? [sku[i]] : undefined,
        title: titles[i] ?? "",
        images: photos[i] ? [{ src: photos[i] }] : undefined,
        isDiscounted: false,
        price: parseFloat(amt) || 0,
        procurementLeadTime: leadTime || undefined,
        procurementMinQty: isSpf1 ? (parseFloat(qty) || undefined) : undefined,
        procurementLockedPrice: isSpf1 ? true : undefined,
      });
    }
    setProducts(arr);
  }, [item]);

  useEffect(() => {
    setPreviewStates(products.map(() => true));
  }, [products]);

  // ── Auto-action: fire once products have loaded ───────────────────────────
  // "preview"  → open the Review Quotation modal (setIsPreviewOpen(true))
  // "download" → call DownloadPDF() — identical to clicking the yellow button
  useEffect(() => {
    if (!autoAction) return;
    if (autoActionFiredRef.current) return;
    if (products.length === 0) return; // wait until products are ready

    autoActionFiredRef.current = true;

    if (autoAction === "preview") {
      // Small delay so the dialog has finished its paint cycle
      const t = setTimeout(() => setIsPreviewOpen(true), 150);
      return () => clearTimeout(t);
    }

    if (autoAction === "download") {
      const t = setTimeout(() => DownloadPDF(), 150);
      return () => clearTimeout(t);
    }
  }, [autoAction, products]);

  useEffect(() => {
    let total = 0;
    products.forEach((p, idx) => {
      const qty = parseFloat(p.product_quantity ?? "0") || 0;
      const amt = parseFloat(p.product_amount ?? "0") || 0;
      let lineTotal = qty * amt;
      if (checkedRows[idx] && vatType === "vat_inc") {
        lineTotal = lineTotal * ((100 - discount) / 100);
      }
      total += lineTotal;
    });
    setQuotationAmount(total);
  }, [products, checkedRows, discount, vatType]);

  const handleProductChange = (
    index: number,
    field: keyof ProductItem,
    value: string,
  ) => {
    setProducts((prev) => {
      const newProducts = [...prev];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return newProducts;
    });
  };

  // ── SPF 1: fetch approved SPF records when SPF1 panel is opened ────────────
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
        if (item.referenceid?.trim()) {
          q = q.eq("referenceid", item.referenceid.trim());
        }
        const { data, error } = await q.order("date_created", { ascending: false });
        if (error) throw error;
        if (!cancelled) setSpf1Records((data || []) as unknown as SpfCreationRow[]);
      } catch (err: any) {
        if (!cancelled) setSpf1Error(err?.message || "Failed to load SPF 1 records.");
      } finally {
        if (!cancelled) setSpf1Loading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSpf1Mode, item.referenceid]);

  const handleRemoveRow = (index: number) => {
    setProducts((prev) => {
      const n = [...prev];
      n.splice(index, 1);
      setHasDeleted(true);
      return n;
    });
    setPreviewStates((prev) => {
      const n = [...prev];
      n.splice(index, 1);
      return n;
    });
  };

  function serializeArrayFixed(arr: (string | undefined | null)[]): string {
    return arr.map((v) => v ?? "").join(",");
  }

  const performSave = async () => {
    try {
      const product_quantity = serializeArrayFixed(
        products.map((p) => p.product_quantity),
      );
      const product_amount = serializeArrayFixed(
        products.map((p) => p.product_amount),
      );
      const product_title = serializeArrayFixed(
        products.map((p) => p.product_title),
      );
      const item_remarks = serializeArrayFixed(
        products.map((p) => p.item_remarks),
      );
      const product_description = products
        .map((p) =>
          p.description?.trim() ? p.description : p.product_description || "",
        )
        .join(" || ");
      const product_photo = serializeArrayFixed(
        products.map((p) => p.product_photo),
      );
      const product_sku = serializeArrayFixed(
        products.map((p) => p.product_sku),
      );
      const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
      const restockingFeeNum = parseFloat(restockingFeeState) || 0;
      const totalQuotationAmount = (quotationAmount || 0) + deliveryFeeNum + restockingFeeNum;

      const bodyData: Completed & {
        vat_type?: "vat_inc" | "vat_exe" | "zero_rated";
      } = {
        id: item.id,
        product_quantity,
        product_amount,
        product_title,
        product_description,
        product_photo,
        product_sku,
        item_remarks,
        quotation_amount: totalQuotationAmount,
        quotation_type: item.quotation_type,
        quotation_number: item.quotation_number,
        vat_type: vatTypeState,
        delivery_fee: deliveryFeeState,
        restocking_fee: restockingFeeState,
        quotation_vatable: whtTypeState,
        quotation_subject: quotationSubjectState,
        activity_reference_number: item.activity_reference_number,
        referenceid: item.referenceid,
        tsm: item.tsm,
        manager: item.manager,
        company_name: item.company_name,
        contact_person: item.contact_person,
        contact_number: item.contact_number,
        email_address: item.email_address,
        address: item.address,
        start_date: startDate,
        end_date: endDate,
      };

      const res = await fetch(`/api/act-update-history?id=${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      if (!res.ok) throw new Error("Failed to update activity");
      sileo.success({
        title: "Succeess",
        description: "Activity updated successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onSave();
      setShowConfirmDialog(false);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Update failed! Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const onClickSave = () => setShowConfirmDialog(true);

  const getQuotationPayload = () => {
    const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
    const emailUsername = email?.split("@")[0] ?? "";

    let emailDomain = "";
    if (quotation_type === "Disruptive Solutions Inc")
      emailDomain = "disruptivesolutionsinc.com";
    else if (quotation_type === "Ecoshift Corporation")
      emailDomain = "ecoshiftcorp.com";
    else emailDomain = email?.split("@")[1] ?? "";
    const salesemail =
      emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

    const items = products.map((p: ProductItem, index: number) => {
      const qty = parseFloat(p.product_quantity ?? "0") || 0;
      const unitPrice = parseFloat(p.product_amount ?? "0") || 0;
      const isDiscounted = checkedRows[index] ?? false;
      const rowDiscount = isDiscounted ? (p.discount ?? (vatTypeState === "vat_exe" ? 12 : 0)) : 0;
      const baseAmount = qty * unitPrice;
      const discountedAmount = isDiscounted && rowDiscount > 0 ? (baseAmount * rowDiscount) / 100 : 0;
      const totalAmount = baseAmount - discountedAmount;

      return {
        itemNo: index + 1,
        qty,
        photo: p.product_photo ?? p.images?.[0]?.src ?? "",
        title: p.product_title ?? "",
        sku: p.product_sku ?? p.skus?.[0] ?? "",
        itemRemarks: p.item_remarks ?? "",
        product_description: p.description?.trim()
          ? p.description
          : p.product_description || "",
        unitPrice,
        discount: rowDiscount,
        totalAmount,
        isSpf1: !!(p.procurementLockedPrice || p.procurementLeadTime || (() => {
          const rawD = p.product_description || p.description || "";
          return rawD.includes("Project lead time");
        })()),
        procurementLeadTime: (() => {
          if (p.procurementLeadTime) return p.procurementLeadTime;
          const rawD = p.product_description || p.description || "";
          const m = rawD.match(/Project lead time<\/strong><\/td><td[^>]*>([^<]+)/);
          return m?.[1]?.trim() ?? "";
        })(),
        remarks: p.item_remarks ?? "",
      };
    });

    const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
    const restockingFeeNum = parseFloat(restockingFeeState) || 0;
    const totalPriceWithDelivery = (quotationAmount || 0) + deliveryFeeNum + restockingFeeNum;

    return {
      referenceNo: quotationNumber ?? "DRAFT-XXXX",
      date: new Date().toLocaleDateString(),
      companyName: company_name ?? "",
      address: address ?? "",
      telNo: contact_number ?? "",
      email: email_address ?? "",
      attention: contact_person ?? "",
      subject: quotationSubjectState || "For Quotation",
      items,
      vatTypeLabel:
        vatType === "vat_inc"
          ? "VAT Inc"
          : vatType === "vat_exe"
            ? "VAT Exe"
            : "Zero-Rated",
      totalPrice: totalPriceWithDelivery,
      salesRepresentative: salesRepresentativeName,
      salesemail,
      salescontact: contact ?? "",
      salestsmname: tsmname || "—",
      salestsmemail: tsmemail ?? "",
      salestsmcontact: tsmcontact ?? "",
      salesmanagername: managername || "—",
      vatType: vatTypeState ?? null,
      deliveryFee: deliveryFeeState ?? "",
      restockingFee: parseFloat(restockingFeeState) || 0,
      whtType: whtTypeState ?? "none",
      whtLabel:
        whtTypeState === "wht_1" ? "EWT 1% (Goods)" :
          whtTypeState === "wht_2" ? "EWT 2% (Services)" : "None",
      whtBase: vatTypeState === "vat_inc"
        ? totalPriceWithDelivery / 1.12
        : totalPriceWithDelivery,
      whtAmount:
        whtTypeState !== "none"
          ? (totalPriceWithDelivery / 1.12) * (whtTypeState === "wht_1" ? 0.01 : 0.02)
          : 0,
      netAmountToCollect:
        totalPriceWithDelivery - (
          whtTypeState !== "none"
            ? (totalPriceWithDelivery / 1.12) * (whtTypeState === "wht_1" ? 0.01 : 0.02)
            : 0
        ),
      agentSignature: agentSignature ?? null,
      agentContactNumber: agentContactNumber ?? null,
      agentEmailAddress: agentEmailAddress ?? null,
      TsmSignature: TsmSignature ?? null,
      TsmEmailAddress: TsmEmailAddress ?? null,
      TsmContactNumber: TsmContactNumber ?? null,
      ManagerSignature: ManagerSignature ?? null,
      ManagerContactNumber: ManagerContactNumber ?? null,
      ManagerEmailAddress: ManagerEmailAddress ?? null,
    };
  };

  const DownloadExcel = async () => {
    const productCats = productTitle.split(",");
    const quantities = productQuantity ? productQuantity.split(",") : [];
    const amounts = productAmount ? productAmount.split(",") : [];
    const photos = productPhoto ? productPhoto.split(",") : [];
    const titles = productTitle ? productTitle.split(",") : [];
    const skus = productSku ? productSku.split(",") : [];
    const descriptions = productDescription
      ? productDescription.split("||")
      : [];
    const remarks = itemRemarks ? itemRemarks.split(",") : [];

    const salesRepresentativeName = `${firstname} ${lastname}`;
    const emailUsername = email?.split("@")[0] || "";
    let emailDomain = "";
    if (company_name === "Disruptive Solutions Inc")
      emailDomain = "disruptivesolutionsinc.com";
    else if (company_name === "Ecoshift Corporation")
      emailDomain = "ecoshiftcorp.com";
    else emailDomain = email?.split("@")[1] || "";

    const items = productCats.map((_, index) => {
      const qty = Number(quantities[index] || 0);
      const amount = Number(amounts[index] || 0);
      const photo = photos[index] || "";
      const title = titles[index] || "";
      const sku = skus[index] || "";
      const description = descriptions[index] || "";
      const descriptionTable = `<table><tr><td>${title}</td></tr><tr><td>${sku}</td></tr><tr><td>${description}</td></tr></table>`;
      return {
        itemNo: index + 1,
        qty,
        referencePhoto: photo,
        description: descriptionTable,
        unitPrice: qty > 0 ? amount / qty : 0,
        totalAmount: amount,
      };
    });

    const quotationData = {
      referenceNo: quotationNumber || activityRef,
      date: formattedDate,
      companyName: company_name,
      address,
      telNo: contact_number,
      email: email_address,
      attention: contact_person,
      subject: quotationSubjectState || "For Quotation",
      items,
      vatType: "Vat Inc",
      totalPrice: Number(quotationAmountNum),
      salesRepresentative: salesRepresentativeName,
      salesemail: `${emailUsername}@${emailDomain}`,
      salescontact: contact || "",
      salestsmname: tsmname || "",
      salesmanagername: managername || "",
    };

    let apiEndpoint = "/api/quotation/disruptive";
    if (quotation_type === "Ecoshift Corporation")
      apiEndpoint = "/api/quotation/ecoshift";
    else if (quotation_type === "Disruptive Solutions Inc")
      apiEndpoint = "/api/quotation/disruptive";

    try {
      const resExport = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationData),
      });
      if (!resExport.ok) {
        sileo.error({
          title: "Failed",
          description: "Failed to export quotation.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }
      const blob = await resExport.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quotation_${quotationNumber || item.id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Export failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const handleAddProduct = (product: Product) => {
    setProducts((prev) => [
      ...prev,
      {
        product_quantity: "1",
        product_amount: product.price || "0",
        product_title: product.title,
        product_description: product.description || "",
        product_photo: product.images?.[0]?.src || "",
        product_sku: product.skus?.[0] || "",
        description: product.description || "",
        item_remarks: product.remarks || "",
        skus: product.skus || [],
        title: product.title || "",
        images: product.images || [],
        isDiscounted: false,
        discount: 0,
        price: parseFloat(product.price || "0") || 0,
        quantity: 1,
      },
    ]);
    setSearchTerm("");
    setSearchResults([]);
    setMobilePanelTab("products");
  };

  useEffect(() => {
    if (!selectedRevisedQuotation) return;
    let productsArray = selectedRevisedQuotation.products;
    if (typeof productsArray === "string") {
      try {
        productsArray = JSON.parse(productsArray);
      } catch {
        productsArray = [];
      }
    }
    if (Array.isArray(productsArray) && productsArray.length > 0) {
      setProducts(
        productsArray.map((p) => ({
          description: p.description || "",
          skus: p.skus || [],
          title: p.title,
          images: p.images || [],
          isDiscounted: false,
          price: p.price ? parseFloat(p.price) : 0,
          quantity: 1,
          product_quantity: "1",
          product_amount: p.price ? p.price.toString() : "0",
          product_description: p.description || "",
          product_photo: p.images?.[0]?.src || "",
          product_title: p.title,
          product_sku: p.skus?.[0] || "",
          item_remarks: p.remarks?.[0] || "",
        })),
      );
    } else {
      const quantities = splitAndTrim(
        selectedRevisedQuotation.product_quantity,
      );
      const amounts = splitAndTrim(selectedRevisedQuotation.product_amount);
      const titles = splitAndTrim(selectedRevisedQuotation.product_title);
      const descriptions = splitDescription(
        selectedRevisedQuotation.product_description,
      );
      const photos = splitAndTrim(selectedRevisedQuotation.product_photo);
      const sku = splitAndTrim(selectedRevisedQuotation.product_sku);
      const remarks = splitAndTrim(selectedRevisedQuotation.item_remarks);
      const maxLen = Math.max(
        quantities.length,
        amounts.length,
        titles.length,
        descriptions.length,
        photos.length,
        sku.length,
        remarks.length,
      );
      const arr: ProductItem[] = [];
      for (let i = 0; i < maxLen; i++) {
        arr.push({
          product_quantity: quantities[i] ?? "",
          product_amount: amounts[i] ?? "",
          product_title: titles[i] ?? "",
          product_description: descriptions[i] ?? "",
          product_photo: photos[i] ?? "",
          product_sku: sku[i] ?? "",
          item_remarks: remarks[i] ?? "",
          quantity: 0,
          description: "",
          skus: [],
          title: "",
          images: [],
          isDiscounted: false,
          price: 0,
        });
      }
      setProducts(arr);
    }
  }, [selectedRevisedQuotation]);

  useEffect(() => {
    if (!activityReferenceNumber) return;
    const fetch_ = async () => {
      const { data, error } = await supabase
        .from("revised_quotations")
        .select("*")
        .eq("activity_reference_number", activityReferenceNumber)
        .order("id", { ascending: false });
      if (!error) setRevisedQuotations(data || []);
    };
    fetch_();
  }, [activityReferenceNumber]);

  const payload = getQuotationPayload();
  const isEcoshift = quotation_type === "Ecoshift Corporation";
  const headerImagePath = isEcoshift
    ? "/ecoshift-banner.png"
    : "/disruptive-banner.png";

  // ── PDF Security helpers ───────────────────────────────────────────────────

  /** Simple non-crypto hash for anti-tamper fingerprint (visible in QR) */
  const buildSecurityToken = (referenceNo: string, date: string, total: number): string => {
    const raw = `${referenceNo}|${date}|${total.toFixed(2)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `${raw}|VER:${hex}`;
  };

  /** Generate a QR code as a base64 PNG data URL using the qrcode library */
  const generateQrDataUrl = async (text: string): Promise<string | null> => {
    try {
      const QRCode = await import("qrcode");
      return await QRCode.toDataURL(text, {
        width: 96,
        margin: 1,
        color: { dark: "#121212", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    } catch {
      return null;
    }
  };

  /** Stamp diagonal watermark text across the current jsPDF page */
  const stampPdfWatermark = (
    pdf: any,
    companyLabel: string,
    referenceNo: string,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    pdf.saveGraphicsState();
    // Use 0.06 to match preview precisely
    const gState = new (pdf as any).GState({ opacity: 0.06 });
    pdf.setGState(gState);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(18, 18, 18);
    const line = `${companyLabel}  ·  OFFICIAL QUOTATION  ·  ${referenceNo}`;

    // stepX matches pattern width 800
    // stepY is 75 to match 2 rows per 150 height pattern
    const stepX = 800;
    const stepY = 75;
    const angle = 25;

    let rowIdx = 0;
    for (let y = -400; y < pdfHeight + 400; y += stepY) {
      // Stagger by 400 (half of stepX) every other row
      const offset = (rowIdx % 2 === 0) ? 0 : 400;
      for (let x = -1000 + offset; x < pdfWidth + 1000; x += stepX) {
        pdf.text(line, x, y, { angle: angle });
      }
      rowIdx++;
    }
    pdf.restoreGraphicsState();
  };

  /** Stamp the QR code + security footer at the bottom of each PDF page */
  const stampPdfSecurityFooter = (
    pdf: any,
    qrDataUrl: string | null,
    referenceNo: string,
    issuedAt: string,
    pageNum: number,
    totalPages: number,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    const footerY = pdfHeight - 32;
    // Thin rule
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(20, footerY - 4, pdfWidth - 20, footerY - 4);

    // QR code (bottom-right)
    if (qrDataUrl) {
      pdf.addImage(qrDataUrl, "PNG", pdfWidth - 60, footerY - 22, 40, 40);
    }

    // Footer text (bottom-left / centre)
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`REF: ${referenceNo}`, 20, footerY + 4);
    pdf.text(`ISSUED: ${issuedAt}`, 20, footerY + 12);
    pdf.text(`This document is only valid when downloaded from Taskflow.`, 20, footerY + 20);
    // Page counter (centre-bottom)
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pdfWidth / 2, footerY + 14, { align: "center" });
  };

  const DownloadPDF = async () => {
    if (typeof window === "undefined") return;
    const PRIMARY_CHARCOAL = "#121212";
    const OFF_WHITE = "#F9FAFA";
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const payload = getQuotationPayload();
      const isEcoshift = quotation_type === "Ecoshift Corporation";

      // ── Build security artefacts BEFORE rendering ────────────────────────
      const issuedAt = new Date().toISOString();
      const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

      // Security Token Generation (must match verify page logic)
      const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
      const generateToken = (ref: string, total: string) => {
        const raw = `${ref}|${total}|${SECURITY_SALT}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const chr = raw.charCodeAt(i);
          hash = (hash << 5) - hash + chr;
          hash |= 0;
        }
        return Math.abs(hash).toString(36).toUpperCase();
      };

      const totalStr = payload.totalPrice.toFixed(2);
      const token = generateToken(payload.referenceNo, totalStr);
      const verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;

      const qrDataUrl = await generateQrDataUrl(verificationUrl);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [612, 936],
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      // Reserve 50pt at the bottom for the security footer strip
      const BOTTOM_MARGIN = 50;

      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        position: "fixed",
        right: "1000%",
        width: "816px",
        visibility: "hidden",
      });
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Initialization Failed");

      iframeDoc.open();
      iframeDoc.write(`
          <html>
            <head>
            <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: white; width: 816px; color: ${PRIMARY_CHARCOAL}; overflow: hidden; font-size: 10px; line-height: 1.4; }
            .header-img { width: 100%; display: block; }
            .content-area { padding: 0 50px; margin: 0; box-sizing: border-box; }
            /* CLIENT GRID */
            .client-grid { border: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: stretch; border-bottom: 1px solid #e5e7eb; }
            .grid-row:last-child { border-bottom: none; }
            .label { width: 130px; font-weight: 900; font-size: 9px; flex-shrink: 0; padding: 4px 10px; background: #f3f4f6; border-right: 1px solid #d1d5db; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.02em; }
            .value { flex-grow: 1; font-size: 9.5px; font-weight: 600; color: #1f2937; padding: 4px 10px; text-transform: uppercase; display: flex; align-items: center; }
            .intro-text { font-size: 9px; font-style: italic; color: #6b7280; font-weight: 400; padding: 5px 0 3px 0; }
            /* PRODUCT TABLE */
            .table-container { border: 1.5px solid black; border-bottom: none; background: white; margin: 0; }
            .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
            .main-table th { padding: 6px 8px; font-size: 8.5px; font-weight: 900; color: white; background: ${PRIMARY_CHARCOAL}; text-transform: uppercase; border-right: 1px solid #374151; letter-spacing: 0.04em; }
            .main-table th:last-child { border-right: none; }
            .main-table td { padding: 8px; vertical-align: top; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; font-size: 9px; }
            .main-table td:last-child { border-right: none; }
            .item-no { color: #9ca3af; font-weight: 700; text-align: center; font-size: 11px; vertical-align: middle; }
            .qty-col { font-weight: 900; text-align: center; font-size: 12px; color: ${PRIMARY_CHARCOAL}; vertical-align: middle; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 9.5px; margin: 0 0 2px 0; color: ${PRIMARY_CHARCOAL}; line-height: 1.3; }
            .sku-text { color: #2563eb; font-weight: 700; font-size: 8px; margin: 0 0 4px 0; }
            .desc-text { font-size: 8px; color: #374151; line-height: 1.3; margin: 0; }
            .desc-remarks { background: #fed7aa; padding: 2px 5px; text-transform: uppercase; color: #7c2d12; display: inline-block; font-weight: 900; font-size: 7.5px; margin-top: 3px; }
            .price-col { font-size: 9.5px; font-weight: 600; text-align: right; color: #374151; vertical-align: middle; }
            .total-col { font-size: 9.5px; font-weight: 900; text-align: right; color: ${PRIMARY_CHARCOAL}; vertical-align: middle; }
            /* LOGISTICS */
            .variance-footnote { margin-top: 12px; font-size: 9.5px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid black; padding-bottom: 3px; }
            .logistics-container { margin-top: 10px; border: 1.5px solid black; font-size: 9px; line-height: 1.4; }
            .logistics-row { display: flex; border-bottom: 1px solid #d1d5db; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 85px; padding: 7px 8px; font-weight: 900; font-size: 8.5px; border-right: 1px solid #d1d5db; flex-shrink: 0; text-transform: uppercase; }
            .logistics-value { padding: 7px 10px; flex-grow: 1; font-size: 8.5px; }
            .logistics-value p { margin: 0 0 3px 0; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 3px; text-decoration: underline; }
            /* TERMS */
            .terms-section { margin-top: 14px; border-top: 2px solid black; padding-top: 8px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 3px 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 8px; letter-spacing: 0.05em; }
            .terms-grid { display: grid; grid-template-columns: 105px 1fr; gap: 0; font-size: 8.5px; line-height: 1.45; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 4px; font-size: 8.5px; }
            .terms-val { padding: 4px 6px; font-size: 8.5px; }
            .terms-val p { margin: 0 0 2px 0; }
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; font-size: 8.5px; line-height: 1.5; }
            /* SUMMARY */
            .tax-options { display: flex; gap: 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
            .tax-active { color: ${PRIMARY_CHARCOAL}; font-weight: 900; }
            .tax-inactive { color: #c0c5cf; }
            .summary-wrap { display: table; width: 100%; border-collapse: collapse; border-top: 2px solid black; }
            .summary-left { display: table-cell; width: 48%; border-right: 2px solid black; padding: 10px 14px; vertical-align: top; }
            .summary-right { display: table-cell; width: 52%; vertical-align: top; padding: 0; }
            .summary-tax-title { color: #e60b0d; font-style: italic; font-weight: 900; font-size: 10px; text-transform: uppercase; margin-bottom: 5px; }
            .summary-wht { display: inline-block; background: #dbeafe; color: #1e40af; font-size: 8px; font-weight: 900; padding: 2px 7px; margin-top: 5px; text-transform: uppercase; }
            .sum-tbl { width: 100%; border-collapse: collapse; }
            .sum-tbl td { padding: 3.5px 10px; }
            .sum-lbl { text-align: right; font-weight: 700; text-transform: uppercase; color: #6b7280; font-size: 7.5px; border-right: 2px solid black; white-space: nowrap; }
            .sum-val { text-align: right; font-weight: 900; color: ${PRIMARY_CHARCOAL}; font-size: 9px; white-space: nowrap; min-width: 90px; }
            .sum-divider td { border-bottom: 2px solid black; }
            .sum-total-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 9px; border-right: 2px solid black; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; }
            .sum-total-val { text-align: right; font-weight: 900; color: #1e3a8a; font-size: 12px; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; min-width: 90px; }
            .sum-gray-lbl { text-align: right; font-weight: 600; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #9ca3af; padding: 3px 10px; white-space: nowrap; }
            .sum-gray-val { text-align: right; font-weight: 600; color: #9ca3af; font-size: 8px; padding: 3px 10px; white-space: nowrap; }
            .sum-ewt-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #1d4ed8; background: #eff6ff; padding: 4px 10px; white-space: nowrap; }
            .sum-ewt-val { text-align: right; font-weight: 900; color: #1d4ed8; background: #eff6ff; font-size: 8.5px; padding: 4px 10px; white-space: nowrap; }
            .sum-final-row { background: ${PRIMARY_CHARCOAL}; }
            .sum-final-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 8.5px; border-right: 1px solid #374151; color: white; padding: 7px 10px; white-space: nowrap; }
            .sum-final-val { text-align: right; font-weight: 900; font-size: 14px; color: white; padding: 7px 10px; white-space: nowrap; }
            /* SIGNATURE */
            .sig-hierarchy { margin-top: 14px; padding-top: 12px; border-top: 3px solid #1d4ed8; padding-bottom: 16px; }
            .sig-message { font-size: 8.5px; margin-bottom: 18px; font-weight: 400; line-height: 1.5; color: #374151; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 18px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 24px; }
            .sig-line { border-bottom: 1px solid black; width: 230px; }
            .sig-sub-label { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
            .sig-italic { font-size: 9px; font-style: italic; font-weight: 700; margin-bottom: 18px; color: ${PRIMARY_CHARCOAL}; }
            .sig-name { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin: 0 0 0 0; }
            .sig-detail { font-size: 8.5px; font-style: italic; margin: 1px 0; color: #374151; }
            .sig-approved-label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 18px; letter-spacing: 0.03em; }
            .sig-client-label { font-size: 8px; font-weight: 900; text-transform: uppercase; text-align: center; margin-top: 3px; }
            .sig-client-sub { font-size: 7.5px; font-weight: 600; text-transform: uppercase; text-align: center; margin-top: 1px; color: #6b7280; }
            </style></head><body></body></html>`);
      iframeDoc.close();

      const renderBlock = async (html: string) => {
        iframeDoc.body.innerHTML = html;
        const images = iframeDoc.querySelectorAll("img");
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }),
        );
        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        });
        return {
          img: canvas.toDataURL("image/jpeg", 0.90),
          h: (canvas.height * pdfWidth) / canvas.width,
        };
      };

      let currentY = 0;
      let pageCount = 1;
      // totalPages will be updated retroactively after all pages are known;
      // we stamp footers at the very end in a second pass, so we track page
      // positions and stamp once complete. For simplicity, we stamp each page
      // immediately using a placeholder total that we resolve at save-time.
      // Because jsPDF can't go back to previous pages easily at arbitrary Y,
      // we use a known total-pages approach: stamp immediately and accept
      // "Page N" without a "of X" if we don't know total yet — OR we make two
      // passes. The cleanest approach for this codebase: stamp each page with
      // watermark + footer right before moving to the next page.

      const finalizeCurrentPage = () => {
        stampPdfWatermark(pdf, companyLabel, payload.referenceNo, pdfWidth, pdfHeight);
      };

      const initiateNewPage = async () => {
        const banner = await renderBlock(
          `<div style="width:100%;display:block;"><img src="${headerImagePath}" class="header-img" style="width:100%;display:block;object-fit:contain;"/><div style="width:100%;text-align:right;font-weight:900;font-size:10px;margin-top:2px;display:inline-block;padding-bottom:5px;line-height:1.2;box-sizing:border-box;padding-right:60px;">REFERENCE NO: ${payload.referenceNo}<br/>DATE: ${payload.date}</div></div>`,
        );
        pdf.addImage(banner.img, "JPEG", 0, 0, pdfWidth, banner.h);
        return banner.h;
      };

      currentY = await initiateNewPage();

      const clientBlock = await renderBlock(
        `<div class="content-area" style="padding-top:6px;"><div class="client-grid"><div class="grid-row"><div class="label">Company Name</div><div class="value">${payload.companyName}</div></div><div class="grid-row"><div class="label">Address</div><div class="value">${payload.address}</div></div><div class="grid-row"><div class="label">Tel No</div><div class="value">${payload.telNo}</div></div><div class="grid-row"><div class="label">Email Address</div><div class="value">${payload.email}</div></div><div class="grid-row" style="border-bottom:1.5px solid black;"><div class="label">Attention</div><div class="value">${payload.attention}</div></div><div class="grid-row"><div class="label">Subject</div><div class="value">${payload.subject}</div></div></div><p class="intro-text">We are pleased to offer you the following products for consideration:</p></div>`,
      );
      pdf.addImage(
        clientBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        clientBlock.h,
      );
      currentY += clientBlock.h;

      const headerBlock = await renderBlock(
        `<div class="content-area"><div class="table-container" style="border-bottom:1.5px solid black;"><table class="main-table"><thead><tr><th style="width:35px;text-align:center;">NO</th><th style="width:35px;text-align:center;">QTY</th><th style="width:105px;text-align:center;">REF. PHOTO</th><th style="text-align:left;">PRODUCT DESCRIPTION</th><th style="width:90px;text-align:right;">UNIT PRICE</th><th style="width:90px;text-align:right;">TOTAL AMOUNT</th></tr></thead></table></div></div>`,
      );
      pdf.addImage(
        headerBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        headerBlock.h,
      );
      currentY += 28;

      for (const [index, item] of payload.items.entries()) {
        const rowBlock = await renderBlock(
          `<div class="content-area"><table class="main-table" style="border:1.5px solid black;border-top:none;"><tr><td style="width:35px;" class="item-no">${index + 1}</td><td style="width:35px;" class="qty-col">${item.qty}</td><td style="width:105px;padding:8px;text-align:center;vertical-align:middle;"><img src="${item.photo}" style="mix-blend-mode:multiply;width:82px;height:82px;object-fit:contain;display:block;margin:0 auto;"></td><td style="padding:8px 10px;"><p class="product-title">${item.title}</p>${item.sku ? `<p class="sku-text">ITEM CODE: ${item.sku}</p>` : ""}${item.procurementLeadTime ? `<div style="display:inline-flex;align-items:center;gap:4px;margin:3px 0 4px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#6b7280;">Lead Time:</span><span style="font-size:9px;font-weight:700;color:#b45309;background:#fff7ed;border:1px solid #fed7aa;padding:1px 6px;">${item.procurementLeadTime}</span></div>` : ""}<div class="desc-text">${item.product_description}</div>${item.remarks ? `<div class="desc-remarks">${item.remarks}</div>` : ""}</td><td style="width:90px;" class="price-col">₱${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="width:90px;" class="total-col">₱${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></table></div>`,
        );
        if (currentY + rowBlock.h > pdfHeight - 50) {
          finalizeCurrentPage();
          pdf.addPage([612, 936]);
          pageCount++;
          currentY = await initiateNewPage();
          pdf.addImage(
            headerBlock.img,
            "JPEG",
            0,
            currentY,
            pdfWidth,
            headerBlock.h,
          );
          currentY += 28;
        }
        pdf.addImage(rowBlock.img, "JPEG", 0, currentY, pdfWidth, rowBlock.h);
        currentY += rowBlock.h;
      }

      // ✅ Helper (put above this block if possible)
      const peso = (val: any) =>
        Number(val ?? 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      const round2 = (n: any) =>
        Math.round((Number(n ?? 0)) * 100) / 100;


      // ✅ Safe numeric values
      const _deliveryNum = Number(payload.deliveryFee) || 0;
      const _restockingNum = Number(payload.restockingFee) || 0;
      const _total = Number(payload.totalPrice) || 0;

      // ✅ Calculations (rounded properly)
      const _netSales = round2(_total - _deliveryNum - _restockingNum);
      const _vatAmount = round2(_total * (12 / 112));
      const _netOfVat = round2(_total / 1.12);
      const _whtAmount = round2(payload.whtAmount || 0);

      // ✅ VAT / WHT block
      const _vatBreak =
        payload.vatTypeLabel === "VAT Inc"
          ? `
<tr>
  <td class="sum-gray-lbl">Less: VAT (12%)</td>
  <td class="sum-gray-val">₱${peso(_vatAmount)}</td>
</tr>
<tr${payload.whtType && payload.whtType !== "none" ? "" : " class='sum-divider'"}>
  <td class="sum-gray-lbl">Net of VAT (Tax Base)</td>
  <td class="sum-gray-val">₱${peso(_netOfVat)}</td>
</tr>
${payload.whtType && payload.whtType !== "none"
            ? `
<tr class="sum-divider">
  <td class="sum-ewt-lbl">Less: ${payload.whtLabel}</td>
  <td class="sum-ewt-val">− ₱${peso(_whtAmount)}</td>
</tr>`
            : ""
          }
`
          : `
<tr class="sum-divider">
  <td class="sum-gray-lbl">Tax Status</td>
  <td class="sum-gray-val" style="font-style:italic;">
    ${payload.vatTypeLabel === "VAT Exe" ? "VAT Exempt" : "Zero-Rated"}
  </td>
</tr>
`;

      // ✅ WHT badge
      const _whtBadge =
        payload.whtType && payload.whtType !== "none"
          ? `<div class="summary-wht">● ${payload.whtLabel} — on Net of VAT</div>`
          : "";

      // ✅ Final label + amount
      const _finalLbl =
        payload.whtType && payload.whtType !== "none"
          ? "Net Amount to Collect"
          : "Total Amount Due";

      const _finalAmt = peso(round2(payload.netAmountToCollect ?? _total));


      // ✅ FINAL RENDER BLOCK
      const footerBlock = await renderBlock(`
<div class="content-area" style="padding-top:0;padding-bottom:0;">
  <div class="table-container" style="border-bottom:2px solid black;">
    <div class="summary-wrap">

      <div class="summary-left">
        <div class="summary-tax-title">Tax Type:</div>

        <div class="tax-options">
          <span class="${payload.vatTypeLabel === "VAT Inc" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
          </span>
          <span class="${payload.vatTypeLabel === "VAT Exe" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
          </span>
          <span class="${payload.vatTypeLabel === "Zero-Rated" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
          </span>
        </div>

        ${_whtBadge}
      </div>

      <div class="summary-right">
        <table class="sum-tbl">

          <tr>
            <td class="sum-lbl">
              Net Sales ${payload.vatTypeLabel === "VAT Inc" ? "(VAT Inc)" : "(Non-VAT)"}
            </td>
            <td class="sum-val">₱${peso(_netSales)}</td>
          </tr>

          <tr>
            <td class="sum-lbl">Delivery Charge</td>
            <td class="sum-val">₱${peso(_deliveryNum)}</td>
          </tr>

          <tr class="sum-divider">
            <td class="sum-lbl">Restocking Fee</td>
            <td class="sum-val">₱${peso(_restockingNum)}</td>
          </tr>

          <tr>
            <td class="sum-total-lbl">Total Invoice Amount</td>
            <td class="sum-total-val">₱${peso(_total)}</td>
          </tr>

          ${_vatBreak}

          <tr class="sum-final-row">
            <td class="sum-final-lbl">${_finalLbl}</td>
            <td class="sum-final-val">₱${_finalAmt}</td>
          </tr>

        </table>
      </div>

    </div>
  </div>
</div>
`);
      if (currentY + footerBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        footerBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        footerBlock.h,
      );
      currentY += footerBlock.h;

      const logisticsBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;">
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
        <div class="logistics-value bg-yellow-note" style="font-style:italic;">
        <p>Deliveries are up to the vehicle unloading point only.</p>
        <p>Additional shipping fee applies for other areas not mentioned above.</p>
        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
        <span class="text-red-strong">
        <u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u>
        </span>
        </div>
        </div>
        </div>
        <div class="terms-section">
        <div class="terms-header">Terms and Conditions</div>
        <div class="terms-grid">
        <div class="terms-label">Availability:</div>
        <div class="terms-val terms-highlight">
        <p>*5-7 days if on stock upon receipt of approved PO.</p>
        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.</p>
        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
        </div>
        <div class="terms-label">Warranty:</div>
        <div class="terms-val terms-highlight">
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
        <div class="terms-label">SO Validity:</div>
        <div class="terms-val">
        <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b>
        </p>
        </div>
        <div class="terms-label">Storage:</div>
        <div class="terms-val terms-highlight">
        <p>Storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b>
        </p>
        </div>
        <div class="terms-label">Return:</div>
        <div class="terms-val terms-highlight">
        <p>
        <b style="color:red;"><u>7 days return policy -</u>
        </b> if the product received is defective, damaged, or incomplete.</p>
        </div>
        </div>
        </div>
        </div>`,
      );
      if (currentY + logisticsBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        logisticsBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        logisticsBlock.h,
      );
      currentY += logisticsBlock.h;

      const termsAndSigBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;"><div class="terms-grid"><div class="terms-label">Payment:</div><div class="terms-val"><p><strong style="color:red;">Cash on Delivery (COD)</strong></p><p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery.</strong></p><p><strong>BANK DETAILS</strong></p><p><b>Payee to: </b><strong>${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}</strong></p><div class="bank-grid" style="display:flex;gap:20px;"><div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</div><div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</div></div></div><div class="terms-label">DELIVERY:</div><div class="terms-val terms-highlight"><p>Delivery/Pick up is subject to confirmation.</p></div><div class="terms-label">Validity:</div><div class="terms-val"><p class="text-red-strong"><u>Thirty (30) calendar days from the date of this offer.</u></p></div><div class="terms-label">CANCELLATION:</div><div class="terms-val terms-highlight"><p>1. Above quoted items are non-cancellable.</p><p>2. Downpayment for items not in stock/indent and order/special items are non-refundable.</p><p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p></div></div><div class="sig-hierarchy"><p class="sig-message">Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p><div class="sig-grid"><div class="sig-side-internal"><div style="position:relative;min-height:85px;"><p class="sig-italic">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p><img src="${payload.agentSignature || ""}" style="position:absolute;top:28px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salesRepresentative}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Representative</p><p class="sig-detail">Mobile: ${payload.agentContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.agentEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:85px;"><p class="sig-approved-label">Approved By:</p><img src="${payload.TsmSignature || ""}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salestsmname}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Manager</p><p class="sig-detail">Mobile: ${payload.TsmContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.TsmEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:75px;"><p class="sig-approved-label">Noted By:</p><img src="${payload.ManagerSignature || ""}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salesmanagername}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales-B2B</p></div></div><div class="sig-side-client"><div style="text-align:center;"><div class="sig-line" style="margin-top:68px;width:220px;"></div><p class="sig-client-label">Company Authorized Representative</p><p class="sig-client-sub">(Please Sign Over Printed Name)</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Payment Release Date</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Position in the Company</p></div></div></div></div></div>`,
      );
      if (currentY + termsAndSigBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        termsAndSigBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        termsAndSigBlock.h,
      );

      // ── Stamp watermark + security footer on ALL pages ─────────────────────
      const totalPages = pageCount;
      const totalPagesNum = pdf.internal.pages.length - 1; // jsPDF internal
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        // Watermark already stamped on pages that triggered a page break;
        // stamp the last/only page here (all others were stamped on addPage).
        if (p === totalPages) {
          stampPdfWatermark(pdf, companyLabel, payload.referenceNo, pdfWidth, pdfHeight);
        }
        stampPdfSecurityFooter(pdf, qrDataUrl, payload.referenceNo, issuedAt, p, totalPages, pdfWidth, pdfHeight);
      }

      pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
      document.body.removeChild(iframe);
    } catch (error) {
      console.error("Critical Export Error:", error);
    }
  };

  const toggleDescription = (index: number) =>
    setOpenDescription((prev) => ({ ...prev, [index]: !prev[index] }));

  const subtotal = React.useMemo(() => {
    return products.reduce((acc, product, index) => {
      const qty = parseFloat(product.product_quantity ?? "0") || 0;
      const amt = parseFloat(product.product_amount ?? "0") || 0;
      const lineTotal = qty * amt;
      const isChecked = checkedRows[index] ?? false;
      if (isChecked) {
        const disc = product.discount ?? (vatTypeState === "vat_exe" ? 12 : 0);
        return acc + lineTotal * (1 - disc / 100);
      }
      return acc + lineTotal;
    }, 0);
  }, [products, checkedRows, vatTypeState]);

  useEffect(() => {
    setQuotationAmount(subtotal);
  }, [subtotal]);

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="h-[95vh] overflow-hidden p-0 w-full flex flex-col" style={{ maxWidth: "95vw", width: "100vw" }}>
          {/* HEADER */}
          <div className="flex flex-col border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between pl-8 pr-5 py-4 sm:pl-10 sm:pr-6">
              <DialogTitle className="font-black text-base tracking-tight">
                Edit Quotations: {item.quotation_number || item.id} — {item.quotation_type}
              </DialogTitle>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                Duration:{" "}
                <span className="font-mono bg-black text-white px-2 py-0.5 rounded text-[10px]">
                  {startDate && endDate ? (() => {
                    const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
                    if (diffMs <= 0) return "0s";
                    const s = Math.floor(diffMs / 1000) % 60;
                    const m = Math.floor(diffMs / (1000 * 60)) % 60;
                    const h = Math.floor(diffMs / (1000 * 60 * 60));
                    return `${h}h ${m}m ${s}s`;
                  })() : "N/A"}
                </span>
              </div>
            </div>
            {/* Mobile tab switcher */}
            <div className="flex lg:hidden border-t border-gray-100 text-[11px] font-bold">
              <button type="button" onClick={() => setMobilePanelTab("search")}
                className={`flex-1 py-2.5 border-b-2 transition-colors ${mobilePanelTab === "search" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}>
                🔍 Search
              </button>
              <button type="button" onClick={() => setMobilePanelTab("products")}
                className={`flex-1 py-2.5 border-b-2 transition-colors ${mobilePanelTab === "products" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}>
                🛒 Products ({products.length})
              </button>
            </div>
          </div>


          {/* BODY */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full grid gap-0 lg:gap-5 lg:pl-8 lg:pr-4 lg:py-4 p-0 overflow-y-auto grid-cols-1 lg:grid-cols-[minmax(22rem,28rem)_1fr] lg:overflow-hidden">
              {/* Left side: Search + history */}
              <div className={`flex-col gap-3 overflow-y-auto px-4 pl-5 sm:pl-6 lg:pl-2 lg:pr-3 pt-3 lg:pt-0 h-full min-w-0 ${mobilePanelTab === "products" ? "hidden lg:flex" : "flex"}`}>
                <div className="flex flex-col gap-3 sticky top-0 bg-white z-10 pb-2">
                  {/* Source Switcher with SPF + SPF 1 */}
                  <div className="grid grid-cols-5 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    {[
                      { source: "shopify", label: "Shopify", icon: "🛍️" },
                      // { source: "firebase_shopify", label: "CMS", icon: "📦" },
                      { source: "firebase_taskflow", label: "DB", icon: "🗄️" },
                    ].map(({ source: s, label, icon }) => (
                      <button key={s} type="button"
                        onClick={() => { setProductSource(s as any); setSearchTerm(""); setSearchResults([]); setIsSpfMode(false); setIsSpf1Mode(false); }}
                        className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all ${productSource === s && !isSpfMode && !isSpf1Mode ? "bg-[#121212] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                      >
                        <span className="text-sm mb-0.5">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => { setIsSpfMode(true); setIsSpf1Mode(false); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all border-l border-gray-200 ${isSpfMode ? "bg-red-600 text-white" : "bg-white text-red-500 hover:bg-red-50"}`}
                    >
                      <span className="text-sm mb-0.5">📋</span>
                      <span>SPF</span>
                    </button>
                    <button type="button"
                      onClick={() => { setIsSpf1Mode(true); setIsSpfMode(false); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all border-l border-gray-200 ${isSpf1Mode ? "bg-red-600 text-white" : "bg-white text-red-500 hover:bg-red-50"}`}
                    >
                      <span className="text-sm mb-0.5">🧾</span>
                      <span>SPF 1</span>
                    </button>
                  </div>

                  {/* SPF Manual Form / SPF1 Panel / Normal Search */}
                  {isSpfMode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SPF</span>
                        <span className="text-[9px] text-red-400 italic">— Special Product Form</span>
                      </div>
                      {/* Cloudinary Image Upload */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Image (optional)</label>
                        <div className="flex items-center gap-2">
                          <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-red-300 bg-white px-3 py-2 cursor-pointer hover:bg-red-50 transition ${spfUploading ? "opacity-50 pointer-events-none" : ""}`}>
                            <ImagePlus className="w-4 h-4 text-red-400" />
                            <span className="text-[10px] font-bold uppercase text-red-500">
                              {spfUploading ? "Uploading..." : spfManualProduct.imageUrl ? "Change" : "Upload"}
                            </span>
                            <input type="file" accept="image/*" className="hidden" disabled={spfUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setSpfUploading(true);
                                try {
                                  if (spfManualProduct.cloudinaryPublicId) await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId);
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  const res = await fetch("/api/cloudinary/upload", { method: "POST", body: formData });
                                  const data = await res.json();
                                  if (data.url) setSpfManualProduct(prev => ({ ...prev, imageUrl: data.url, cloudinaryPublicId: data.publicId || "" }));
                                } catch (err) { console.error("Upload failed:", err); }
                                finally { setSpfUploading(false); }
                              }}
                            />
                          </label>
                          {spfManualProduct.imageUrl && (
                            <button type="button" onClick={async () => { await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId); setSpfManualProduct(prev => ({ ...prev, imageUrl: "", cloudinaryPublicId: "" })); }} className="p-1 text-red-500 hover:text-red-700">
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {spfManualProduct.imageUrl && <img src={spfManualProduct.imageUrl} alt="preview" className="w-16 h-16 object-cover border border-gray-200 mt-1 rounded-sm" />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Product Name *</label>
                        <Input type="text" placeholder="Enter product name..." value={spfManualProduct.title} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, title: e.target.value }))} className="rounded-none text-xs uppercase" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Item Code / SKU</label>
                        <Input type="text" placeholder="Enter item code..." value={spfManualProduct.sku} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, sku: e.target.value }))} className="rounded-none text-xs uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Qty</label>
                          <Input type="number" min={1} value={spfManualProduct.quantity} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} className="rounded-none text-xs" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Unit Price</label>
                          <Input type="number" min={0} step="0.01" value={spfManualProduct.price} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, price: Math.max(0, parseFloat(e.target.value) || 0) }))} className="rounded-none text-xs" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Description / Specs</label>
                        <Textarea placeholder="Enter description..." value={spfManualProduct.description} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, description: e.target.value }))} rows={3} className="rounded text-xs" />
                      </div>
                      <Button type="button" disabled={!spfManualProduct.title}
                        onClick={() => {
                          const newProduct: any = {
                            title: spfManualProduct.title.toUpperCase(),
                            product_title: spfManualProduct.title.toUpperCase(),
                            product_description: spfManualProduct.description,
                            product_sku: spfManualProduct.sku,
                            product_quantity: String(spfManualProduct.quantity),
                            product_amount: String(spfManualProduct.price),
                            product_photo: spfManualProduct.imageUrl,
                            images: spfManualProduct.imageUrl ? [{ src: spfManualProduct.imageUrl }] : [],
                            skus: spfManualProduct.sku ? [spfManualProduct.sku] : [],
                            description: spfManualProduct.description,
                            price: spfManualProduct.price,
                            quantity: spfManualProduct.quantity,
                            isDiscounted: false,
                            discount: 0,
                            cloudinaryPublicId: spfManualProduct.cloudinaryPublicId,
                          };
                          setProducts(prev => [...prev, newProduct]);
                          setSpfManualProduct({ title: "", sku: "", price: 0, quantity: 1, description: "", imageUrl: "", cloudinaryPublicId: "" });
                          setMobilePanelTab("products");
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 mt-1 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add SPF Product
                      </Button>
                    </div>
                  ) : isSpf1Mode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SPF 1</span>
                          <span className="text-[9px] text-red-400 italic">— approved SPF list</span>
                        </div>
                        {spf1Loading && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Loading…</span>
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
                        <div className="text-[11px] text-red-600 font-medium">{spf1Error}</div>
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
                                  if (spf1Selected?.id === r.id) { setSpf1Selected(null); return; }
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
                                              <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover border border-gray-200 shrink-0" />
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
                                                const newProduct: any = {
                                                  title: p.sku ? p.sku.toUpperCase() : p.title,
                                                  product_title: p.sku ? p.sku.toUpperCase() : p.title,
                                                  product_description: `${specHtml}${leadHtml}`,
                                                  description: `${specHtml}${leadHtml}`,
                                                  product_sku: p.sku || "",
                                                  product_quantity: String(Math.max(1, p.quantity)),
                                                  product_amount: String(p.finalSellingPrice),
                                                  product_photo: p.imageUrl || "",
                                                  images: p.imageUrl ? [{ src: p.imageUrl }] : [],
                                                  skus: p.sku ? [p.sku] : [],
                                                  price: p.finalSellingPrice,
                                                  quantity: Math.max(1, p.quantity),
                                                  isDiscounted: false,
                                                  discount: 0,
                                                  item_remarks: "",
                                                  procurementMinQty: p.quantity,
                                                  procurementLeadTime: p.leadTime,
                                                  procurementLockedPrice: true,
                                                };
                                                setProducts(prev => [...prev, newProduct]);
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
                        <FieldLabel>Product Name</FieldLabel>
                        <Input
                          type="text"
                          className="uppercase"
                          value={searchTerm}
                          placeholder="Search product by Title or SKU..."
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
                              if (productSource === "shopify") {
                                const res = await fetch(
                                  `/api/shopify/products?q=${rawValue.toLowerCase()}`,
                                );
                                const data = await res.json();
                                setSearchResults(data.products || []);
                              } else {
                                const searchUpper = rawValue.toUpperCase();
                                const websiteFilter =
                                  productSource === "firebase_shopify"
                                    ? "Shopify"
                                    : "Taskflow";
                                const q = query(
                                  collection(db, "products"),
                                  where(
                                    "websites",
                                    "array-contains",
                                    websiteFilter,
                                  ),
                                );
                                const querySnapshot = await getDocs(q);
                                const firebaseResults = querySnapshot.docs
                                  .map((doc) => {
                                    const data = doc.data();
                                    let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
                                    let rawSpecsText = "";
                                    if (Array.isArray(data.technicalSpecs)) {
                                      data.technicalSpecs.forEach((group: any) => {
                                        rawSpecsText += ` ${group.specGroup}`;
                                        specsHtml += `<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">${group.specGroup}</div>`;
                                        specsHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;
                                        group.specs?.forEach((spec: any) => {
                                          rawSpecsText += ` ${spec.name} ${spec.value}`;
                                          specsHtml += `<tr><td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><b>${spec.name}</b></td><td style="border:1px solid #e5e7eb;padding:4px">${spec.value}</td></tr>`;
                                        });
                                        specsHtml += `</table>`;
                                      });
                                    }
                                    return {
                                      id: doc.id,
                                      title: data.name || "No Name",
                                      price:
                                        data.salePrice || data.regularPrice || 0,
                                      description: specsHtml,
                                      images: data.mainImage
                                        ? [{ src: data.mainImage }]
                                        : [],
                                      skus: data.itemCode ? [data.itemCode] : [],
                                      discount: 0,
                                      tempSearchMetadata: (
                                        data.name +
                                        " " +
                                        (data.itemCode || "") +
                                        " " +
                                        rawSpecsText
                                      ).toUpperCase(),
                                    };
                                  })
                                  .filter((p) =>
                                    p.tempSearchMetadata.includes(searchUpper),
                                  );
                                setSearchResults(firebaseResults);
                              }
                            } catch (err) {
                              console.error("Search error:", err);
                            } finally {
                              setIsSearching(false);
                            }
                          }}
                        />
                        {isSearching && (
                          <p className="text-[10px] animate-pulse">
                            Searching Source...
                          </p>
                        )}
                      </>
                    )
                  )}
                  {/* End SPF ternary */}
                </div>

                {/* Search Results — only shown when not in SPF mode */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && searchResults.length > 0 && (
                  <>
                    <div className="text-xs text-green-600 mb-2">
                      Note: you can choose the same products.
                    </div>
                    <div className="grid grid-cols-1 gap-3 overflow-auto border rounded p-2 bg-white grow">
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          className="cursor-pointer border rounded-sm p-2 hover:shadow-md flex gap-3 items-center bg-white"
                        >
                          <button
                            type="button"
                            onClick={() => handleAddProduct(product)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#121212] text-white shrink-0 hover:bg-gray-800"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {product.images?.[0]?.src ? (
                            <img
                              src={product.images[0].src}
                              alt={product.title}
                              className="w-14 h-14 object-contain rounded border shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400 shrink-0">
                              No Image
                            </div>
                          )}
                          <div className="flex flex-col justify-center min-w-0">
                            <span className="font-semibold text-xs truncate">{product.title}</span>
                            <span className="text-[10px] text-blue-600 font-bold">
                              {product.skus?.length ? `ITEM CODE: ${product.skus.join(", ")}` : "No item code"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Empty state when search has no results */}
                {!isSpfMode && !isSpf1Mode && searchResults.length === 0 && searchTerm.length >= 2 && !isSearching && (
                  <p className="text-xs text-center text-gray-500 mt-4">No products found.</p>
                )}

                <div className="mt-6 p-4 max-h-64 overflow-auto custom-scrollbar">
                  <h3 className="text-sm font-semibold mb-2">
                    Revised Quotations History
                  </h3>
                  {revisedQuotations.length === 0 ? (
                    <p>No revised quotations found.</p>
                  ) : (
                    <div className="space-y-3">
                      {revisedQuotations.map((q) => (
                        <Item
                          key={q.id}
                          className={`border border-gray-300 rounded-sm p-3 shadow-sm hover:shadow-md transition cursor-pointer ${selectedRevisedQuotation?.id === q.id ? "bg-gray-100" : ""}`}
                          onClick={() => setSelectedRevisedQuotation(q)}
                        >
                          <ItemContent>
                            <ItemTitle className="font-semibold text-sm">
                              {q.version || "N/A"}
                            </ItemTitle>
                            <ItemDescription className="text-xs text-gray-600">
                              <div>
                                <strong>Product Title:</strong>{" "}
                                {q.product_title || "N/A"}
                              </div>
                              <div>
                                <strong>Amount:</strong>{" "}
                                {q.quotation_amount ?? "N/A"}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                <span>
                                  <strong>Start:</strong>{" "}
                                  {q.start_date
                                    ? new Date(q.start_date).toLocaleString()
                                    : "N/A"}
                                </span>
                                <br />
                                <span>
                                  <strong>End:</strong>{" "}
                                  {q.end_date
                                    ? new Date(q.end_date).toLocaleString()
                                    : "N/A"}
                                </span>
                              </div>
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: Products table */}
              <div className={`flex-col overflow-y-auto px-3 lg:px-0 pb-3 lg:pb-0 min-h-0 ${mobilePanelTab === "search" ? "hidden lg:flex" : "flex"}`}>

                {/* Controls bar - matching quotation layout */}
                <div className="flex flex-col gap-2 mb-3">
                  <div className="hidden lg:flex items-center justify-between mb-1">
                    <h4 className="font-black text-sm tracking-tight">
                      Product List
                      <span className="ml-2 text-xs font-normal text-gray-400">({products.length} item{products.length !== 1 ? "s" : ""})</span>
                    </h4>
                  </div>
                  <h4 className="font-bold text-xs lg:hidden">Products: ({products.length})</h4>

                  {/* Subject + VAT + EWT — single compact toolbar */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-0 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden text-[10px]">
                    {/* Subject */}
                    <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                      <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">Subject</span>
                      <input
                        type="text"
                        value={quotationSubjectState}
                        onChange={(e) => setQuotationSubjectState(e.target.value)}
                        placeholder="For Quotation"
                        className="border-0 bg-transparent px-0 py-0 text-[10px] font-bold uppercase flex-1 min-w-0 focus:outline-none placeholder-gray-300"
                      />
                    </div>
                    {/* VAT */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                      <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">VAT</span>
                      <RadioGroup value={vatTypeState} onValueChange={(value) => {
                        const v = value as "vat_inc" | "vat_exe" | "zero_rated";
                        setVatTypeState(v);
                        setDiscount(v === "vat_exe" ? 12 : 0);
                      }} className="flex gap-2">
                        {[{ v: "vat_inc", l: "Inc" }, { v: "vat_exe", l: "Exe" }, { v: "zero_rated", l: "0%" }].map(({ v, l }) => (
                          <div key={v} className="flex items-center gap-0.5">
                            <RadioGroupItem value={v} id={`edit-vat-${v}`} />
                            <label htmlFor={`edit-vat-${v}`} className={`font-black uppercase cursor-pointer transition-colors ${vatTypeState === v ? "text-[#121212]" : "text-gray-300"}`}>{l}</label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    {/* EWT */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="font-black uppercase text-gray-400 tracking-widest shrink-0">EWT</span>
                      <RadioGroup value={whtTypeState} onValueChange={setWhtTypeState} className="flex gap-2">
                        {[{ v: "none", l: "None" }, { v: "wht_1", l: "1%" }, { v: "wht_2", l: "2%" }].map(({ v, l }) => (
                          <div key={v} className="flex items-center gap-0.5">
                            <RadioGroupItem value={v} id={`edit-ewt-${v}`} />
                            <label htmlFor={`edit-ewt-${v}`} className={`font-black uppercase cursor-pointer transition-colors ${whtTypeState === v ? "text-[#121212]" : "text-gray-300"}`}>{l}</label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-[#121212] text-white text-[10px] uppercase tracking-wider">
                        <th className="border border-gray-700 p-2 text-center w-10">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Object.keys(checkedRows).length === products.length && products.length > 0}
                              onChange={(e) => {
                                setCheckedRows(
                                  e.target.checked
                                    ? products.reduce((acc, _, idx) => ({ ...acc, [idx]: true }), {})
                                    : {},
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
                      {products.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center p-4 text-xs text-gray-400 italic">
                            No products found.
                          </td>
                        </tr>
                      )}
                      {products.map((product, index) => {
                        const qty = parseFloat(product.product_quantity ?? "0") || 0;
                        const amt = parseFloat(product.product_amount ?? "0") || 0;
                        const baseAmount = qty * amt;
                        const isChecked = checkedRows[index] || false;
                        const rowDiscount = isChecked
                          ? (product.discount ?? (vatTypeState === "vat_exe" ? 12 : 0))
                          : 0;
                        const discountedAmount = isChecked ? (baseAmount * rowDiscount) / 100 : 0;
                        const totalAfterDiscount = baseAmount - discountedAmount;
                        return (
                          <React.Fragment key={index}>
                            <tr className="even:bg-gray-50 align-middle">
                              {/* Disc% */}
                              <td className="border border-gray-300 p-2">
                                <div className="flex items-center justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => setCheckedRows((prev) => ({ ...prev, [index]: e.target.checked }))}
                                  />
                                  {isChecked && (
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={product.discount ?? (vatTypeState === "vat_exe" ? 12 : 0)}
                                      onChange={(e) => {
                                        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                        setProducts((prev) => {
                                          const copy = [...prev];
                                          copy[index] = { ...copy[index], discount: val };
                                          return copy;
                                        });
                                      }}
                                      className="w-14 p-0 border-none rounded-none text-xs text-center"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Remarks */}
                              <td className="hidden sm:table-cell border border-gray-300 p-1">
                                <Textarea
                                  value={product.item_remarks ?? ""}
                                  onChange={(e) => handleProductChange(index, "item_remarks", e.target.value)}
                                  placeholder="Enter any remarks here..."
                                  rows={3}
                                  className="capitalize rounded-none text-[10px] w-full p-1 border-none shadow-none resize-none"
                                />
                              </td>

                              {/* Product */}
                              <td className="p-1 sm:p-2">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  {/* Photo — check both sources */}
                                  {(product.product_photo || product.images?.[0]?.src) ? (
                                    <img
                                      src={product.product_photo || product.images?.[0]?.src}
                                      alt={`Product ${index + 1}`}
                                      className="w-8 h-8 sm:w-12 sm:h-12 object-contain rounded shrink-0 border border-gray-100"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-50 border border-gray-200 rounded shrink-0 flex items-center justify-center">
                                      <span className="text-[8px] text-gray-300">IMG</span>
                                    </div>
                                  )}
                                  {(() => {
                                    // Resolve lead time: prefer stored field, fallback parse from description HTML
                                    const rawDesc = product.product_description || product.description || "";
                                    const parsedLead = (() => {
                                      const m = rawDesc.match(/Project lead time<\/strong><\/td><td[^>]*>([^<]+)/);
                                      return m?.[1]?.trim() ?? "";
                                    })();
                                    const displayLead = product.procurementLeadTime || parsedLead;
                                    return (
                                      <div className="flex-1 min-w-0">
                                        {/* Title + Lead Time badge inline */}
                                        <div className="flex items-start gap-2 flex-wrap">
                                          <div
                                            contentEditable
                                            suppressContentEditableWarning
                                            className="flex-1 outline-none text-[10px] sm:text-xs min-w-0 break-words font-semibold"
                                            onBlur={(e) => {
                                              handleProductChange(index, "product_title", e.currentTarget.innerText);
                                            }}
                                            dangerouslySetInnerHTML={{ __html: product.product_title ?? "" }}
                                          />
                                          {displayLead && (
                                            <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                                              LEAD TIME: {displayLead}
                                            </span>
                                          )}
                                        </div>
                                        {/* Item code */}
                                        {(product.product_sku || product.skus?.[0]) && (
                                          <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                                            ITEM CODE: {product.product_sku || product.skus?.[0]}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* Qty */}
                              <td className="border border-gray-300 p-1 sm:p-2">
                                <Input
                                  type="number"
                                  min={product.procurementMinQty && product.procurementMinQty > 0 ? product.procurementMinQty : 1}
                                  step="any"
                                  value={product.product_quantity ?? ""}
                                  onChange={(e) => {
                                    const raw = parseFloat(e.target.value) || 1;
                                    const floor = product.procurementMinQty && product.procurementMinQty > 0 ? product.procurementMinQty : 1;
                                    handleProductChange(index, "product_quantity", String(Math.max(floor, raw)));
                                  }}
                                  className="w-12 sm:w-full p-1 sm:p-2 rounded-none text-xs text-center border-none shadow-none"
                                />
                                {product.procurementMinQty != null && product.procurementMinQty > 0 && (
                                  <div className="text-[9px] text-gray-500 mt-1 text-center">
                                    Min (PD): <span className="font-bold">{product.procurementMinQty}</span>
                                  </div>
                                )}
                              </td>

                              {/* Unit Price */}
                              <td className="border border-gray-300 p-1 sm:p-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={product.product_amount ?? ""}
                                  readOnly={product.procurementLockedPrice}
                                  onChange={(e) => {
                                    if (product.procurementLockedPrice) return;
                                    handleProductChange(index, "product_amount", e.target.value);
                                  }}
                                  className={`w-16 sm:w-full p-1 sm:p-2 rounded-none text-xs text-center border-none shadow-none ${product.procurementLockedPrice ? "bg-gray-50 font-bold" : ""}`}
                                />
                                {product.procurementLockedPrice && (
                                  <div className="text-[9px] text-gray-500 mt-1 text-center">
                                    Final selling price (locked)
                                  </div>
                                )}
                              </td>

                              {/* Discount amount */}
                              <td className="border border-gray-300 p-2 font-semibold text-center hidden sm:table-cell">
                                {isChecked && discountedAmount > 0 ? `₱${discountedAmount.toFixed(2)}` : "₱0.00"}
                              </td>

                              {/* Subtotal */}
                              <td className="border border-gray-300 p-2 font-semibold text-center">
                                ₱{totalAfterDiscount.toFixed(2)}
                              </td>

                              {/* Actions */}
                              <td className="border border-gray-300 text-center p-2">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => toggleDescription(index)}
                                    className="flex items-center rounded-none gap-1 px-2"
                                  >
                                    {openDescription[index] ? (
                                      <><EyeOff className="w-4 h-4" /><span className="hidden sm:inline">Hide</span></>
                                    ) : (
                                      <><Eye className="w-4 h-4" /><span className="hidden sm:inline">View</span></>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="flex items-center rounded-none gap-1"
                                    onClick={() => handleRemoveRow(index)}
                                  >
                                    <Trash className="text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {openDescription[index] && (
                              <tr className="even:bg-[#F9FAFA]">
                                <td colSpan={8} className="border border-gray-300 p-4 align-top">
                                  <label className="block text-xs font-medium mb-1">Description:</label>
                                  <div
                                    className="w-full max-h-90 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        product.description ||
                                        product.product_description ||
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
                        <td className="border border-gray-300 p-2 text-center hidden sm:table-cell"></td>
                        <td className="border border-gray-300 p-2"></td>
                        <td className="border border-gray-300 p-2 text-center font-black">
                          {products.reduce((acc, p) => acc + (parseFloat(p.product_quantity ?? "0") || 0), 0)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-black">
                          {products.reduce((acc, p) => acc + (parseFloat(p.product_amount ?? "0") || 0), 0).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center hidden sm:table-cell">
                          ₱{products.reduce((acc, p, idx) => {
                            const disc = checkedRows[idx] ? (p.discount ?? 0) : 0;
                            const base = (parseFloat(p.product_quantity ?? "0") || 0) * (parseFloat(p.product_amount ?? "0") || 0);
                            return acc + (base * disc) / 100;
                          }, 0).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-black">
                          ₱{products.reduce((acc, p, idx) => {
                            const disc = checkedRows[idx] ? (p.discount ?? 0) : 0;
                            const base = (parseFloat(p.product_quantity ?? "0") || 0) * (parseFloat(p.product_amount ?? "0") || 0);
                            return acc + base - (base * disc) / 100;
                          }, 0).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2"></td>
                      </tr>

                      {/* Delivery & Restocking Fee — desktop inside table */}
                      <tr className="hidden sm:table-row">
                        <td colSpan={4} className="border border-gray-300 p-2"></td>
                        <td colSpan={4} className="border border-gray-300 p-2">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs whitespace-nowrap font-bold">Delivery Fee:</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                placeholder="0.00"
                                value={deliveryFeeState}
                                onChange={(e) => setDeliveryFeeState(e.target.value)}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs whitespace-nowrap font-bold">Restocking Fee:</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                placeholder="0.00"
                                value={restockingFeeState}
                                onChange={(e) => setRestockingFeeState(e.target.value)}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Delivery & Restocking Fee — mobile only */}
                <div className="sm:hidden border border-gray-200 bg-gray-50 p-3 mt-1">
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-200">
                    <span className="text-xs font-bold uppercase text-gray-600">Delivery Fee</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                      placeholder="0.00"
                      value={deliveryFeeState}
                      onChange={(e) => setDeliveryFeeState(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs font-bold uppercase text-gray-600">Restocking Fee</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                      placeholder="0.00"
                      value={restockingFeeState}
                      onChange={(e) => setRestockingFeeState(e.target.value)}
                    />
                  </div>
                </div>

              </div>
            </div>

          </div>{/* end BODY */}

          {/* Note bar */}
          <div className="text-[10px] text-red-500 text-center italic px-3 py-1.5 bg-red-50 border-t border-red-200 shrink-0">
            ⚠️ Quotation Number only appears on the final downloaded quotation.
          </div>

          <DialogFooter className="flex flex-col gap-2 pl-8 pr-5 py-3 sm:pl-10 sm:pr-6 border-t border-gray-200 shrink-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full lg:w-auto lg:ml-auto flex-wrap p-2">
              <Button
                className="flex-1 lg:flex-none bg-[#121212] rounded-none hover:bg-black text-white flex gap-2 items-center h-12 px-6"
                onClick={() => setIsPreviewOpen(true)}
              >
                <Eye className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
              </Button>

              {(ApprovedStatus === "Approved" || ApprovedStatus === "Approved By Sales Head") && !hasDeleted && (
                <>
                  <Button
                    type="button"
                    onClick={DownloadPDF}
                    className="rounded-none h-12 px-6 bg-yellow-600 flex items-center gap-2"
                  >
                    <FileText /> PDF
                  </Button>

                  {/* <Button
                    type="button"
                    onClick={DownloadExcel}
                    className="rounded-none h-12 px-6 bg-green-600 flex items-center gap-2"
                  >
                    <FileSpreadsheet /> Excel
                  </Button> */}
                </>
              )}

              <Button variant="outline" className="rounded-none h-12 px-6 border-2" onClick={onClose}>
                Cancel
              </Button>
              {!hasSPF && (
                <Button onClick={onClickSave} className="rounded-none h-12 px-6">
                  Save
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onSave={performSave}
      />

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white shadow-2xl"
          style={{ maxWidth: "950px", width: "100vw" }}
        >
          <div className="sr-only">
            <DialogTitle>Official Quotation Protocol Preview</DialogTitle>
            <DialogDescription>
              Validated engineering export protocol.
            </DialogDescription>
          </div>
          <Preview
            payload={getQuotationPayload()}
            quotationType={quotation_type}
            setIsPreviewOpen={setIsPreviewOpen}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}