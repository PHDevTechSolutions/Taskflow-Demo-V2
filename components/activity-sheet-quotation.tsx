"use client";

import React, { useState, useEffect } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemMedia, ItemTitle, } from "@/components/ui/item";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

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
    handleBack,
    handleNext,
    handleSave,
  } = props;

  const [quotationNumberError, setQuotationNumberError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleDescriptions, setVisibleDescriptions] = useState<Record<number, boolean>>({});
  const [isManualEntry, setIsManualEntry] = useState(false);

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

  const isStep3Valid =
    selectedProducts.length > 0 &&
    selectedProducts.every((p) => p.quantity > 0 && p.price >= 0);

  const isStep4Valid = projectType.trim() !== "";

  const isStep5Valid =
    quotationNumber.trim().length >= 6 &&
    quotationAmount.trim() !== "" &&
    parseFloat(quotationAmount) > 0 &&
    callType.trim() !== "";

  const isStep6Valid = status.trim() !== "";

  // Handle next on step 5 with validation + error messages
  const handleNextStep5 = () => {
    if (quotationNumber.trim().length < 6) {
      setQuotationNumberError("Quotation Number must be more than 5 characters.");
      return;
    }
    if (quotationAmount.trim() === "" || parseFloat(quotationAmount) === 0) {
      toast.error("Please enter valid Quotation Amount.");
      return;
    }
    if (callType.trim() === "") {
      toast.error("Please select Call Type.");
      return;
    }
    setQuotationNumberError("");
    handleNext();
  };

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
    handleSave();
  };

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
                onValueChange={(value) => setSource(value)}
              >
                {Quotation_SOURCES.map(({ label, description }) => (
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
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button onClick={handleBack}>Back</Button>
            <Button onClick={handleNext} disabled={!isStep2Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — PRODUCT DETAILS */}
      {step === 3 && (
        <div>
          <FieldGroup>
            <FieldSet>
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

              {/* Manual Entry Checkbox */}
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={isManualEntry}
                  onChange={(e) => {
                    const manual = e.target.checked;
                    setIsManualEntry(manual);
                    if (manual) {
                      setSelectedProducts([]); // clear products when manual
                      setSearchResults([]);
                      setSearchTerm("");
                    }
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

              {!isManualEntry && selectedProducts.length > 0 && (
                <Alert variant="default">
                  <AlertTitle>Grand Total:</AlertTitle>
                  <AlertDescription>
                    ₱{selectedProducts.reduce((acc, p) => acc + p.quantity * p.price, 0).toFixed(2)}
                  </AlertDescription>
                </Alert>
              )}

            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={isManualEntry ? false : !isStep3Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — PROJECT DETAILS */}
      {step === 4 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="mt-3">Project Type</FieldLabel>
              <RadioGroup value={projectType} onValueChange={setProjectType}>
                {[
                  {
                    label: "B2B",
                    description: "Business to Business transactions.",
                  },
                  {
                    label: "B2C",
                    description: "Business to Consumer transactions.",
                  },
                  { label: "B2G", description: "Business to Government contracts." },
                  { label: "Gentrade", description: "General trade activities." },
                  {
                    label: "Modern Trade",
                    description: "Retail and modern trade partners.",
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

              <FieldLabel className="mt-3">Project Name (Optional)</FieldLabel>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={!isStep4Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5 — QUOTATION DETAILS */}
      {step === 5 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="mt-3">Quotation For</FieldLabel>
              <RadioGroup value={quotationType} required onValueChange={setQuotationType}>
                {[
                  {
                    label: "Ecoshift Corporation",
                    description: "The Fastest-Growing Provider of Innovative Lighting Solutions",
                  },
                  {
                    label: "Disruptive Solutions Inc",
                    description: "future-ready lighting solutions that brighten spaces, cut costs, and power smarter business",
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

              <FieldLabel>Quotation Number</FieldLabel>
              <Input
                type="text"
                value={quotationNumber}
                onChange={(e) => {
                  setQuotationNumber(e.target.value);
                  if (quotationNumberError) setQuotationNumberError("");
                }}
                placeholder="Enter quotation number"
                className="uppercase"
              />
              <FieldDescription className="text-sm text-muted-foreground">
                Quotation Number Source from TSM
              </FieldDescription>
              {quotationNumberError && (
                <p className="mt-1 text-sm text-red-600">{quotationNumberError}</p>
              )}

              <FieldLabel className="mt-3">Quotation Amount</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                placeholder="Enter quotation amount"
                readOnly={!isManualEntry} // Editable only if manual entry
              />

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
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={handleNextStep5}
              disabled={!isStep5Valid}
            >
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
              <FieldLabel>Follow-up Date</FieldLabel>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />

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
              <RadioGroup value={status} onValueChange={setStatus}>
                <FieldLabel>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Quote Done</FieldTitle>
                      <FieldDescription>
                        The quotation process is complete and finalized.
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="Quote-Done" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={saveWithSelectedProducts}
              disabled={!isStep6Valid}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
