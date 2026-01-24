"use client";

import * as React from "react";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  time?: string; // "hh:mm AM/PM" format, optional
  title: string;
  description: string;
}

interface SimpleCalendarProps {
  referenceid: string;
  userId: string;
  email: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getWeekdayOfFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

const hours = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour24: number) {
  const ampm = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12} ${ampm}`;
}

function eventsByHour(events: EventItem[]) {
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

export function SimpleCalendar({ referenceid, userId, email }: SimpleCalendarProps) {
  const now = React.useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = React.useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(now.getMonth());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(now);

  const [events, setEvents] = React.useState<EventItem[]>([]);

  const processSnapshot = React.useCallback(
    (
      snapshot: QuerySnapshot<DocumentData>,
      dateField: string,
      titleField: string,
      descriptionField: string
    ) => {
      const items: EventItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let dateStr = "";
        let timeStr: string | undefined = undefined;

        const dateValue = data[dateField];
        if (dateValue instanceof Timestamp) {
          const dateObj = dateValue.toDate();
          dateStr = formatDateLocal(dateObj);
          timeStr = formatTime(dateObj);
        } else if (typeof dateValue === "string" || typeof dateValue === "number") {
          const dateObj = new Date(dateValue);
          if (!isNaN(dateObj.getTime())) {
            dateStr = formatDateLocal(dateObj);
            timeStr = formatTime(dateObj);
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
    },
    []
  );

  React.useEffect(() => {
    if (!referenceid && !email) {
      setEvents([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Meetings query
    if (referenceid) {
      const meetingQuery = query(
        collection(db, "meetings"),
        where("referenceid", "==", referenceid),
        orderBy("start_date", "desc")
      );

      const unsubscribeMeetings = onSnapshot(meetingQuery, (snapshot) => {
        const meetingEvents = processSnapshot(snapshot, "start_date", "type_activity", "remarks");

        setEvents((prevEvents) => {
          // Keep previous login/logout events
          const otherEvents = prevEvents.filter(
            (ev) => ev.title.toLowerCase() === "login" || ev.title.toLowerCase() === "logout"
          );
          return [...meetingEvents, ...otherEvents].sort((a, b) => {
            if (a.date > b.date) return -1;
            if (a.date < b.date) return 1;
            if (a.time && b.time) {
              if (a.time > b.time) return -1;
              if (a.time < b.time) return 1;
            }
            return 0;
          });
        });
      });

      unsubscribes.push(unsubscribeMeetings);
    }

    // Activity logs query
    if (email) {
      const activityLogsQuery = query(
        collection(db, "activity_logs"),
        where("email", "==", email),
        orderBy("date_created", "desc")
      );

      const unsubscribeActivityLogs = onSnapshot(activityLogsQuery, (snapshot) => {
        console.log("activity_logs docs:", snapshot.docs.map((doc) => doc.data()));

        const allActivityEvents = processSnapshot(snapshot, "date_created", "status", "remarks");
        console.log("allActivityEvents:", allActivityEvents);

        // Case-insensitive filter for login/logout
        const activityEvents = allActivityEvents.filter((ev) =>
          ["login", "logout"].includes(ev.title.toLowerCase())
        );

        console.log("Filtered login/logout events:", activityEvents);

        setEvents((prevEvents) => {
          // Keep previous non-login/logout events (e.g., meetings)
          const otherEvents = prevEvents.filter(
            (ev) => ev.title.toLowerCase() !== "login" && ev.title.toLowerCase() !== "logout"
          );
          return [...otherEvents, ...activityEvents].sort((a, b) => {
            if (a.date > b.date) return -1;
            if (a.date < b.date) return 1;
            if (a.time && b.time) {
              if (a.time > b.time) return -1;
              if (a.time < b.time) return 1;
            }
            return 0;
          });
        });
      });

      unsubscribes.push(unsubscribeActivityLogs);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [referenceid, email, processSnapshot]);

  // Organize events by date string
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstWeekday = getWeekdayOfFirstDay(currentYear, currentMonth);

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) daysArray.push(null);
  for (let day = 1; day <= daysInMonth; day++) daysArray.push(day);

  const handleDayClick = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
  };

  const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : null;
  const selectedEvents = selectedDateStr ? eventsByDate[selectedDateStr] || [] : [];

  return (
    <div className="flex flex-col md:flex-row max-w-7xl mx-auto gap-6 min-h-[700px]">
      {/* Calendar left */}
      <Card className="flex-shrink-0 w-full md:w-2/5">
        <CardHeader className="flex justify-between items-center mb-4">
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
          <CardTitle className="text-lg font-semibold">
            {new Date(currentYear, currentMonth).toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
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

        {/* Weekdays */}
        <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2 select-none">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
            <div key={wd} className="text-sm">
              {wd}
            </div>
          ))}
        </div>

        {/* Days */}
        <div
          className="grid grid-cols-7 gap-1"
          style={{ "--cell-size": "4rem" } as React.CSSProperties}
        >
          {daysArray.map((day, i) =>
            day ? (
              <button
                key={i}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`relative flex items-center justify-center rounded-md text-lg font-semibold cursor-pointer
                ${
                  selectedDate?.getDate() === day &&
                  selectedDate.getMonth() === currentMonth &&
                  selectedDate.getFullYear() === currentYear
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-primary/20"
                }
              `}
                style={{
                  height: "var(--cell-size)",
                  minWidth: "var(--cell-size)",
                  aspectRatio: "1 / 1",
                }}
              >
                {day}

                {/* Dot indicator if events exist on this day */}
                {eventsByDate[
                  `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                ] && (
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 rounded-full h-3 w-3 p-0"
                  />
                )}
              </button>
            ) : (
              <div key={i} className="h-[4rem]" />
            )
          )}
        </div>
      </Card>

      {/* Right panel: hourly schedule */}
      <Card className="w-full md:w-2/3 gap-1 overflow-auto shadow-none border-0 max-h-[700px]">
        {selectedDate ? (
          (() => {
            const groupedEvents = eventsByHour(selectedEvents);

            return (
              <div className="flex flex-col">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex border-b border-gray-200 min-h-[1rem] items-start gap-2 px-2"
                  >
                    {/* Hour label */}
                    <div className="w-12 text-xs text-gray-500 select-none">{formatHour(hour)}</div>

                    {/* Events in this hour */}
                    <div className="flex-1 space-y-1 p-1">
                      {groupedEvents[hour].length === 0 && (
                        <div className="text-xs text-muted-foreground italic">—</div>
                      )}

                      {groupedEvents[hour].map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-md p-5 bg-muted hover:bg-muted/70 cursor-pointer"
                        >
                          <p className="font-semibold text-xs capitalize">
                            {ev.time} - {ev.title}
                          </p>
                          {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <p className="text-xs text-muted-foreground p-4">Select a date to see events</p>
        )}
      </Card>
    </div>
  );
}
