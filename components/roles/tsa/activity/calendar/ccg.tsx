"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface CCGItem {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_activity?: string;
    date_created: string;
    date_updated: string;
    status: string;
    company_name: string;
    remarks: string;
}

// Helpers: date formatting & grouping
function formatDateLocal(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatTimeFromDate(date: Date) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
}

function formatHourLabel(hour24: number) {
    const ampm = hour24 >= 12 ? "PM" : "AM";
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12} ${ampm}`;
}

function parseDateCreated(value?: string) {
    if (!value) return null;
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
}

function eventsByHour(items: CCGItem[]) {
    const map: Record<number, CCGItem[]> = {};
    for (let i = 0; i < 24; i++) map[i] = [];
    items.forEach((it) => {
        const d = parseDateCreated(it.date_created);
        if (!d) return;
        const hour = d.getHours();
        map[hour].push(it);
    });
    for (let h = 0; h < 24; h++) {
        map[h].sort(
            (a, b) =>
                parseDateCreated(a.date_created)!.getTime() - parseDateCreated(b.date_created)!.getTime()
        );
    }
    return map;
}

export const CCG: React.FC<{
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}> = ({ referenceid, target_quota, dateCreatedFilterRange, setDateCreatedFilterRangeAction }) => {
    const [activities, setActivities] = useState<CCGItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<Date | null>(today);

    // Fetch activities only (history includes company info)
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
    
        const url = new URL("/api/activity/tsa/calendar/fetch", window.location.origin);
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

    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        const chan = supabase
            .channel(`public:history:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as CCGItem;
                    const oldRecord = payload.old as CCGItem;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) return [...curr, newRecord];
                                return curr;
                            case "UPDATE":
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
                            case "DELETE":
                                return curr.filter((a) => a.id !== oldRecord.id);
                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chan);
        };
    }, [referenceid, fetchActivities]);

    // No company merge needed anymore
    const mergedActivities = useMemo(() => {
        return activities.sort(
            (a, b) =>
                new Date(b.date_updated ?? b.date_created).getTime() -
                new Date(a.date_updated ?? a.date_created).getTime()
        );
    }, [activities]);

    const hasMeaningfulData = (item: CCGItem) => {
        return Object.values(item).some((val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === "string") return val.trim() !== "";
            if (typeof val === "number") return !isNaN(val);
            if (val instanceof Date) return !isNaN(val.getTime());
            return Boolean(val);
        });
    };

    const filteredActivities = useMemo(() => {
        const s = searchTerm.toLowerCase();

        return mergedActivities
            .filter((item) => {
                if (!s) return true;
                return Object.values(item).some((val) => val && String(val).toLowerCase().includes(s));
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                if (filterTypeActivity !== "all" && item.type_activity !== filterTypeActivity) return false;
                return true;
            })
            .filter(hasMeaningfulData);
    }, [mergedActivities, searchTerm, filterStatus, filterTypeActivity]);

    const eventsByDateMap = useMemo(() => {
        const map: Record<string, CCGItem[]> = {};
        for (const item of filteredActivities) {
            const d = parseDateCreated(item.date_created);
            if (!d) continue;
            const key = formatDateLocal(d);
            if (!map[key]) map[key] = [];
            map[key].push(item);
        }
        Object.keys(map).forEach((k) =>
            map[k].sort(
                (a, b) =>
                    parseDateCreated(a.date_created)!.getTime() - parseDateCreated(b.date_created)!.getTime()
            )
        );
        return map;
    }, [filteredActivities]);

    // Calendar helpers
    function getDaysInMonth(year: number, month: number) {
        return new Date(year, month + 1, 0).getDate();
    }
    function getWeekdayOfFirstDay(year: number, month: number) {
        return new Date(year, month, 1).getDay();
    }

    const daysInMonth = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);
    const firstWeekday = useMemo(() => getWeekdayOfFirstDay(currentYear, currentMonth), [currentYear, currentMonth]);

    const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : null;
    const selectedDayEvents = selectedDateStr ? eventsByDateMap[selectedDateStr] || [] : [];
    const groupedByHour = useMemo(() => eventsByHour(selectedDayEvents), [selectedDayEvents]);

    const statusOptions = useMemo(() => Array.from(new Set(mergedActivities.map(a => a.status).filter(Boolean))).sort(), [mergedActivities]);
    const typeActivityOptions = useMemo(() => Array.from(new Set(mergedActivities.map(a => a.type_activity).filter(Boolean))).sort(), [mergedActivities]);

    const now = new Date();
    const currentHour = now.getHours();
    const isToday =
        selectedDate &&
        selectedDate.getDate() === now.getDate() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getFullYear() === now.getFullYear();

    const currentHourRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isToday && currentHourRef.current && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = currentHourRef.current.offsetTop - 10;
        }
    }, [selectedDate, isToday, currentHour]);

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
            {/* Left: Calendar */}
            <Card className="w-full md:w-2/5">
                <CardHeader className="flex items-center justify-between mb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (currentMonth === 0) {
                                setCurrentYear((y) => y - 1);
                                setCurrentMonth(11);
                            } else setCurrentMonth((m) => m - 1);
                            setSelectedDate(null);
                        }}
                    >
                        Prev
                    </Button>
                    <CardTitle className="text-sm font-semibold">
                        {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long", year: "numeric" })}
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (currentMonth === 11) {
                                setCurrentYear((y) => y + 1);
                                setCurrentMonth(0);
                            } else setCurrentMonth((m) => m + 1);
                            setSelectedDate(null);
                        }}
                    >
                        Next
                    </Button>
                </CardHeader>

                {/* Weekday headings */}
                <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2 select-none px-4">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
                        <div key={wd} className="text-sm">{wd}</div>
                    ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1 px-6" style={{ "--cell-size": "4rem" } as React.CSSProperties}>
                    {(() => {
                        const arr: (number | null)[] = [];
                        for (let i = 0; i < firstWeekday; i++) arr.push(null);
                        for (let d = 1; d <= daysInMonth; d++) arr.push(d);
                        return arr.map((day, idx) =>
                            day ? (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        const date = new Date(currentYear, currentMonth, day);
                                        setSelectedDate(date);
                                    }}
                                    className={`relative flex items-center justify-center rounded-md text-lg font-semibold cursor-pointer
                    ${selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-primary/10"
                                        }`}
                                    style={{
                                        height: "var(--cell-size)",
                                        minWidth: "var(--cell-size)",
                                        aspectRatio: "1 / 1",
                                    }}
                                >
                                    {day}
                                    {/* dot if events exist */}
                                    {eventsByDateMap[
                                        `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                                    ] && (
                                            <Badge variant="secondary" className="absolute bottom-2 right-2 rounded-full h-3 w-3 p-0" />
                                        )}
                                </button>
                            ) : (
                                <div key={idx} className="h-[4rem]" />
                            )
                        );
                    })()}
                </div>
            </Card>

            {/* Right: Hourly schedule for selected date */}
            <Card className="w-full md:w-2/3 max-h-[700px] border-none shadow-none">
                <CardContent
                    className="p-2 overflow-auto custom-scrollbar"
                    ref={scrollContainerRef}
                >
                    {/* Search + Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search activities..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-56"
                            />
                        </div>

                        <div className="flex flex-col items-end text-xs text-muted-foreground">
                            <div>Events for {selectedDate ? selectedDate.toLocaleDateString() : "No date selected"}</div>
                            <div>Total: {selectedDayEvents.length}</div>
                        </div>
                    </div>

                    {selectedDate ? (
                        (() => {
                            const hours = Array.from({ length: 24 }, (_, i) => i);
                            return (
                                <div>
                                    {hours.map((hour) => {
                                        const isCurrentHour = isToday && hour === currentHour;
                                        return (
                                            <div
                                                key={hour}
                                                ref={isCurrentHour ? currentHourRef : null}
                                                className={`flex border-b border-gray-100 min-h-[1rem] items-start gap-2 px-2 py-1
                    ${isCurrentHour ? "bg-yellow-100" : ""}
                  `}
                                            >
                                                <div className="w-12 text-xs text-gray-500 select-none">
                                                    {formatHourLabel(hour)}
                                                </div>
                                                <div className="flex-1 space-y-1 p-1">
                                                    {groupedByHour[hour].length === 0 ? (
                                                        <div className="text-xs text-muted-foreground italic">—</div>
                                                    ) : (
                                                        groupedByHour[hour].map((ev) => {
                                                            const dt = parseDateCreated(ev.date_created)!;
                                                            return (
                                                                <div key={ev.id} className="rounded-md p-5 bg-muted hover:bg-muted/80 cursor-pointer">
                                                                    <p className="font-semibold text-xs">
                                                                        {formatTimeFromDate(dt)} - {ev.type_activity ?? ev.activity_reference_number}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {ev.company_name} • <span className="capitalize">{ev.remarks ?? "—"}</span>
                                                                    </p>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()
                    ) : (
                        <div className="text-xs text-muted-foreground p-4">Select a date to see events</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
