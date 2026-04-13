"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, where,
  Timestamp, onSnapshot, QuerySnapshot, DocumentData,
} from "firebase/firestore";
import { ChevronLeft, ChevronRight, Clock, CalendarDays, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  date: string;       // "YYYY-MM-DD"
  time?: string;      // "hh:mm AM/PM"
  title: string;
  description: string;
}

interface SimpleCalendarProps {
  referenceid: string;
  userId: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

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
  const h12  = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function groupEventsByHour(events: EventItem[]): Record<number, EventItem[]> {
  const map: Record<number, EventItem[]> = {};
  for (let i = 0; i < 24; i++) map[i] = [];

  events.forEach((ev) => {
    if (!ev.time) return;
    const match = ev.time.match(/^(\d{1,2}):\d{2} (AM|PM)$/);
    if (!match) return;
    let hour = parseInt(match[1], 10);
    const ampm = match[2];
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    map[hour].push(ev);
  });

  return map;
}

// Event type → color
const EVENT_COLORS: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  login:  { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
  logout: { bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-400",    text: "text-rose-700"   },
};

function getEventStyle(title: string) {
  return EVENT_COLORS[title.toLowerCase()] ?? {
    bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-400", text: "text-indigo-700",
  };
}

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard: React.FC<{ ev: EventItem }> = ({ ev }) => {
  const style = getEventStyle(ev.title);
  return (
    <div className={`group relative rounded-xl border ${style.border} ${style.bg} px-4 py-3 hover:shadow-md transition-all duration-150`}>
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "currentColor" }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold capitalize ${style.text}`}>{ev.title}</p>
          {ev.description && (
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{ev.description}</p>
          )}
        </div>
        {ev.time && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium shrink-0">
            <Clock size={10} />
            {ev.time}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function SimpleCalendar({ referenceid, userId, email }: SimpleCalendarProps) {
  const now = React.useMemo(() => new Date(), []);
  const [currentYear,  setCurrentYear]  = React.useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(now.getMonth());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(now);
  const [searchTerm,   setSearchTerm]   = React.useState("");

  const [events, setEvents] = React.useState<EventItem[]>([]);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const currentHourRef     = React.useRef<HTMLDivElement>(null);

  // ── Firebase snapshot processor ────────────────────────────────────────────

  const processSnapshot = React.useCallback((
    snapshot: QuerySnapshot<DocumentData>,
    dateField: string,
    titleField: string,
    descriptionField: string,
  ): EventItem[] => {
    const items: EventItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      let dateStr = "";
      let timeStr: string | undefined;

      const dateValue = data[dateField];
      if (dateValue instanceof Timestamp) {
        const d = dateValue.toDate();
        dateStr = formatDateLocal(d);
        timeStr = formatTime(d);
      } else if (typeof dateValue === "string" || typeof dateValue === "number") {
        const d = new Date(dateValue);
        if (!isNaN(d.getTime())) {
          dateStr = formatDateLocal(d);
          timeStr = formatTime(d);
        }
      }

      items.push({
        id: doc.id,
        date: dateStr,
        time: timeStr,
        title: data[titleField] || "Event",
        description: data[descriptionField] || "",
      });
    });
    return items;
  }, []);

  // ── Realtime listeners ─────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!referenceid && !email) { setEvents([]); return; }

    const unsubs: (() => void)[] = [];

    if (referenceid) {
      const q = query(
        collection(db, "meetings"),
        where("referenceid", "==", referenceid),
        orderBy("start_date", "desc")
      );
      unsubs.push(onSnapshot(q, (snap) => {
        const meetingEvents = processSnapshot(snap, "start_date", "type_activity", "remarks");
        setEvents((prev) => {
          const others = prev.filter((e) => ["login", "logout"].includes(e.title.toLowerCase()));
          return [...meetingEvents, ...others].sort(sortEvents);
        });
      }));
    }

    if (email) {
      const q = query(
        collection(db, "activity_logs"),
        where("email", "==", email),
        orderBy("date_created", "desc")
      );
      unsubs.push(onSnapshot(q, (snap) => {
        const all = processSnapshot(snap, "date_created", "status", "remarks");
        const logEvents = all.filter((e) => ["login", "logout"].includes(e.title.toLowerCase()));
        setEvents((prev) => {
          const others = prev.filter((e) => !["login", "logout"].includes(e.title.toLowerCase()));
          return [...others, ...logEvents].sort(sortEvents);
        });
      }));
    }

    return () => unsubs.forEach((u) => u());
  }, [referenceid, email, processSnapshot]);

  function sortEvents(a: EventItem, b: EventItem) {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    if (a.time && b.time) return a.time > b.time ? -1 : a.time < b.time ? 1 : 0;
    return 0;
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  // All events grouped by date (unfiltered) — used for calendar dots
  const allEventsByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => { map[e.date] = (map[e.date] ?? 0) + 1; });
    return map;
  }, [events]);

  const selectedDateStr   = selectedDate ? formatDateLocal(selectedDate) : null;

  // Events for selected date, filtered by search
  const selectedDayEvents = React.useMemo(() => {
    if (!selectedDateStr) return [];
    const s = searchTerm.toLowerCase();
    return events.filter((e) => {
      if (e.date !== selectedDateStr) return false;
      if (!s) return true;
      return [e.title, e.description].join(" ").toLowerCase().includes(s);
    });
  }, [events, selectedDateStr, searchTerm]);

  const groupedByHour = React.useMemo(
    () => groupEventsByHour(selectedDayEvents),
    [selectedDayEvents]
  );

  const daysInMonth  = getDaysInMonth(currentYear, currentMonth);
  const firstWeekday = getFirstWeekday(currentYear, currentMonth);

  const nowHour = now.getHours();
  const isToday =
    selectedDate &&
    selectedDate.getDate()     === now.getDate()  &&
    selectedDate.getMonth()    === now.getMonth() &&
    selectedDate.getFullYear() === now.getFullYear();

  // Scroll to current hour
  React.useEffect(() => {
    if (isToday && currentHourRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = currentHourRef.current.offsetTop - 40;
    }
  }, [selectedDate, isToday]);

  // Month nav
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDate(null);
  };

  // Month total
  const monthTotal = Object.entries(allEventsByDate)
    .filter(([k]) => k.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`))
    .reduce((acc, [, v]) => acc + v, 0);

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
              {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })}
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
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-0.5 px-4 pb-5">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected =
              selectedDate &&
              selectedDate.getDate()     === day &&
              selectedDate.getMonth()    === currentMonth &&
              selectedDate.getFullYear() === currentYear;
            const isTodayCell =
              day === now.getDate() &&
              currentMonth === now.getMonth() &&
              currentYear  === now.getFullYear();
            const eventCount = allEventsByDate[dateKey] ?? 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(new Date(currentYear, currentMonth, day))}
                className={`relative flex flex-col items-center justify-center rounded-xl h-10 w-full text-xs font-semibold transition-all duration-100
                  ${isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : isTodayCell
                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300"
                    : "text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {day}
                {eventCount > 0 && (
                  <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : "bg-indigo-400"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Month summary footer */}
        <div className="mt-auto border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500">
            <CalendarDays size={13} />
            <span className="text-xs">
              {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })} total
            </span>
          </div>
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {monthTotal} events
          </Badge>
        </div>
      </div>

      {/* ── RIGHT: Timeline panel ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Panel header */}
        <div className="border-b border-slate-100 px-5 pt-4 pb-3 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-PH", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })
                  : "Select a date"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedDate
                  ? `${selectedDayEvents.length} event${selectedDayEvents.length !== 1 ? "s" : ""}`
                  : "No date selected"}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-300"
            />
          </div>
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 py-20">
              <CalendarDays size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Pick a day on the calendar</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-0">
              {Array.from({ length: 24 }, (_, h) => h).map((hour) => {
                const isCurrentHour = !!isToday && hour === nowHour;
                const eventsInHour  = groupedByHour[hour] ?? [];
                const hasEvents     = eventsInHour.length > 0;

                return (
                  <div
                    key={hour}
                    ref={isCurrentHour ? currentHourRef : null}
                    className="flex gap-3 min-h-[48px]"
                  >
                    {/* Hour label + timeline line */}
                    <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                      <span className={`text-[10px] font-bold leading-none select-none
                        ${isCurrentHour ? "text-indigo-600" : "text-slate-400"}`}>
                        {formatHourLabel(hour)}
                      </span>
                      <div className={`flex-1 w-px mt-1.5
                        ${isCurrentHour ? "bg-indigo-400" : hasEvents ? "bg-slate-300" : "bg-slate-100"}`}
                      />
                    </div>

                    {/* Events */}
                    <div className="flex-1 pb-2 pt-0.5 space-y-1.5">
                      {/* Current time indicator */}
                      {isCurrentHour && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-md shadow-indigo-300 animate-pulse" />
                          <span className="text-[10px] text-indigo-500 font-bold tracking-wider uppercase">
                            Now · {formatTime(now)}
                          </span>
                        </div>
                      )}

                      {hasEvents
                        ? eventsInHour.map((ev) => <EventCard key={ev.id} ev={ev} />)
                        : <div className="text-[11px] text-slate-200 pt-1 select-none">—</div>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}