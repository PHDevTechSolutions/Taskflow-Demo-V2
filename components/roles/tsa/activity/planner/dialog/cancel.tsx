"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface CancelDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelDialog({ onConfirm, onCancel }: CancelDialogProps) {
  const [isOpen, setIsOpen] = useState(true); // Start open

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-white max-w-sm w-full shadow-lg border border-gray-300 z-[9999] rounded-none">
        <DialogHeader>
          <DialogTitle>
            <strong className="text-red-500">Canceling</strong> will clear the current activity and restart the timer.
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="mt-2 text-sm text-black">
          Do you want to continue? This action cannot be undone.
        </DialogDescription>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            className="rounded-none p-6 hover:text-black"
            onClick={() => {
              setIsOpen(false);
              onCancel();
            }}
          >
            No, keep editing
          </Button>
          <Button
            variant="destructive"
            className="rounded-none p-6"
            onClick={() => {
              setIsOpen(false);
              onConfirm();
            }}
          >
            Yes, cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
