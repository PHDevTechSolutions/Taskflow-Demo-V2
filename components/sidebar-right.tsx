"use client";

import * as React from "react";
import { DatePicker } from "@/components/rightbar/date-picker";
import { NavUser } from "@/components/nav/user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { useFormat } from "@/contexts/FormatContext";
import { type DateRange } from "react-day-picker";

import { Meeting } from "@/components/roles/tsa/activity/meeting/meeting";
import { BreachesDialog } from "@/components/popup/breaches";
import { BreachesTSMDialog } from "@/components/popup/breaches-tsm";
import { BreachesManagerDialog } from "@/components/popup/breaches-manager";
import { TimeLogComponent } from "@/components/roles/tsa/activity/timelog/logs";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  userId?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
};

type TimeLog = {
  Type: string;
  Status: string;
  date_created: string;
  Location: string;
  PhotoURL: string;
};

type UserDetails = {
  ReferenceID: string;
  TSM: string;
  Manager: string;
  Firstname: string;
  Lastname: string;
  Position: string;
  Email: string;
  profilePicture: string;
  Role: string;
};

const DEFAULT_USER: UserDetails = {
  ReferenceID: "",
  TSM: "",
  Manager: "",
  Firstname: "",
  Lastname: "",
  Position: "",
  Email: "",
  profilePicture: "",
  Role: "",
};

// ─── Clock helpers ────────────────────────────────────────────────────────────

function useFormattedClock(timeFormat: string, dateFormat: string) {
  const [time, setTime] = React.useState("");
  const [date, setDate] = React.useState("");

  React.useEffect(() => {
    const update = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: timeFormat === "12h",
        })
      );

      if (dateFormat === "short") {
        setDate(now.toLocaleDateString("en-US"));
      } else if (dateFormat === "iso") {
        setDate(now.toISOString().split("T")[0]);
      } else {
        setDate(
          now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        );
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeFormat, dateFormat]);

  return { time, date };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarRight({
  userId,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  ...props
}: SidebarRightProps) {
  const { timeFormat, dateFormat } = useFormat();
  const { time, date } = useFormattedClock(timeFormat, dateFormat);

  const [userDetails, setUserDetails] = React.useState<UserDetails>(DEFAULT_USER);
  const [timeLogs, setTimeLogs]       = React.useState<TimeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [errorLogs, setErrorLogs]     = React.useState<string | null>(null);

  // ── Fetch user ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!userId) return;

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then((data) =>
        setUserDetails({
          ReferenceID:    data.ReferenceID    || "",
          TSM:            data.TSM            || "",
          Manager:        data.Manager        || "",
          Firstname:      data.Firstname      || "",
          Lastname:       data.Lastname       || "",
          Position:       data.Position       || "",
          Email:          data.Email          || "",
          profilePicture: data.profilePicture || "",
          Role:           data.Role           || "",
        })
      )
      .catch((err) => console.error("User fetch error:", err));
  }, [userId]);

  // ── Fetch all time logs (no date filter here — filtering is done in component) ──

  React.useEffect(() => {
    if (!userDetails.Email) {
      setTimeLogs([]);
      return;
    }

    setLoadingLogs(true);
    setErrorLogs(null);

    fetch(`/api/fetch-timelogs?Email=${encodeURIComponent(userDetails.Email)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch timelogs");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setTimeLogs(data.data);
        } else {
          setErrorLogs("Failed to fetch logs");
          setTimeLogs([]);
        }
      })
      .catch(() => {
        setErrorLogs("Error fetching logs");
        setTimeLogs([]);
      })
      .finally(() => setLoadingLogs(false));
  }, [userDetails.Email]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const isTSM     = userDetails.Role === "Territory Sales Manager";
  const isTSA     = userDetails.Role === "Territory Sales Associate";
  const isManager = userDetails.Role === "Manager";

  const navUser = {
    name:        `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "Unknown User",
    position:    userDetails.Position,
    email:       userDetails.Email,
    ReferenceID: userDetails.ReferenceID,
    TSM:         userDetails.TSM,
    Manager:     userDetails.Manager,
    avatar:      userDetails.profilePicture || "/avatars/shadcn.jpg",
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      {/* ── Header ── */}
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center">
        <NavUser user={navUser} userId={userId ?? ""} />
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent className="custom-scrollbar overflow-y-auto">

        {/* Date range picker */}
        <DatePicker
          selectedDateRange={dateCreatedFilterRange}
          onDateSelectAction={setDateCreatedFilterRangeAction}
        />

        <SidebarSeparator className="mx-0" />

        {/* Meeting + Time Logs — hidden for TSM */}
        {!isTSM && (
          <Card className="rounded-none shadow-none border-0">
            <CardContent className="space-y-2 px-3 py-2">
              <Meeting
                referenceid={userDetails.ReferenceID}
                tsm={userDetails.TSM}
                manager={userDetails.Manager}
              />
              {/* Pass dateCreatedFilterRange so logs are filtered by the selected date range */}
              <TimeLogComponent
                timeLogs={timeLogs}
                loadingLogs={loadingLogs}
                errorLogs={errorLogs}
                dateCreatedFilterRange={dateCreatedFilterRange}
              />
            </CardContent>
          </Card>
        )}
      </SidebarContent>

      {/* ── Floating breach dialogs ── */}
      {isTSA     && <BreachesDialog />}
      {isTSM     && <BreachesTSMDialog />}
      {isManager && <BreachesManagerDialog />}

      {/* ── Footer clock ── */}
      <SidebarFooter>
        <div className="border-t border-sidebar-border pt-2 pb-1 text-center select-none">
          <div className="text-xs font-mono font-semibold text-gray-700 tabular-nums tracking-tight">
            {time}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
            {date}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}