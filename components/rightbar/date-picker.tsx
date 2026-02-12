"use client";

import * as React from "react";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MapPin } from "lucide-react";
type DatePickerProps = {
  selectedDateRange: DateRange | undefined;
  onDateSelectAction: (range: DateRange | undefined) => void;

  /** OPTIONAL FLAGS */
  disableFuture?: boolean;
};

/* -------------------- Date Helpers -------------------- */
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export function DatePicker({
  selectedDateRange,
  onDateSelectAction,
  disableFuture = true,
}: DatePickerProps) {
  return (
    <SidebarGroup className="px-2">
      <SidebarGroupContent className="space-y-3">

        {/* From – To display */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {selectedDateRange?.from
              ? `From: ${selectedDateRange.from.toLocaleDateString()}`
              : "From: —"}
          </span>
          <span>
            {selectedDateRange?.to
              ? `To: ${selectedDateRange.to.toLocaleDateString()}`
              : "To: —"}
          </span>
        </div>

        {/* Calendar */}
        <Calendar
          mode="range"
          selected={selectedDateRange}
          numberOfMonths={1}
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(range) => {
            if (!range?.from) {
              onDateSelectAction(undefined);
              return;
            }

            const fixedRange: DateRange = {
              from: startOfDay(range.from),
              to: range.to
                ? endOfDay(range.to)
                : endOfDay(range.from), // ✅ single-day fix
            };

            onDateSelectAction(fixedRange);
          }}
          className="
            w-full rounded-md border bg-background p-2
            [&_.rdp-cell]:w-9
            [&_.rdp-cell]:h-9
            [&_.rdp-day]:
            [&_.rdp-day_range_start]:rounded-l-md
            [&_.rdp-day_range_end]:rounded-r-md
            [&_.rdp-day_range_middle]:rounded-none
            [&_.rdp-day_range_middle]:bg-sidebar-primary/20
            [&_.rdp-day_selected]:bg-sidebar-primary
            [&_.rdp-day_selected]:text-sidebar-primary-foreground
            [&_.rdp-day_today]:border
            [&_.rdp-day_today]:border-sidebar-primary
          "
        />

        {/* Clear button */}
        {selectedDateRange?.from && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => onDateSelectAction(undefined)}
            >
              <X className="w-3 h-3 mr-1" />
              Clear range
            </Button>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
