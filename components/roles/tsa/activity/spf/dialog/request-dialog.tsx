"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import imageCompression from "browser-image-compression";

interface Props {
    open: boolean;
    onClose: () => void;
    isEditMode: boolean;
    prepared_by?: string;
    currentSPF: any;
    setCurrentSPF: (data: any) => void;
    handleCreateSPF: (payload?: any) => void;
    handleEditSPF: (payload?: any) => void;
    referenceid: string;
}

function formatDuration(startISO: string, endISO: string) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    let diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

type ItemDescription = { type: "text" | "file"; value: string };

export function RequestDialog({
    open,
    onClose,
    isEditMode,
    currentSPF,
    setCurrentSPF,
    handleCreateSPF,
    handleEditSPF,
    referenceid,
}: Props) {
    const [loadingSPF, setLoadingSPF] = useState(false);
    const [uploadingItem, setUploadingItem] = useState<number | null>(null);
    const [itemDescriptions, setItemDescriptions] = useState<ItemDescription[]>([]);

    // Initialize itemDescriptions when dialog opens or currentSPF changes
    useEffect(() => {
        if (open) {
            if (currentSPF?.item_description) {
                // Support comma-separated text for backward compatibility
                const items = currentSPF.item_description.split(",").map((v: string) => ({ type: "text", value: v }));
                setItemDescriptions(items);
            } else {
                setItemDescriptions([]);
            }
        }
    }, [open]);

    const leftFields = [
        { label: "Customer Name", key: "customer_name" },
        { label: "Contact Person", key: "contact_person" },
        { label: "Contact Number", key: "contact_number" },
        { label: "Registered Address", key: "registered_address" },
        { label: "Delivery Address", key: "delivery_address" },
        { label: "Billing Address", key: "billing_address" },
        { label: "Collection Address", key: "collection_address" },
        { label: "Tin Number", key: "tin_no" },
    ];

    const rightFields = [
        { label: "SPF Number", key: "spf_number" },
        { label: "Payment Terms", key: "payment_terms" },
        { label: "Warranty", key: "warranty" },
        { label: "Delivery Date", key: "delivery_date", type: "date" },
        { label: "Special Instructions", key: "special_instructions" },
        { label: "Item Description", key: "item_description" },
        { label: "Sales Person", key: "sales_person" },
        { label: "Prepared By", key: "prepared_by" },
        { label: "Approved By", key: "approved_by" },
    ];

    const compressImage = async (file: File) => {
        const options = {
            maxSizeMB: 0.5, // target <= 0.5 MB
            maxWidthOrHeight: 1920, // maintain reasonable resolution
            useWebWorker: true,
        };
        return await imageCompression(file, options);
    };


    const compressFile = async (file: File) => {
        if (file.type.startsWith("image/")) {
            return await compressImage(file);
        }
        if (file.type === "application/pdf") {
            // For PDF, we just let Cloudinary handle optimization
            return file;
        }
        return file;
    };

    // Only upload if it's a new File
    const handleItemUpload = async (file: File, index: number) => {
        setUploadingItem(index);

        try {
            const compressedFile = await compressFile(file);

            // Delete previous file if URL
            const prev = itemDescriptions[index];
            if (prev?.type === "file" && prev.value.startsWith("http")) {
                await fetch("/api/cloudinary/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ public_id: prev.value.split("/").pop()?.split(".")[0] }),
                });
            }

            const data = new FormData();
            data.append("file", compressedFile);
            data.append("upload_preset", "Xchire");
            data.append("folder", "spf_items");

            const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload", {
                method: "POST",
                body: data,
            });
            const uploaded = await res.json();

            const updated = [...itemDescriptions];
            updated[index] = { type: "file", value: uploaded.secure_url };
            setItemDescriptions(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setUploadingItem(null);
        }
    };

    const handleSubmit = () => {
        const updatedSPF = {
            ...currentSPF,
            item_description: itemDescriptions.map(i => i.value).join(","), // store only values
        };
        setCurrentSPF(updatedSPF);
        setLoadingSPF(true);

        if (isEditMode) handleEditSPF(updatedSPF);
        else handleCreateSPF(updatedSPF);

        setLoadingSPF(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl rounded-none p-6">
                <DialogHeader>
                    <DialogTitle className="text-1xl font-semibold">
                        {isEditMode ? "Edit SPF" : "Request SPF"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                    {/* LEFT CARD */}
                    <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border">
                        {leftFields.map((field) => (
                            <div key={field.key} className="flex flex-col">
                                <label className="text-xs font-medium text-muted-foreground mb-1">
                                    {field.label}
                                </label>
                                <Input
                                    type="text"
                                    value={currentSPF?.[field.key] || ""}
                                    className="rounded-none"
                                    onChange={(e) =>
                                        setCurrentSPF({ ...currentSPF, [field.key]: e.target.value })
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    {/* RIGHT CARD */}
                    <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border relative">
                        {/* Top right SPF Number */}
                        <div className="absolute top-6 right-6 w-40">
                            <label className="text-xs font-medium text-muted-foreground mb-1">
                                SPF Number
                            </label>
                            <Input
                                type="text"
                                className="rounded-none"
                                value={currentSPF?.spf_number || ""}
                                readOnly
                            />
                        </div>

                        {/* Middle fields */}
                        <div className="mt-12 space-y-4">
                            {rightFields
                                .filter((f) => f.key !== "spf_number" && f.key !== "prepared_by" && f.key !== "approved_by")
                                .map((field) => (
                                    <div key={field.key} className="flex flex-col">
                                        <label className="text-xs font-medium text-muted-foreground mb-1">
                                            {field.label}
                                        </label>

                                        {field.key === "special_instructions" ? (
                                            <textarea
                                                className="border rounded-none p-2 text-sm min-h-[120px]"
                                                value={currentSPF?.special_instructions || ""}
                                                onChange={(e) =>
                                                    setCurrentSPF({
                                                        ...currentSPF,
                                                        special_instructions: e.target.value,
                                                    })
                                                }
                                            />
                                        ) : field.key === "item_description" ? (
                                            <div className="flex flex-col gap-3">
                                                {itemDescriptions.map((item, index) => (
                                                    <div key={index} className="flex gap-2 items-center">
                                                        <select
                                                            className="border rounded-none px-2 py-2 text-xs"
                                                            value={item.type}
                                                            onChange={(e) => {
                                                                const updated = [...itemDescriptions];
                                                                updated[index] = { type: e.target.value as "text" | "file", value: "" };
                                                                setItemDescriptions(updated);
                                                            }}
                                                        >
                                                            <option value="text">Text</option>
                                                            <option value="file">File</option>
                                                        </select>

                                                        {item.type === "text" ? (
                                                            <Input
                                                                placeholder="Item text"
                                                                className="rounded-none"
                                                                value={item.value}
                                                                onChange={(e) => {
                                                                    const updated = [...itemDescriptions];
                                                                    updated[index] = { ...updated[index], value: e.target.value };
                                                                    setItemDescriptions(updated);
                                                                }}
                                                            />
                                                        ) : (
                                                            <Input
                                                                type="file"
                                                                className="rounded-none"
                                                                accept="image/*,application/pdf"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleItemUpload(file, index);
                                                                }}
                                                            />
                                                        )}

                                                        {uploadingItem === index && <span className="text-xs text-muted-foreground">Uploading...</span>}

                                                        {item.type === "file" && item.value && (
                                                            <a href={item.value} target="_blank" className="text-xs text-blue-600 underline">View</a>
                                                        )}

                                                        <Button
                                                            variant="destructive"
                                                            className="rounded-none p-4"
                                                            onClick={() => setItemDescriptions(itemDescriptions.filter((_, i) => i !== index))}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                ))}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="rounded-none p-6"
                                                    onClick={() => setItemDescriptions([...itemDescriptions, { type: "text", value: "" }])}
                                                >
                                                    + Add Item
                                                </Button>
                                            </div>
                                        ) : (
                                            <Input
                                                type={field.type || "text"}
                                                className="rounded-none"
                                                value={currentSPF?.[field.key] || ""}
                                                onChange={(e) =>
                                                    setCurrentSPF({ ...currentSPF, [field.key]: e.target.value })
                                                }
                                            />
                                        )}
                                    </div>
                                ))}
                        </div>

                        {/* Bottom row: Prepared By (left), Approved By (right) */}
                        <div className="flex justify-between mt-6 gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Prepared By
                                </label>
                                <Input
                                    type="text"
                                    className="rounded-none"
                                    value={currentSPF?.prepared_by || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({ ...currentSPF, prepared_by: e.target.value })
                                    }
                                />
                            </div>

                            <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Approved By
                                </label>
                                <Input
                                    type="text"
                                    className="rounded-none"
                                    value={currentSPF?.approved_by || ""}
                                    disabled
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Duration display */}
                {!isEditMode && currentSPF?.start_date && currentSPF?.end_date && (
                    <div className="text-sm font-mono mt-4">
                        Request Time: {formatDuration(currentSPF.start_date, currentSPF.end_date)}
                    </div>
                )}

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-none p-6" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="rounded-none p-6"
                        disabled={loadingSPF}
                    >
                        {isEditMode ? "Update" : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}