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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

function splitAndTrim(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
  if (!value) return [];
  return value.split("||").map((v) => v.trim());
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
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [openDescription, setOpenDescription] = useState<
    Record<number, boolean>
  >({});

  // Tracks whether the autoAction has already been fired for this dialog instance
  const autoActionFiredRef = useRef(false);

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
        skus: undefined,
        title: "",
        images: undefined,
        isDiscounted: false,
        price: 0,
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

  const handleRemoveRow = (index: number) => {
    setProducts((prev) => {
      const n = [...prev];
      n.splice(index, 1);
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
      const totalQuotationAmount = (quotationAmount || 0) + deliveryFeeNum;

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
    const salesRepresentativeName =
      `${firstname ?? ""} ${lastname ?? ""}`.trim();
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
      const baseAmount = qty * unitPrice;
      const discountedAmount =
        isDiscounted && vatType === "vat_inc"
          ? (baseAmount * discount) / 100
          : 0;
      const totalAmount = baseAmount - discountedAmount;
      return {
        itemNo: index + 1,
        qty,
        photo: p.product_photo ?? "",
        title: p.product_title ?? "",
        sku: p.product_sku ?? "",
        remarks: p.item_remarks ?? "",
        product_description: p.description?.trim()
          ? p.description
          : p.product_description || "",
        unitPrice,
        totalAmount,
      };
    });

    const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
    const totalPriceWithDelivery = (quotationAmount || 0) + deliveryFeeNum;

    return {
      referenceNo: quotationNumber ?? "DRAFT-XXXX",
      date: new Date().toLocaleDateString(),
      companyName: company_name ?? "",
      address: address ?? "",
      telNo: contact_number ?? "",
      email: email_address ?? "",
      attention: contact_person ?? "",
      subject: "For Quotation",
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
      salestsmname: tsmname ?? "",
      salestsmemail: tsmemail ?? "",
      salestsmcontact: tsmcontact ?? "",
      salesmanagername: managername ?? "",
      vatType: vatType ?? null,
      deliveryFee: deliveryFee ?? "",
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
      subject: "For Quotation",
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
        price: parseFloat(product.price || "0") || 0,
        quantity: 1,
      },
    ]);
    setSearchTerm("");
    setSearchResults([]);
    setIsManualEntry(true);
    setTimeout(() => setIsManualEntry(false), 100);
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

  const DownloadPDF = async () => {
    if (typeof window === "undefined") return;
    const PRIMARY_CHARCOAL = "#121212";
    const OFF_WHITE = "#F9FAFA";
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const payload = getQuotationPayload();
      const isEcoshift = quotation_type === "Ecoshift Corporation";

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [612, 936],
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const BOTTOM_MARGIN = 0;

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
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: white; width: 816px; color: ${PRIMARY_CHARCOAL}; overflow: hidden; }
            .header-img { width: 100%; display: block; }
            .content-area { padding: 0px 60px; margin: 0 !important; box-sizing:border-box; }
            .client-grid { border-left: 1.5px solid black; border-right: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: center; min-height: 20px; padding: 2px 15px; }
            .border-t { border-top: 1.5px solid black; }
            .border-b { border-bottom: 1.5px solid black; padding-bottom: 10px;}
            .label { width: 140px; font-weight: 900; font-size: 10px; flex-shrink: 1; }
            .value { flex-grow: 1; font-size: 10px; font-weight: bold; color: #374151; padding-left: 15px; text-transform: uppercase; }
            .intro-text { font-size: 10px; font-style: italic; color: #6b7280; font-weight: 500; padding: 5px 0; }
            .table-container { border: 1.5px solid black; border-bottom: none; background: white; margin: 0; }
            .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
            .main-table thead tr { background: ${OFF_WHITE}; border-bottom: 1.5px; solid black;}
            .main-table th { padding: 5px 8px; font-size: 9.5px; font-weight: 800; color: ${PRIMARY_CHARCOAL}; text-transform: uppercase; border-right: 1px solid black; }
            .main-table td { padding: 15px 10px; vertical-align: top; border-right: 1px solid black; border-bottom: 1px solid black; font-size: 10px; }
            .main-table td:last-child, .main-table th:last-child { border-right: none;}
            .item-no { color: #9ca3af; font-weight: bold; text-align: center; }
            .qty-col { font-weight: 900; text-align: center; color: ${PRIMARY_CHARCOAL}; }
            .ref-photo { mix-blend-mode: multiply; width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; }
            .sku-text { color: #2563eb; font-weight: bold; font-size: 9px; margin-bottom: 10px; letter-spacing: -0.025em; }
            .desc-text { width: 100%; font-size: 9px; color: #000000; line-height: 1.2; }
            .desc-remarks { background-color: #f97316; padding: 0.50rem; text-transform: uppercase; color: #801313; display: inline-block; font-weight: bold; }
            .variance-footnote { margin-top: 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 4px; }
            .logistics-container { margin-top: 15px; border: 1px solid black; font-size: 9.5px; line-height: 1.3; }
            .logistics-row { display: flex; border-bottom: 1px solid black; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 100px; padding: 8px; font-weight: 900; border-right: 1px solid black; flex-shrink: 0; }
            .logistics-value { padding: 8px; flex-grow: 1; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 4px; }
            .terms-section { margin-top: 25px; border-top: 2.5px solid black; padding-top: 10px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 4px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
            .terms-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 9px; line-height: 1.4; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 0; }
            .terms-val { padding: 0px 4px;}
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .summary-bar { background-color: #e5e7eb; color: white; height: 35px; }
            .summary-bar td { border: none; vertical-align: middle; padding: 0 15px; }
            .tax-label { color: #e60b0d; font-style: italic; font-weight: 900; font-size: 22px; text-transform: uppercase; padding-left: 4px; }
            .tax-options { display: flex; gap: 15px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .tax-active { color: black; }
            .tax-inactive { color: #a0a5b3; }
            .grand-total-label { text-align: left; font-weight: 500; font-size: 8px; text-transform: uppercase; white-space: nowrap; color: black; }
            .grand-total-value { text-align: right; font-weight: 900; color: #058236; }
            .sig-hierarchy { margin-top: 20px; padding-top: 16px; border-top: 4px solid #1d4ed8; padding-bottom: 10px; }
            .sig-message { font-size: 9px; margin-bottom: 15px; font-weight: 500; line-height: 1.4; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 10px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 40px; }
            .sig-line { border-bottom: 1px solid black; width: 256px; }
            .sig-rep-box { width: 150px; height: 25px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 8px; font-weight: 900; color: #dc2626; text-transform: uppercase; padding: 0 8px; }
            .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
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
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        return {
          img: canvas.toDataURL("image/jpeg", 1.0),
          h: (canvas.height * pdfWidth) / canvas.width,
        };
      };

      let currentY = 0;
      let pageCount = 1;

      const drawPageNumber = (n: number) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Page ${n}`, pdfWidth - 60, pdfHeight - 20);
      };

      const initiateNewPage = async () => {
        const banner = await renderBlock(
          `<div style="width:100%;display:block;"><img src="${headerImagePath}" class="header-img" style="width:100%;display:block;object-fit:contain;"/><div style="width:100%;text-align:right;font-weight:900;font-size:10px;margin-top:2px;display:inline-block;padding-bottom:5px;line-height:1.2;box-sizing:border-box;padding-right:60px;">REFERENCE NO: ${payload.referenceNo}<br/>DATE: ${payload.date}</div></div>`,
        );
        pdf.addImage(banner.img, "JPEG", 0, 0, pdfWidth, banner.h);
        drawPageNumber(pageCount);
        return banner.h;
      };

      currentY = await initiateNewPage();

      const clientBlock = await renderBlock(
        `<div class="content-area" style="padding-top:5;"><div class="client-grid"><div class="grid-row border-t"><div class="label">COMPANY NAME:</div><div class="value">${payload.companyName}</div></div><div class="grid-row"><div class="label">ADDRESS:</div><div class="value">${payload.address}</div></div><div class="grid-row"><div class="label">TEL NO:</div><div class="value">${payload.telNo}</div></div><div class="grid-row border-b"><div class="label">EMAIL ADDRESS:</div><div class="value">${payload.email}</div></div><div class="grid-row"><div class="label">ATTENTION:</div><div class="value">${payload.attention}</div></div><div class="grid-row border-b"><div class="label">SUBJECT:</div><div class="value">${payload.subject}</div></div></div><p class="intro-text">We are pleased to offer you the following products for consideration:</p></div>`,
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
        `<div class="content-area"><div class="table-container" style="border-bottom:1.5px solid black;"><table class="main-table"><thead><tr><th style="width:40px;">ITEM NO</th><th style="width:40px;">QTY</th><th style="width:120px;">REFERENCE PHOTO</th><th style="width:200px;">PRODUCT DESCRIPTION</th><th style="width:80px;text-align:right;">UNIT PRICE</th><th style="width:80px;text-align:right;">TOTAL AMOUNT</th></tr></thead></table></div></div>`,
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
          `<div class="content-area"><table class="main-table" style="border:1.5px solid black;border-top:none;"><tr><td style="width:40px;" class="item-no">${index + 1}</td><td style="width:40px;" class="qty-col">${item.qty}</td><td style="width:120px;"><img src="${item.photo}" class="ref-photo"></td><td style="width:200px;"><div class="product-title" style="font-size:7px;">${item.title}</div><div class="sku-text">${item.sku}</div><div class="desc-text">${item.product_description} <span class="desc-remarks">${item.remarks}</span></div></td><td style="width:80px;text-align:right;">₱${item.unitPrice.toLocaleString()}</td><td style="width:80px;text-align:right;font-weight:900;">₱${item.totalAmount.toLocaleString()}</td></tr></table></div>`,
        );
        if (currentY + rowBlock.h > pdfHeight - 50) {
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

      const footerBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;padding-bottom:0;"><div class="table-container"><table class="main-table"><tr class="summary-bar"><td colspan="1"></td><td class="tax-label" style="font-size:12px;text-align:left;width:150px">Tax Type:</td><td style="width:300px;"><div class="tax-options" style="margin-left:50px;"><span class="${payload.vatTypeLabel === "VAT Inc" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc</span><span class="${payload.vatTypeLabel === "VAT Exe" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe</span><span class="${payload.vatTypeLabel === "Zero-Rated" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated</span></div></td><td style="width:70px;border-left:1px solid black;text-align:left;font-size:9px" class="grand-total-label">Delivery Fee:</td><td style="width:130px;font-size:15px;" class="grand-total-value">₱${payload.deliveryFee}</td></tr><tr class="summary-bar" style="border-bottom:1px solid black;font-size:10px;border-top:1px solid black;"><td colspan="3"></td><td style="width:70px;border-left:1px solid black;text-align:left;font-size:9px" class="grand-total-label">Grand Total:</td><td style="width:130px;font-size:15px;" class="grand-total-value">₱${payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></table></div></div>`,
      );
      if (currentY + footerBlock.h > pdfHeight - BOTTOM_MARGIN) {
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
        `<div class="content-area" style="padding-top:0;"><div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div><div class="logistics-container"><div class="logistics-row"><div class="logistics-label bg-yellow-header">Included:</div><div class="logistics-value bg-yellow-content"><p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p><p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p></div></div><div class="logistics-row"><div class="logistics-label bg-yellow-header">Excluded:</div><div class="logistics-value bg-yellow-content"><p>All lamp poles are subject to a delivery charge.</p><p>Installation and all hardware/accessories not indicated above.</p><p>Freight charges, arrastre, and other processing fees.</p></div></div><div class="logistics-row"><div class="logistics-label">Notes:</div><div class="logistics-value bg-yellow-note" style="font-style:italic;"><p>Deliveries are up to the vehicle unloading point only.</p><p>Additional shipping fee applies for other areas not mentioned above.</p><p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p><span class="text-red-strong"><u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u></span></div></div></div><div class="terms-section"><div class="terms-header">Terms and Conditions</div><div class="terms-grid"><div class="terms-label">Availability:</div><div class="terms-val terms-highlight"><p>*5-7 days if on stock upon receipt of approved PO.</p><p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.</p><p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p></div><div class="terms-label">Warranty:</div><div class="terms-val terms-highlight"><p>One (1) year from the time of delivery for all busted lights except the damaged fixture.</p><p>*Shipping costs for warranty claims are for customers' account.</p></div><div class="terms-label">SO Validity:</div><div class="terms-val"><p>Sales order has <b style="color:red;">validity period of 14 working days.</b> Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b></p></div><div class="terms-label">Storage:</div><div class="terms-val terms-highlight"><p>Storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b></p></div><div class="terms-label">Return:</div><div class="terms-val terms-highlight"><p><b style="color:red;"><u>7 days return policy -</u></b> if the product received is defective, damaged, or incomplete.</p></div></div></div></div>`,
      );
      if (currentY + logisticsBlock.h > pdfHeight - BOTTOM_MARGIN) {
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
        `<div class="content-area" style="padding-top:0;"><div class="terms-grid"><div class="terms-label">Payment:</div><div class="terms-val"><p><strong style="color:red;">Cash on Delivery (COD)</strong></p><p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery.</strong></p><p><strong>BANK DETAILS</strong></p><p><b>Payee to: </b><strong>${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}</strong></p><div class="bank-grid" style="display:flex;gap:20px;"><div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</div><div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</div></div></div><div class="terms-label">DELIVERY:</div><div class="terms-val terms-highlight"><p>Delivery/Pick up is subject to confirmation.</p></div><div class="terms-label">Validity:</div><div class="terms-val"><p class="text-red-strong"><u>Thirty (30) calendar days from the date of this offer.</u></p></div><div class="terms-label">CANCELLATION:</div><div class="terms-val terms-highlight"><p>1. Above quoted items are non-cancellable.</p><p>2. Downpayment for items not in stock/indent and order/special items are non-refundable.</p><p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p></div></div><div class="sig-hierarchy"><p class="sig-message">Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p><div class="sig-grid"><div class="sig-side-internal"><div style="position:relative;"><p style="font-style:italic;font-size:10px;font-weight:900;margin-bottom:25px;">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p><img src="${payload.agentSignature || ""}" class="sig-rep-box" style="position:absolute;top:40px;left:0;width:125px;height:auto;object-fit:contain;z-index:9999;"/><p style="font-size:10px;font-weight:900;text-transform:uppercase;margin-top:50px;">${payload.salesRepresentative}</p><div class="sig-line"></div><p class="sig-sub-label">Sales Representative</p><p style="font-size:10px;font-style:italic;">Mobile: ${payload.agentContactNumber || "N/A"}</p><p style="font-size:10px;font-style:italic;">Email: ${payload.agentEmailAddress || "N/A"}</p></div><div style="position:relative;"><p style="font-size:9px;font-weight:900;text-transform:uppercase;color:#9ca3af;margin-bottom:25px;">Approved By:</p><img src="${payload.TsmSignature || ""}" class="sig-rep-box" style="position:absolute;top:40px;left:0;width:125px;height:auto;object-fit:contain;z-index:9999;"/><p style="font-size:10px;font-weight:900;text-transform:uppercase;">${payload.salestsmname}</p><div class="sig-line"></div><p class="sig-sub-label">SALES MANAGER</p><p style="font-size:10px;font-style:italic;">Mobile: ${payload.TsmContactNumber || "N/A"}</p><p style="font-size:10px;font-style:italic;">Email: ${payload.TsmEmailAddress || "N/A"}</p></div><div style="position:relative;"><p style="font-size:9px;font-weight:900;text-transform:uppercase;color:#9ca3af;margin-bottom:25px;">Noted By:</p><img src="${payload.ManagerSignature || ""}" class="sig-rep-box" style="position:absolute;top:40px;left:0;width:125px;height:auto;object-fit:contain;z-index:9999;"/><p style="font-size:10px;font-weight:900;text-transform:uppercase;">${payload.salesmanagername}</p><div class="sig-line"></div><p class="sig-sub-label">Sales-B2B</p></div></div><div class="sig-side-client"><div><div class="sig-line" style="margin-top:73px;"></div><p style="font-size:9px;text-align:center;font-weight:900;margin-top:4px;text-transform:uppercase;">Company Authorized Representative</p></div><div style="width:256px;"><div class="sig-line" style="margin-top:68px;"></div><p style="font-size:9px;text-align:center;font-weight:900;margin-top:4px;text-transform:uppercase;">Payment Release Date</p></div><div style="width:256px;"><div class="sig-line" style="margin-top:68px;"></div><p style="font-size:9px;text-align:center;font-weight:900;margin-top:4px;text-transform:uppercase;">Position in the Company</p></div></div></div></div></div>`,
      );
      if (currentY + termsAndSigBlock.h > pdfHeight - BOTTOM_MARGIN) {
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
      if (vatType === "vat_exe") {
        const disc = product.discount ?? 12;
        return acc + lineTotal * (1 - disc / 100);
      }
      return acc + lineTotal;
    }, 0);
  }, [products, vatType]);

  useEffect(() => {
    setQuotationAmount(subtotal);
  }, [subtotal]);

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent style={{ maxWidth: "90vw", width: "98vw" }}>
          <DialogHeader>
            <DialogTitle className="text-sm">
              Edit Quotation: {item.quotation_number || item.id} -{" "}
              {item.quotation_type}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold">Duration</label>
              <div className="date-timestamps p-2 shadow-sm rounded w-40 text-center bg-black text-white font-mono">
                <span>
                  {startDate && endDate
                    ? (() => {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        const diffMs = end.getTime() - start.getTime();
                        if (diffMs <= 0) return "0s";
                        const diffSeconds = Math.floor(diffMs / 1000) % 60;
                        const diffMinutes =
                          Math.floor(diffMs / (1000 * 60)) % 60;
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        return `${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
                      })()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex space-x-4" style={{ height: "70vh" }}>
            {/* Left side: Search + history */}
            <div className="flex flex-col w-1/3 gap-4 overflow-y-auto pr-2">
              <div className="flex flex-col gap-4 sticky top-0 bg-white z-10 pb-2">
                <div className="flex border rounded-md overflow-hidden border-gray-300">
                  {(
                    [
                      "shopify",
                      "firebase_shopify",
                      "firebase_taskflow",
                    ] as const
                  ).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        setProductSource(src);
                        setSearchTerm("");
                        setSearchResults([]);
                      }}
                      className={`flex-1 py-4 text-[10px] font-bold transition-colors ${productSource === src ? "bg-[#121212] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      {src === "shopify"
                        ? "SHOPIFY"
                        : src === "firebase_shopify"
                          ? "CMS"
                          : "PRODUCT DATABASE"}
                    </button>
                  ))}
                </div>

                {!isManualEntry && (
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
                )}
              </div>

              <div className="overflow-auto border rounded p-2 bg-white grow">
                {searchResults.length === 0 && searchTerm.length >= 2 && (
                  <p className="text-xs text-center text-gray-500 mt-8">
                    No products found.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="cursor-pointer border rounded p-2 hover:shadow-md flex space-x-3"
                      onClick={() => handleAddProduct(product)}
                    >
                      {product.images?.[0]?.src ? (
                        <img
                          src={product.images[0].src}
                          alt={product.title}
                          className="w-16 h-16 object-contain rounded border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">
                          No Image
                        </div>
                      )}
                      <div className="flex flex-col justify-center">
                        <span className="font-semibold text-xs">
                          {product.title}
                        </span>
                        <span className="text-xs text-gray-500">
                          ITEM CODE: {product.skus?.join(", ") || "None"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
            <div className="flex flex-col w-1/1 overflow-auto border rounded p-2 bg-white">
              <div className="flex items-center gap-4 justify-end border rounded p-4">
                <span className="text-xs font-medium">VAT Type:</span>
                <RadioGroup
                  value={vatTypeState}
                  onValueChange={(value) => {
                    const v = value as "vat_inc" | "vat_exe" | "zero_rated";
                    setVatTypeState(v);
                    setDiscount(v === "vat_exe" ? 12 : 0);
                  }}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="vat_inc" id="vat-inc" />
                    <label htmlFor="vat-inc" className="text-xs cursor-pointer">
                      VAT Inc
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="vat_exe" id="vat-exe" />
                    <label htmlFor="vat-exe" className="text-xs cursor-pointer">
                      VAT Exe{" "}
                      <span className="text-red-600 text-[10px]">(12%)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="zero_rated" id="zero-rated" />
                    <label
                      htmlFor="zero-rated"
                      className="text-xs cursor-pointer"
                    >
                      Zero Rated
                    </label>
                  </div>
                </RadioGroup>
              </div>

              <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-4 text-center w-5">
                      <Input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={
                          Object.keys(checkedRows).length === products.length &&
                          products.length > 0
                        }
                        onChange={(e) => {
                          setCheckedRows(
                            e.target.checked
                              ? products.reduce(
                                  (acc, _, idx) => ({ ...acc, [idx]: true }),
                                  {},
                                )
                              : {},
                          );
                        }}
                      />{" "}
                      Check All
                    </th>
                    <th className="border p-4 text-left w-45">Product</th>
                    <th className="border p-4 text-center w-5">Quantity</th>
                    <th className="border p-4 text-center w-15">Amount</th>
                    <th className="border p-4 text-center w-10">-</th>
                    <th className="border p-4 text-center w-10">Subtotal</th>
                    <th className="border p-4 text-center w-5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center p-4 text-xs">
                        No products found.
                      </td>
                    </tr>
                  )}
                  {products.map((product, index) => {
                    const qty =
                      parseFloat(product.product_quantity ?? "0") || 0;
                    const amt = parseFloat(product.product_amount ?? "0") || 0;
                    const lineTotal = qty * amt;
                    const isChecked = checkedRows[index] || false;
                    return (
                      <React.Fragment key={index}>
                        <tr className="align-middle">
                          <td className="border border-gray-300 p-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="checkbox"
                                className="w-4 h-4"
                                checked={isChecked}
                                onChange={(e) =>
                                  setCheckedRows((prev) => ({
                                    ...prev,
                                    [index]: e.target.checked,
                                  }))
                                }
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={
                                  product.discount ??
                                  (vatTypeState === "vat_exe" ? 12 : 0)
                                }
                                onChange={(e) => {
                                  const val = Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      parseFloat(e.target.value) || 0,
                                    ),
                                  );
                                  setProducts((prev) => {
                                    const copy = [...prev];
                                    copy[index] = {
                                      ...copy[index],
                                      discount: val,
                                    };
                                    return copy;
                                  });
                                }}
                                className="w-16 border-none p-0 text-xs text-center"
                              />
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="flex gap-3">
                              {product.product_photo && (
                                <img
                                  src={product.product_photo}
                                  alt={`Product ${index + 1}`}
                                  className="max-h-20 w-auto object-contain rounded-sm border"
                                />
                              )}
                              <div className="flex-1">
                                <Textarea
                                  value={product.product_title ?? ""}
                                  onChange={(e) =>
                                    handleProductChange(
                                      index,
                                      "product_title",
                                      e.target.value,
                                    )
                                  }
                                  className="border-none p-1 shadow-none text-xs resize-none w-full"
                                />
                                <div className="text-xs text-gray-500">
                                  ITEM CODE:{" "}
                                  {product.product_sku ? (
                                    product.product_sku
                                  ) : (
                                    <i>None</i>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="border border-gray-300 p-2">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={product.product_quantity ?? ""}
                              onChange={(e) =>
                                handleProductChange(
                                  index,
                                  "product_quantity",
                                  e.target.value,
                                )
                              }
                              className="border-none shadow-none text-xs text-center"
                            />
                          </td>
                          <td className="border border-gray-300 p-2">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={product.product_amount ?? ""}
                              onChange={(e) =>
                                handleProductChange(
                                  index,
                                  "product_amount",
                                  e.target.value,
                                )
                              }
                              className="border-none shadow-none text-xs text-center"
                            />
                          </td>
                          <td className="border border-gray-300 p-2 text-center">
                            {vatType === "vat_exe"
                              ? `₱${(lineTotal * ((product.discount ?? 12) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "₱0.00"}
                          </td>
                          <td className="border border-gray-300 p-2 text-center">
                            ₱
                            {(isChecked && vatType === "vat_exe"
                              ? lineTotal * (1 - (product.discount ?? 12) / 100)
                              : lineTotal
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="border border-gray-300 p-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                onClick={() => toggleDescription(index)}
                                className="flex items-center gap-1 text-xs rounded-none"
                              >
                                {openDescription[index] ? (
                                  <>
                                    <EyeOff size={16} /> Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye size={16} /> View
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                className="text-xs rounded-none"
                                onClick={() => handleRemoveRow(index)}
                              >
                                <Trash className="text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {openDescription[index] && (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={8} className="p-3">
                              <div className="font-semibold mb-1">
                                Description
                              </div>
                              <div
                                className="max-h-[250px] overflow-auto border rounded bg-white p-2"
                                style={{ fontSize: "11px", lineHeight: "1.4" }}
                                dangerouslySetInnerHTML={{
                                  __html:
                                    product.description ||
                                    product.product_description ||
                                    '<span class="italic text-gray-400">No specifications provided.</span>',
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div className="border border-gray-300 p-2">
                <div className="flex items-center justify-end">
                  <span className="text-sm mr-2 whitespace-nowrap">
                    Delivery Fee:
                  </span>
                  <div className="flex items-center border border-gray-300 px-2 py-1">
                    <span className="text-sm mr-1">₱</span>
                    <input
                      type="text"
                      className="w-20 text-right outline-none bg-transparent"
                      placeholder="0.00"
                      value={deliveryFeeState}
                      onChange={(e) => setDeliveryFeeState(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="inline-block text-right font-semibold text-sm border border-yellow-500 p-4 bg-yellow-50">
              <div>
                Total: ₱
                {subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                Actual Quotation Amount: ₱
                {quotationAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-between items-center">
            <div className="flex space-x-2">
              <Button
                className="bg-[#121212] rounded-none hover:bg-black text-white px-8 p-6 flex gap-2 items-center"
                onClick={() => setIsPreviewOpen(true)}
              >
                <Eye className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Review Quotation
                </span>
              </Button>

              {(ApprovedStatus === "Approved" ||
                ApprovedStatus === "Approved By Sales Head") && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={DownloadPDF}
                    className="rounded-xs p-6 bg-yellow-600 flex items-center gap-2"
                  >
                    <FileText /> PDF
                  </Button>
                  <Button
                    type="button"
                    onClick={DownloadExcel}
                    className="rounded-xs p-6 bg-green-600 flex items-center gap-2"
                  >
                    <FileSpreadsheet /> Excel
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                className="rounded-none p-6"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button onClick={onClickSave} className="rounded-none p-6">
                Save
              </Button>
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
