"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountsApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmApprove: () => void;
}

export function AccountsApproveDialog({
  open,
  onOpenChange,
  onConfirmApprove,
}: AccountsApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Selected Accounts</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve the selected pending accounts?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>

          <Button onClick={onConfirmApprove}>
            Confirm Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
