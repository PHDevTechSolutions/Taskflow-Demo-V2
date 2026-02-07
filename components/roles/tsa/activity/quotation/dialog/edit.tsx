"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Download, Eye, Trash } from "lucide-react";
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
import { FieldLabel } from "@/components/ui/field";

interface Completed {
    id: number;
    end_date?: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    quotation_number?: string;
    quotation_amount?: number | string;
    quotation_type: string;
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
}

interface Product {
    id: string;
    title: string;
    description?: string;
    images?: { src: string }[];
    skus?: string[];
    price?: string;
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
    managername?: string;
}

function splitAndTrim(value?: string): string[] {
    if (!value) return [];
    return value.split(",").map((v) => v.trim());
}

function joinArray(arr: (string | undefined)[]): string {
    return arr.filter((v) => v !== undefined && v !== "").join(", ");
}

function splitDescription(value?: string): string[] {
    if (!value) return [];
    return value.split("||").map((v) => v.trim());
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
    managername,
}: TaskListEditDialogProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [previewStates, setPreviewStates] = useState<boolean[]>([]);
    const [quotationAmount, setQuotationAmount] = useState<number>(0);

    // For search and add new product
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [isManualEntry, setIsManualEntry] = useState<boolean>(false);

    const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
    const [discount, setDiscount] = React.useState(0);
    const [vatType, setVatType] = React.useState<"vat_inc" | "vat_exe" | "zero_rated">("zero_rated");
    // Confirmation dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [endDate, setEndDate] = useState<string>(item.end_date ?? "");
    // Live time for showing live clock with fixed date
    const [liveTime, setLiveTime] = useState<Date>(() => {
        // Initialize with end_date time or current date fallback
        return item.end_date ? new Date(item.end_date) : new Date();
    });

    useEffect(() => {
        let baseTime = item.end_date ? new Date(item.end_date) : new Date();
        let secondsPassed = 0;

        const interval = setInterval(() => {
            secondsPassed++;
            const newLiveTime = new Date(baseTime.getTime() + secondsPassed * 1000);
            setLiveTime(newLiveTime);
            setEndDate(newLiveTime.toISOString().slice(0, 19)); // Example format: "2026-02-05T08:12:34"
        }, 1000);

        return () => clearInterval(interval);
    }, [item.end_date]);

    // These can be from props or item or company info
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
    const address = company?.address || ""; // add if available
    const email_address = company?.email_address || ""; // add if available
    const contact_person = company?.contact_number || ""; // add if available
    const quotation_number = quotationNumber;
    const activityRef = ""; // fallback if needed
    const formattedDate = new Date().toLocaleDateString();

    useEffect(() => {
        const quantities = splitAndTrim(item.product_quantity);
        const amounts = splitAndTrim(item.product_amount);
        const titles = splitAndTrim(item.product_title);
        const descriptions = splitDescription(item.product_description);
        const photos = splitAndTrim(item.product_photo);
        const sku = splitAndTrim(item.product_sku);

        const maxLen = Math.max(
            quantities.length,
            amounts.length,
            titles.length,
            descriptions.length,
            photos.length,
            sku.length
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
                quantity: 0,
                description: "",
                skus: undefined,
                title: "",
                images: undefined,
                isDiscounted: false,
                price: 0
            });
        }

        setProducts(arr);
    }, [item]);

    useEffect(() => {
        setPreviewStates(products.map(() => true));
    }, [products]);

    useEffect(() => {
        let total = 0;
        products.forEach((p, idx) => {
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const amt = parseFloat(p.product_amount ?? "0") || 0;
            let lineTotal = qty * amt;

            // If this row is checked AND vatType is vat_inc, apply discount
            if (checkedRows[idx] && vatType === "vat_inc") {
                const discounted = lineTotal * ((100 - discount) / 100);
                lineTotal = discounted;
            }

            total += lineTotal;
        });
        setQuotationAmount(total);
    }, [products, checkedRows, discount, vatType]);

    const handleProductChange = (
        index: number,
        field: keyof ProductItem,
        value: string
    ) => {
        setProducts((prev) => {
            const newProducts = [...prev];
            newProducts[index] = { ...newProducts[index], [field]: value };
            return newProducts;
        });
    };

    const handleRemoveRow = (index: number) => {
        setProducts((prev) => {
            const newProducts = [...prev];
            newProducts.splice(index, 1);
            return newProducts;
        });
        setPreviewStates((prev) => {
            const newStates = [...prev];
            newStates.splice(index, 1);
            return newStates;
        });
    };

    const extractTableDescription = (description: string): string => {
        const match = description.match(/<table\b[^>]*>[\s\S]*?<\/table>/i);
        if (match) {
            return match[0];
        }
        return "";
    };

    const handleAddProduct = (product: Product) => {
        const tableDescription = extractTableDescription(product.description || "");

        setProducts((prev) => [
            ...prev,
            {
                product_quantity: "1",
                product_amount: product.price || "0",
                product_title: product.title,
                product_description: tableDescription,
                product_photo: product.images?.[0]?.src || "",
                product_sku: product.skus?.[0] || "",
                description: product.description || "",
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

    // Actual save function
    const performSave = async () => {
        try {
            const product_quantity = joinArray(products.map((p) => p.product_quantity));
            const product_amount = joinArray(products.map((p) => p.product_amount));
            const product_title = joinArray(products.map((p) => p.product_title));
            const product_description = products
                .map((p) => p.product_description || "")
                .join(" || ");
            const product_photo = joinArray(products.map((p) => p.product_photo));
            const product_sku = joinArray(products.map((p) => p.product_sku));

            const bodyData: Completed = {
                id: item.id,
                end_date: endDate,
                product_quantity,
                product_amount,
                product_title,
                product_description,
                product_photo,
                product_sku,
                quotation_amount: quotationAmount,
                quotation_type: item.quotation_type,
            };

            const res = await fetch(`/api/act-update-history?id=${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyData),
            });

            if (!res.ok) throw new Error("Failed to update activity");

            toast.success("Activity updated successfully!");
            onSave();
            setShowConfirmDialog(false);
        } catch (error) {
            toast.error("Update failed! Please try again.");
        }
    };

    // Download handler with your given logic integrated
    const handleDownload = async () => {
        // Prepare data arrays
        const productCats = productTitle.split(",");
        const quantities = productQuantity ? productQuantity.split(",") : [];
        const amounts = productAmount ? productAmount.split(",") : [];
        const photos = productPhoto ? productPhoto.split(",") : [];
        const titles = productTitle ? productTitle.split(",") : [];
        const skus = productSku ? productSku.split(",") : [];
        const descriptions = productDescription ? productDescription.split("||") : [];

        const salesRepresentativeName = `${firstname} ${lastname}`;

        // Email username and domain
        const emailUsername = email?.split("@")[0] || "";
        let emailDomain = "";
        if (company_name === "Disruptive Solutions Inc") {
            emailDomain = "disruptivesolutionsinc.com";
        } else if (company_name === "Ecoshift Corporation") {
            emailDomain = "ecoshiftcorp.com";
        } else {
            emailDomain = email?.split("@")[1] || "";
        }

        const salesemail = `${emailUsername}@${emailDomain}`;
        const salescontact = contact || "";
        const salestsmname = tsmname || "";
        const salesmanagername = managername || "";

        // Construct items
        const items = productCats.map((_, index) => {
            const qty = Number(quantities[index] || 0);
            const amount = Number(amounts[index] || 0);
            const photo = photos[index] || "";
            const title = titles[index] || "";
            const sku = skus[index] || "";
            const description = descriptions[index] || "";

            const descriptionTable = `<table>
      <tr><td>${title}</td></tr>
      <tr><td>${sku}</td></tr>
      <tr><td>${description}</td></tr>
    </table>`;

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
            address: address,
            telNo: contact_number,
            email: email_address,
            attention: `${contact_person}, ${address}`,
            subject: "For Quotation",
            items,
            vatType: "Vat Inc",
            totalPrice: Number(quotationAmountNum),
            salesRepresentative: salesRepresentativeName,
            salesemail,
            salescontact,
            salestsmname,
            salesmanagername,
        };

        // API endpoint
        let apiEndpoint = "/api/quotation/disruptive";
        if (quotation_type === "Ecoshift Corporation") {
            apiEndpoint = "/api/quotation/ecoshift";
        } else if (quotation_type === "Disruptive Solutions Inc") {
            apiEndpoint = "/api/quotation/disruptive";
        }

        try {
            const resExport = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(quotationData),
            });

            if (!resExport.ok) {
                toast.error("Failed to export quotation.");
                setShowConfirmDialog(false);
                return;
            }

            const blob = await resExport.blob();
            const url = URL.createObjectURL(blob);

            // Trigger download
            const link = document.createElement("a");
            link.href = url;
            link.download = `quotation_${quotationNumber || item.id}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setShowConfirmDialog(false);
        } catch (error) {
            toast.error("Export failed. Please try again.");
            setShowConfirmDialog(false);
        }
    };

    // Show confirmation dialog when Save clicked
    const onClickSave = () => {
        setShowConfirmDialog(true);
    };

    const toggleCheckbox = (index: number) => {
        setCheckedRows((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    // Prepare live clock display with fixed date from endDate
    const displayDateTime = liveTime;

    // Routing for product retrieval
    const [productSource, setProductSource] = useState<'shopify' | 'firebase'>('shopify');

    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

    const getQuotationPayload = () => {
        const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
        const emailUsername = email?.split("@")[0] ?? "";

        let emailDomain = "";
        if (quotation_type === "Disruptive Solutions Inc") {
            emailDomain = "disruptivesolutionsinc.com";
        } else if (quotation_type === "Ecoshift Corporation") {
            emailDomain = "ecoshiftcorp.com";
        } else {
            emailDomain = email?.split("@")[1] ?? "";
        }

        const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

        const items = products.map((p: ProductItem, index: number) => {
            // Use the 'product_xxx' fields which are updated by handleProductChange
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const unitPrice = parseFloat(p.product_amount ?? "0") || 0;
            const isDiscounted = checkedRows[index] ?? false; // Use the row's checked state

            const baseAmount = qty * unitPrice;
            const discountedAmount = (isDiscounted && vatType === "vat_inc")
                ? (baseAmount * discount) / 100
                : 0;
            const totalAmount = baseAmount - discountedAmount;

            return {
                itemNo: index + 1,
                qty,
                // Ensure these match the fields initialized in your useEffect
                photo: p.product_photo ?? "",
                title: p.product_title ?? "",
                sku: p.product_sku ?? "",
                description: p.product_description ?? "",
                unitPrice,
                totalAmount,
            };
        });

        const handleDownloadPDF = async () => {
            const payload = getQuotationPayload();

            try {
                let apiEndpoint = "/api/quotation/disruptive/pdf"; // Adjust based on your API structure
                if (quotation_type === "Ecoshift Corporation") {
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
        };
    };

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent style={{ maxWidth: "90vw", width: "98vw" }}>
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Edit Quotation: {item.quotation_number || item.id} - {item.quotation_type}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Container for left (search grid) and right (table) */}
                    <div className="flex space-x-4" style={{ height: "70vh" }}>
                        {/* Left side: Search input + product grid */}
                        <div className="flex flex-col w-1/3 gap-4 overflow-y-auto pr-2">
                            <div className="flex flex-col gap-4 sticky top-0 bg-white z-10 pb-2">
                                <div className="flex border rounded-md overflow-hidden border-gray-300">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProductSource('shopify');
                                            setSearchTerm("");       // Protocol: Reset input
                                            setSearchResults([]);   // Protocol: Clear results
                                        }}
                                        className={`flex-1 py-2 text-[10px] font-bold transition-colors ${productSource === 'shopify' ? 'bg-[#121212] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        SHOPIFY
                                    </button>
                                    <button
                                        type="button"
                                        hidden={true}
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
                                                    if (productSource === 'shopify') {
                                                        const res = await fetch(`/api/shopify/products?q=${rawValue.toLowerCase()}`);
                                                        let data = await res.json();
                                                        setSearchResults(data.products || []);
                                                    } else {
                                                        const searchUpper = rawValue.toUpperCase();
                                                        const q = query(collection(db, "products"));
                                                        const querySnapshot = await getDocs(q);

                                                        const firebaseResults = querySnapshot.docs.map(doc => {
                                                            const data = doc.data();

                                                            // 1. Build Specifications HTML and Searchable Text
                                                            let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
                                                            let rawSpecsText = "";

                                                            if (data.technicalSpecs?.[0]?.rows) {
                                                                specsHtml += `<table style="width:100%; border-collapse: collapse; font-size: 11px;">`;
                                                                data.technicalSpecs[0].rows.forEach((row: any) => {
                                                                    rawSpecsText += ` ${row.name} ${row.value}`;
                                                                    specsHtml += `<tr>
          <td style="border: 1px solid #e5e7eb; padding: 4px; background: #f9fafb;"><b>${row.name}</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 4px;">${row.value}</td>
        </tr>`;
                                                                });
                                                                specsHtml += `</table>`;
                                                            }

                                                            // 2. Map to Product format and resolve ID mismatch
                                                            return {
                                                                // Convert string ID to a hash number if your system strictly requires numbers
                                                                id: Math.abs(doc.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)),
                                                                title: data.name || "No Name",
                                                                price: data.salePrice || data.regularPrice || 0,
                                                                description: specsHtml,
                                                                images: data.mainImage ? [{ src: data.mainImage }] : [],
                                                                skus: data.sku ? [data.sku] : [],
                                                                discount: 0,
                                                                // We attach the search string temporarily for the filter
                                                                tempSearchMetadata: (data.name + " " + (data.sku || "") + " " + rawSpecsText).toUpperCase()
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
                                        {isSearching && <p className="text-[10px] animate-pulse">Searching Source...</p>}
                                    </>
                                )}
                            </div>

                            {/* Search results grid */}
                            <div className="overflow-auto border rounded p-2 bg-white flex-grow">
                                {searchResults.length === 0 && searchTerm.length >= 2 && (
                                    <p className="text-xs text-center text-gray-500 mt-8">No products found.</p>
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
                                                <span className="font-semibold text-xs">{product.title}</span>
                                                <span className="text-xs text-gray-500">
                                                    SKU: {product.skus?.join(", ") || "None"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right side: Products table */}
                        <div className="flex flex-col w-1/1 overflow-auto border rounded p-2 bg-white">
                            <div className="flex items-center gap-4 justify-end border rounded p-2">
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Item</TableHead>
                                        <TableHead className="text-xs">Product Photo</TableHead>
                                        <TableHead className="text-xs">Title</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                        <TableHead className="text-xs">Quantity</TableHead>
                                        <TableHead className="text-xs">Amount</TableHead>
                                        <TableHead className="text-xs">Total Amount</TableHead>
                                        <TableHead className="text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {products.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center p-4 text-xs">
                                                No products found.
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {products.map((product, index) => {
                                        const qty = parseFloat(product.product_quantity ?? "0") || 0;
                                        const amt = parseFloat(product.product_amount ?? "0") || 0;
                                        const lineTotal = qty * amt;
                                        const isChecked = checkedRows[index] || false;

                                        // Calculate discounted total for this row if applicable
                                        const discountedTotal =
                                            isChecked && vatType === "vat_inc"
                                                ? lineTotal * ((100 - discount) / 100)
                                                : lineTotal;

                                        return (
                                            <TableRow key={index}>
                                                <TableCell className="font-semibold align-top text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleCheckbox(index)}
                                                        disabled={vatType !== "vat_inc"}
                                                        className="h-5 w-5 rounded-full"
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top text-xs">
                                                    {product.product_photo && (
                                                        <img
                                                            src={product.product_photo}
                                                            alt={`Product ${index + 1}`}
                                                            className="max-h-24 object-contain rounded-sm border text-xs"
                                                        />
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top ">
                                                    <Textarea
                                                        value={product.product_title ?? ""}
                                                        onChange={(e) =>
                                                            handleProductChange(index, "product_title", e.target.value)
                                                        }
                                                        className="border-none p-0 shadow-none"
                                                    />
                                                    <div className="text-xs text-gray-500">
                                                        SKU: {product.product_sku || <i>None</i>}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="flex flex-col">
                                                        {previewStates[index] ? (
                                                            <div
                                                                className="border p-2 rounded max-h-40 overflow-auto custom-scrollbar bg-white text-black text-xs"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: product.product_description || "<i>No description</i>",
                                                                }}
                                                            />
                                                        ) : (
                                                            <Textarea
                                                                value={product.product_description ?? ""}
                                                                onChange={(e) =>
                                                                    handleProductChange(index, "product_description", e.target.value)
                                                                }
                                                                rows={6}
                                                                className="text-xs"
                                                                placeholder="Paste or edit product description HTML here"
                                                            />
                                                        )}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={product.product_quantity ?? ""}
                                                        onChange={(e) =>
                                                            handleProductChange(index, "product_quantity", e.target.value)
                                                        }
                                                        className="border-none shadow-none text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={product.product_amount ?? ""}
                                                        onChange={(e) =>
                                                            handleProductChange(index, "product_amount", e.target.value)
                                                        }
                                                        className="border-none shadow-none text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell className="align-top font-semibold text-xs">
                                                    ₱{discountedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <Button variant="destructive" size="sm" onClick={() => handleRemoveRow(index)}>
                                                        <Trash />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="flex justify-end font-semibold text-sm">
                        Subtotal: ₱
                        {quotationAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </div>

                    <DialogFooter className="mt-4 flex justify-between items-center">
                        <div className="font-semibold text-sm">
                            Actual Quotation Amount: ₱
                            {item.quotation_amount}
                        </div>

                        <div className="flex space-x-2">
                            <Button
                                className="bg-[#121212] hover:bg-black text-white px-8 flex gap-2 items-center"
                                onClick={() => setIsPreviewOpen(true)} // Changed from handleDownloadQuotation
                            >
                                <Eye className="w-4 h-4" /> {/* Eye icon for "Preview" */}
                                <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
                            </Button>
                            <Button onClick={handleDownload}>Download</Button>
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>

                            <Button onClick={onClickSave}>Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={() => setShowConfirmDialog(false)}>
                <DialogContent style={{ maxWidth: "30vw" }}>
                    <DialogHeader>
                        <DialogTitle>Confirm Save</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm p-4">
                        Do you want to download the quotation or just proceed to save?
                    </div>
                    <DialogFooter className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={performSave}>Proceed to Save Only</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PREVIEW PROTOCOL MODAL */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent
                    className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-[#F9FAFA] shadow-2xl"
                    style={{ maxWidth: "950px", width: "100vw" }}
                >
                    {(() => {
                        const payload = getQuotationPayload();

                        // 1. BRAND SELECTION LOGIC
                        const isEcoshift = quotation_type === "Ecoshift Corporation";

                        // 2. ASSET PATH RESOLUTION
                        const headerImagePath = isEcoshift
                            ? "/ecoshift-banner.png"
                            : "/disruptive-banner.png";

                        function handleDownloadQuotation() {
                            throw new Error("Function not implemented.");
                        }

                        return (
                            <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]">

                                {/* CORPORATE BRANDING HEADER */}
                                <div className="w-full flex justify-center py-6 border-b border-gray-100 bg-white">
                                    <div className="w-full max-w-[900px] h-[110px] relative flex items-center justify-center overflow-hidden">
                                        <img
                                            key={quotation_type}
                                            src={headerImagePath}
                                            alt={`${quotation_type} Header`}
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

                                <div className="px-12 py-8 space-y-1">
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
                                    <div className="mt-8 border-l border-r border-black">
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
                                                className={`grid grid-cols-6 py-2 px-4 items-center min-h-[35px]
                    ${info.borderTop ? 'border-t border-black' : ''} 
                    ${info.borderBottom ? 'border-b border-black' : ''}
                  `}
                                            >
                                                <span className="col-span-1 font-black text-[10px] text-[#121212]">{info.label}:</span>
                                                <span className="col-span-5 text-[11px] font-bold text-gray-700 pl-4">{info.value || "---"}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-[10px] italic py-8 text-gray-500 font-medium">
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
                                                {payload.items.map((item: { itemNo: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; qty: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; photo: string | Blob | undefined; title: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; sku: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; description: any; unitPrice: { toLocaleString: (arg0: undefined, arg1: { minimumFractionDigits: number; }) => string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }; totalAmount: { toLocaleString: (arg0: undefined, arg1: { minimumFractionDigits: number; }) => string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }; }, idx: React.Key | null | undefined) => (
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
                                                <p>Orders outside Metro Manila: Free delivery thresholds apply (₱10k Rizal, ₱15k Bulacan/Cavite, ₱25k Laguna/Pampanga/Batangas).</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-6 border-b border-black">
                                            <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Excluded:</div>
                                            <div className="col-span-5 p-2 bg-yellow-100">
                                                <p>• All lamp poles are subject to delivery charge. Installation and all hardware/accessories not indicated above.</p>
                                                <p>• Freight charges, arrastre, and other processing fees.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-6 bg-yellow-50">
                                            <div className="col-span-1 p-2 font-black border-r border-black">Note:</div>
                                            <div className="col-span-5 p-2 italic">
                                                Deliveries are up to the vehicle unloading point only. Additional shipping fee applies for other areas.
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
                                                <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.</p>
                                            </div>

                                            <div className="col-span-2 font-black uppercase">Warranty:</div>
                                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                                <p>One (1) year from the time of delivery for all busted lights except the damaged fixture. Warranty is VOID if unit is tampered, altered, or subjected to misuse.</p>
                                            </div>

                                            <div className="col-span-2 font-black uppercase">SO Validity:</div>
                                            <div className="col-span-10 pl-4 border-l border-gray-100">
                                                <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. Any order not confirmed/verified within this period will be <span className="text-red-600 font-black">automatically cancelled</span>.</p>
                                            </div>

                                            <div className="col-span-2 font-black uppercase">Storage:</div>
                                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                                <p>Orders undelivered after 14 days due to client shortcomings will be charged a storage fee of <span className="text-red-600 font-black">10% of the value of the orders per month (0.33% per day)</span>.</p>
                                            </div>

                                            <div className="col-span-2 font-black uppercase">Bank Details:</div>
                                            <div className="col-span-10 pl-4 border-l border-gray-100 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="font-black">METROBANK (Payee: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'})</p>
                                                    <p>Account Number: {isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black">BDO (Payee: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'})</p>
                                                    <p>Account Number: {isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</p>
                                                </div>
                                            </div>

                                            <div className="col-span-2 font-black uppercase">Validity:</div>
                                            <div className="col-span-10 pl-4 border-l border-gray-100">
                                                <p className="text-red-600 font-black underline">Thirty (30) calendar days from the date of this offer.</p>
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
                                                    <p className="italic text-[10px] font-black mb-4">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                                                    <div className="border-b border-black w-64"></div>
                                                    <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sales Representative</p>
                                                    <p className="text-[8px] italic">{payload.salescontact} | {payload.salesemail}</p>
                                                </div>

                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-gray-400">Approved By:</p>
                                                    <div className="border-b border-black w-64 mt-4"></div>
                                                    <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname || "SALES MANAGER"}</p>
                                                    <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salesmanagername}</p>
                                                </div>

                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-gray-400">Noted By:</p>
                                                    <div className="border-b border-black w-64 mt-4"></div>
                                                    <p className="text-[11px] font-black underline mt-1"></p>
                                                    <p className="text-[9px] font-black uppercase tracking-tighter"></p>
                                                </div>
                                            </div>

                                            {/* Right Side: Client Side */}
                                            <div className="space-y-10 flex flex-col items-end">
                                                <div className="w-64">
                                                    <div className="h-10 w-full bg-red-400/10 border border-red-400 flex items-center justify-center text-[8px] font-black text-red-600 uppercase text-center px-2">
                                                        Company Authorized Representative PLEASE SIGN OVER PRINTED NAME
                                                    </div>
                                                    <div className="border-b border-black w-full mt-1"></div>
                                                </div>

                                                <div className="w-64">
                                                    <div className="border-b border-black w-full mt-10"></div>
                                                    <p className="text-[9px] text-right font-black mt-1 uppercase tracking-widest">Payment Release Date</p>
                                                </div>

                                                <div className="w-64">
                                                    <div className="border-b border-black w-full mt-10"></div>
                                                    <p className="text-[9px] text-right font-black mt-1 uppercase tracking-widest">Position in the Company</p>
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
