"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle, } from "@/components/ui/item"
import { Download, Eye, Trash, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FieldLabel } from "@/components/ui/field";

import { Preview } from "./preview";
import ConfirmationDialog from "./confirmation";

// import jsPDF from "jspdf";
// import html2canvas from "html2canvas";

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
    quotation_number?: string;
    quotation_amount?: number | string;
    quotation_type: string;
    version?: string;

    // Submit to API
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
    tsmemail,
    tsmcontact,
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

    const [selectedRevisedQuotation, setSelectedRevisedQuotation] = useState<RevisedQuotation | null>(null);
    const [revisedQuotations, setRevisedQuotations] = useState<RevisedQuotation[]>([]);

    const [productsToDisplay, setProductsToDisplay] = useState(products);
    const activityReferenceNumber = item.activity_reference_number;

    const [startDate, setStartDate] = useState<string>(() => new Date().toISOString());
    const [liveTime, setLiveTime] = useState<Date>(() => new Date());
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString());

    useEffect(() => {
        // Pag-open ng dialog, itakda startDate sa current time, palaging bago
        const now = new Date();
        setStartDate(now.toISOString());
    }, []);

    // Increment liveTime and update endDate every second
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
                product_quantity,
                product_amount,
                product_title,
                product_description,
                product_photo,
                product_sku,
                quotation_amount: quotationAmount,
                quotation_type: item.quotation_type,
                quotation_number: item.quotation_number,
                // New Added
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
      end_date: endDate
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

    // Routing for product retrieval
    const [productSource, setProductSource] = useState<'shopify' | 'firebase'>('shopify');
    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

    // Download handler with your given logic integrated
    const DownloadExcel = async () => {
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
        const salestsmemail = tsmemail || "";
        const salestsmcontact = tsmcontact || "";
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
                description: p.description ?? "",
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
            salestsmemail: tsmemail ?? "",
            salestsmcontact: tsmcontact ?? "",

            salesmanagername: managername ?? "",
        };
    };

    useEffect(() => {
        if (!selectedRevisedQuotation) {
            // Do nothing, keep current products from default item
            return;
        }

        let productsArray = selectedRevisedQuotation.products;

        // If products is a string, parse it to array
        if (typeof productsArray === "string") {
            try {
                productsArray = JSON.parse(productsArray);
            } catch (e) {
                console.error("Failed to parse products JSON:", e);
                productsArray = [];
            }
        }

        if (Array.isArray(productsArray) && productsArray.length > 0) {
            // Map each product to ProductItem shape
            const mappedProducts: ProductItem[] = productsArray.map((p) => ({
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
            }));

            setProducts(mappedProducts);
        } else {
            // fallback: split concatenated strings into array to build products
            const splitAndTrim = (value?: string, delimiter = ","): string[] => {
                if (!value) return [];
                return value.split(delimiter).map((v) => v.trim());
            };

            const splitDescription = (value?: string): string[] => {
                if (!value) return [];
                return value.split("||").map((v) => v.trim());
            };

            const quantities = splitAndTrim(selectedRevisedQuotation.product_quantity);
            const amounts = splitAndTrim(selectedRevisedQuotation.product_amount);
            const titles = splitAndTrim(selectedRevisedQuotation.product_title);
            const descriptions = splitDescription(selectedRevisedQuotation.product_description);
            const photos = splitAndTrim(selectedRevisedQuotation.product_photo);
            const sku = splitAndTrim(selectedRevisedQuotation.product_sku);

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

        async function fetchRevisedQuotations() {
            const { data, error } = await supabase
                .from("revised_quotations")
                .select("*")
                .eq("activity_reference_number", activityReferenceNumber)
                .order("id", { ascending: false });

            if (error) {
                console.error("Failed to fetch revised quotations:", error);
            } else {
                setRevisedQuotations(data || []);
            }
        }

        fetchRevisedQuotations();
    }, [activityReferenceNumber]);

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent style={{ maxWidth: "90vw", width: "98vw" }}>
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Edit Quotation: {item.quotation_number || item.id} - {item.quotation_type}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold">Duration</label>
                            <div className="date-timestamps p-2 shadow-sm rounded w-40 text-center bg-black text-white font-mono">
                                <span>
                                    {startDate && endDate ? (() => {
                                        const start = new Date(startDate);
                                        const end = new Date(endDate);
                                        const diffMs = end.getTime() - start.getTime();

                                        if (diffMs <= 0) return "0s";

                                        const diffSeconds = Math.floor(diffMs / 1000) % 60;
                                        const diffMinutes = Math.floor(diffMs / (1000 * 60)) % 60;
                                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

                                        return `${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
                                    })() : "N/A"}
                                </span>
                            </div>
                        </div>
                    </div>

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
                                        className={`flex-1 py-6 text-[10px] font-bold transition-colors ${productSource === 'shopify' ? 'bg-[#121212] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
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
                                                    ITEM CODE: {product.skus?.join(", ") || "None"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 p-4 max-h-64 overflow-auto custom-scrollbar">
                                <h3 className="text-sm font-semibold mb-2">Revised Quotations History</h3>
                                {revisedQuotations.length === 0 ? (
                                    <p>No revised quotations found.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {revisedQuotations.map((q) => (
                                            <Item
                                                key={q.id}
                                                className={`border border-gray-300 rounded-sm p-3 shadow-sm hover:shadow-md transition cursor-pointer ${selectedRevisedQuotation?.id === q.id ? "bg-gray-100" : ""
                                                    }`}
                                                onClick={() => setSelectedRevisedQuotation(q)}
                                            >
                                                <ItemContent>
                                                    <ItemTitle className="font-semibold text-sm">
                                                        {q.version || "N/A"}
                                                    </ItemTitle>
                                                    <ItemDescription className="text-xs text-gray-600">
                                                        <div><strong>Product Title:</strong> {q.product_title || "N/A"}</div>
                                                        <div><strong>Amount:</strong> {q.quotation_amount ?? "N/A"}</div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            <span><strong>Start:</strong> {q.start_date ? new Date(q.start_date).toLocaleString() : "N/A"}</span><br />
                                                            <span><strong>End:</strong> {q.end_date ? new Date(q.end_date).toLocaleString() : "N/A"}</span>
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
                            <div className="flex items-center gap-4 justify-end border rounded p-2">
                                <span className="text-xs font-medium">VAT Type:</span>
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
                                            isChecked && vatType === "vat_exe"
                                                ? lineTotal * ((100 - discount) / 100)
                                                : lineTotal;

                                        return (
                                            <TableRow key={index}>
                                                <TableCell className="font-semibold align-top text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleCheckbox(index)}
                                                        disabled={vatType !== "vat_exe"}
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
                                                        ITEM CODE: {product.product_sku || <i>None</i>}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="flex flex-col">
                                                        ddd
                                                        {previewStates[index] ? (
                                                            <div
                                                                className="w-full max-h-90 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                                            dangerouslySetInnerHTML={{
                                                                __html: product.product_description || '<span class="text-gray-400 italic">No specifications provided.</span>'
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
                                className="bg-[#121212] rounded-none hover:bg-black text-white px-8 p-6 flex gap-2 items-center"
                                onClick={() => setIsPreviewOpen(true)} // Changed from handleDownloadQuotation
                            >
                                <Eye className="w-4 h-4" /> {/* Eye icon for "Preview" */}
                                <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
                            </Button>
                            <Button type="button" onClick={DownloadExcel} className="rounded-xs p-6 bg-green-600"><FileSpreadsheet /> Excel</Button>
                            <Button variant="outline" className="rounded-none p-6" onClick={onClose}>Cancel</Button>
                            <Button onClick={onClickSave} className="rounded-none p-6">Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onSave={performSave}
            />

            {/* PREVIEW PROTOCOL MODAL */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent
                    className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white shadow-2xl"
                    style={{ maxWidth: "950px", width: "100vw" }}
                >
                    <div className="sr-only">
                        <DialogTitle>Official Quotation Protocol Preview</DialogTitle>
                        <DialogDescription>Validated engineering export protocol.</DialogDescription>
                    </div>

                    {(() => {
                        // 1. DATA INITIALIZATION: Defined here so both the UI and handleDownloadQuotation can access it.
                        const payload = getQuotationPayload();
                        // 1. BRAND SELECTION LOGIC
                        const isEcoshift = quotation_type === "Ecoshift Corporation";

                        // 2. ASSET PATH RESOLUTION
                        const headerImagePath = isEcoshift
                            ? "/ecoshift-banner.png"
                            : "/disruptive-banner.png";

                        async function DownloadPDF() {
                            if (typeof window === 'undefined') return;

                            const PRIMARY_CHARCOAL = '#121212';
                            const OFF_WHITE = '#F9FAFA';

                            try {
                                const { default: jsPDF } = await import('jspdf');
                                const { default: html2canvas } = await import('html2canvas');
                                const payload = getQuotationPayload();
                                const isEcoshift = quotation_type === "Ecoshift Corporation";

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
                                            .sig-message { font-size: 9px; margin-bottom: 32px; font-weight: 500; line-height: 1.4; }
                                            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
                                            .sig-side-internal { display: flex; flex-direction: column; gap: 40px; }
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

                                // E. TERMS & SIGNATURES
                                const finalBlock = await renderBlock(`
                                                                        <div class="content-area" style="padding-top:0;">
                                                                            <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>

                                                                            <div class="logistics-container">
                                                                                <div class="logistics-row">
                                                                                    <div class="logistics-label bg-yellow-header">Included:</div>
                                                                                    <div class="logistics-value bg-yellow-content">
                                                                                        <p>• Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
                                                                                        <p>• Orders outside Metro Manila: Free delivery thresholds apply (₱10k Rizal, ₱15k Bulacan/Cavite, ₱25k Laguna/Pampanga/Batangas).</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="logistics-row">
                                                                                    <div class="logistics-label bg-yellow-header">Exclude:</div>
                                                                                    <div class="logistics-value bg-yellow-content">
                                                                                        <p>• All lamp poles are subject to delivery charge. Installation and all hardware/accessories not indicated above.</p>
                                                                                        <p>• Freight charges, arrastre, and other processing fees.</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="logistics-row">
                                                                                    <div class="logistics-label">Note:</div>
                                                                                    <div class="logistics-value bg-yellow-note" style="font-style: italic;">
                                                                                        <p>Deliveries are up to the vehicle unloading point only. Additional shipping fee applies for other areas.</p>
                                                                                        <span class="text-red-strong"><u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u></span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div class="terms-section">
                                                                                <div class="terms-header">Terms and Conditions</div>
                                                                                <div class="terms-grid">
                                                                                    <div class="terms-label">Availability:</div>
                                                                                    <div class="terms-val terms-highlight">
                                                                                        <p>5-7 days if on stock upon receipt of approved PO.</p>
                                                                                        <p>For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.</p>
                                                                                    </div>
                                                                                    
                                                                                    <div class="terms-label">Warranty:</div>
                                                                                    <div class="terms-val terms-highlight">
                                                                                        <p>One (1) year from the time of delivery for all busted lights except the damaged fixture. Warranty is VOID if unit is tampered, altered, or subjected to misuse.</p>
                                                                                    </div>

                                                                                    <div class="terms-label">SO Validity:</div>
                                                                                    <div class="terms-val terms-highlight">
                                                                                        <p>Sales order has validity period of 14 working days. Any order not confirmed/verified within this period will be automatically cancelled.</p>
                                                                                    </div>

                                                                                    <div class="terms-label">Storage</div>
                                                                                    <div class="terms-val terms-highlight">
                                                                                        <p>Orders undelivered after 14 days due to client shortcomings will be charged a storage fee of 10% of the value of the orders per month (0.33% per day).</p>
                                                                                    </div>

                                                                                    <div class="terms-label">Bank Details:</div>
                                                                                    <div class="terms-val">
                                                                                        <div class="bank-grid">
                                                                                            <div><strong>METROBANK</strong><br/>Payee: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Acc: ${isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</div>
                                                                                            <div><strong>BDO</strong><br/>Payee: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Acc: ${isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</div>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div class="terms-label">Validity:</div>
                                                                                    <div class="terms-val terms-highlight">
                                                                                        <p><u>Thirty (30) calendar days from the date of this offer.</u></p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div class="sig-hierarchy">
                                                                                <p class="sig-message">
                                                                                    Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                                                                                    Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                                                                                </p>

                                                                                <div class="sig-grid">
                                                                                    <div class="sig-side-internal">
                                                                                        <div>
                                                                                            <p style="font-style: italic; font-size: 10px; font-weight: 900; margin-bottom: 4px;">${isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                                                                                            <div class="sig-line"></div>
                                                                                            <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salesRepresentative}</p>
                                                                                            <p class="sig-sub-label">Sales Representative</p>
                                                                                            <p style="font-size: 8px; font-style: italic;">${payload.salescontact} | ${payload.salesemail}</p>
                                                                                        </div>

                                                                                        <div>
                                                                                            <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af;">Approved By:</p>
                                                                                            <div class="sig-line" style="margin-top: 16px;"></div>
                                                                                            <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salestsmname || "SALES MANAGER"}</p>
                                                                                            <p style="font-size: 9px; color: #6b7280; font-weight: bold; font-style: italic;">Mobile: ${payload.salesmanagername}</p>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div class="sig-side-client">
                                                                                        <div>
                                                                                            <div class="sig-rep-box">Company Authorized Representative PLEASE SIGN OVER PRINTED NAME</div>
                                                                                            <div class="sig-line" style="margin-top: 4px;"></div>
                                                                                        </div>
                                                                                        <div style="width: 256px;">
                                                                                            <div class="sig-line" style="margin-top: 40px;"></div>
                                                                                            <p style="font-size: 9px; text-align: right; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Payment Release Date</p>
                                                                                        </div>
                                                                                        <div style="width: 256px;">
                                                                                            <div class="sig-line" style="margin-top: 40px;"></div>
                                                                                            <p style="font-size: 9px; text-align: right; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Position in the Company</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    `);
                                if (currentY + finalBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
                                    pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
                                    pageCount++;
                                }
                                pdf.addImage(finalBlock.img, 'JPEG', 0, currentY, pdfWidth, finalBlock.h);

                                // 3. FINALIZATION
                                pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
                                document.body.removeChild(iframe);

                            } catch (error) {
                                console.error("Critical Export Error:", error);
                            }
                        }

                        // 3. UI RENDERING
                        return (
                            <>
                                <Preview
                                    payload={getQuotationPayload()}
                                    quotationType={quotation_type}
                                    setIsPreviewOpen={setIsPreviewOpen}
                                    DownloadPDF={DownloadPDF}
                                />
                            </>
                        );

                    })()}

                </DialogContent>
            </Dialog>
        </>
    );
}
