"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountsActiveDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  removeRemarks: string;
  setRemoveRemarks: (value: string) => void;
  onConfirmRemove: () => void;
}

export function AccountsActiveDeleteDialog({
  open,
  onOpenChange,
  removeRemarks,
  setRemoveRemarks,
  onConfirmRemove,
}: AccountsActiveDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Selected Accounts</DialogTitle>
          <DialogDescription>
            Please provide remarks/reason for removing the selected accounts.
          </DialogDescription>
        </DialogHeader>

        <textarea
          className="w-full border rounded p-2 mt-2 mb-4"
          rows={4}
          value={removeRemarks}
          onChange={(e) => setRemoveRemarks(e.target.value)}
          placeholder="Enter remarks here"
        />

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              setRemoveRemarks("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!removeRemarks.trim()}
            onClick={onConfirmRemove}
          >
            Confirm Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}