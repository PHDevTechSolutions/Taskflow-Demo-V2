"use client";

import React, { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Filter,
  ArrowUpAZ,
  ArrowDownAZ,
  CalendarArrowUp,
  CalendarArrowDown,
  X,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountsActiveFilterProps {
  typeFilter: string;
  setTypeFilterAction: (value: string) => void;
  dateCreatedFilter: string | null;
  setDateCreatedFilterAction: (value: string | null) => void;
  alphabeticalFilter: string | null;
  setAlphabeticalFilterAction: (value: string | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "TOP 50", label: "Top 50" },
  { value: "NEXT 30", label: "Next 30" },
  { value: "BALANCE 20", label: "Balance 20" },
  { value: "CSR CLIENT", label: "CSR Client" },
  { value: "TSA CLIENT", label: "TSA Client" },
  { value: "NEW CLIENT", label: "New Client" },
];

/** Count how many filters are currently active */
function countActiveFilters(
  typeFilter: string,
  dateCreatedFilter: string | null,
  alphabeticalFilter: string | null,
): number {
  let count = 0;
  if (typeFilter && typeFilter !== "all") count++;
  if (dateCreatedFilter) count++;
  if (alphabeticalFilter) count++;
  return count;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountsActiveFilter({
  typeFilter,
  setTypeFilterAction,
  dateCreatedFilter,
  setDateCreatedFilterAction,
  alphabeticalFilter,
  setAlphabeticalFilterAction,
}: AccountsActiveFilterProps) {
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(typeFilter, dateCreatedFilter, alphabeticalFilter);
  const hasActiveFilters = activeCount > 0;

  const handleClearAll = () => {
    setTypeFilterAction("all");
    setDateCreatedFilterAction(null);
    setAlphabeticalFilterAction(null);
  };

  // FIX: toggle date filter — cycling asc → desc → null instead of only asc/desc
  const handleToggleDateFilter = () => {
    if (!dateCreatedFilter) setDateCreatedFilterAction("asc");
    else if (dateCreatedFilter === "asc") setDateCreatedFilterAction("desc");
    else setDateCreatedFilterAction(null);
  };

  return (
    <>
      {/* ── Trigger Button ───────────────────────────────────────────────── */}
      <div className="relative inline-flex">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label="Open filters"
          className="relative flex items-center justify-center cursor-pointer rounded-none h-9 w-9 p-0"
        >
          <Filter className="h-4 w-4" />
        </Button>

        {/* Active filter badge */}
        {hasActiveFilters && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
            {activeCount}
          </span>
        )}
      </div>

      {/* ── Filter Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-sm rounded-none p-0 overflow-hidden gap-0">

          {/* Header */}
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Filter className="h-3.5 w-3.5 text-white" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Filters
                </DialogTitle>
                {hasActiveFilters && (
                  <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-semibold">
                    {activeCount} active
                  </span>
                )}
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">

            {/* Type Client */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                Type Client
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilterAction}>
                <SelectTrigger className="w-full rounded-none text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-100" />

            {/* Sort & Date filters */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-3">
                Sort &amp; Order
              </label>

              <div className="space-y-2">
                {/* Alphabetical */}
                <div>
                  <p className="text-[10px] text-zinc-400 mb-1.5">Alphabetical</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: "none", label: "None", icon: null },
                      { value: "asc", label: "A → Z", icon: <ArrowUpAZ className="h-3 w-3" /> },
                      { value: "desc", label: "Z → A", icon: <ArrowDownAZ className="h-3 w-3" /> },
                    ].map((opt) => {
                      const current = alphabeticalFilter ?? "none";
                      const isActive = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setAlphabeticalFilterAction(opt.value === "none" ? null : opt.value)
                          }
                          className={`
                            flex items-center justify-center gap-1.5 px-2 py-2
                            text-[11px] font-medium border rounded-none transition-colors
                            ${isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            }
                          `}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Created */}
                <div>
                  <p className="text-[10px] text-zinc-400 mb-1.5">Date Created</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: null, label: "None", icon: null },
                      { value: "asc", label: "Oldest", icon: <CalendarArrowUp className="h-3 w-3" /> },
                      { value: "desc", label: "Newest", icon: <CalendarArrowDown className="h-3 w-3" /> },
                    ].map((opt) => {
                      const isActive = dateCreatedFilter === opt.value;
                      return (
                        <button
                          key={opt.value ?? "none"}
                          type="button"
                          onClick={() => setDateCreatedFilterAction(opt.value)}
                          className={`
                            flex items-center justify-center gap-1.5 px-2 py-2
                            text-[11px] font-medium border rounded-none transition-colors
                            ${isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            }
                          `}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                <p className="text-xs text-zinc-600 flex-1">
                  {activeCount} filter{activeCount > 1 ? "s" : ""} active
                </p>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-zinc-500 hover:text-zinc-900 underline font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="rounded-none flex-1 text-xs h-10 border-zinc-200"
                onClick={handleClearAll}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Clear All
              </Button>
            )}
            <Button
              className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              Apply Filters
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}