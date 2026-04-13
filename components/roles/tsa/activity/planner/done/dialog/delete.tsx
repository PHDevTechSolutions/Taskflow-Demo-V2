// components/dialog/delete.tsx
"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    loading?: boolean;
    title?: string;
    description?: string;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
    open,
    onOpenChange,
    onConfirm,
    loading = false,
    title = "Delete Item",
    description = "Are you sure you want to delete this item? This action cannot be undone.",
}) => {
    const [progress, setProgress] = React.useState(0);
    const intervalRef = React.useRef<number | null>(null);

    // Start holding
    const startHold = () => {
        if (loading) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(0);

        intervalRef.current = window.setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    onConfirm(); // trigger delete when 100%
                    return 100;
                }
                return prev + 1; // increment progress
            });
        }, 20); // adjust speed here (~2s to reach 100)
    };

    // Cancel holding
    const cancelHold = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(0);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-none">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex flex-col gap-2">
                    {/* Cancel Button */}
                    <Button
                        variant="outline"
                        className="rounded-none p-6"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    {/* Hold-to-confirm Delete Button */}
                    <div className="relative w-full">
                        <Button
                            variant="destructive"
                            className="rounded-none p-6 w-full overflow-hidden relative"
                            onMouseDown={startHold}
                            onMouseUp={cancelHold}
                            onMouseLeave={cancelHold}
                            disabled={loading}
                        >
                            {loading ? "Deleting..." : "Hold to Delete"}

                            {/* Progress bar overlay */}
                            <div
                                className="absolute top-0 left-0 h-full bg-red-900/30 pointer-events-none transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};