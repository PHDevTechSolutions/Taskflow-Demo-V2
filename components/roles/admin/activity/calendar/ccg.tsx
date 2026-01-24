"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskListDialog } from "../../../tsa/activity/tasklist/dialog/filter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Company {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
}

interface CCGItem {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name?: string;
    product_category?: string;
    project_type?: string;
    source?: string;
    target_quota?: number;
    type_activity?: string;
    callback?: string;
    call_status?: string;
    call_type?: string;
    quotation_number?: string;
    quotation_amount?: number;
    so_number?: string;
    so_amount?: number;
    actual_sales?: number;
    delivery_date?: string;
    dr_number?: string;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    date_followup?: string;
    date_site_vist?: string;
    date_created: string; // "2025-11-26 01:37:02.636+00"
    date_updated?: string;
    account_reference_number?: string;
    payment_terms?: string;
    scheduled_status?: string;
    company_name?: string; // merged
    contact_number?: string; // merged
}
// Helpers: date formatting & grouping
function formatDateLocal(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // yyyy-mm-dd
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
    // sort each hour by exact time
    for (let h = 0; h < 24; h++) {
        map[h].sort((a, b) => {
            const da = parseDateCreated(a.date_created)!.getTime();
            const db = parseDateCreated(b.date_created)!.getTime();
            return da - db;
        });
    }
    return map;
}

export const CCG: React.FC<{
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}> = ({ referenceid, target_quota, dateCreatedFilterRange, setDateCreatedFilterRangeAction }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<CCGItem[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    // Filters state
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

    // Calendar state
    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-based
    const [selectedDate, setSelectedDate] = useState<Date | null>(today);

    // Fetch companies (same as before)
    useEffect(() => {
        setLoadingCompanies(true);
        setErrorCompanies(null);

        fetch(`/api/com-fetch-account-admin`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch companies");
                return res.json();
            })
            .then((data) => setCompanies(data.data || []))
            .catch((err) => setErrorCompanies(err.message))
            .finally(() => setLoadingCompanies(false));
    }, []);


    const fetchActivities = useCallback(() => {
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/act-fetch-admin-history`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, []);


    useEffect(() => {
        // Initial fetch
        fetchActivities();

        const chan = supabase
            .channel("public:history:all")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                },
                (payload) => {
                    const newRecord = payload.new as CCGItem;
                    const oldRecord = payload.old as CCGItem;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;

                            case "UPDATE":
                                return curr.map((a) =>
                                    a.id === newRecord.id ? newRecord : a
                                );

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
    }, [fetchActivities]);


    // merge company info like before
    const mergedActivities = useMemo(() => {
        return activities
            .map((history) => {
                const company = companies.find((c) => c.account_reference_number === history.account_reference_number);
                return {
                    ...history,
                    company_name: company?.company_name ?? "Unknown Company",
                    contact_number: company?.contact_number ?? "-",
                    type_client: company?.type_client ?? "",
                };
            })
            .sort(
                (a, b) =>
                    new Date(b.date_updated ?? b.date_created).getTime() - new Date(a.date_updated ?? a.date_created).getTime()
            );
    }, [activities, companies]);

    // meaningful-data filter (copied)
    const hasMeaningfulData = (item: CCGItem) => {
        const columnsToCheck = [
            "activity_reference_number",
            "referenceid",
            "tsm",
            "manager",
            "type_client",
            "project_name",
            "product_category",
            "project_type",
            "source",
            "target_quota",
            "type_activity",
            "callback",
            "call_status",
            "call_type",
            "quotation_number",
            "quotation_amount",
            "so_number",
            "so_amount",
            "actual_sales",
            "delivery_date",
            "dr_number",
            "ticket_reference_number",
            "remarks",
            "status",
            "start_date",
            "end_date",
            "date_followup",
            "date_site_vist",
            "date_created",
            "date_updated",
            "account_reference_number",
            "payment_terms",
            "scheduled_status",
        ];
        return columnsToCheck.some((col) => {
            const val = (item as any)[col];
            if (val === null || val === undefined) return false;
            if (typeof val === "string") return val.trim() !== "";
            if (typeof val === "number") return !isNaN(val);
            if (val instanceof Date) return !isNaN(val.getTime());
            if (typeof val === "object" && val !== null && val.toString) return val.toString().trim() !== "";
            return Boolean(val);
        });
    };

    // Apply filters + search
    const filteredActivities = useMemo(() => {
        const s = searchTerm.toLowerCase();

        return mergedActivities
            .filter((item) => {
                if (!s) return true;
                return Object.values(item).some((val) => {
                    if (val === null || val === undefined) return false;
                    return String(val).toLowerCase().includes(s);
                });
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                if (filterTypeActivity !== "all" && item.type_activity !== filterTypeActivity) return false;
                return true;
            })
            .filter(hasMeaningfulData);
    }, [mergedActivities, searchTerm, filterStatus, filterTypeActivity]);

    // Build map of events grouped by date (for calendar dots) — uses filteredActivities so calendar depends on filters & search
    const eventsByDateMap = useMemo(() => {
        const map: Record<string, CCGItem[]> = {};
        for (const item of filteredActivities) {
            const d = parseDateCreated(item.date_created);
            if (!d) continue;
            const key = formatDateLocal(d);
            if (!map[key]) map[key] = [];
            map[key].push(item);
        }
        // sort events in each date by time asc
        Object.keys(map).forEach((k) => {
            map[k].sort((a, b) => (parseDateCreated(a.date_created)!.getTime() - parseDateCreated(b.date_created)!.getTime()));
        });
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

    // When calendar day clicked: pick events for that day and group by hour
    const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : null;
    const selectedDayEvents = selectedDateStr ? eventsByDateMap[selectedDateStr] || [] : [];

    const groupedByHour = useMemo(() => eventsByHour(
        // ensure items for selected day only
        selectedDayEvents
    ), [selectedDayEvents]);

    // Unique options for filters
    const statusOptions = useMemo(() => {
        const s = new Set<string>();
        mergedActivities.forEach((a) => { if (a.status) s.add(a.status); });
        return Array.from(s).sort();
    }, [mergedActivities]);

    const typeActivityOptions = useMemo(() => {
        const s = new Set<string>();
        mergedActivities.forEach((a) => { if (a.type_activity) s.add(a.type_activity); });
        return Array.from(s).sort();
    }, [mergedActivities]);

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
            const container = scrollContainerRef.current;
            const elem = currentHourRef.current;
            container.scrollTop = elem.offsetTop - 10; // scroll with 10px offset
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
                            <TaskListDialog
                                filterStatus={filterStatus}
                                filterTypeActivity={filterTypeActivity}
                                setFilterStatus={setFilterStatus}
                                setFilterTypeActivity={setFilterTypeActivity}
                                statusOptions={statusOptions}
                                typeActivityOptions={typeActivityOptions}
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
