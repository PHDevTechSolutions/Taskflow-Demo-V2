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
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator"
import { Trash, Download, ImagePlus, Plus, RefreshCcw, Eye, ArrowLeft, ArrowRight, CheckCircle2Icon, XCircle } from "lucide-react";
// Firebase Project Dependencies
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
// Ensure 'db' is initialized in your firebase configuration file
import { db } from "@/lib/firebase";

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
  productSku: string;           // comma separated SKUs (first SKU if multiple)
  setProductSku: (v: string) => void;
  productTitle: string;         // comma separated titles
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
  quotationStatus: string;
  setQuotationStatus: (v: string) => void;
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
  handleBack: () => void;
  handleNext: () => void;
  handleSave: () => void;
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
  salesManagerContact?: string;
  salesManagerEmail?: string;
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
  id: number;
  title: string;
  description?: string;
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
}

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

interface ManualProduct {
  id: number;
  title: string;
  skus: string[];
  description: string;
  brand?: string;
  images: { src: string }[];
  base64Attachment?: string;
  imageFilename?: string;
  quantity?: number;
  price?: number | string;
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
    quotationStatus, setQuotationStatus,
    callType, setCallType,
    followUpDate, setFollowUpDate,
    remarks, setRemarks,
    status, setStatus,
    tsm, setTSM,
    typeClient, setTypeClient,
    handleBack,
    handleNext,
    handleSave,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    company_name,
    address,
    contact_number,
    email_address,
    contact_person,
    salesManagerContact,
    salesManagerEmail
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
  const [vatType, setVatType] = React.useState<"vat_inc" | "vat_exe" | "zero_rated">("zero_rated");

  const [useToday, setUseToday] = useState(false);

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

  useEffect(() => {
    setUseToday(false);
  }, [callType]);

  const [showQuotationAlert, setShowQuotationAlert] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localQuotationNumber, setLocalQuotationNumber] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // Manual Creation and Submission to Shopify
  const [manualProducts, setManualProducts] = useState<ManualProduct[]>([]);

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
    const total = selectedProducts.reduce((acc, p) => {
      const isDiscounted = p.isDiscounted ?? false;
      const baseAmount = p.price * p.quantity;
      let discountedAmount = 0;

      if (isDiscounted && discount > 0) {
        discountedAmount = (baseAmount * discount) / 100;
        // You can customize discount logic based on vatType here if needed
      }

      const totalAfterDiscount = baseAmount - discountedAmount;
      return acc + totalAfterDiscount;
    }, 0);

    setQuotationAmount(total.toFixed(2)); // Assuming quotationAmount is string, else remove toFixed
  }, [selectedProducts, discount, vatType]);

  useEffect(() => {
    setLocalQuotationNumber(quotationNumber);
  }, [quotationNumber]);

  useEffect(() => {
    const ids = selectedProducts.map((p) => p.id.toString());
    const quantities = selectedProducts.map((p) => p.quantity.toString());
    const amounts = selectedProducts.map((p) => p.price.toString());

    // Extract only the first table block from description
    const descriptions = selectedProducts
      .map((p) => p.description || "")
      .map((desc) => extractTable(desc))
      .filter((tableHtml) => tableHtml.trim() !== "");

    const photos = selectedProducts.map((p) => p.images?.[0]?.src || "");
    const skus = selectedProducts.map((p) => (p.skus && p.skus.length > 0 ? p.skus[0] : ""));
    const titles = selectedProducts.map((p) => p.title);

    setProductCat(ids.join(","));
    setProductQuantity(quantities.join(","));
    setProductAmount(amounts.join(","));
    setProductDescription(descriptions.join("||")); // Only table HTML here
    setProductPhoto(photos.join(","));
    setProductSku(skus.join(","));
    setProductTitle(titles.join(","));
  }, [
    selectedProducts,
    setProductCat,
    setProductQuantity,
    setProductAmount,
    setProductDescription,
    setProductPhoto,
    setProductSku,
    setProductTitle,
  ]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("File size exceeds 3MB limit");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const base64String = reader.result as string; // full data URL

      setManualProducts((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          images: [{ src: base64String }], // For image preview (data URL)
          base64Attachment: base64String.split(",")[1], // base64 part only, for backend
          imageFilename: file.name,
        };
        return copy;
      });
    };

    reader.readAsDataURL(file);
  }

  async function submitProductToShopify(product: ManualProduct) {
    try {
      const payload = {
        title: product.title,
        sku: product.skus[0] || "",
        description: product.description,
        quantity: product.quantity ?? 1,
        price: product.price !== undefined ? product.price.toString() : "0.00",
        imageAttachment: product.base64Attachment,
        imageFilename: product.imageFilename,
      };

      const res = await fetch("/api/manual-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Failed to submit product";
        try {
          const errorData = await res.json();
          if (errorData?.message) errorMessage = errorData.message;
          if (errorData?.details) errorMessage += ": " + errorData.details;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMessage += ": " + errorText;
        }
        throw new Error(errorMessage);
      }

      toast.success(`Product "${product.title}" submitted successfully!`);
    } catch (error: any) {
      toast.error(`Error submitting product: ${error.message || error.toString()}`);
    }
  }

  function extractTable(html: string): string {
    const match = html.match(/<table[\s\S]*?<\/table>/i);
    return match ? match[0] : "";
  }

  // Save handler with validation
  const saveWithSelectedProducts = () => {
    setShowQuotationAlert(true);  // Show the Shadcn alert
    handleDownloadQuotationPDF(); // Generate PDF before saving
    handleSave();
  };

  function setDescriptionAtIndex(idx: number, newDesc: string) {
    setManualProducts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], description: newDesc };
      return copy;
    });
  }

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

  // Function to extract <table>...</table> from full HTML string
  function extractTableHtml(html: string): string {
    const match = html.match(/<table[\s\S]*?<\/table>/i);
    return match ? match[0] : "";
  }

  useEffect(() => {
    // PH VAT rate
    const VAT_RATE = 0.12;

    const totalAfterDiscountAndVAT = selectedProducts.reduce((acc, p) => {
      const baseAmount = p.price * p.quantity;

      // If the row is discounted (checkbox checked)
      const discountedAmount = p.isDiscounted
        ? (baseAmount * discount) / 100
        : 0;

      // Subtotal for this product after discount
      const subtotalAfterDiscount = baseAmount - discountedAmount;

      // Apply VAT based on vatType
      let totalWithVat = subtotalAfterDiscount;


      return acc + totalWithVat;
    }, 0);

    setQuotationAmount(totalAfterDiscountAndVAT.toFixed(2));
  }, [selectedProducts, discount, vatType]);

  function formatCurrency(value: number | null | undefined): string {
    if (value == null) return "₱0.00";
    return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handleDownloadQuotation = async () => {
    if (!productCat || productCat.trim() === "") {
      toast.error("Cannot export quotation: Product Category is empty.");
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
        attention: safeContactPerson || safeAddress
          ? `${safeContactPerson}${safeContactPerson && safeAddress ? ", " : ""}${safeAddress}`
          : "",

        subject: "For Quotation",
        items,
        vatType:
          vatType === "vat_exe"
            ? "VAT Exe"
            : vatType === "vat_inc"
              ? "VAT Inc"
              : "Zero-Rated",
        totalPrice: Number(quotationAmount ?? 0),
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
        toast.error("Failed to download quotation: " + errorText);
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
      toast.error("Failed to download quotation. Please try again.");
    }
  };

  // Routing for product retrieval
  const [productSource, setProductSource] = useState<'shopify' | 'firebase'>('shopify');

  // Ensures Firebase documents match the existing UI table keys
  const mapFirebaseToSchema = (doc: any) => ({
    id: doc.id,
    title: doc.title || "Untitled Product",
    // Ensure price is a number for the calculation logic
    price: Number(doc.price) || 0,
    // Map Firebase "desc" or "body" to the expected "description" key
    description: doc.description || doc.body_html || "",
    brand: doc.brand || "",
    // Map images to an array format expected by the thumbnail logic
    images: doc.image_url ? [{ src: doc.image_url }] : (doc.images || []),
    skus: doc.sku ? [doc.sku] : [],
    uid: `firebase-${doc.id}` // Unique identifier for key stability
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

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

      // Logic mirrored from handleDownloadQuotation
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
        unitPrice,
        totalAmount,
      };
    });

    const handleDownloadPDF = async () => {
      const payload = getQuotationPayload();

      try {
        let apiEndpoint = "/api/quotation/disruptive/pdf"; // Adjust based on your API structure
        if (quotationType === "Ecoshift Corporation") {
          apiEndpoint = "/api/quotation/ecoshift/pdf";
        }

        const resExport = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resExport.ok) throw new Error("PDF Generation Failed");

        const blob = await resExport.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Quotation_${payload.referenceNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("PDF Export Successful");
      } catch (error) {
        console.error("PDF Protocol Error:", error);
        toast.error("Failed to generate PDF.");
      }
    };

    return {
      referenceNo: quotationNumber ?? "DRAFT-XXXX",
      date: new Date().toLocaleDateString(),
      companyName: company_name ?? "",
      address: address ?? "",
      telNo: contact_number ?? "",
      email: email_address ?? "",
      attention: contact_person ? `${contact_person}, ${address ?? ""}` : (address ?? ""),
      subject: "For Quotation",
      items,
      vatTypeLabel: vatType === "vat_inc" ? "VAT Inc" : vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",
      totalPrice: Number(quotationAmount ?? 0),
      salesRepresentative: salesRepresentativeName,
      salesemail,
      salescontact: contact ?? "",
      salestsmname: tsmname ?? "",
      salesmanagername: managername ?? "",
      salesManagerContact: salesManagerContact ?? "",
      salesManagerEmail: salesManagerEmail ?? "",
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
                                            .grid-row { display: flex; align-items: center; min-height: 30px; padding: 2px 15px; }
                                            .border-t { border-top: 1.5px solid black; }
                                            .border-b { border-bottom: 1.5px solid black; }
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
                                            .main-table thead tr { background: ${OFF_WHITE}; border-bottom: 1.5px solid black; }
                                            .main-table th { 
                                                padding: 12px 8px; font-size: 9px; font-weight: 900; color: ${PRIMARY_CHARCOAL}; 
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
                                            .desc-text { width: 100%; font-size: 9px; color: #6b7280; line-height: 1.4; }

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
                                            .sig-rep-box { 
                                                width: 256px; height: 40px; background: rgba(248, 113, 113, 0.1); 
                                                border: 1px solid #f87171; display: flex; align-items: center; 
                                                justify-content: center; text-align: center; font-size: 8px; 
                                                font-weight: 900; color: #dc2626; text-transform: uppercase; padding: 0 8px;
                                            }
                                            .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
                                        </style>
                                    </head>
                                    <body></body>
                                    </html>
                                `);
      iframeDoc.close();

      // 2. HELPER: ATOMIC SECTION CAPTURE
      const renderBlock = async (html: string) => {
        iframeDoc.body.innerHTML = html;
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
        const banner = await renderBlock(`<img src="${headerImagePath}" class="header-img" />`);
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
                                            <div class="grid-row border-t"><div class="label">COMPANY NAME:</div><div class="value">${payload.companyName}</div></div>
                                            <div class="grid-row"><div class="label">ADDRESS:</div><div class="value">${payload.address}</div></div>
                                            <div class="grid-row"><div class="label">TEL NO:</div><div class="value">${payload.telNo}</div></div>
                                            <div class="grid-row border-b"><div class="label">EMAIL ADDRESS:</div><div class="value">${payload.email}</div></div>
                                            <div class="grid-row"><div class="label">ATTENTION:</div><div class="value">${payload.attention}</div></div>
                                            <div class="grid-row border-b"><div class="label">SUBJECT:</div><div class="value">${payload.subject}</div></div>
                                        </div>
                                        <p class="intro-text">We are pleased to offer you the following products for consideration:</p>
                                    </div>
                                `);
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
                                `);
      pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
      currentY += 40;

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
                                                        <div class="product-title">${item.title}</div>
                                                        <div class="sku-text">${item.sku}</div>
                                                        <div class="desc-text">${item.description}</div>
                                                    </td>
                                                    <td style="width: 80px; text-align:right;">₱${item.unitPrice.toLocaleString()}</td>
                                                    <td style="width: 80px; text-align:right; font-weight:900;">₱${item.totalAmount.toLocaleString()}</td>
                                                </tr>
                                            </table>
                                        </div>
                                    `);

        // Handle Page Breaks (Same logic)
        if (currentY + rowBlock.h > (pdfHeight - 50)) {
          pdf.addPage([612, 936]);
          pageCount++;
          currentY = await initiateNewPage();
          pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
          currentY += 40; // Re-apply stitch on new page
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
                                                                        
                                                                    `);
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


                                            `);
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
                                                                    <p style="font-size: 8px; font-style: italic;">Mobile: ${payload.salesManagerContact || 'N/A'}</p>
                                                                    <p style="font-size: 8px; font-style: italic;">Email: ${payload.salesManagerEmail || 'N/A'}</p>
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
                                                                      `);

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

              <FieldLabel className="font-bold">Remarks <span className="text-red-500 text-[10px]">*Required</span></FieldLabel>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any remarks here..."
                rows={3}
                required
                className="capitalize rounded-none"
              />

              <FieldLabel className="font-bold">Status </FieldLabel>
              <Select value={quotationStatus} onValueChange={setQuotationStatus}>
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Convert to SO">Convert to SO</SelectItem>
                    <SelectItem value="Declined / Dissaproved">Declined / Dissaproved</SelectItem>
                    <SelectItem value="Pending PD">Pending PD</SelectItem>
                    <SelectItem value="Pending Procurement">Pending Procurement</SelectItem>
                    <SelectItem value="Pending Client Approval">Pending Client Approval</SelectItem>
                    <SelectItem value="Wait Bid Results">Wait Bid Results</SelectItem>
                    <SelectItem value="Lost Bid">Lost Bid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

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

                            {/* Changed Save button handler */}
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

                  <Button onClick={handleDownloadQuotation} disabled={!hasGenerated} hidden={true} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation Excel
                  </Button>

                  <Button onClick={handleDownloadQuotationPDF} disabled={!hasGenerated} hidden={false} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation PDF
                  </Button>

                  {!hasDownloaded && hasGenerated && (
                    <p className="text-sm text-yellow-600 mt-2 border border-dashed p-2 bg-red-100" hidden={false}>
                      ⚠️ Please download the quotation before saving.
                      <span className="text-sm text-red-600 italic ml-1">
                        Note: If there are no products or the quotation is empty, please do not download.
                      </span>
                    </p>
                  )}

                  <div className="flex justify-end gap-4 pt-10">
                    <Button variant="outline" className="rounded-none" onClick={handleCancelFollowUp} disabled={isGenerating}>
                      Cancel
                    </Button>

                    <Button onClick={handleConfirmFollowUp} className="rounded-none" disabled={!hasGenerated}>
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
          className={`max-h-[90vh] overflow-y-auto p-6 transition-all duration-300 ${selectedProducts.length === 0
            ? "w-[60vw]"
            : "w-[90vw]"
            }`}
          style={{
            maxWidth: selectedProducts.length === 0 ? "900px" : "1600px",
            width: "100vw",
          }}
        >

          <DialogHeader>
            <DialogTitle className="font-bold">Select Products</DialogTitle>
          </DialogHeader>

          <div
            className={`grid gap-6 mt-4 max-h-[75vh] overflow-hidden ${selectedProducts.length === 0
              ? "grid-cols-1"
              : "grid-cols-[1fr_2.5fr]"
              }`}
          >

            {/* Left side: Search + checkbox selected */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="flex flex-col gap-4 sticky top-0 bg-white z-10 pb-2">
                <div className="flex border rounded-md overflow-hidden border-gray-300">
                  <button
                    type="button"
                    onClick={() => {
                      setProductSource('shopify');
                      setSearchTerm("");       // Protocol: Reset input
                      setSearchResults([]);   // Protocol: Clear results
                    }}
                    className={`flex-1 py-4 text-[10px] font-bold transition-colors ${productSource === 'shopify' ? 'bg-[#121212] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    SHOPIFY
                  </button>
                  <button
                    type="button"
                    hidden={false}
                    onClick={() => {
                      setProductSource('firebase');
                      setSearchTerm("");       // Protocol: Reset input
                      setSearchResults([]);   // Protocol: Clear results
                    }}
                    className={`flex-1 py-2 text-[10px] font-bold transition-colors ${productSource === 'firebase' ? 'bg-[#121212] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    PRODUCT DATABASE
                  </button>
                </div>

                {!isManualEntry && (
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
                          } else {
                            const searchUpper = rawValue.toUpperCase();
                            const q = query(
                              collection(db, "products"), 
                              where("websites", "array-contains", "Taskflow")
                            );
                            const querySnapshot = await getDocs(q);

                            const firebaseResults = querySnapshot.docs.map(doc => {
                              const data = doc.data();

                              // 1. Build Specifications HTML and Searchable Text
                              let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
                              let rawSpecsText = "";

                              if (data.technicalSpecs && Array.isArray(data.technicalSpecs)) {
                                data.technicalSpecs.forEach((group: any) => {
                                  // 1. Add the Group Header (e.g., FIXTURE DETAILS)
                                  rawSpecsText += ` ${group.specGroup}`;
                                  specsHtml += `
                                                <div style="background: #121212; color: white; padding: 4px 8px; font-weight: 900; text-transform: uppercase; font-size: 9px; margin-top: 8px;">
                                                    ${group.specGroup}
                                                </div>`;

                                  // 2. Start the table for this specific group
                                  specsHtml += `<table style="width:100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px;">`;

                                  group.specs?.forEach((spec: any) => {
                                    // 3. Add data to searchable text and HTML rows
                                    rawSpecsText += ` ${spec.name} ${spec.value}`;
                                    specsHtml += `
                                                  <tr>
                                                      <td style="border: 1px solid #e5e7eb; padding: 4px; background: #f9fafb; width: 40%;">
                                                          <b>${spec.name}</b>
                                                      </td>
                                                      <td style="border: 1px solid #e5e7eb; padding: 4px;">
                                                          ${spec.value}
                                                      </td>
                                                  </tr>`;
                                  });

                                  specsHtml += `</table>`;
                                });
                              }

                              // 2. Map to Product format and resolve ID mismatch
                              return {
                                // Convert string ID to a hash number if your system strictly requires numbers
                                id: Math.abs(doc.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)),
                                title: data.name || "No Name",
                                price: data.salePrice || data.regularPrice || 0,
                                description: specsHtml,
                                images: data.mainImage ? [{ src: data.mainImage }] : [],
                                skus: data.itemCode ? [data.itemCode] : [],
                                discount: 0,
                                // We attach the search string temporarily for the filter
                                tempSearchMetadata: (data.name + " " + (data.itemCode || "") + " " + rawSpecsText).toUpperCase()
                              } as any; // Use 'as any' temporarily to bypass the strict Product definition
                            })
                              .filter(product => {
                                // 3. Perform the deep "Contains" search
                                return product.tempSearchMetadata.includes(searchUpper);
                              }) as Product[]; // Cast the final filtered array back to Product[]

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
                )}
              </div>

              {!isManualEntry && searchResults.length > 0 && (
                <>
                  <div className="text-xs text-green-600 mb-2">
                    Note: you can choose the same products.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4">

                    {searchResults.map((item) => (
                      <Card key={item.id} className="cursor-pointer hover:bg-gray-50 rounded-xs">
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
                              }}
                              className="w-6 h-6 p-0 flex items-center justify-center rounded-full"
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
                            <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400">
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
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] border border-dashed p-4 rounded-sm">
                {selectedProducts.length === 0 && (
                  <p className="text-xs text-gray-500">No products selected.</p>
                )}

                {selectedProducts.map((item, index) => (
                  <div key={item.uid} className="flex flex-col">
                    {/* Optional separator except for the first item */}
                    {index !== 0 && <Separator className="my-1" />}

                    <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked
                        className="accent-blue-500"
                        onChange={() => {
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
            <div className="overflow-y-auto max-h-[75vh]">
              {selectedProducts.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    {/* LEFT */}
                    <h4 className="font-bold text-xs">
                      Selected Products: ({selectedProducts.length})
                    </h4>

                    {/* RIGHT */}
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold">VAT Type:</span>

                      <RadioGroup
                        value={vatType}
                        onValueChange={(value) => {
                          const newVatType = value as "vat_inc" | "vat_exe" | "zero_rated";
                          setVatType(newVatType);

                          // If VAT Inc, set discount to 12%, else reset discount to 0 (or keep previous)
                          if (newVatType === "vat_exe") {
                            setDiscount(12);
                          } else {
                            setDiscount(0);
                          }
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
                            VAT Exe
                          </label>
                        </div>

                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="zero_rated" id="zero-rated" />
                          <label htmlFor="zero-rated" className="text-xs cursor-pointer">
                            Zero Rated
                          </label>
                        </div>
                      </RadioGroup> |

                      {/* DISCOUNT */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">Discount (%)</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={discount}
                          onChange={(e) =>
                            setDiscount(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-24 text-xs h-8 rounded-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-center w-12"></th>
                        <th className="border border-gray-300 p-2 text-left">Product</th>
                        <th className="border border-gray-300 p-2 text-left w-30">Quantity</th>
                        <th className="border border-gray-300 p-2 text-left w-30">Price per item</th>
                        <th className="border border-gray-300 p-2 text-right w-30">Discounted</th>
                        <th className="border border-gray-300 p-2 text-right w-30">Subtotal</th>
                        <th className="border border-gray-300 p-2 text-center w-20">Tool</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map((p, idx) => {
                        const isDiscounted = p.isDiscounted ?? false;

                        const baseAmount = p.price * p.quantity;
                        let discountedAmount = 0;
                        if (isDiscounted && discount > 0) {
                          discountedAmount = (baseAmount * discount) / 100;
                        }
                        const totalAfterDiscount = baseAmount - discountedAmount;

                        return (
                          <React.Fragment key={p.uid}>
                            <tr className="even:bg-gray-50">
                              <td className="border border-gray-300 p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isDiscounted}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedProducts((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], isDiscounted: checked };
                                      return copy;
                                    });
                                  }}
                                  className="cursor-pointer"
                                />
                              </td>

                              <td className="p-2 flex items-center gap-3">
                                {p.images?.[0]?.src ? (
                                  <img
                                    src={p.images[0].src}
                                    alt={p.title}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                    No Image
                                  </div>
                                )}

                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="flex-1 outline-none"
                                  onBlur={(e) => {
                                    const text = e.currentTarget.innerText;
                                    setSelectedProducts((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], title: text };
                                      return copy;
                                    });
                                  }}
                                >
                                  {p.title}
                                </div>
                              </td>

                              <td className="border border-gray-300 p-2">
                                <Input
                                  type="number"
                                  min={1}
                                  value={p.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setSelectedProducts((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], quantity: val };
                                      return copy;
                                    });
                                  }}
                                  className="border-none shadow-none w-full p-0"
                                />
                              </td>

                              <td className="border border-gray-300 p-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={p.price}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setSelectedProducts((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], price: val };
                                      return copy;
                                    });
                                  }}
                                  className="border-none shadow-none w-full p-2"
                                />
                              </td>

                              <td className="border border-gray-300 p-2 font-semibold text-right">
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

                              <td className="border border-gray-300 p-2 font-semibold text-right">
                                ₱{totalAfterDiscount.toFixed(2)}
                              </td>

                              <td className="border border-gray-300 p-2 text-center">
                                <Button
                                  variant="destructive"
                                  onClick={() => {
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
                                  <Trash />
                                </Button>
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
                            <tr key={`desc-${idx}`} className="even:bg-[#F9FAFA]">
                              <td colSpan={7} className="border border-gray-300 p-4 align-top">
                                <label className="block text-xs font-medium mb-1">Description:</label>
                                {/* Description Container: Content is now Locked/Non-Editable */}
                                <div
                                  className="w-full max-h-90 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: p.description || '<span class="text-gray-400 italic">No specifications provided.</span>'
                                  }}
                                />
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}

                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          {/* Description above the footer */}
          <div className="text-xs text-red-600 text-right italic mb-2">
            Note: Quotation Number is not included in the Preview Sample (only appears on the final downloaded quotation).
          </div>

          <DialogFooter className="flex items-center justify-between">
            {/* Left side: Close button */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-sm font-semibold">
                  Overall Total: ₱{quotationAmount}
                </div>
                {/* <div className="flex flex-col items-start">
                  <Button className="bg-orange-500" onClick={handleDownloadQuotation}>
                    <Download /> Preview Sample
                  </Button>
                </div> */}
                {/* Inside the main selection modal footer */}
                <Button
                  className="bg-[#121212] hover:bg-black text-white px-8 flex gap-2 items-center rounded-none"
                  onClick={() => setIsPreviewOpen(true)} // Changed from handleDownloadQuotation
                >
                  <Eye className="w-4 h-4" /> {/* Eye icon for "Preview" */}
                  <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
                </Button>
              </div>
            )}

            {/* Right side: Total + Download button */}


            <Button className="rounded-none" variant="outline" onClick={() => setOpen(false)}>
              <XCircle /> Close
            </Button>
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
                  <div className="mt-5 border-l border-r border-black">
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
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-[#F9FAFA] border-b border-black font-black uppercase text-[#121212]">
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
                            <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400">{item.itemNo}</td>
                            <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                            <td className="p-3 border-r border-black align-top bg-white">
                              {item.photo ? (
                                <img src={item.photo} className="w-24 h-24 object-contain mx-auto mix-blend-multiply" alt="sku-ref" />
                              ) : (
                                <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic">No Image</div>
                              )}
                            </td>
                            <td className="p-4 border-r border-black align-top">
                              <p className="font-black text-[#121212] text-xs uppercase mb-1">{item.title}</p>
                              <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
                              <div
                                className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: item.description }}
                              />
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
                        <tr className="border-t-2 border-black bg-[#121212] text-white h-[45px]">
                          <td colSpan={2} className="border-r border-white/20"></td>
                          <td className="px-4 border-r border-white/20 font-black text-red-400 italic text-[9px] uppercase">Tax Type:</td>
                          <td className="px-4 border-r border-white/20">
                            <div className="flex gap-4 text-[9px] font-black uppercase tracking-tight">
                              <span className={payload.vatTypeLabel === "VAT Inc" ? "text-white" : "text-white/30"}>
                                {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                              </span>
                              <span className={payload.vatTypeLabel === "VAT Exe" ? "text-white" : "text-white/30"}>
                                {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                              </span>
                              <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-white" : "text-white/30"}>
                                {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                              </span>
                            </div>
                          </td>
                          <td className="px-4 text-right border-r border-white/20 font-black text-[10px] uppercase">Grand Total:</td>
                          <td className="px-4 text-right font-black text-lg">
                            ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salesManagerContact || "N/A"}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salesManagerEmail || "N/A"}</p>
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
