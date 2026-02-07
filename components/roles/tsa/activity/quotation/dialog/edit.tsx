"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Trash } from "lucide-react";
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
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleDownload}>Download</Button>
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
        </>
    );
}
