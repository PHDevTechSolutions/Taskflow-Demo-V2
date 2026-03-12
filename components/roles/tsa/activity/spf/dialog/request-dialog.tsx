"use client";

import React, { useEffect, useState } from "react";
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

type ItemRow = {
    descType: "text" | "file";
    item_photo: string;
    item_description: string;
    item_code: string;
};

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

export function RequestDialog({
    open,
    onClose,
    isEditMode,
    currentSPF,
    setCurrentSPF,
    handleCreateSPF,
    handleEditSPF,
}: Props) {
    const [loadingSPF, setLoadingSPF] = useState(false);
    const [uploadingItem, setUploadingItem] = useState<string | null>(null);
    const [items, setItems] = useState<ItemRow[]>([]);

    /* ---------------------------
       LOAD ITEMS WHEN EDIT MODE
    --------------------------- */
    useEffect(() => {
        if (!open) return;

        const descParts = currentSPF?.item_description?.split(",") || [];
        const photoParts = currentSPF?.item_photo?.split(",") || [];
        const codeParts = currentSPF?.item_code?.split(",") || [];

        const rows: ItemRow[] = descParts.map((desc: string, i: number) => ({
            item_description: desc || "",
            item_photo: photoParts[i] || "",
            item_code: codeParts[i] || "",
            descType: desc?.startsWith("http") ? "file" : "text",
        }));

        if (rows.length > 0) setItems(rows);
        else setItems([]);
    }, [open]);

    /* ---------------------------
       IMAGE COMPRESSION
    --------------------------- */
    const compressImage = async (file: File) => {
        return await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        });
    };

    /* ---------------------------
       CLOUDINARY UPLOAD
    --------------------------- */
    const handleUpload = async (
        file: File,
        index: number,
        type: "photo" | "desc"
    ) => {
        setUploadingItem(`${type}-${index}`);

        try {
            const compressed = await compressImage(file);

            const data = new FormData();
            data.append("file", compressed);
            data.append("upload_preset", "Xchire");
            data.append("folder", "spf_items");

            const res = await fetch(
                "https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload",
                {
                    method: "POST",
                    body: data,
                }
            );

            const uploaded = await res.json();

            const updated = [...items];

            if (type === "photo") {
                updated[index].item_photo = uploaded.secure_url;
            } else {
                updated[index].item_description = uploaded.secure_url;
            }

            setItems(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setUploadingItem(null);
        }
    };

    /* ---------------------------
       SUBMIT
    --------------------------- */
    const handleSubmit = () => {
        if (items.length === 0) {
            alert("Please add at least one item.");
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.item_photo) {
                alert(`Item ${i + 1}: Photo is required.`);
                return;
            }
            if (!item.item_code || item.item_code.trim() === "") {
                alert(`Item ${i + 1}: Item Code is required.`);
                return;
            }
            if (!item.item_description || item.item_description.trim() === "") {
                alert(`Item ${i + 1}: Description is required.`);
                return;
            }
        }

        const descriptions = items.map((i) => i.item_description);
        const photos = items.map((i) => i.item_photo);
        const codes = items.map((i) => i.item_code);

        const updatedSPF = {
            ...currentSPF,
            item_description: descriptions.join(","),
            item_photo: photos.join(","),
            item_code: codes.join(","),
        };

        setCurrentSPF(updatedSPF);
        setLoadingSPF(true);

        if (isEditMode) handleEditSPF(updatedSPF);
        else handleCreateSPF(updatedSPF);

        setLoadingSPF(false);
    };

    /* ---------------------------
       ITEM FUNCTIONS
    --------------------------- */

    const addRow = () => {
        setItems([
            ...items,
            { item_photo: "", item_description: "", item_code: "", descType: "text" },
        ]);
    };

    const removeRow = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    /* ---------------------------
       FORM FIELDS
    --------------------------- */

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

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <DialogContent className="sm:max-w-7xl rounded-none p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        {isEditMode ? "Edit SPF" : "Request SPF"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                    {/* LEFT SIDE */}
                    <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border">
                        {leftFields.map((field) => (
                            <div key={field.key} className="flex flex-col">
                                <label className="text-xs text-muted-foreground mb-1">
                                    {field.label}
                                </label>

                                <Input
                                    className="rounded-none"
                                    value={currentSPF?.[field.key] || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({
                                            ...currentSPF,
                                            [field.key]: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    {/* RIGHT SIDE */}
                    <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border">

                        {/* PAYMENT TERMS + WARRANTY */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                                <label className="text-xs text-muted-foreground mb-1">
                                    Payment Terms
                                </label>

                                <select
                                    className="border rounded-none px-2 py-2 text-sm"
                                    value={currentSPF?.payment_terms || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({
                                            ...currentSPF,
                                            payment_terms: e.target.value,
                                        })
                                    }
                                >
                                    <option value="">Select Payment Terms</option>
                                    <option value="COD">COD</option>
                                    <option value="Check">Check</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Bank Deposit">Bank Deposit</option>
                                    <option value="GCash">GCash</option>
                                    <option value="Terms">Terms</option>
                                </select>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-xs text-muted-foreground mb-1">
                                    Warranty
                                </label>

                                <Input
                                    className="rounded-none"
                                    value={currentSPF?.warranty || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({
                                            ...currentSPF,
                                            warranty: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* DELIVERY DATE */}
                        <div className="flex flex-col">
                            <label className="text-xs text-muted-foreground mb-1">
                                Delivery Date
                            </label>

                            <Input
                                type="date"
                                className="rounded-none"
                                value={currentSPF?.delivery_date || ""}
                                onChange={(e) =>
                                    setCurrentSPF({
                                        ...currentSPF,
                                        delivery_date: e.target.value,
                                    })
                                }
                            />
                        </div>

                        {/* SPECIAL INSTRUCTIONS */}
                        <div className="flex flex-col">
                            <label className="text-xs text-muted-foreground mb-1">
                                Special Instructions
                            </label>

                            <Textarea
                                className="rounded-none"
                                value={currentSPF?.special_instructions || ""}
                                onChange={(e) =>
                                    setCurrentSPF({
                                        ...currentSPF,
                                        special_instructions: e.target.value,
                                    })
                                }
                            />
                        </div>

                        {/* ITEMS */}
                        <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
                            <label className="text-xs text-muted-foreground mb-1">Items</label>

                            {items.map((row, index) => (
                                <div
                                    key={index}
                                    className="border p-3 space-y-3"
                                >
                                    {/* PHOTO */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">
                                            Item Photo <span className="text-red-600">(*Required)</span>
                                        </label>

                                        <Input
                                            type="file"
                                            accept="image/*"
                                            className="rounded-none"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                handleUpload(file, index, "photo");
                                            }}
                                        />

                                        {uploadingItem === `photo-${index}` && (
                                            <span className="text-xs">Uploading...</span>
                                        )}

                                        {row.item_photo && (
                                            <img
                                                src={row.item_photo}
                                                className="w-24 h-24 object-contain border"
                                            />
                                        )}
                                    </div>

                                    {/* ITEM CODE */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">
                                            Item Code <span className="text-red-600">(*Required)</span>
                                        </label>

                                        <Input
                                            className="rounded-none"
                                            value={row.item_code}
                                            onChange={(e) => {
                                                const updated = [...items];
                                                updated[index].item_code = e.target.value;
                                                setItems(updated);
                                            }}
                                        />
                                    </div>

                                    {/* DESCRIPTION */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">
                                            Item Description <span className="text-red-600">(*Required)</span>
                                        </label>

                                        <Textarea
                                            className="rounded-none"
                                            value={row.item_description}
                                            onChange={(e) => {
                                                // Remove any commas from input
                                                const sanitizedValue = e.target.value.replace(/,/g, "");
                                                const updated = [...items];
                                                updated[index].item_description = sanitizedValue;
                                                setItems(updated);
                                            }}
                                            rows={15}
                                            placeholder="Enter item description without commas"
                                        />
                                    </div>

                                    {/* REMOVE BUTTON */}
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            className="rounded-none bg-red-500 text-white px-2 py-1 text-xs"
                                            onClick={() => removeRow(index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                className="rounded-none w-full border py-2 text-xs"
                                onClick={addRow}
                            >
                                + Add Item
                            </button>
                        </div>

                        {/* SALES PERSON */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                                <label className="text-xs text-muted-foreground mb-1">
                                    Sales Person
                                </label>

                                <Input
                                    className="rounded-none"
                                    value={currentSPF?.sales_person || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({
                                            ...currentSPF,
                                            sales_person: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            {/* PREPARED BY */}
                            <div className="flex flex-col">
                                <label className="text-xs text-muted-foreground mb-1">
                                    Prepared By
                                </label>

                                <Input
                                    className="rounded-none"
                                    value={currentSPF?.prepared_by || ""}
                                    onChange={(e) =>
                                        setCurrentSPF({
                                            ...currentSPF,
                                            prepared_by: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>


                        {/* APPROVED BY */}
                        <div className="flex flex-col">
                            <label className="text-xs text-muted-foreground mb-1">
                                Approved By
                            </label>

                            <Input
                                className="rounded-none"
                                disabled
                                value={currentSPF?.approved_by || ""}
                            />
                        </div>

                    </div>
                </div>

                {!isEditMode && currentSPF?.start_date && currentSPF?.end_date && (
                    <div className="text-sm font-mono mt-4">
                        Request Time:{" "}
                        {formatDuration(currentSPF.start_date, currentSPF.end_date)}
                    </div>
                )}

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        className="rounded-none"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        className="rounded-none"
                        onClick={handleSubmit}
                        disabled={loadingSPF}
                    >
                        {isEditMode ? "Update" : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}