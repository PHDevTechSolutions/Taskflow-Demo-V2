"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountsActiveDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  removeRemarks: string;
  setRemoveRemarks: (value: string) => void;
  onConfirmRemove: () => Promise<void>;
  selectedCount?: number; // FIX: added so user knows how many accounts will be removed
}

const HOLD_DURATION_MS = 2000;
const INTERVAL_MS = 20;
const INCREMENT = (INTERVAL_MS / HOLD_DURATION_MS) * 100;

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountsActiveDeleteDialog({
  open,
  onOpenChange,
  removeRemarks,
  setRemoveRemarks,
  onConfirmRemove,
  selectedCount,
}: AccountsActiveDeleteDialogProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false); // FIX: prevent double-fire
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // FIX: was typed as number | null — wrong on non-browser envs

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Reset state when dialog closes ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(0);
      setLoading(false);
      setConfirmed(false);
    }
  }, [open]);

  // ── Confirm handler ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    // FIX: guard against double-fire from interval tick race condition
    if (confirmed || loading) return;
    setConfirmed(true);
    setLoading(true);

    try {
      await onConfirmRemove();
    } catch (err) {
      console.error("Error removing accounts:", err);
      // FIX: reset on error so user can retry
      setLoading(false);
      setConfirmed(false);
      setProgress(0);
      return;
    }

    setTimeout(() => {
      setLoading(false);
      setProgress(0);
      setConfirmed(false);
      setRemoveRemarks("");
      onOpenChange(false);
    }, 300);
  }, [confirmed, loading, onConfirmRemove, onOpenChange, setRemoveRemarks]);

  // ── Hold-to-confirm handlers ────────────────────────────────────────────────
  const startHold = () => {
    if (loading || confirmed || !removeRemarks.trim()) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + INCREMENT;
        if (next >= 100) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          // FIX: call handleConfirm via setTimeout to avoid calling setState inside setState
          setTimeout(() => handleConfirm(), 0);
          return 100;
        }
        return next;
      });
    }, INTERVAL_MS);
  };

  const cancelHold = () => {
    if (loading || confirmed) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  const handleClose = () => {
    if (loading) return;
    cancelHold();
    setRemoveRemarks("");
    onOpenChange(false);
  };

  const canDelete = removeRemarks.trim().length > 0 && !loading && !confirmed;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-none p-0 overflow-hidden max-w-md w-full gap-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-red-950 px-6 pt-6 pb-5">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <Trash2 className="h-4 w-4 text-red-300" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Remove Accounts
              </DialogTitle>
            </div>
            <DialogDescription className="text-red-300/80 text-xs leading-relaxed">
              This action will mark the selected accounts for removal. Provide a
              clear reason before proceeding.
            </DialogDescription>
          </DialogHeader>

          {/* Account count badge */}
          {selectedCount !== undefined && selectedCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 text-red-300" />
              <span className="text-[11px] font-semibold text-red-200">
                {selectedCount}{" "}
                {selectedCount === 1 ? "account" : "accounts"} will be removed
              </span>
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
              Reason / Remarks
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              className="
                w-full border border-zinc-200 rounded-none p-3 text-xs
                bg-zinc-50 resize-none focus:outline-none
                focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900
                transition-all disabled:opacity-50 disabled:cursor-not-allowed
              "
              rows={4}
              value={removeRemarks}
              onChange={(e) => setRemoveRemarks(e.target.value)}
              placeholder="e.g. Account no longer active, duplicate entry, customer request..."
              disabled={loading}
            />
            {/* Character feedback */}
            <p className={`text-[10px] mt-1 ${removeRemarks.trim().length === 0 ? "text-red-400" : "text-zinc-400"}`}>
              {removeRemarks.trim().length === 0
                ? "Remarks are required before deleting."
                : `${removeRemarks.trim().length} characters`}
            </p>
          </div>

          {/* Hold-to-confirm button */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-400 text-center">
              {canDelete
                ? "Hold the button below to confirm removal"
                : loading
                ? "Processing removal..."
                : "Enter remarks to enable deletion"}
            </p>

            <button
              type="button"
              className={`
                relative w-full h-12 overflow-hidden rounded-none
                text-xs font-bold uppercase tracking-widest select-none
                transition-colors focus:outline-none
                ${canDelete
                  ? "bg-red-600 text-white cursor-pointer"
                  : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                }
              `}
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}   // FIX: added touch support — original had none
              onTouchEnd={cancelHold}
              disabled={!canDelete}
            >
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 bg-red-900/40 pointer-events-none transition-none"
                style={{ width: `${progress}%` }}
              />

              {/* Label */}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Removing...
                  </>
                ) : progress > 0 ? (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {`Deleting... ${Math.round(progress)}%`}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hold to Delete
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-zinc-100">
          <Button
            variant="outline"
            className="rounded-none w-full text-xs h-10"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}