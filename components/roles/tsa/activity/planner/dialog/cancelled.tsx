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
import { Textarea } from "@/components/ui/textarea";

interface CancelledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (remarks: string) => void;
  loading?: boolean;
}

export const CancelledDialog: React.FC<CancelledDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}) => {
  const [cancellationRemarks, setCancellationRemarks] = useState("");
  const [canConfirm, setCanConfirm] = useState(false);

  useEffect(() => {
    setCanConfirm(cancellationRemarks.trim().length > 0);
  }, [cancellationRemarks]);

  // Reset remarks when dialog closes
  useEffect(() => {
    if (!open) setCancellationRemarks("");
  }, [open]);

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(cancellationRemarks.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Mark Transaction as Cancelled</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this transaction?  
            This action will move the record to the cancelled history and remove it from the
            scheduled list.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <label htmlFor="cancellationRemarks" className="block mb-1 font-medium">
            Cancellation Reason <span className="text-red-600">*</span>
          </label>
          <Textarea
            id="cancellationRemarks"
            placeholder="Please provide a reason for cancellation..."
            value={cancellationRemarks}
            onChange={(e) => setCancellationRemarks(e.target.value)}
            rows={4}
            required
            className="rounded-none"
            
          />
        </div>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-none p-6"
          >
            No, Keep It
          </Button>

          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="rounded-none p-6"
          >
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
