"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import parse from "html-react-parser";

/* Helpers to split comma-separated strings into arrays */
const splitToArray = (value?: string, delimiter = ",") =>
    value ? value.split(delimiter).map((v) => v.trim()) : [];

/* Special splitter for descriptions by "||" */
const splitDescriptions = (value?: string) => {
    if (!value) return [];
    return value.split("||").map((desc) => desc.trim());
};

interface DoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (data: {
        tsmapprovedstatus: string;
        tsmapprovedremarks: string;
        tsmapproveddate: string;
    }) => void;
    loading?: boolean;

    quotation_number?: string | null;
    quotation_amount?: number | null;
    quotation_type?: string | null;

    /* Comma-separated strings for product info */
    product_quantity?: string;
    product_amount?: string;
    product_description?: string; // now delimited by || for descriptions
    product_photo?: string;
    product_sku?: string;
    product_title?: string;

    vat_type?: string;  // <-- Correctly typed optional string
}

export const DoneDialog: React.FC<DoneDialogProps> = ({
    open,
    onOpenChange,
    onConfirm,
    loading = false,

    quotation_number,
    quotation_amount,
    quotation_type,

    product_quantity,
    product_amount,
    product_description,
    product_photo,
    product_sku,
    product_title,
    vat_type,
}) => {
    const [tsmapprovedstatus, setTsmApprovedStatus] = useState("");
    const [tsmapprovedremarks, setTsmApprovedRemarks] = useState("");
    const [tsmapproveddate, setTsmApprovedDate] = useState("");

    useEffect(() => {
        if (!open) {
            setTsmApprovedStatus("");
            setTsmApprovedRemarks("");
            setTsmApprovedDate("");
        }
    }, [open]);

    /* Convert comma-separated strings to array of products */
    const products = useMemo(() => {
        const quantities = splitToArray(product_quantity);
        const amounts = splitToArray(product_amount);
        const descriptions = splitDescriptions(product_description).map((desc) =>
            desc.replace(/\n+/g, "\n")
        );
        const photos = splitToArray(product_photo);
        const skus = splitToArray(product_sku);
        const titles = splitToArray(product_title);

        return titles.map((_, i) => ({
            title: titles[i],
            quantity: Number(quantities[i] ?? 0),
            amount: Number(amounts[i] ?? 0),
            description: descriptions[i] || "-",
            photo: photos[i],
            sku: skus[i],
        }));
    }, [
        product_quantity,
        product_amount,
        product_description,
        product_photo,
        product_sku,
        product_title,
        vat_type, // <-- added here to update memo if vat_type changes
    ]);

    const handleConfirm = () => {
        onConfirm({
            tsmapprovedstatus,
            tsmapprovedremarks,
            tsmapproveddate,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{
                    maxWidth: "60rem",
                    width: "100%",
                    maxHeight: "95vh",
                    overflowY: "auto",
                }}
                className="p-6"
            >
                <DialogHeader className="pb-1">
                    <DialogTitle className="text-base font-semibold leading-tight">
                        Quotation Validation
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1 mb-2 max-w-[500px] leading-snug">
                        Review quotation details and products before approving.
                    </DialogDescription>
                </DialogHeader>

                {/* QUOTATION INFO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mt-2">
                    {/* Left column */}
                    <div>
                        <p className="text-muted-foreground">Quotation Number</p>
                        <p className="font-semibold">{quotation_number || "-"}</p>
                    </div>

                    <div className="text-right">
                        <p className="text-muted-foreground">Quotation Type</p>
                        <p className="font-semibold">{quotation_type || "-"}</p>
                    </div>

                    <div>
                        <p className="text-muted-foreground">Quotation Amount</p>
                        <p className="font-semibold">
                            {(quotation_amount ?? 0).toLocaleString("en-PH", {
                                style: "currency",
                                currency: "PHP",
                            })}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-muted-foreground">Vat Type</p>
                        <p className="font-semibold">{vat_type || "-"}</p>
                    </div>
                </div>

                {/* PRODUCTS */}
                <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase mb-2">Quotation Products</h4>

                    {products.length > 0 ? (
                        <table className="w-full text-xs border-collapse border border-gray-200 rounded-md">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-300 p-1 text-left" style={{ width: 80 }}>
                                        Photo
                                    </th>
                                    <th className="border border-gray-300 p-1 text-left" style={{ maxWidth: 400 }}>
                                        Product Details
                                    </th>
                                    <th className="border border-gray-300 p-1 text-right" style={{ width: 60 }}>
                                        Qty
                                    </th>
                                    <th className="border border-gray-300 p-1 text-right" style={{ width: 80 }}>
                                        Total Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p, i) => (
                                    <tr key={i} className="border-b border-gray-200 align-top">
                                        <td
                                            className="border border-gray-300 p-1 align-top"
                                            style={{ width: 80, maxWidth: 80 }}
                                        >
                                            {p.photo ? (
                                                <img
                                                    src={p.photo}
                                                    alt={p.title}
                                                    className="rounded object-cover border"
                                                    style={{ width: 80, height: 64, display: "block" }}
                                                />
                                            ) : (
                                                <div className="bg-gray-100 flex items-center justify-center text-gray-400 border rounded" style={{ width: 80, height: 64 }}>
                                                    No Image
                                                </div>
                                            )}
                                        </td>
                                        <td
                                            className="border border-gray-300 p-1 align-top"
                                            style={{
                                                maxWidth: 400,
                                                whiteSpace: "normal",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            <div className="font-bold text-green-700" style={{ marginBottom: 2 }}>
                                                {p.sku || "-"}
                                            </div>
                                            <div className="font-semibold" style={{ marginBottom: 2 }}>
                                                {p.title || "-"}
                                            </div>
                                            <div
                                                className="border p-1 rounded overflow-auto custom-scrollbar bg-white text-black text-xs"
                                                style={{ maxHeight: 300, whiteSpace: "normal", wordBreak: "break-word" }}
                                            >
                                                {p.description ? parse(p.description) : "-"}
                                            </div>
                                        </td>
                                        <td className="border border-gray-300 p-1 text-right">{p.quantity}</td>
                                        <td className="border border-gray-300 p-1 text-right font-semibold">
                                            {p.amount.toLocaleString("en-PH", {
                                                style: "currency",
                                                currency: "PHP",
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50 font-semibold">
                                    <td className="border border-gray-300 p-1 text-right" colSpan={2}>
                                        Total
                                    </td>
                                    <td className="border border-gray-300 p-1 text-right">
                                        {products.reduce((sum, p) => sum + p.quantity, 0)}
                                    </td>
                                    <td className="border border-gray-300 p-1 text-right">
                                        {products
                                            .reduce((sum, p) => sum + p.amount, 0)
                                            .toLocaleString("en-PH", {
                                                style: "currency",
                                                currency: "PHP",
                                            })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    ) : (
                        <p className="text-xs text-muted-foreground text-center">No products available</p>
                    )}
                </div>

                {/* APPROVAL FORM */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Remarks - full width on small screens, left side on sm+ */}
                    <div>
                        <label className="block font-medium mb-1">Remarks</label>
                        <textarea
                            value={tsmapprovedremarks}
                            onChange={(e) => setTsmApprovedRemarks(e.target.value)}
                            rows={6}
                            className="w-full rounded-md border px-3 py-2 resize-none"
                            placeholder="Enter remarks"
                        />
                    </div>

                    {/* Right side container for Date and Status */}
                    <div className="flex flex-col justify-start space-y-4">
                        <div>
                            <label className="block font-medium mb-1 text-left">Date</label>
                            <input
                                type="date"
                                value={tsmapproveddate}
                                onChange={(e) => setTsmApprovedDate(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-xs text-right"
                            />
                        </div>

                        <div>
                            <label className="block font-medium mb-1 text-left">Status</label>
                            <Select
                                value={tsmapprovedstatus}
                                onValueChange={setTsmApprovedStatus}
                            >
                                <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Decline">Decline</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                    </div>
                </div>

                {/* FOOTER */}
                <DialogFooter className="mt-4 flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || !tsmapprovedstatus}
                    >
                        {loading ? "Updating..." : "Confirm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
