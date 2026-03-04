"use client";

import React, { useState, useRef, useEffect } from "react";
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
  onConfirmRemove: () => Promise<void>;
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
  const intervalRef = useRef<number | null>(null);

  // Clear interval when component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startHold = () => {
    if (loading || !removeRemarks.trim()) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);

    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalRef.current!);
          handleConfirm();
          return 100;
        }
        return prev + 1;
      });
    }, 20); // ~2 seconds to fill
  };

  const cancelHold = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmRemove();
    } catch (err) {
      console.error("Error removing accounts:", err);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        onOpenChange(false);
        setRemoveRemarks("");
      }, 300); // brief delay to show full progress
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

        <DialogFooter className="flex flex-col gap-2">
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

          {/* Hold-to-confirm button */}
          <Button
            variant="destructive"
            className="rounded-none p-6 overflow-hidden relative"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            disabled={loading || !removeRemarks.trim()}
          >
            {loading ? "Deleting..." : "Hold to Delete"}

            {/* Progress bar overlay */}
            <div
              className="absolute top-0 left-0 h-full bg-red-900/30 pointer-events-none transition-all"
              style={{ width: `${progress}%` }}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}