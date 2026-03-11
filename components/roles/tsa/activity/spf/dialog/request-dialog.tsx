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

interface Props {
    open: boolean;
    onClose: () => void;
    isEditMode: boolean;
    prepared_by?: string;
    currentSPF: any;
    setCurrentSPF: (data: any) => void;
    handleCreateSPF: () => void;
    handleEditSPF: () => void;
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
    const [instructionType, setInstructionType] = useState<"text" | "attachment">("text");
    const [uploadingAttachment, setUploadingAttachment] = useState(false);

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
        { label: "Sales Person", key: "sales_person" },
        { label: "Prepared By", key: "prepared_by" },
        { label: "Approved By", key: "approved_by" },
    ];

    const handleAttachmentUpload = async (file: File) => {
        setUploadingAttachment(true);

        try {

            // ✅ DELETE PREVIOUS FILE FIRST
            if (currentSPF?.special_instructions_public_id) {
                await fetch("/api/cloudinary/delete", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        public_id: currentSPF.special_instructions_public_id,
                    }),
                });
            }

            const data = new FormData();
            data.append("file", file);
            data.append("upload_preset", "Xchire");
            data.append("folder", "spf_attachments");

            const res = await fetch(
                "https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload",
                {
                    method: "POST",
                    body: data,
                }
            );

            const uploaded = await res.json();

            setCurrentSPF({
                ...currentSPF,
                special_instructions: uploaded.secure_url,
                special_instructions_public_id: uploaded.public_id,
            });

        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploadingAttachment(false);
        }
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
                                .filter(f => f.key !== "spf_number" && f.key !== "prepared_by" && f.key !== "approved_by")
                                .map((field) => (
                                    <div key={field.key} className="flex flex-col">
                                        <label className="text-xs font-medium text-muted-foreground mb-1">
                                            {field.label}
                                        </label>

                                        {field.key === "special_instructions" ? (
                                            <div className="flex flex-col gap-2">

                                                {/* TYPE DROPDOWN */}
                                                <select
                                                    className="border p-2 text-sm rounded-none"
                                                    value={instructionType}
                                                    onChange={(e) => setInstructionType(e.target.value as "text" | "attachment")}
                                                >
                                                    <option value="text">Text</option>
                                                    <option value="attachment">Attachment (PDF / Image)</option>
                                                </select>

                                                {/* TEXT MODE */}
                                                {instructionType === "text" && (
                                                    <textarea
                                                        className="border rounded-none p-2 text-sm min-h-[200px]"
                                                        value={currentSPF?.special_instructions || ""}
                                                        onChange={(e) =>
                                                            setCurrentSPF({
                                                                ...currentSPF,
                                                                special_instructions: e.target.value,
                                                            })
                                                        }
                                                    />
                                                )}

                                                {/* ATTACHMENT MODE */}
                                                {instructionType === "attachment" && (
                                                    <div className="flex flex-col gap-2">

                                                        <Input
                                                            type="file"
                                                            accept="image/*,.pdf"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleAttachmentUpload(file);
                                                            }}
                                                        />

                                                        {uploadingAttachment && (
                                                            <p className="text-xs text-muted-foreground">Uploading...</p>
                                                        )}

                                                        {currentSPF?.special_instructions && (
                                                            <a
                                                                href={currentSPF.special_instructions}
                                                                target="_blank"
                                                                className="text-xs text-blue-600 underline"
                                                            >
                                                                View Uploaded File
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

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
                {!isEditMode &&
                    currentSPF?.start_date &&
                    currentSPF?.end_date && (
                        <div className="text-sm font-mono mt-4">
                            Request Time: {formatDuration(currentSPF.start_date, currentSPF.end_date)}
                        </div>
                    )}

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-none p-6" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={isEditMode ? handleEditSPF : handleCreateSPF} className="rounded-none p-6" disabled={loadingSPF}>
                        {isEditMode ? "Update" : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}