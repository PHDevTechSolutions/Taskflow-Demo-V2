"use client";

import * as React from "react";
import { DatePicker } from "@/components/rightbar/date-picker";
import { NavUser } from "@/components/nav/user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarSeparator, } from "@/components/ui/sidebar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useFormat } from "@/contexts/FormatContext";
import { type DateRange } from "react-day-picker";

import { Meeting } from "@/components/roles/tsa/activity/meeting/meeting";
import { BreachesDialog } from "@/components/popup/breaches";
import { TimeLogComponent } from "@/components/roles/tsa/activity/timelog/logs";

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  userId?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
};

type TimeLog = {
  Type: string;
  Status: string;
  date_created: string;
  Location: string;
  PhotoURL: string;
};

export function SidebarRight({
  userId,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  ...props
}: SidebarRightProps) {
  const { timeFormat, dateFormat } = useFormat();
  const [time, setTime] = React.useState("");
  const [date, setDate] = React.useState("");

  const [timeLogs, setTimeLogs] = React.useState<TimeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [errorLogs, setErrorLogs] = React.useState<string | null>(null);

  const [userDetails, setUserDetails] = React.useState({
    ReferenceID: "",
    TSM: "",
    Manager: "",
    Firstname: "",
    Lastname: "",
    Position: "",
    Email: "",
    profilePicture: "",
    Role: "",
  });

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: timeFormat === "12h",
      });

      let formattedDate = "";
      if (dateFormat === "short") {
        formattedDate = now.toLocaleDateString("en-US");
      } else if (dateFormat === "iso") {
        formattedDate = now.toISOString().split("T")[0];
      } else {
        formattedDate = now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }

      setTime(formattedTime);
      setDate(formattedDate);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timeFormat, dateFormat]);

  React.useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        setUserDetails({
          ReferenceID: data.ReferenceID || "",
          TSM: data.TSM || "",
          Manager: data.Manager || "",
          Firstname: data.Firstname || "",
          Lastname: data.Lastname || "",
          Position: data.Position || "",
          Email: data.Email || "",
          profilePicture: data.profilePicture || "",
          Role: data.Role || "",
        });
      })
      .catch((err) => console.error(err));
  }, [userId]);

  React.useEffect(() => {
    if (!userDetails.Email) {
      setTimeLogs([]);
      return;
    }

    setLoadingLogs(true);
    setErrorLogs(null);

    fetch(`/api/fetch-timelogs?Email=${encodeURIComponent(userDetails.Email)}`)
      .then((res) => res.json())
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
      .finally(() => {
        setLoadingLogs(false);
      });
  }, [userDetails.Email]);

  function handleDateRangeSelect(range: DateRange | undefined) {
    setDateCreatedFilterRangeAction(range);
  }

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarHeader className="border-sidebar-border h-16 border-b">
        {userId ? (
          <NavUser
            user={{
              name: `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "Unknown User",
              position: userDetails.Position,
              email: userDetails.Email,
              ReferenceID: userDetails.ReferenceID,
              TSM: userDetails.TSM,
              Manager: userDetails.Manager,
              avatar: userDetails.profilePicture || "/avatars/shadcn.jpg",
            }}
            userId={userId}
          />
        ) : (
          <NavUser
            user={{
              name: `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "Unknown User",
              position: userDetails.Position,
              email: userDetails.Email,
              ReferenceID: userDetails.ReferenceID,
              TSM: userDetails.TSM,
              Manager: userDetails.Manager,
              avatar: userDetails.profilePicture || "/avatars/shadcn.jpg",
            }}
            userId={userId ?? ""}
          />
        )}
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar">
        <DatePicker
          selectedDateRange={dateCreatedFilterRange}
          onDateSelectAction={handleDateRangeSelect}
        />

        <SidebarSeparator className="mx-0" />

        {userDetails.Role !== "Territory Sales Manager" && (
          <Card className="rounded-xs shadow-none border-0">
            <CardContent className="space-y-2">
              <Meeting
                referenceid={userDetails.ReferenceID}
                tsm={userDetails.TSM}
                manager={userDetails.Manager}
              />
              <TimeLogComponent
                timeLogs={timeLogs}
                loadingLogs={loadingLogs}
                errorLogs={errorLogs}
              />
            </CardContent>
          </Card>
        )}
      </SidebarContent>
      <BreachesDialog />
      <SidebarFooter>
        <div className="border-t border-sidebar-border mt-2 pt-2 text-center text-xs">
          <div>{time}</div>
          <div className="text-[11px]">{date}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
