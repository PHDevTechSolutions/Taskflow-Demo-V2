"use client";

import React, { useMemo, useState } from "react";
import { format, isSameDay, isToday, isPast, parseISO } from "date-fns";
import { Calendar, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  company_name: string;
  contact_person: string;
  type_client: string;
  next_available_date?: string;
  region?: string;
  industry?: string;
}

interface ScheduledAccountsCalendarProps {
  posts: Account[];
  onSelectDate?: (date: Date) => void;
}

// ─── Cluster config ───────────────────────────────────────────────────────────
const CLUSTER_CONFIG: Record<string, { color: string; bg: string; textColor: string }> = {
  "top 50": { color: "#f59e0b", bg: "#fef3c7", textColor: "#92400e" },
  "next 30": { color: "#3b82f6", bg: "#dbeafe", textColor: "#1e40af" },
  "balance 20": { color: "#8b5cf6", bg: "#ede9fe", textColor: "#5b21b6" },
  "new client": { color: "#10b981", bg: "#d1fae5", textColor: "#065f46" },
  "tsa client": { color: "#ef4444", bg: "#fee2e2", textColor: "#991b1b" },
  "csr client": { color: "#f97316", bg: "#ffedd5", textColor: "#9a3412" },
};

function getClusterStyle(typeClient: string) {
  return (
    CLUSTER_CONFIG[typeClient?.toLowerCase()] ?? {
      color: "#6b7280",
      bg: "#f3f4f6",
      textColor: "#374151",
    }
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ScheduledAccountsCalendar({
  posts,
  onSelectDate,
}: ScheduledAccountsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Get scheduled dates with accounts
  const scheduledDates = useMemo(() => {
    const dates = new Map<string, Account[]>();
    let debugCount = 0;
    posts.forEach((post) => {
      if (post.next_available_date) {
        // Parse date and normalize to yyyy-MM-dd format
        const dateObj = new Date(post.next_available_date);
        if (!isNaN(dateObj.getTime())) {
          const dateKey = format(dateObj, "yyyy-MM-dd");
          if (!dates.has(dateKey)) {
            dates.set(dateKey, []);
          }
          dates.get(dateKey)?.push(post);
          debugCount++;
        }
      }
    });
    console.log(`[ScheduledAccountsCalendar] Found ${debugCount} accounts with next_available_date`);
    console.log(`[ScheduledAccountsCalendar] Unique dates:`, Array.from(dates.keys()));
    return dates;
  }, [posts]);

  // Calendar navigation
  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: Date | null; accounts: Account[]; isCurrentMonth: boolean }> = [];

    // Padding days from previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, accounts: [], isCurrentMonth: false });
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = format(date, "yyyy-MM-dd");
      const accounts = scheduledDates.get(dateKey) || [];
      days.push({ date, accounts, isCurrentMonth: true });
    }

    return days;
  }, [currentMonth, scheduledDates]);

  // Selected date accounts
  const selectedDateAccounts = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return scheduledDates.get(dateKey) || [];
  }, [selectedDate, scheduledDates]);

  // Stats for display
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayCount = scheduledDates.get(todayStr)?.length || 0;
  const hasOverdue = Array.from(scheduledDates.entries()).some(([dateKey, accounts]) => {
    return isPast(parseISO(dateKey)) && !isToday(parseISO(dateKey)) && accounts.length > 0;
  });

  // Handle date click
  const handleDateClick = (date: Date, hasScheduled: boolean) => {
    setSelectedDate(date);
    if (hasScheduled) {
      const dateStr = format(date, "yyyy-MM-dd");
      setDateFilter(dateStr);
      onSelectDate?.(date);
    }
  };

  // Clear filter
  const handleClearFilter = () => {
    setDateFilter(null);
    setSelectedDate(null);
  };

  return (
    <div
      className="relative overflow-hidden rounded-none border bg-white p-0 shadow-sm transition-all duration-200 hover:shadow-md"
      style={{ borderLeftColor: "#8b5cf6", borderLeftWidth: 3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-none"
            style={{ background: "#8b5cf61a" }}
          >
            <Calendar className="h-4 w-4" style={{ color: "#8b5cf6" }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Schedule
            </p>
            <p className="text-xs text-slate-600">
              {todayCount > 0 ? (
                <span className="font-semibold text-purple-600">{todayCount} today</span>
              ) : (
                <span className="text-slate-400">No schedules today</span>
              )}
              {hasOverdue && (
                <span className="ml-2 text-[10px] text-red-500 font-medium">(has overdue)</span>
              )}
              <span className="ml-2 text-[10px] text-slate-400">
                ({Array.from(scheduledDates.values()).reduce((acc, arr) => acc + arr.length, 0)} total)
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1 hover:bg-slate-100 rounded-none transition-colors"
          >
            <ChevronDown className="h-4 w-4 rotate-90 text-slate-400" />
          </button>
          <span className="text-xs font-semibold text-slate-700 min-w-[70px] text-center">
            {format(currentMonth, "MMM yyyy")}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-slate-100 rounded-none transition-colors"
          >
            <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      <div className="p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (!day.date) {
              return <div key={`pad-${idx}`} className="h-7" />;
            }

            const hasScheduled = day.accounts.length > 0;
            const isTodayDate = isToday(day.date);
            const isPastDate = isPast(day.date) && !isTodayDate;
            const isSelected = selectedDate && isSameDay(day.date, selectedDate);

            return (
              <button
                key={day.date.toISOString()}
                onClick={() => handleDateClick(day.date!, hasScheduled)}
                className={`
                  relative h-7 w-full flex items-center justify-center text-[11px] font-medium rounded-none
                  transition-all duration-150
                  ${isSelected ? "bg-purple-600 text-white" : "hover:bg-slate-100"}
                  ${isTodayDate && !isSelected ? "bg-purple-50 text-purple-700 font-bold" : ""}
                  ${isPastDate && hasScheduled && !isSelected ? "text-red-600 bg-red-50/50" : ""}
                  ${!hasScheduled && !isTodayDate ? "text-slate-400" : "text-slate-700"}
                `}
              >
                {day.date.getDate()}
                {/* Dot indicator for scheduled */}
                {hasScheduled && (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                      isPastDate ? "bg-red-500" : isTodayDate ? "bg-purple-600" : "bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date preview */}
      {selectedDate && selectedDateAccounts.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">
              {isToday(selectedDate) ? "Today" : format(selectedDate, "MMM d, yyyy")}
            </p>
            <span className="text-[10px] text-purple-600 font-semibold">
              {selectedDateAccounts.length} account{selectedDateAccounts.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1">
            {selectedDateAccounts.slice(0, 3).map((account) => (
              <div
                key={account.id}
                className="text-[10px] text-slate-600 truncate flex items-center gap-1"
              >
                <span className="w-1 h-1 rounded-full bg-purple-400" />
                {account.company_name}
              </div>
            ))}
          </div>
          {selectedDateAccounts.length > 3 && (
            <button
              onClick={() => setShowDialog(true)}
              className="mt-2 text-[10px] text-purple-600 font-medium hover:text-purple-800 underline"
            >
              View {selectedDateAccounts.length - 3} more...
            </button>
          )}
        </div>
      )}

      {/* Clear Filter Button */}
      {dateFilter && (
        <div className="border-t border-slate-100 px-3 py-2 bg-purple-50/50">
          <button
            onClick={handleClearFilter}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-purple-600 font-medium hover:text-purple-800"
          >
            <X className="h-3 w-3" />
            Clear date filter
          </button>
        </div>
      )}

      {/* View More Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-full max-w-md rounded-none p-0 overflow-hidden gap-0">
          <div className="bg-zinc-900 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduled Accounts
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 mb-3">
              {selectedDate &&
                (isToday(selectedDate) ? "Today" : format(selectedDate, "MMMM d, yyyy"))}
              <span className="ml-2 text-purple-600 font-semibold">
                ({selectedDateAccounts.length} accounts)
              </span>
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {selectedDateAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-2 border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 uppercase">
                      {account.company_name}
                    </p>
                    <p className="text-[10px] text-slate-500">{account.contact_person}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] rounded-none"
                    style={{
                      borderColor: getClusterStyle(account.type_client).color + "40",
                      background: getClusterStyle(account.type_client).bg,
                      color: getClusterStyle(account.type_client).textColor,
                    }}
                  >
                    {account.type_client}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none text-xs"
              onClick={() => setShowDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-3 text-[9px] text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          Today
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Upcoming
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Overdue
        </div>
      </div>
    </div>
  );
}
