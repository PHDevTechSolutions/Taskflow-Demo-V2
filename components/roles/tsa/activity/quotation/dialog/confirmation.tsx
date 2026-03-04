"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmationDialogProps = {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    title?: string;
    message?: string;
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    onClose,
    onSave,
    title = "Confirm Save",
    message = "Once you save this quotation, all existing signatories associated with this quotation number will be cleared. The quotation status will be set back to Pending and will require re-approval from the TSM. Do you want to proceed?",
}) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent style={{ maxWidth: "30vw" }} className="rounded-none">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="text-sm p-4">{message}</div>
                <DialogFooter className="flex justify-end space-x-2">
                    <Button variant="outline" className="rounded-none p-6" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onSave} className="rounded-none p-6">Proceed to Save Only</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;
