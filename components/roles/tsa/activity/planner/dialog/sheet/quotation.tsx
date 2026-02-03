"use client";

import React, { useState, useEffect } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import EditableTable from "@/components/EditableTable";
import { Trash, Download, ImagePlus, Plus, RefreshCcw } from "lucide-react";

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
  images?: Array<{
    src: string;
  }>;
  skus?: string[];
}

interface SelectedProduct extends Product {
  uid: string;
  quantity: number;
  price: number;
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
      if (vatType === "vat_exe") {
        totalWithVat = subtotalAfterDiscount * (1 + VAT_RATE);
      } else if (vatType === "vat_inc") {
        // price already includes VAT, do nothing
        totalWithVat = subtotalAfterDiscount;
      } else if (vatType === "zero_rated") {
        // no VAT, do nothing
        totalWithVat = subtotalAfterDiscount;
      }

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
          vatType === "vat_inc"
            ? "VAT Inc"
            : vatType === "vat_exe"
              ? "VAT Exe"
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

  return (
    <>
      {/* STEP 2 — SOURCE */}
      {step === 2 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Source</FieldLabel>
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
                            <Button type="button" variant="outline" onClick={handleBack}>
                              Back
                            </Button>
                            <Button
                              type="button"
                              onClick={handleNext}
                            >
                              Next
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
              <FieldLabel className="mt-3">Type</FieldLabel>
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

              <FieldLabel className="mt-3">Quotation For</FieldLabel>
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
                            <Button type="button" onClick={handleBack} variant="outline">
                              Back
                            </Button>
                            <Button type="button" onClick={handleNext} disabled={!quotationType}>
                              Next
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
              <FieldLabel className="mt-3">Project Name (Optional)</FieldLabel>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="capitalize"
              />

              <FieldLabel className="mt-3">Project Type</FieldLabel>
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
                            <Button type="button" onClick={handleBack} variant="outline">
                              Back
                            </Button>
                            <Button type="button" onClick={handleNext}>
                              Next
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
                  className="h-4 w-6"
                />
                <span className="text-xs font-medium">No products available</span>
              </label>

              {/* Selected Products with quantity and price inputs */}
              {!noProductsAvailable && (
                <Button onClick={() => setOpen(true)}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed bg-white text-black h-40 w-full hover:bg-gray-100 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
                  <ImagePlus className="h-10 w-10 text-gray-500" />
                  <span className="text-sm font-semibold">Select Products</span>
                  <span className="text-xs text-gray-500">
                    Browse and add items to this quotation
                  </span>
                </Button>
              )}

              {isManualEntry && (
                <p className="text-sm text-gray-600">
                  You chose to manually enter quotation details. Please proceed to the next step.
                </p>
              )}

              <Dialog open={isManualEntry} onOpenChange={setIsManualEntry}>
                <DialogContent
                  style={{ maxWidth: "60vw", width: "90vw" }}
                  className="mx-auto rounded-lg p-6"
                >
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                      Manual Product Entry
                    </DialogTitle>
                  </DialogHeader>

                  {/* BODY */}
                  <div className="max-h-[75vh] overflow-auto">

                    {/* ================= EMPTY STATE ================= */}
                    {manualProducts.length === 0 && (
                      <div className="flex items-center justify-center min-h-[40vh]">
                        <div className="text-center space-y-4">
                          <h3 className="text-base font-semibold">
                            No products added yet
                          </h3>

                          <p className="text-sm text-muted-foreground">
                            You selected manual entry.
                            Click below to add a new product and provide its details
                            before submitting to Shopify.
                          </p>

                          <div className="flex justify-center gap-3 pt-2">
                            <Button
                              onClick={() =>
                                setManualProducts([
                                  {
                                    id: Date.now(),
                                    title: "",
                                    skus: [""],
                                    description: "",
                                    images: [{ src: "" }],
                                    quantity: 1,
                                    price: 0,
                                  },
                                ])
                              }
                            >
                              Add New Product
                            </Button>

                            <Button
                              variant="destructive"
                              onClick={() => {
                                setManualProducts([]);
                                setIsManualEntry(false);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ================= PRODUCT FORMS ================= */}
                    {manualProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        className="border rounded-md p-4 flex gap-8 mb-6"
                        style={{ minHeight: "400px" }}
                      >
                        {/* LEFT SIDE */}
                        <div className="flex flex-col gap-6 w-[40%]">
                          {/* Product Title */}
                          <div>
                            <label className="block font-medium mb-1 text-sm">
                              Product Title
                            </label>
                            <p className="text-xs text-gray-500 mb-1">
                              Enter the name of the product.
                            </p>
                            <Input
                              value={p.title}
                              placeholder="Product Title"
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualProducts((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], title: val };
                                  return copy;
                                });
                              }}
                            />
                          </div>

                          {/* SKU */}
                          <div>
                            <label className="block font-medium mb-1 text-sm">SKU</label>
                            <p className="text-xs text-gray-500 mb-1">
                              Unique identifier for the product variant.
                            </p>
                            <Input
                              className="uppercase"
                              value={p.skus[0] || ""}
                              placeholder="SKU"
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualProducts((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], skus: [val] };
                                  return copy;
                                });
                              }}
                            />
                          </div>

                          {/* Photo */}
                          <div>
                            <label className="block font-medium mb-1 text-sm">
                              Photo (max 3MB)
                            </label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(e, idx)}
                            />
                            {p.images?.[0]?.src && (
                              <img
                                src={p.images[0].src}
                                className="mt-2 max-h-40 object-contain border rounded"
                              />
                            )}
                          </div>
                        </div>

                        {/* RIGHT SIDE */}
                        <div className="w-[60%] flex flex-col">
                          <label className="block font-medium mb-1 text-sm">
                            Product Description
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Provide a detailed description of the product.
                          </p>

                          <div className="flex-grow border rounded p-2 overflow-auto">
                            <EditableTable
                              description={p.description}
                              setDescription={(val) => setDescriptionAtIndex(idx, val)}
                            />
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button onClick={() => submitProductToShopify(p)} className="ml-auto">Submit to Shopify</Button>
                            <Button
                              variant="destructive"
                              onClick={() =>
                                setManualProducts((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* FOOTER (only show when may products na) */}
                  {manualProducts.length > 0 && (
                    <DialogFooter className="flex justify-between">
                      <Button
                        onClick={() =>
                          setManualProducts((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              title: "",
                              skus: [""],
                              description: "",
                              images: [{ src: "" }],
                              quantity: 1,
                              price: 0,
                            },
                          ])
                        }
                      >
                        Add More
                      </Button>

                      <Button variant="outline" onClick={() => setIsManualEntry(false)}>Close</Button>
                    </DialogFooter>
                  )}
                </DialogContent>
              </Dialog>

              <FieldLabel>Quotation Amount</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                placeholder="Enter quotation amount"
              />
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext}>
              Next
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
                <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-4 bg-cyan-100">
                  <div>
                    <AlertTitle>Follow Up Date:</AlertTitle>
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

              <FieldLabel className="mt-3">Remarks</FieldLabel>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any remarks here..."
                rows={3}
                required
                className="capitalize"
              />

              <FieldLabel className="mt-3">Status</FieldLabel>
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
                            <Button type="button" variant="outline" onClick={handleBack}>
                              Back
                            </Button>

                            {/* Changed Save button handler */}
                            <Button
                              onClick={handleSaveClick}
                            >
                              Save
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
              <div className="max-w-md rounded-lg bg-white p-6 shadow-lg">
                <Alert variant="default" className="p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="mb-1">
                      <AlertTitle>Quotation Number</AlertTitle>
                    </div>

                    {isGenerating ? (
                      <AlertDescription className="text-sm text-gray-700 flex items-center gap-2">
                        <Spinner className="w-5 h-5" />
                        <p>Generating your quotation number, please wait...</p>
                      </AlertDescription>
                    ) : hasGenerated ? (
                      <AlertDescription className="text-sm">
                        Your quotation number is{" "}
                        <strong>{localQuotationNumber}</strong>
                        <br />
                        <p className="mt-1 text-xs text-gray-600">
                          It is automatically generated based on the quotation type, TSM
                          prefix, current year, and a sequential number.
                        </p>
                      </AlertDescription>
                    ) : (
                      <AlertDescription className="text-sm text-gray-500">
                        Click <strong>Generate</strong> to create a quotation number.
                      </AlertDescription>
                    )}
                  </div>
                </Alert>

                {/* Action buttons */}
                <div className="mt-4 flex flex-col gap-3">
                  <Button onClick={handleGenerateQuotation} variant="outline" className="w-full flex items-center justify-center gap-2">
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

                  <Button onClick={handleDownloadQuotation} disabled={!hasGenerated} className="cursor-pointer" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation
                  </Button>

                  {!hasDownloaded && hasGenerated && (
                    <p className="text-sm text-yellow-700 mt-2">
                      ⚠️ Please download the quotation before saving.
                      <br />
                      <span className="text-xs text-red-600 italic">
                        Note: If there are no products or the quotation is empty, please do not download.
                      </span>
                    </p>
                  )}

                  <div className="flex justify-end gap-4 pt-2">
                    <Button variant="outline" onClick={handleCancelFollowUp} disabled={isGenerating}>
                      Cancel
                    </Button>

                    <Button onClick={handleConfirmFollowUp} disabled={!hasGenerated}>
                      OK
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

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
            <DialogTitle>Select Products</DialogTitle>
          </DialogHeader>

          <div
            className={`grid gap-6 mt-4 max-h-[75vh] overflow-hidden ${selectedProducts.length === 0
              ? "grid-cols-1"
              : "grid-cols-[1fr_2.5fr]"
              }`}
          >

            {/* Left side: Search + checkbox selected */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              {!noProductsAvailable && !isManualEntry && (
                <>
                  <FieldLabel>Product Name</FieldLabel>
                  <Input
                    type="text"
                    className="uppercase"
                    value={searchTerm}
                    placeholder="Search product..."
                    onChange={async (e) => {
                      if (isManualEntry) return;
                      const value = e.target.value.toLowerCase();
                      setSearchTerm(value);

                      if (value.length < 2) {
                        setSearchResults([]);
                        return;
                      }

                      setIsSearching(true);
                      try {
                        const res = await fetch(`/api/shopify/products?q=${value}`);
                        let data = await res.json();
                        let products: Product[] = data.products || [];

                        products = products.filter((product) => {
                          const titleMatch = product.title.toLowerCase().includes(value);
                          const skuMatch = product.skus?.some((sku) =>
                            sku.toLowerCase().includes(value)
                          );
                          return titleMatch || skuMatch;
                        });

                        setSearchResults(products);
                      } catch (err) {
                        console.error(err);
                      }
                      setIsSearching(false);
                    }}
                  />
                  {isSearching && <p className="text-sm mt-1">Searching...</p>}
                </>
              )}

              {!isManualEntry && searchResults.length > 0 && (
                <>
                  <div className="text-xs text-green-600 mb-2">
                    Shopify Product List | Note: you can choose the same products.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4">

                    {searchResults.map((item) => (
                      <Card key={item.id} className="cursor-pointer hover:bg-gray-50">
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
                            ? `SKU${item.skus.length > 1 ? "s" : ""}: ${item.skus.join(", ")}`
                            : "No SKU available"}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </>
              )}


              {/* Selected Products checkboxes */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] border border-dashed p-2 rounded-sm">
                {selectedProducts.length === 0 && (
                  <p className="text-xs text-gray-500">No products selected.</p>
                )}

                {selectedProducts.map((item) => (
                  <label
                    key={item.uid}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked
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
                    {item.title}
                  </label>
                ))}
              </div>
            </div>

            {/* Right side: Selected Products as Table with Image & Editable Description */}
            <div className="overflow-y-auto max-h-[75vh]">
              {selectedProducts.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    {/* LEFT */}
                    <h4 className="font-semibold text-xs">
                      Selected Products: ({selectedProducts.length})
                    </h4>

                    {/* RIGHT */}
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium">VAT Type:</span>

                      <RadioGroup
                        value={vatType}
                        onValueChange={(value) => {
                          const newVatType = value as "vat_inc" | "vat_exe" | "zero_rated";
                          setVatType(newVatType);

                          // If VAT Inc, set discount to 12%, else reset discount to 0 (or keep previous)
                          if (newVatType === "vat_inc") {
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
                          className="w-24 text-xs h-8"
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

                            <tr className="even:bg-gray-50">
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>

            {/* Right side: Total + Download button */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-sm font-semibold">
                  Overall Total: ₱{quotationAmount}
                </div>
                <div className="flex flex-col items-start">
                  <Button className="bg-orange-500" onClick={handleDownloadQuotation}>
                    <Download /> Preview Sample
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
