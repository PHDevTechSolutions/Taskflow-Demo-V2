"use client";

import React, { useState, useEffect } from "react";
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

interface DoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (data: {
        tsmapprovedstatus: string;
        tsmapprovedremarks: string;
        tsmapproveddate: string;
    }) => void;
    loading?: boolean;
}

export const DoneDialog: React.FC<DoneDialogProps> = ({
    open,
    onOpenChange,
    onConfirm,
    loading = false,
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

    const handleConfirm = () => {
        onConfirm({
            tsmapprovedstatus,
            tsmapprovedremarks,
            tsmapproveddate,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mark Transaction as Approved</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to mark this transaction as Approved? The
                        agent will be notified, and it will remain visible in the In
                        Progress list.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <label
                            htmlFor="remarks"
                            className="block text-sm font-medium mb-1"
                        >
                            Remarks
                        </label>
                        <textarea
                            id="remarks"
                            value={tsmapprovedremarks}
                            onChange={(e) => setTsmApprovedRemarks(e.target.value)}
                            placeholder="Enter remarks"
                            rows={4}
                            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 resize-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="date" className="block text-sm font-medium mb-1">
                            Date
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={tsmapproveddate}
                            onChange={(e) => setTsmApprovedDate(e.target.value)}
                            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="status"
                            className="block text-sm font-medium mb-1"
                        >
                            Status
                        </label>

                        <Select
                            value={tsmapprovedstatus}
                            onValueChange={setTsmApprovedStatus}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Decline">Decline</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter className="flex justify-end gap-2 mt-6">
                    <Button
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading || !tsmapprovedstatus}>
                        {loading ? "Updating..." : "Confirm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
