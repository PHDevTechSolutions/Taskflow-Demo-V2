"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CCGItem {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity?: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  status: string;
  company_name: string;
  remarks: string;
}

interface MeetingSlot {
  type: "meeting";
  meeting: CCGItem;
  children: CCGItem[];
  startHour: number;
  endHour: number;
}

interface ActivitySlot {
  type: "activity";
  item: CCGItem;
  hour: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(date: Date) {
  let h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function formatHourLabel(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function buildHourSlots(items: CCGItem[]): {
  meetingSlots: MeetingSlot[];
  activitySlots: ActivitySlot[];
} {
  const meetings = items.filter((it) => it.start_date && it.end_date);
  const activities = items.filter((it) => !it.start_date || !it.end_date);

  const meetingSlots: MeetingSlot[] = meetings.map((meeting) => {
    const startDate = parseDate(meeting.start_date!)!;
    const endDate = parseDate(meeting.end_date!)!;
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();

    const children = activities.filter((act) => {
      const actTime = parseDate(act.end_date);
      if (!actTime) return false;
      return actTime >= startDate && actTime <= endDate;
    });

    return { type: "meeting", meeting, children, startHour, endHour };
  });

  const coveredActivityIds = new Set(
    meetingSlots.flatMap((ms) => ms.children.map((c) => c.id))
  );

  const activitySlots: ActivitySlot[] = activities
    .filter((act) => !coveredActivityIds.has(act.id))
    .map((act) => {
      const d = parseDate(act.end_date);
      return { type: "activity", item: act, hour: d ? d.getHours() : 0 };
    });

  return { meetingSlots, activitySlots };
}

// Status badge styling
const STATUS_STYLES: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-100  text-amber-700  border-amber-200",
  Cancelled: "bg-red-100    text-red-700    border-red-200",
  Active: "bg-blue-100   text-blue-700   border-blue-200",
};

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard: React.FC<{ ev: CCGItem }> = ({ ev }) => {
  const isMeeting = ev.start_date && ev.end_date;
  const startDate = parseDate(isMeeting ? ev.start_date : ev.end_date);
  const endDate = isMeeting ? parseDate(ev.end_date) : null;
  const statusClass =
    STATUS_STYLES[ev.status] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div
        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${isMeeting ? "bg-purple-400" : "bg-green-400"}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate">
            {ev.company_name || "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {ev.type_activity ?? ev.activity_reference_number}
          </p>
          {ev.remarks && (
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 capitalize">
              {ev.remarks}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {startDate && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock size={10} />
              {formatTime(startDate)}
              {endDate && ` - ${formatTime(endDate)}`}
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusClass}`}
          >
            {ev.status || "—"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CCG: React.FC<{
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}> = ({ referenceid, dateCreatedFilterRange, setDateCreatedFilterRangeAction }) => {
  const [activities, setActivities] = useState<CCGItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const currentHourRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/calendar/fetch",
      window.location.origin
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const handlePostgresChanges = (payload: any) => {
      const newRec = payload.new as CCGItem;
      const oldRec = payload.old as CCGItem;
      setActivities((curr) => {
        switch (payload.eventType) {
          case "INSERT":
            return curr.some((a) => a.id === newRec.id) ? curr : [...curr, newRec];
          case "UPDATE":
            return curr.map((a) => (a.id === newRec.id ? newRec : a));
          case "DELETE":
            return curr.filter((a) => a.id !== oldRec.id);
          default:
            return curr;
        }
      });
    };

    const historyChannel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        handlePostgresChanges
      )
      .subscribe();

    const meetingsChannel = supabase
      .channel(`public:meetings:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `referenceid=eq.${referenceid}`,
        },
        handlePostgresChanges
      )
      .subscribe();

    return () => {
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(meetingsChannel);
    };
  }, [referenceid, fetchActivities]);

  // ── Derived Data ───────────────────────────────────────────────────────────

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.start_date || b.end_date).getTime() -
          new Date(a.start_date || a.end_date).getTime()
      ),
    [activities]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(sortedActivities.map((a) => a.status).filter(Boolean))
      ).sort(),
    [sortedActivities]
  );

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sortedActivities
            .map((a) => a.type_activity)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [sortedActivities]
  );

  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return sortedActivities.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (
        filterTypeActivity !== "all" &&
        item.type_activity !== filterTypeActivity
      )
        return false;
      if (s) {
        const haystack = [
          item.company_name,
          item.type_activity,
          item.status,
          item.remarks,
          item.activity_reference_number,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [sortedActivities, searchTerm, filterStatus, filterTypeActivity]);

  const allEventsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of sortedActivities) {
      const d = parseDate(item.start_date || item.end_date);
      if (!d) continue;
      const key = formatDateLocal(d);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [sortedActivities]);

  const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : null;

  const selectedDayEvents = useMemo(() => {
    if (!selectedDateStr) return [];
    return filteredActivities.filter((item) => {
      const d = parseDate(item.start_date || item.end_date);
      return d ? formatDateLocal(d) === selectedDateStr : false;
    });
  }, [filteredActivities, selectedDateStr]);

  // Build hour slots from selected day events
  const { meetingSlots, activitySlots } = useMemo(
    () => buildHourSlots(selectedDayEvents),
    [selectedDayEvents]
  );

  // Map: hour → meeting slot (for spanning)
  const hourToMeeting = useMemo(() => {
    const map = new Map<number, MeetingSlot>();
    meetingSlots.forEach((ms) => {
      for (let h = ms.startHour; h <= ms.endHour; h++) {
        map.set(h, ms);
      }
    });
    return map;
  }, [meetingSlots]);

  // ── Calendar helpers ───────────────────────────────────────────────────────

  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );
  const firstWeekday = useMemo(
    () => getFirstWeekday(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else setCurrentMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else setCurrentMonth((m) => m + 1);
    setSelectedDate(null);
  };

  const nowDate = new Date();
  const currentHour = nowDate.getHours();
  const isToday =
    selectedDate &&
    selectedDate.getDate() === nowDate.getDate() &&
    selectedDate.getMonth() === nowDate.getMonth() &&
    selectedDate.getFullYear() === nowDate.getFullYear();

  useEffect(() => {
    if (isToday && currentHourRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        currentHourRef.current.offsetTop - 40;
    }
  }, [selectedDate, isToday]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-0 rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white min-h-[680px]">
      {/* ── LEFT: Calendar panel ── */}
      <div className="lg:w-[320px] shrink-0 border-r border-slate-100 bg-slate-50 flex flex-col">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800 tracking-wide">
              {new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })}
            </p>
            <p className="text-xs text-slate-400">{currentYear}</p>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-4 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center text-[11px] font-bold text-slate-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-y-0.5 px-4 pb-5">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected =
              selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === currentMonth &&
              selectedDate.getFullYear() === currentYear;
            const isTodayCell =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear();
            const eventCount = allEventsByDate[dateKey] ?? 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setSelectedDate(new Date(currentYear, currentMonth, day))
                }
                className={`relative flex flex-col items-center justify-center rounded-xl h-10 w-full text-xs font-semibold transition-all duration-100
                  ${
                    isSelected
                      ? "bg-green-600 text-white shadow-md shadow-green-200"
                      : isTodayCell
                        ? "bg-green-50 text-green-700 ring-1 ring-green-300"
                        : "text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {day}
                {eventCount > 0 && (
                  <span
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : "bg-green-400"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Month summary */}
        <div className="mt-auto border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500">
            <CalendarDays size={13} />
            <span className="text-xs">
              {new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })}{" "}
              total
            </span>
          </div>
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {Object.entries(allEventsByDate)
              .filter(([k]) =>
                k.startsWith(
                  `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
                )
              )
              .reduce((acc, [, v]) => acc + v, 0)}{" "}
            events
          </Badge>
        </div>
      </div>

      {/* ── RIGHT: Timeline panel ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Panel header */}
        <div className="border-b border-slate-100 px-5 pt-4 pb-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedDate
                  ? `${selectedDayEvents.length} event${selectedDayEvents.length !== 1 ? "s" : ""}`
                  : "No date selected"}
              </p>
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors
                ${
                  showFilters
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:text-green-600"
                }`}
            >
              <SlidersHorizontal size={12} />
              Filters
            </button>
          </div>

          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              placeholder="Search company, activity, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-green-300"
            />
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-7 w-[150px] text-xs border-slate-200">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterTypeActivity}
                onValueChange={setFilterTypeActivity}
              >
                <SelectTrigger className="h-7 w-[170px] text-xs border-slate-200">
                  <SelectValue placeholder="All Activity Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity Types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filterStatus !== "all" ||
                filterTypeActivity !== "all" ||
                searchTerm) && (
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterTypeActivity("all");
                    setSearchTerm("");
                  }}
                  className="h-7 px-3 text-[11px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
          {loading ? (
            <div className="flex items-center justify-center h-full py-20 text-slate-400 text-xs gap-2">
              <span className="animate-spin text-lg">⏳</span> Loading...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full py-20 text-red-400 text-xs">
              {error}
            </div>
          ) : !selectedDate ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 py-20">
              <CalendarDays size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Pick a day on the calendar</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-0">
              {(() => {
                const renderedMeetingIds = new Set<number>();

                return Array.from({ length: 24 }, (_, h) => h).map((hour) => {
                  const isCurrentHour = !!isToday && hour === currentHour;
                  const meetingSlot = hourToMeeting.get(hour);

                  // Skip hours inside a meeting that's already been rendered
                  if (
                    meetingSlot &&
                    renderedMeetingIds.has(meetingSlot.meeting.id)
                  ) {
                    return null;
                  }

                  // Render spanning meeting block at its START hour
                  if (meetingSlot) {
                    renderedMeetingIds.add(meetingSlot.meeting.id);
                    const startDate = parseDate(meetingSlot.meeting.start_date!)!;
                    const endDate = parseDate(meetingSlot.meeting.end_date!)!;
                    const spanHours =
                      meetingSlot.endHour - meetingSlot.startHour + 1;

                    return (
                      <div
                        key={`meeting-${meetingSlot.meeting.id}`}
                        ref={isCurrentHour ? currentHourRef : null}
                        className="flex gap-3"
                        style={{ minHeight: `${spanHours * 48}px` }}
                      >
                        {/* Hour label + vertical line */}
                        <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                          <span className="text-[10px] font-bold leading-none select-none text-purple-500">
                            {formatHourLabel(hour)}
                          </span>
                          <div className="flex-1 w-px mt-1.5 bg-purple-300" />
                        </div>

                        {/* Spanning meeting block */}
                        <div className="flex-1 pb-2 pt-0.5">
                          <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden h-full flex flex-col">
                            {/* Meeting header */}
                            <div className="px-4 pt-3 pb-2 border-b border-purple-200 bg-purple-100/60 shrink-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-purple-900 truncate">
                                    {meetingSlot.meeting.company_name || "—"}
                                  </p>
                                  <p className="text-[11px] text-purple-600 mt-0.5 truncate">
                                    {meetingSlot.meeting.type_activity ??
                                      meetingSlot.meeting
                                        .activity_reference_number}
                                  </p>
                                  {meetingSlot.meeting.remarks && (
                                    <p className="text-[11px] text-purple-500 mt-1 line-clamp-2 capitalize">
                                      {meetingSlot.meeting.remarks}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="flex items-center gap-1 text-[10px] text-purple-500 font-medium">
                                    <Clock size={10} />
                                    {formatTime(startDate)} –{" "}
                                    {formatTime(endDate)}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_STYLES[meetingSlot.meeting.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                                  >
                                    {meetingSlot.meeting.status || "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Children activities */}
                            {meetingSlot.children.length > 0 ? (
                              <div className="px-3 py-2 space-y-1.5 flex-1">
                                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                                  Activities during this meeting
                                </p>
                                {meetingSlot.children
                                  .sort(
                                    (a, b) =>
                                      new Date(a.end_date).getTime() -
                                      new Date(b.end_date).getTime()
                                  )
                                  .map((child) => {
                                    const childTime = parseDate(
                                      child.end_date
                                    );
                                    return (
                                      <div
                                        key={child.id}
                                        className="flex gap-2 items-start"
                                      >
                                        <span className="text-[9px] text-purple-400 font-bold pt-[14px] w-12 shrink-0 text-right">
                                          {childTime
                                            ? formatTime(childTime)
                                            : "—"}
                                        </span>
                                        <div className="flex-1">
                                          <EventCard ev={child} />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <div className="px-4 py-3 text-[11px] text-purple-300 italic flex-1">
                                No activities logged during this meeting
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Normal hour row
                  const hourActivities = activitySlots.filter(
                    (s) => s.hour === hour
                  );
                  const hasEvents = hourActivities.length > 0;

                  return (
                    <div
                      key={hour}
                      ref={isCurrentHour ? currentHourRef : null}
                      className={`flex gap-3 min-h-[48px] group ${isCurrentHour ? "relative" : ""}`}
                    >
                      <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                        <span
                          className={`text-[10px] font-bold leading-none select-none ${isCurrentHour ? "text-green-600" : "text-slate-400"}`}
                        >
                          {formatHourLabel(hour)}
                        </span>
                        <div
                          className={`flex-1 w-px mt-1.5 ${isCurrentHour ? "bg-green-400" : hasEvents ? "bg-slate-300" : "bg-slate-100"}`}
                        />
                      </div>
                      <div className="flex-1 pb-2 pt-0.5 space-y-1.5">
                        {isCurrentHour && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-md shadow-green-300 animate-pulse" />
                            <span className="text-[10px] text-green-500 font-bold tracking-wider uppercase">
                              Now · {formatTime(nowDate)}
                            </span>
                          </div>
                        )}
                        {hasEvents ? (
                          hourActivities.map(({ item }) => (
                            <EventCard key={item.id} ev={item} />
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-200 pt-1 select-none">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
