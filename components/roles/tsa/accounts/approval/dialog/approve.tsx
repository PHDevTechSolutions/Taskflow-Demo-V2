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

interface AccountsApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmApprove: () => Promise<void> | void;
}

export function AccountsApproveDialog({
  open,
  onOpenChange,
  onConfirmApprove,
}: AccountsApproveDialogProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startHold = () => {
    if (loading) return;
    clearTimer();
    setProgress(0);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearTimer();
          handleConfirm();
          return 100;
        }
        return prev + 2; // 2% every 20ms → 1s hold
      });
    }, 20);
  };

  const cancelHold = () => {
    clearTimer();
    setProgress(0);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmApprove();
    } catch (error) {
      console.error("Error approving accounts:", error);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        onOpenChange(false);
      }, 300);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    cancelHold();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none p-6">
        <DialogHeader>
          <DialogTitle>Approve Selected Accounts</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve the selected pending accounts?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 mt-4">
          <Button
            variant="secondary"
            className="rounded-none p-6"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          {/* Hold to Confirm */}
          <Button
            className="relative rounded-none p-6 overflow-hidden"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            disabled={loading}
          >
            {loading ? "Confirming..." : "Hold to Confirm Approve"}

            {/* Progress overlay */}
            <div
              className="absolute top-0 left-0 h-full bg-black/20 pointer-events-none transition-all"
              style={{ width: `${progress}%` }}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}