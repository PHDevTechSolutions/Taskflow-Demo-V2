"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  ChevronDown,
  Clock,
  Search,
  CalendarDays,
  SlidersHorizontal,
  UserCircle2,
  Timer,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CCGItem {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity?: string;
  date_updated: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  status: string;
  company_name: string;
  remarks: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
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

function formatDuration(start?: string, end?: string): string | null {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return null;
  let diff = Math.floor((e.getTime() - s.getTime()) / 1000);
  if (diff < 0) return null;
  const hours   = Math.floor(diff / 3600);
  diff %= 3600;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  const parts: string[] = [];
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function groupByHour(items: CCGItem[]): Record<number, CCGItem[]> {
  const map: Record<number, CCGItem[]> = {};
  for (let i = 0; i < 24; i++) map[i] = [];
  items.forEach((it) => {
    const d = parseDate(it.date_updated);
    if (!d) return;
    map[d.getHours()].push(it);
  });
  for (let h = 0; h < 24; h++) {
    map[h].sort(
      (a, b) =>
        parseDate(a.date_updated)!.getTime() -
        parseDate(b.date_updated)!.getTime()
    );
  }
  return map;
}

const STATUS_STYLES: Record<string, string> = {
  "Assisted":     "bg-blue-100    text-blue-700    border-blue-200",
  "Not Assisted": "bg-rose-100    text-rose-700    border-rose-200",
  "Quote-Done":   "bg-violet-100  text-violet-700  border-violet-200",
  "SO-Done":      "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Delivered":    "bg-teal-100    text-teal-700    border-teal-200",
  "Cancelled":    "bg-red-100     text-red-700     border-red-200",
};

// ─── Agent Avatar ─────────────────────────────────────────────────────────────

const AgentAvatar: React.FC<{ name: string; picture?: string }> = ({ name, picture }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold flex items-center justify-center ring-1 ring-green-200">
      {initials}
    </span>
  );
};

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard: React.FC<{
  ev: CCGItem;
  agentName?: string;
  agentPicture?: string;
}> = ({ ev, agentName, agentPicture }) => {
  const dt = parseDate(ev.date_updated);
  const statusClass =
    STATUS_STYLES[ev.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const duration = formatDuration(ev.start_date, ev.end_date);

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-green-300 transition-all duration-150">
      {/* Left accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />

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

          {/* ── Duration row ── */}
          {duration && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
              <Timer size={11} className="text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-500 font-medium font-mono">
                {duration}
              </span>
            </div>
          )}

          {/* ── Agent name row ── */}
          {agentName && (
            <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 ${duration ? "border-t-0 mt-1 pt-0" : ""}`}>
              <AgentAvatar name={agentName} picture={agentPicture} />
              <span className="text-[11px] text-slate-500 font-medium truncate">
                {agentName}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {dt && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock size={10} />
              {formatTime(dt)}
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
  const [agents,     setAgents]     = useState<Agent[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [searchTerm,         setSearchTerm]         = useState("");
  const [filterStatus,       setFilterStatus]       = useState("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState("all");
  const [filterAgent,        setFilterAgent]        = useState("all");
  const [showFilters,        setShowFilters]        = useState(false);
  const [expandedHours,      setExpandedHours]      = useState<Set<number>>(new Set());

  const today = useMemo(() => new Date(), []);
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const currentHourRef     = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch agents ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!referenceid) return;
    fetch(`/api/fetch-all-user-manager?id=${encodeURIComponent(referenceid)}`)
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => {});
  }, [referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, { name: string; picture: string }> = {};
    agents.forEach((a) => {
      if (a.ReferenceID)
        m[a.ReferenceID.toLowerCase()] = {
          name: `${a.Firstname} ${a.Lastname}`,
          picture: a.profilePicture || "",
        };
    });
    return m;
  }, [agents]);

  // ── Fetch activities ───────────────────────────────────────────────────────

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL("/api/activity/manager/calendar/fetch", window.location.origin);
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

    const chan = supabase
      .channel(`public:history:manager=eq.${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
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
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [referenceid, fetchActivities]);

  // ── Derived Data ───────────────────────────────────────────────────────────

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
      ),
    [activities]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(sortedActivities.map((a) => a.status).filter(Boolean))).sort(),
    [sortedActivities]
  );

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(sortedActivities.map((a) => a.type_activity).filter(Boolean) as string[])
      ).sort(),
    [sortedActivities]
  );

  const agentOptions = useMemo(() => {
    const ids = Array.from(
      new Set(sortedActivities.map((a) => a.referenceid?.toLowerCase()).filter(Boolean))
    );
    return ids
      .map((id) => ({ id, name: agentMap[id]?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedActivities, agentMap]);

  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return sortedActivities.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterTypeActivity !== "all" && item.type_activity !== filterTypeActivity) return false;
      if (filterAgent !== "all" && item.referenceid?.toLowerCase() !== filterAgent.toLowerCase()) return false;
      if (s) {
        const agentName = agentMap[item.referenceid?.toLowerCase()]?.name ?? "";
        const haystack = [
          item.company_name,
          item.type_activity,
          item.status,
          item.remarks,
          item.activity_reference_number,
          agentName,
        ].join(" ").toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [sortedActivities, searchTerm, filterStatus, filterTypeActivity, filterAgent, agentMap]);

  const allEventsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of sortedActivities) {
      const d = parseDate(item.date_updated);
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
      const d = parseDate(item.date_updated);
      return d ? formatDateLocal(d) === selectedDateStr : false;
    });
  }, [filteredActivities, selectedDateStr]);

  const groupedByHour = useMemo(() => groupByHour(selectedDayEvents), [selectedDayEvents]);

  // ── Calendar helpers ───────────────────────────────────────────────────────

  const daysInMonth  = useMemo(() => getDaysInMonth(currentYear, currentMonth),  [currentYear, currentMonth]);
  const firstWeekday = useMemo(() => getFirstWeekday(currentYear, currentMonth), [currentYear, currentMonth]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDate(null);
    setExpandedHours(new Set());
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDate(null);
    setExpandedHours(new Set());
  };

  // ── Scroll to current hour ─────────────────────────────────────────────────

  const nowDate     = new Date();
  const currentHour = nowDate.getHours();
  const isToday =
    selectedDate &&
    selectedDate.getDate()     === nowDate.getDate()  &&
    selectedDate.getMonth()    === nowDate.getMonth() &&
    selectedDate.getFullYear() === nowDate.getFullYear();

  useEffect(() => {
    if (isToday && currentHourRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = currentHourRef.current.offsetTop - 40;
    }
  }, [selectedDate, isToday]);

  const hasActiveFilters =
    filterStatus !== "all" ||
    filterTypeActivity !== "all" ||
    filterAgent !== "all" ||
    searchTerm.length > 0;

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
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-slate-400 py-1">
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
              selectedDate.getDate()     === day &&
              selectedDate.getMonth()    === currentMonth &&
              selectedDate.getFullYear() === currentYear;
            const isTodayCell =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear  === today.getFullYear();
            const eventCount = allEventsByDate[dateKey] ?? 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(new Date(currentYear, currentMonth, day))}
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
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      isSelected ? "bg-white/70" : "bg-green-400"
                    }`}
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
              {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })} total
            </span>
          </div>
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {Object.entries(allEventsByDate)
              .filter(([k]) => k.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`))
              .reduce((acc, [, v]) => acc + v, 0)}{" "}
            events
          </Badge>
        </div>
      </div>

      {/* ── RIGHT: Timeline panel ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Panel header */}
        <div className="border-b border-slate-100 px-5 pt-4 pb-3 flex flex-col gap-3">

          {/* Title row */}
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
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search company, agent, activity, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-green-300"
            />
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1">

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-7 w-[150px] text-xs border-slate-200">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTypeActivity} onValueChange={setFilterTypeActivity}>
                <SelectTrigger className="h-7 w-[170px] text-xs border-slate-200">
                  <SelectValue placeholder="All Activity Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity Types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger className="h-7 w-[180px] text-xs border-slate-200">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-1.5">
                      <UserCircle2 size={12} className="text-slate-400" />
                      All Agents
                    </span>
                  </SelectItem>
                  {agentOptions.map(({ id, name }) => (
                    <SelectItem key={id} value={id}>
                      <span className="flex items-center gap-1.5">
                        <AgentAvatar name={name} picture={agentMap[id]?.picture} />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterTypeActivity("all");
                    setFilterAgent("all");
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
              {Array.from({ length: 24 }, (_, h) => h).map((hour) => {
                const isCurrentHour = !!isToday && hour === currentHour;
                const events        = groupedByHour[hour] ?? [];
                const hasEvents     = events.length > 0;
                const isExpanded    = expandedHours.has(hour);

                const toggleHour = () => {
                  if (!hasEvents) return;
                  setExpandedHours((prev) => {
                    const next = new Set(prev);
                    next.has(hour) ? next.delete(hour) : next.add(hour);
                    return next;
                  });
                };

                return (
                  <div
                    key={hour}
                    ref={isCurrentHour ? currentHourRef : null}
                    className="flex gap-3 group"
                  >
                    {/* Hour label + timeline line */}
                    <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                      <span
                        className={`text-[10px] font-bold leading-none select-none
                          ${isCurrentHour ? "text-green-600" : "text-slate-400"}`}
                      >
                        {formatHourLabel(hour)}
                      </span>
                      <div
                        className={`flex-1 w-px mt-1.5
                          ${
                            isCurrentHour
                              ? "bg-green-400"
                              : hasEvents
                              ? "bg-slate-300"
                              : "bg-slate-100"
                          }`}
                      />
                    </div>

                    {/* Events area */}
                    <div className="flex-1 pb-2 pt-0.5 space-y-1.5 min-h-[48px]">

                      {/* Current time indicator */}
                      {isCurrentHour && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 shadow-md shadow-green-300 animate-pulse" />
                          <span className="text-[10px] text-green-500 font-bold tracking-wider uppercase">
                            Now · {formatTime(nowDate)}
                          </span>
                        </div>
                      )}

                      {hasEvents ? (
                        <>
                          {/* Collapsed header — always visible when there are events */}
                          <button
                            type="button"
                            onClick={toggleHour}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-150
                              ${
                                isExpanded
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold ${isExpanded ? "text-green-700" : "text-slate-700"}`}>
                                {events.length} {events.length === 1 ? "activity" : "activities"}
                              </span>
                              {/* Mini status dots */}
                              <div className="flex items-center gap-1">
                                {Array.from(
                                  events.reduce((acc, ev) => {
                                    acc.set(ev.status, (acc.get(ev.status) ?? 0) + 1);
                                    return acc;
                                  }, new Map<string, number>())
                                ).map(([status, count]) => (
                                  <span
                                    key={status}
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold
                                      ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                                  >
                                    {count} {status}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <ChevronDown
                              size={13}
                              className={`transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180 text-green-600" : "text-slate-400"}`}
                            />
                          </button>

                          {/* Expanded cards */}
                          {isExpanded && (
                            <div className="space-y-1.5 pt-1">
                              {events.map((ev) => {
                                const agentInfo = agentMap[ev.referenceid?.toLowerCase()];
                                return (
                                  <EventCard
                                    key={ev.id}
                                    ev={ev}
                                    agentName={agentInfo?.name}
                                    agentPicture={agentInfo?.picture}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-200 pt-1 select-none">—</div>
                      )}
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
};
