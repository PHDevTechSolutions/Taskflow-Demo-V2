"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Completed {
    id: number;
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

    // Confirmation dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
        const total = products.reduce((sum, p) => {
            const qty = parseFloat(p.product_quantity ?? "0");
            const amt = parseFloat(p.product_amount ?? "0");
            if (!isNaN(qty) && !isNaN(amt)) {
                return sum + qty * amt;
            }
            return sum;
        }, 0);
        setQuotationAmount(total);
    }, [products]);

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

    const handlePhotoChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result) {
                setProducts((prev) => {
                    const newProducts = [...prev];
                    newProducts[index] = {
                        ...newProducts[index],
                        product_photo: reader.result as string,
                    };
                    return newProducts;
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const togglePreview = (index: number) => {
        setPreviewStates((prev) => {
            const newStates = [...prev];
            newStates[index] = !newStates[index];
            return newStates;
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

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent style={{ maxWidth: "90vw", width: "98vw" }}>
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Edit Quotation: {item.quotation_number || item.id} - {item.quotation_type}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Search input */}
                    <div className="mb-4 relative">
                        <Input
                            type="text"
                            className="uppercase"
                            value={searchTerm}
                            placeholder="Search product by Title or SKU..."
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
                        {searchResults.length > 0 && (
                            <ul className="absolute z-50 w-full max-h-64 overflow-auto border bg-white shadow-md rounded mt-1">
                                {searchResults.map((product) => (
                                    <li
                                        key={product.id}
                                        className="cursor-pointer px-4 py-2 hover:bg-gray-100 flex items-center space-x-4"
                                        onClick={() => handleAddProduct(product)}
                                    >
                                        {product.images?.[0]?.src ? (
                                            <img
                                                src={product.images[0].src}
                                                alt={product.title}
                                                className="w-12 h-12 object-contain rounded border"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">
                                                No Image
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{product.title}</span>
                                            <span className="text-xs text-gray-500">
                                                SKU: {product.skus?.join(", ") || "None"}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="overflow-auto max-h-[70vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Item</TableHead>
                                    <TableHead className="text-xs">Product Photo</TableHead>
                                    <TableHead className="text-xs">Title</TableHead>
                                    <TableHead className="text-xs">Description</TableHead>
                                    <TableHead className="text-xs">Quantity</TableHead>
                                    <TableHead className="text-xs">Amount</TableHead>
                                    <TableHead className="text-xs">Actions</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center p-4">
                                            No products found.
                                        </TableCell>
                                    </TableRow>
                                )}

                                {products.map((product, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-semibold align-top text-xs">{index + 1}</TableCell>

                                        <TableCell className="align-top text-xs">
                                            {product.product_photo && (
                                                <img
                                                    src={product.product_photo}
                                                    alt={`Product ${index + 1}`}
                                                    className="max-h-24 object-contain rounded border text-xs"
                                                />
                                            )}
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handlePhotoChange(index, e)}
                                                className="mt-2 border-none text-xs"
                                            />
                                        </TableCell>

                                        <TableCell className="align-top ">
                                            <Textarea
                                                value={product.product_title ?? ""}
                                                onChange={(e) =>
                                                    handleProductChange(index, "product_title", e.target.value)
                                                }
                                                className="border-none shadow-none"
                                            />
                                            <div className="mt-1 text-xs text-gray-500">
                                                SKU: {product.product_sku || <i>None</i>}
                                            </div>
                                        </TableCell>

                                        <TableCell className="align-top">
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Button variant="outline" size="sm" onClick={() => togglePreview(index)}>
                                                        {previewStates[index] ? "Edit" : "Preview"}
                                                    </Button>
                                                </div>
                                                {previewStates[index] ? (
                                                    <div
                                                        className="border p-2 rounded max-h-40 overflow-auto bg-white text-black text-xs"
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

                                        <TableCell className="align-top">
                                            <Button variant="destructive" size="sm" onClick={() => handleRemoveRow(index)}>
                                                Remove
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="mt-4 flex justify-between items-center">
                        <div className="font-semibold text-sm">
                            Total Quotation Amount:
                            ₱
                            {quotationAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>

                        <div className="flex space-x-2">
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
                        <Button onClick={handleDownload}>Download</Button>
                        <Button onClick={performSave}>Proceed to Save Only</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
