"use client";

import React, { useState, useEffect } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemMedia, ItemTitle, } from "@/components/ui/item";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import EditableTable from "@/components/EditableTable";

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
}

const Quotation_SOURCES = [
  { label: "Existing Client", description: "Clients with active accounts or previous transactions.", },
  { label: "CSR Inquiry", description: "Customer Service Representative inquiries.", },
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
  quantity: number;
  price: number;
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
  } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleDescriptions, setVisibleDescriptions] = useState<Record<number, boolean>>({});
  const [isManualEntry, setIsManualEntry] = useState(false);

  function addDaysToDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format for input[type=date]
  }

  useEffect(() => {
    if (callType === "Sent Quotation Standard" || callType === "Sent Quotation with Special Price") {
      setFollowUpDate(addDaysToDate(1)); // after 1 day (tomorrow)
    } else if (callType === "Sent Quotation with SPF") {
      setFollowUpDate(addDaysToDate(5)); // after 5 days
    } else {
      setFollowUpDate(""); // clear or keep empty for others
    }
  }, [callType]);

  const [localQuotationNumber, setLocalQuotationNumber] = useState(quotationNumber);
  const [showQuotationAlert, setShowQuotationAlert] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  // Manual Creation and Submission to Shopify
  const [manualProducts, setManualProducts] = useState<ManualProduct[]>([]);


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

  // Generate quotation number when quotationType or tsm changes
  useEffect(() => {
    if (!quotationType || !tsm) return;

    async function generateQuotationNumber() {
      setIsGenerating(true);
      const cleanQuotationType = quotationType.trim();
      const prefixBase = `${getQuotationPrefix(cleanQuotationType)}-${extractTsmPrefix(tsm)}`;
      const currentYear = new Date().getFullYear();

      const nextSeq = await fetchNextQuotationSequence(prefixBase);
      const newQuotationNumber = `${prefixBase}-${currentYear}-${nextSeq}`;

      setLocalQuotationNumber(newQuotationNumber);
      setQuotationNumber(newQuotationNumber);
      setIsGenerating(false);
    }

    generateQuotationNumber();
  }, [quotationType, tsm, setQuotationNumber]);

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

  // Auto compute total quotation amount when selectedProducts changes
  useEffect(() => {
    const total = selectedProducts.reduce(
      (sum, p) => sum + p.quantity * p.price,
      0
    );
    setQuotationAmount(total.toFixed(2));
  }, [selectedProducts, setQuotationAmount]);

  // Validation states
  const isStep2Valid = source.trim() !== "";
  const isStep3Valid = selectedProducts.length > 0 && selectedProducts.every((p) => p.quantity > 0 && p.price >= 0);
  const isStep4Valid = projectType.trim() !== "";
  const isStep5Valid = productCat.trim().length >= 6 && callType.trim() !== "";
  const isStep6Valid = status.trim() !== "";

  // Save handler with validation
  const saveWithSelectedProducts = () => {
    if (!isManualEntry && selectedProducts.length === 0) {
      toast.error("Please select at least one product.");
      return;
    }
    if (!isManualEntry && selectedProducts.some((p) => p.quantity <= 0 || p.price < 0)) {
      toast.error("Quantity and Price must be valid numbers.");
      return;
    }
    if (!isStep6Valid) {
      toast.error("Please select status.");
      return;
    }

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
                    label: "CSR Inquiry",
                    description: "Customer Service Representative inquiries.",
                },
            ]
            : Quotation_SOURCES.filter(
                (source) => source.label !== "CSR Inquiry"
            );

  return (
    <>
      {/* STEP 2 — SOURCE */}
      {step === 2 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Source</FieldLabel>
              <RadioGroup
                value={source}
                onValueChange={setSource}
              >
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
                              disabled={!isStep2Valid}
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
                    label: "Sent Quotation Standard",
                    description: "Standard quotation sent to client.",
                  },
                  {
                    label: "Sent Quotation with Special Price",
                    description: "Quotation with a special pricing offer.",
                  },
                  {
                    label: "Sent Quotation with SPF",
                    description: "Quotation including SPF (Special Pricing Framework).",
                  },
                  {
                    label: "With SPFS",
                    description: "Quotation with SPFS details included.",
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
                            <Button type="button" onClick={handleNext} disabled={!isStep4Valid}>
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
              <Alert variant="default" className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1">
                    <AlertTitle>Quotation Number</AlertTitle>
                  </div>
                  {isGenerating ? (
                    <AlertDescription className="text-sm text-gray-700 flex items-center gap-2">
                      <Spinner className="w-5 h-5 text-gray-500" />
                      Generating your quotation number, please wait...
                    </AlertDescription>
                  ) : (
                    <AlertDescription className="text-sm text-gray-700">
                      Your quotation number is <strong className="text-black">{localQuotationNumber}</strong>
                      <br />
                      It is automatically generated based on the quotation type, TSM prefix, current year, and a sequential number.
                    </AlertDescription>
                  )}
                </div>
              </Alert>

              {!isManualEntry && (
                <>
                  <FieldLabel>Product Name</FieldLabel>
                  <Input
                    type="text"
                    className="uppercase"
                    value={searchTerm}
                    placeholder="Search product..."
                    onChange={async (e) => {
                      if (isManualEntry) return; // skip searching if manual
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

                        // Filter client-side for SKU match as well
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
                </>
              )}

              {/* Manual Entry Checkbox */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isManualEntry}
                  onChange={(e) => {
                    const manual = e.target.checked;
                    setIsManualEntry(manual);
                    if (!manual) setManualProducts([]);
                  }}
                />
                <span className="text-xs font-medium">No products available / Manual entry</span>
              </label>

              {isSearching && <p className="text-sm mt-1">Searching...</p>}

              {/* RESULTS AS CHECKBOX CARDS */}
              {!isManualEntry && searchResults.length > 0 && (
                <div className="mt-2 space-y-3 max-h-60 overflow-y-auto">
                  {searchResults.map((item) => {
                    const isChecked = selectedProducts.some((p) => p.id === item.id);

                    return (
                      <Card key={item.id} className="cursor-pointer hover:bg-gray-50">
                        <CardHeader className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProducts((prev) => [
                                    ...prev,
                                    {
                                      ...item,
                                      quantity: 1,
                                      price: 0,
                                      description: item.description || "",
                                    },
                                  ]);
                                } else {
                                  setSelectedProducts((prev) =>
                                    prev.filter((p) => p.id !== item.id)
                                  );
                                  setVisibleDescriptions((prev) => {
                                    const copy = { ...prev };
                                    delete copy[item.id];
                                    return copy;
                                  });
                                }
                              }}
                              className="mt-0.5"
                            />
                            <CardTitle className="text-base text-xs font-semibold">{item.title}</CardTitle>
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
                    );
                  })}
                </div>
              )}

              {/* Selected Products with quantity and price inputs */}
              {!isManualEntry && selectedProducts.length > 0 && (
                <div className="mt-3 space-y-4">
                  <h4 className="font-semibold mb-2 text-xs">
                    Selected Products: ({selectedProducts.length})
                  </h4>
                  {selectedProducts.map((p, idx) => (
                    <Item
                      key={p.id}
                      variant="outline"
                      className="flex flex-col md:flex-row md:items-center md:gap-4"
                    >
                      {/* Product Title */}
                      <ItemContent className="flex-1 text-xs font-medium">{p.title}</ItemContent>

                      {/* Quantity, Price, Total grouped */}
                      <ItemActions className="flex items-center gap-4 mt-2 md:mt-0">
                        <label className="flex flex-col text-xs">
                          Quantity
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
                            className="w-20"
                          />
                        </label>

                        <label className="flex flex-col text-xs">
                          Price
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
                            className="w-28"
                          />
                        </label>

                        <div className="text-xs font-semibold whitespace-nowrap">
                          Total: ₱{(p.quantity * p.price).toFixed(2)}
                        </div>
                      </ItemActions>

                      {/* View Description Button aligned to left side */}
                      <ItemActions className="flex justify-start items-center mt-2 md:mt-0 md:flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleDescriptions((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            }))
                          }
                          className="whitespace-nowrap"
                        >
                          {visibleDescriptions[p.id] ? "Hide Description" : "View Description"}
                        </Button>
                      </ItemActions>

                      {/* Description Section */}
                      {visibleDescriptions[p.id] && p.description && (
                        <div
                          className="mt-2 text-xs prose max-w-none md:col-span-3"
                          style={{ whiteSpace: "pre-wrap" }}
                          dangerouslySetInnerHTML={{ __html: p.description }}
                        />
                      )}
                    </Item>
                  ))}
                </div>
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
                            <Button
                              onClick={() => submitProductToShopify(p)}
                              className="ml-auto"
                            >
                              Submit to Shopify
                            </Button>

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

                      <Button variant="outline" onClick={() => setIsManualEntry(false)}>
                        Close
                      </Button>
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
                <Alert variant="default" className="mb-4 flex items-center gap-2">
                  <div>
                    <AlertTitle>Follow Up Date:</AlertTitle>
                    <AlertDescription>
                      {followUpDate} — This is the scheduled date to reconnect with the client for further updates or actions.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>No Follow Up Date set</AlertTitle>
                  <AlertDescription>
                    Please select a call type to auto-generate a follow up date. This helps ensure timely client follow-ups.
                  </AlertDescription>
                </Alert>
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
                            <Button
                              onClick={saveWithSelectedProducts}
                              disabled={!isStep6Valid}
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
        </div>
      )}
    </>
  );
}
