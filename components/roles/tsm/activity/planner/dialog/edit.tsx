"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from "@/components/ui/dialog";
import { Preview } from "./preview";

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

    // Signatories
    agentSignature?: string;
    agentContactNumber?: string;
    agentEmailAddress?: string;

    signature?: string;
    email?: string;
    contact?: string;
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

    // Signatories
    agentSignature,
    agentContactNumber,
    agentEmailAddress,

    signature,

}: TaskListEditDialogProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [previewStates, setPreviewStates] = useState<boolean[]>([]);
    const [quotationAmount, setQuotationAmount] = useState<number>(0);

    const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
    const [discount, setDiscount] = React.useState(0);
    const [vatType, setVatType] = React.useState<"vat_inc" | "vat_exe" | "zero_rated">("zero_rated");
    // Confirmation dialog state

    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState(false);

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

    // Download handler with your given logic integrated
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
                product_description: p.description?.trim()
                    ? p.description
                    : p.product_description || "",
                unitPrice,
                totalAmount,
            };
        });

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

            agentSignature: agentSignature ?? null,
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,

            signature: signature ?? null,
            tsmemail: email ?? null,
            tsmcontact: contact ?? null,
        };
    };

    const handleUpdateStatus = async (status: "Approved" | "Decline") => {
        if (!item.quotation_number) {
            alert("Missing activity reference number");
            return;
        }

        setIsUpdating(true);
        try {
            const res = await fetch("/api/activity/tsm/quotation/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quotation_number: item.quotation_number,
                    tsm_approved_status: status,
                    contact: contact,
                    email: email,
                    signature: signature ?? agentSignature
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Update failed");

            alert(`Quotation ${status} successfully`);
            onClose();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Something went wrong");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-[1000px] w-[95vw] max-h-[90vh] p-0 border-none bg-white shadow-2xl flex flex-col"
                    style={{ maxWidth: "950px", width: "100vw" }}
                >
                    {/* Scrollable content */}
                    <div className="flex flex-col flex-1 overflow-auto p-2 space-y-4">
                        <Preview
                            payload={getQuotationPayload()}
                            quotationType={quotation_type}
                            setIsPreviewOpen={setIsPreviewOpen}
                        />
                    </div>

                    {/* Footer always visible */}
                    <DialogFooter className="flex justify-end gap-4 border-t p-4 bg-white">
                        <button
                            onClick={() => handleUpdateStatus("Approved")}
                            disabled={isUpdating}
                            className="p-4 bg-green-600 text-white font-bold rounded-none hover:bg-green-700 disabled:opacity-50"
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => handleUpdateStatus("Decline")}
                            disabled={isUpdating}
                            className="p-4 bg-red-600 text-white font-bold rounded-none hover:bg-red-700 disabled:opacity-50"
                        >
                            Decline
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </>
    );
}
