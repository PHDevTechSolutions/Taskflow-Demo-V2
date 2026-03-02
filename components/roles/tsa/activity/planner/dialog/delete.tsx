"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountsActiveDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  removeRemarks: string;
  setRemoveRemarks: (value: string) => void;
  onConfirmRemove: () => Promise<void>; // should return a Promise
}

export function AccountsActiveDeleteDialog({
  open,
  onOpenChange,
  removeRemarks,
  setRemoveRemarks,
  onConfirmRemove,
}: AccountsActiveDeleteDialogProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 15 + 5); // increment 5-20%
        return next >= 100 ? 100 : next;
      });
    }, 200);

    try {
      await onConfirmRemove(); // wait for deletion
    } finally {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        onOpenChange(false);
        setRemoveRemarks("");
      }, 500); // small delay so user sees 100%
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none p-6">
        <DialogHeader>
          <DialogTitle>Remove Selected Accounts</DialogTitle>
          <DialogDescription>
            Please provide remarks/reason for removing the selected accounts.
          </DialogDescription>
        </DialogHeader>

        <textarea
          className="w-full border rounded-none p-2 mt-2 mb-4"
          rows={4}
          value={removeRemarks}
          onChange={(e) => setRemoveRemarks(e.target.value)}
          placeholder="Enter remarks here"
          disabled={loading}
        />

        {/* Progress bar */}
        {loading && (
          <div className="w-full bg-gray-200 h-3 rounded mb-4">
            <div
              className="bg-red-600 h-3 rounded"
              style={{ width: `${progress}%`, transition: "width 0.2s" }}
            ></div>
          </div>
        )}

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (!loading) {
                onOpenChange(false);
                setRemoveRemarks("");
              }
            }}
            className="rounded-none p-6"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-none p-6"
            disabled={!removeRemarks.trim() || loading}
            onClick={handleConfirm}
          >
            {loading ? "Removing..." : "Confirm Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}