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
  /** True when this item originates from an SPF 1 (procurement-approved) record */
  isSpf1?: boolean;
  /** Lead time from procurement — extracted from the saved description HTML for display */
  procurementLeadTime?: string;
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

      // Detect SPF 1 items: the description HTML contains the "Procurement" section
      // header written by formatProcurementLeadHtml (saved during quotation creation).
      const descHtml = p.description?.trim() ? p.description : (p.product_description || "");
      const isSpf1 = p.isSpf1 ?? descHtml.includes(">Procurement<");

      // Extract lead time text from the saved procurement HTML block if present.
      // The HTML pattern is: <td ...>Project lead time</td><td ...>VALUE</td>
      let procurementLeadTime = p.procurementLeadTime ?? "";
      if (!procurementLeadTime && isSpf1) {
        const leadMatch = descHtml.match(/Project lead time<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
        if (leadMatch) procurementLeadTime = leadMatch[1].trim();
      }

      return {
        itemNo: index + 1,
        qty,
        photo: p.product_photo ?? "",
        title: p.product_title ?? "",
        sku: p.product_sku ?? "",
        remarks: p.item_remarks ?? "",
        product_description: descHtml,
        unitPrice,
        totalAmount,
        isSpf1,
        procurementLeadTime,
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
      salestsmname: tsmname ?? "",
      salestsmemail: tsmemail ?? "",
      salestsmcontact: tsmcontact ?? "",
      salesmanagername: managername ?? "",
      vatType: vatType ?? null,
      deliveryFee: deliveryFeeState ?? "",
      restockingFee: parseFloat(restockingFeeState) || 0,
      whtType: whtTypeState ?? "none",
      whtLabel:
        whtTypeState === "wht_1" ? "EWT 1% (Goods)" :
        whtTypeState === "wht_2" ? "EWT 2% (Services)" : "None",
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
          img: canvas.toDataURL("image/jpeg", 0.97),
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
        // Build the SPF badge + lead time HTML snippet for the PDF row (SPF 1 items only)
        const spfBadgeHtml = item.isSpf1
          ? `<span style="display:inline-block;background:#dc2626;color:white;padding:1px 5px;font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;border-radius:2px;margin-left:5px;vertical-align:middle;">SPF</span>`
          : "";
        const leadTimeHtml = item.isSpf1 && item.procurementLeadTime
          ? `<div style="margin:3px 0 4px;display:flex;align-items:center;gap:4px;"><span style="font-size:7px;font-weight:900;text-transform:uppercase;color:#9ca3af;letter-spacing:0.05em;">Lead Time:</span><span style="font-size:7.5px;font-weight:900;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;padding:1px 5px;">${item.procurementLeadTime}</span></div>`
          : "";

        const rowBlock = await renderBlock(
          `<div class="content-area"><table class="main-table" style="border:1.5px solid black;border-top:none;"><tr><td style="width:35px;" class="item-no">${index + 1}</td><td style="width:35px;" class="qty-col">${item.qty}</td><td style="width:105px;padding:8px;text-align:center;vertical-align:middle;"><img src="${item.photo}" style="mix-blend-mode:multiply;width:82px;height:82px;object-fit:contain;display:block;margin:0 auto;"></td><td style="padding:8px 10px;"><div style="display:flex;align-items:center;"><p class="product-title" style="margin:0;">${item.title}</p>${spfBadgeHtml}</div>${leadTimeHtml}${item.sku ? `<p class="sku-text">ITEM CODE: ${item.sku}</p>` : ""}<div class="desc-text">${item.product_description}</div>${item.remarks ? `<div class="desc-remarks">${item.remarks}</div>` : ""}</td><td style="width:90px;" class="price-col">₱${item.unitPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td style="width:90px;" class="total-col">₱${item.totalAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr></table></div>`,
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

      const _deliveryNum = parseFloat(String(payload.deliveryFee)) || 0;
      const _restockingNum = payload.restockingFee || 0;
      const _netSales = payload.totalPrice - _deliveryNum - _restockingNum;
      const _vatBreak = payload.vatTypeLabel === "VAT Inc"
        ? `<tr><td class="sum-gray-lbl">Less: VAT (12/112)</td><td class="sum-gray-val">₱${(payload.totalPrice*(12/112)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr${payload.whtType&&payload.whtType!=="none"?"":" class='sum-divider'"}><td class="sum-gray-lbl">Net of VAT (Tax Base)</td><td class="sum-gray-val">₱${(payload.totalPrice/1.12).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>${payload.whtType&&payload.whtType!=="none"?`<tr class="sum-divider"><td class="sum-ewt-lbl">Less: ${payload.whtLabel}</td><td class="sum-ewt-val">− ₱${(payload.whtAmount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`:""}`
        : `<tr class="sum-divider"><td class="sum-gray-lbl">Tax Status</td><td class="sum-gray-val" style="font-style:italic;">${payload.vatTypeLabel==="VAT Exe"?"VAT Exempt":"Zero-Rated"}</td></tr>`;
      const _whtBadge = payload.whtType&&payload.whtType!=="none"
        ? `<div class="summary-wht">● ${payload.whtLabel} — on Net of VAT</div>` : "";
      const _finalLbl = payload.whtType&&payload.whtType!=="none" ? "Net Amount to Collect" : "Total Amount Due";
      const _finalAmt = (payload.netAmountToCollect??payload.totalPrice).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

      const footerBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;padding-bottom:0;"><div class="table-container" style="border-bottom:2px solid black;"><div class="summary-wrap"><div class="summary-left"><div class="summary-tax-title">Tax Type:</div><div class="tax-options"><span class="${payload.vatTypeLabel==="VAT Inc"?"tax-active":"tax-inactive"}">${payload.vatTypeLabel==="VAT Inc"?"●":"○"} VAT Inc</span><span class="${payload.vatTypeLabel==="VAT Exe"?"tax-active":"tax-inactive"}">${payload.vatTypeLabel==="VAT Exe"?"●":"○"} VAT Exe</span><span class="${payload.vatTypeLabel==="Zero-Rated"?"tax-active":"tax-inactive"}">${payload.vatTypeLabel==="Zero-Rated"?"●":"○"} Zero-Rated</span></div>${_whtBadge}</div><div class="summary-right"><table class="sum-tbl"><tr><td class="sum-lbl">Net Sales ${payload.vatTypeLabel==="VAT Inc"?"(VAT Inc)":"(Non-VAT)"}</td><td class="sum-val">₱${_netSales.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr><td class="sum-lbl">Delivery Charge</td><td class="sum-val">₱${_deliveryNum.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr class="sum-divider"><td class="sum-lbl">Restocking Fee</td><td class="sum-val">₱${_restockingNum.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr><td class="sum-total-lbl">Total Invoice Amount</td><td class="sum-total-val">₱${payload.totalPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>${_vatBreak}<tr class="sum-final-row"><td class="sum-final-lbl">${_finalLbl}</td><td class="sum-final-val">₱${_finalAmt}</td></tr></table></div></div></div></div>`,
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
        `<div class="content-area" style="padding-top:0;"><div class="terms-grid"><div class="terms-label">Payment:</div><div class="terms-val"><p><strong style="color:red;">Cash on Delivery (COD)</strong></p><p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery.</strong></p><p><strong>BANK DETAILS</strong></p><p><b>Payee to: </b><strong>${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}</strong></p><div class="bank-grid" style="display:flex;gap:20px;"><div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</div><div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</div></div></div><div class="terms-label">DELIVERY:</div><div class="terms-val terms-highlight"><p>Delivery/Pick up is subject to confirmation.</p></div><div class="terms-label">Validity:</div><div class="terms-val"><p class="text-red-strong"><u>Thirty (30) calendar days from the date of this offer.</u></p></div><div class="terms-label">CANCELLATION:</div><div class="terms-val terms-highlight"><p>1. Above quoted items are non-cancellable.</p><p>2. Downpayment for items not in stock/indent and order/special items are non-refundable.</p><p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p></div></div><div class="sig-hierarchy"><p class="sig-message">Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p><div class="sig-grid"><div class="sig-side-internal"><div style="position:relative;min-height:85px;"><p class="sig-italic">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p><img src="${payload.agentSignature || ""}" style="position:absolute;top:28px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salesRepresentative}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Representative</p><p class="sig-detail">Mobile: ${payload.agentContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.agentEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:85px;"><p class="sig-approved-label">Approved By:</p><img src="${payload.TsmSignature || ""}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salestsmname}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Manager</p><p class="sig-detail">Mobile: ${payload.TsmContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.TsmEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:75px;"><p class="sig-approved-label">Noted By:</p><img src="${payload.ManagerSignature || ""}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/><p class="sig-name" style="margin-top:46px;">${payload.salesmanagername}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales-B2B</p></div></div><div class="sig-side-client"><div style="text-align:center;"><div class="sig-line" style="margin-top:68px;width:220px;"></div><p class="sig-client-label">Company Authorized Representative</p><p class="sig-client-sub">(Please Sign Over Printed Name)</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Payment Release Date</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Position in the Company</p></div></div></div></div></div>`,
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
        <DialogContent className="h-[95vh] overflow-hidden p-0 w-full flex flex-col" style={{ maxWidth: "90vw", width: "98vw" }}>
          {/* HEADER */}
          <div className="flex flex-col border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between px-5 py-3">
              <DialogTitle className="font-black text-sm tracking-tight">
                Edit Quotation: {item.quotation_number || item.id} — {item.quotation_type}
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
                🛒 Products
              </button>
            </div>
          </div>


          {/* BODY */}
          <div className="flex-1 overflow-hidden">
          <div className="h-full grid gap-0 lg:gap-4 lg:p-4 p-0 overflow-y-auto grid-cols-1 lg:grid-cols-[300px_1fr] lg:overflow-hidden">
            {/* Left side: Search + history */}
            <div className={`flex-col gap-3 overflow-y-auto px-3 lg:px-0 pt-3 lg:pt-0 h-full ${mobilePanelTab === "products" ? "hidden lg:flex" : "flex"}`}>
              <div className="flex flex-col gap-3 sticky top-0 bg-white z-10 pb-2">
                {/* Source Switcher with SPF */}
                <div className="grid grid-cols-4 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  {[
                    { source: "shopify", label: "Shopify", icon: "🛍️" },
                    { source: "firebase_shopify", label: "CMS", icon: "📦" },
                    { source: "firebase_taskflow", label: "DB", icon: "🗄️" },
                  ].map(({ source: s, label, icon }) => (
                    <button key={s} type="button"
                      onClick={() => { setProductSource(s as any); setSearchTerm(""); setSearchResults([]); setIsSpfMode(false); }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all ${productSource === s && !isSpfMode ? "bg-[#121212] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >
                      <span className="text-sm mb-0.5">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setIsSpfMode(true); setSearchTerm(""); setSearchResults([]); }}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 text-[9px] font-black uppercase tracking-wide transition-all border-l border-gray-200 ${isSpfMode ? "bg-red-600 text-white" : "bg-white text-red-500 hover:bg-red-50"}`}
                  >
                    <span className="text-sm mb-0.5">📋</span>
                    <span>SPF</span>
                  </button>
                </div>

                {/* SPF Form OR Search */}
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
            <div className={`flex-col overflow-y-auto px-3 lg:px-0 pb-3 lg:pb-0 ${mobilePanelTab === "search" ? "hidden lg:flex" : "flex"}`}>
              <div className="flex flex-col gap-2 border rounded p-3 bg-gray-50">
                {/* Subject */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest w-14 shrink-0">Subject</span>
                  <input
                    type="text"
                    value={quotationSubjectState}
                    onChange={(e) => setQuotationSubjectState(e.target.value)}
                    placeholder="For Quotation"
                    className="border border-gray-200 rounded px-2 py-1 text-[10px] font-medium uppercase flex-1 focus:outline-none focus:border-gray-400 bg-white"
                  />
                </div>
                {/* VAT + EWT */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">VAT</span>
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
                        <label htmlFor="vat-inc" className="text-xs cursor-pointer">VAT Inc</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="vat_exe" id="vat-exe" />
                        <label htmlFor="vat-exe" className="text-xs cursor-pointer">
                          VAT Exe <span className="text-red-600 text-[10px]">(12%)</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="zero_rated" id="zero-rated" />
                        <label htmlFor="zero-rated" className="text-xs cursor-pointer">Zero Rated</label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="w-px h-4 bg-gray-300 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">EWT</span>
                    <RadioGroup
                      value={whtTypeState}
                      onValueChange={setWhtTypeState}
                      className="flex items-center gap-3"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="none" id="ewt-none" />
                        <label htmlFor="ewt-none" className="text-xs cursor-pointer">None</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="wht_1" id="ewt-1" />
                        <label htmlFor="ewt-1" className="text-xs cursor-pointer">1% (Goods)</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="wht_2" id="ewt-2" />
                        <label htmlFor="ewt-2" className="text-xs cursor-pointer">2% (Services)</label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
              <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-[#121212] text-white text-[10px] uppercase tracking-wider">
                    <th className="border border-gray-700 p-2 text-center w-10">
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
                      />
                    </th>
                    <th className="border border-gray-700 p-2 text-left font-bold">Product</th>
                    <th className="border border-gray-700 p-2 text-center font-bold w-16">Qty</th>
                    <th className="border border-gray-700 p-2 text-center font-bold w-24">Unit Price</th>
                    <th className="border border-gray-700 p-2 text-center font-bold hidden sm:table-cell">Discount</th>
                    <th className="border border-gray-700 p-2 text-center font-bold">Subtotal</th>
                    <th className="border border-gray-700 p-2 text-center font-bold w-24">Actions</th>
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
              </div>
              <div className="border border-gray-300 p-2">
                <div className="flex flex-wrap items-center justify-end gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Delivery Fee:</span>
                    <div className="flex items-center border border-gray-300 px-2 py-1">
                      <span className="text-xs mr-1">₱</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-20 text-right outline-none bg-transparent text-xs"
                        placeholder="0.00"
                        value={deliveryFeeState}
                        onChange={(e) => setDeliveryFeeState(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Restocking Fee:</span>
                    <div className="flex items-center border border-gray-300 px-2 py-1">
                      <span className="text-xs mr-1">₱</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-20 text-right outline-none bg-transparent text-xs"
                        placeholder="0.00"
                        value={restockingFeeState}
                        onChange={(e) => setRestockingFeeState(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="inline-block text-right font-semibold text-sm border border-yellow-500 p-4 bg-yellow-50 space-y-1 min-w-[220px]">
              <div className="text-gray-500 text-xs">
                Subtotal: ₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {parseFloat(deliveryFeeState) > 0 && (
                <div className="text-gray-500 text-xs">
                  Delivery Fee: ₱{parseFloat(deliveryFeeState).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              {parseFloat(restockingFeeState) > 0 && (
                <div className="text-gray-500 text-xs">
                  Restocking Fee: ₱{parseFloat(restockingFeeState).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              {whtTypeState !== "none" && (
                <div className="text-blue-600 text-xs">
                  EWT ({whtTypeState === "wht_1" ? "1%" : "2%"}): −₱{(
                    (quotationAmount / 1.12) * (whtTypeState === "wht_1" ? 0.01 : 0.02)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <div className="border-t border-yellow-400 pt-1 text-sm font-black">
                Total: ₱{quotationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div></div>{/* end BODY */}

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