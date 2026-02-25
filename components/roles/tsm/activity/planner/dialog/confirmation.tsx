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
    message = "Do you want to download the quotation or just proceed to save?",
}) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent style={{ maxWidth: "30vw" }}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="text-sm p-4">{message}</div>
                <DialogFooter className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onSave}>Proceed to Save Only</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;
