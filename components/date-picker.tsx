"use client";

import * as React from "react";
import { type DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

type DatePickerProps = {
  selectedDateRange: DateRange | undefined;
  onDateSelectAction: (dateRange: DateRange | undefined) => void;
};

export function DatePicker({ selectedDateRange, onDateSelectAction }: DatePickerProps) {
  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] "
          mode="range"
          selected={selectedDateRange}
          onSelect={(range: DateRange | undefined) => {
            onDateSelectAction(range);
          }}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
