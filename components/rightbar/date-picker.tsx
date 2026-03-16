"use client";

import * as React from "react";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { X, CalendarDays } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePickerProps = {
  selectedDateRange: DateRange | undefined;
  onDateSelectAction: (range: DateRange | undefined) => void;
  disableFuture?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const startOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

const endOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
};

/** Format a Date as "MMM D" — e.g. "Mar 16" */
const fmtShort = (d: Date): string =>
  d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/** Format a Date as "YYYY-MM-DD" for tooltip/label */
const fmtISO = (d: Date): string => d.toISOString().slice(0, 10);

// ─── Component ────────────────────────────────────────────────────────────────

export function DatePicker({
  selectedDateRange,
  onDateSelectAction,
  disableFuture = true,
}: DatePickerProps) {
  const hasRange = !!selectedDateRange?.from;
  const isSingleDay =
    hasRange &&
    selectedDateRange!.from &&
    selectedDateRange!.to &&
    fmtISO(selectedDateRange!.from) === fmtISO(selectedDateRange!.to);

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onDateSelectAction(undefined);
      return;
    }

    const fixedRange: DateRange = {
      from: startOfDay(range.from),
      // If user clicks a single day (no `to`), treat `to` = end of that same day
      to: range.to ? endOfDay(range.to) : endOfDay(range.from),
    };

    onDateSelectAction(fixedRange);
  };

  return (
    <SidebarGroup className="px-0 py-0">
      <SidebarGroupContent>

        {/* ── Range label bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <CalendarDays className="w-3 h-3 text-gray-400" />
            Date Filter
          </div>

          {hasRange ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-gray-700 tabular-nums">
                {fmtShort(selectedDateRange!.from!)}
              </span>
              {!isSingleDay && selectedDateRange?.to && (
                <>
                  <span className="text-gray-300 text-[10px]">→</span>
                  <span className="text-[11px] font-bold text-gray-700 tabular-nums">
                    {fmtShort(selectedDateRange!.to)}
                  </span>
                </>
              )}
              {isSingleDay && (
                <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  1 day
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-gray-300 italic">None selected</span>
          )}
        </div>

        {/* ── Calendar ────────────────────────────────────────────────── */}
        <div className="px-2 pt-1 pb-2">
          <Calendar
            mode="range"
            selected={selectedDateRange}
            numberOfMonths={1}
            disabled={disableFuture ? { after: new Date() } : undefined}
            onSelect={handleSelect}
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              caption: "flex justify-center pt-1 relative items-center text-xs font-semibold",
              caption_label: "text-xs font-bold uppercase tracking-wide text-gray-700",
              nav: "space-x-1 flex items-center",
              nav_button:
                "h-6 w-6 bg-transparent hover:bg-gray-100 rounded-none flex items-center justify-center text-gray-500 transition-colors",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell:
                "text-gray-400 rounded-none w-8 font-semibold text-[10px] uppercase tracking-wide text-center",
              row: "flex w-full mt-1",
              cell: "relative p-0 text-center text-xs",
              day:
                "h-8 w-8 mx-auto flex items-center justify-center text-[11px] font-medium rounded-none hover:bg-gray-100 transition-colors cursor-pointer",
              day_selected:
                "bg-gray-900 text-white hover:bg-gray-800 font-bold rounded-none",
              day_today:
                "border border-gray-400 font-bold text-gray-800",
              day_outside: "text-gray-300 opacity-50",
              day_disabled: "text-gray-200 cursor-not-allowed",
              day_range_start:
                "bg-gray-900 text-white rounded-none font-bold",
              day_range_end:
                "bg-gray-900 text-white rounded-none font-bold",
              day_range_middle:
                "bg-gray-100 text-gray-700 rounded-none",
              day_hidden: "invisible",
            }}
          />
        </div>

        {/* ── Clear button ─────────────────────────────────────────────── */}
        {hasRange && (
          <div className="px-3 pb-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[10px] uppercase font-bold tracking-wider text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-none border border-gray-200 hover:border-red-200 transition-colors gap-1.5"
              onClick={() => onDateSelectAction(undefined)}
            >
              <X className="w-3 h-3" />
              Clear filter
            </Button>
          </div>
        )}

      </SidebarGroupContent>
    </SidebarGroup>
  );
}