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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskListDialogProps {
  filterStatus: string;
  filterTypeActivity: string;
  filterSource: string;
  filterTypeClient: string;
  filterCallStatus: string;
  filterQuotationStatus: string;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  setFilterTypeActivity: React.Dispatch<React.SetStateAction<string>>;
  setFilterSource: React.Dispatch<React.SetStateAction<string>>;
  setFilterTypeClient: React.Dispatch<React.SetStateAction<string>>;
  setFilterCallStatus: React.Dispatch<React.SetStateAction<string>>;
  setFilterQuotationStatus: React.Dispatch<React.SetStateAction<string>>;
  statusOptions: string[];
  typeActivityOptions: string[];
  sourceOptions: string[];
  typeClientOptions: string[];
  callStatusOptions: string[];
  quotationStatusOptions: string[];
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

// ─── Status color map ─────────────────────────────────────────────────────────

function getStatusDot(status: string): string {
  switch (status) {
    case "Delivered":   return "bg-emerald-500";
    case "SO-Done":     return "bg-amber-400";
    case "Quote-Done":  return "bg-blue-600";
    case "On Progress":
    case "Assisted":    return "bg-orange-500";
    case "Cancelled":   return "bg-red-600";
    case "Completed":   return "bg-teal-600";
    case "Pending":     return "bg-slate-400";
    default:            return "bg-zinc-400";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export const TaskListDialog: React.FC<TaskListDialogProps> = ({
  filterStatus,
  filterTypeActivity,
  filterSource,
  filterTypeClient,
  filterCallStatus,
  filterQuotationStatus,
  setFilterStatus,
  setFilterTypeActivity,
  setFilterSource,
  setFilterTypeClient,
  setFilterCallStatus,
  setFilterQuotationStatus,
  statusOptions,
  typeActivityOptions,
  sourceOptions,
  typeClientOptions,
  callStatusOptions,
  quotationStatusOptions,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
}) => {
  const [open, setOpen] = useState(false);

  const activeCount =
    (filterStatus !== "all" ? 1 : 0) +
    (filterTypeActivity !== "all" ? 1 : 0) +
    (filterSource !== "all" ? 1 : 0) +
    (filterTypeClient !== "all" ? 1 : 0) +
    (filterCallStatus !== "all" ? 1 : 0) +
    (filterQuotationStatus !== "all" ? 1 : 0) +
    (itemsPerPage !== 20 ? 1 : 0); // Default is 20

  const hasActiveFilters = activeCount > 0;

  const handleClearAll = () => {
    setFilterStatus("all");
    setFilterTypeActivity("all");
    setFilterSource("all");
    setFilterTypeClient("all");
    setFilterCallStatus("all");
    setFilterQuotationStatus("all");
    setItemsPerPage(20);
  };

  return (
    <>
      {/* ── Trigger button ───────────────────────────────────────────── */}
      <div className="relative inline-flex items-center gap-2 pr-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Open filters"
          className="rounded-none h-9 w-9 p-0 relative"
          onClick={() => setOpen(true)}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Advance Filter</span>

        {/* Active filter badge */}
        {hasActiveFilters && (
          <span className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
            {activeCount}
          </span>
        )}
      </div>

      {/* ── Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-sm rounded-none p-0 overflow-hidden gap-0">

          {/* Header */}
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Filter className="h-3.5 w-3.5 text-white" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Filter Activities
                </DialogTitle>
                {hasActiveFilters && (
                  <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-semibold">
                    {activeCount} active
                  </span>
                )}
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                Advance Filter - Filter by status, activity type, source, and more.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body - 2 Column Grid */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4">

              {/* Status filter - only show if has options */}
              {statusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Status
                  </label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`} />
                            {status.replace("-", " ")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Activity type filter - only show if has options */}
              {typeActivityOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Activity Type
                  </label>
                  <Select value={filterTypeActivity} onValueChange={setFilterTypeActivity}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {typeActivityOptions.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Source filter - only show if has options */}
              {sourceOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Source
                  </label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {sourceOptions.map((source) => (
                        <SelectItem key={source} value={source} className="text-xs">
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Type Client filter - only show if has options */}
              {typeClientOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Client Type
                  </label>
                  <Select value={filterTypeClient} onValueChange={setFilterTypeClient}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {typeClientOptions.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Call Status filter - only show if has options */}
              {callStatusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Call Status
                  </label>
                  <Select value={filterCallStatus} onValueChange={setFilterCallStatus}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {callStatusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quotation Status filter - only show if has options */}
              {quotationStatusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Quotation Status
                  </label>
                  <Select value={filterQuotationStatus} onValueChange={setFilterQuotationStatus}>
                    <SelectTrigger className="w-full rounded-none text-xs h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {quotationStatusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Rows per page - always show */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Rows Per Page
                </label>
                <Select 
                  value={String(itemsPerPage)} 
                  onValueChange={(val) => {
                    setItemsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full rounded-none text-xs h-8">
                    <SelectValue placeholder="20" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                <p className="text-xs text-zinc-600 flex-1">
                  {activeCount} setting{activeCount > 1 ? "s" : ""} active
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
              Apply
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
};