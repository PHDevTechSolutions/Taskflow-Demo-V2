"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  Suspense,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { sileo } from "sileo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { NewTask } from "@/components/roles/tsa/activity/planner/new-task/new";
import { Progress } from "@/components/roles/tsa/activity/planner/progress/progress";
import { Scheduled } from "@/components/roles/tsa/activity/planner/scheduled/scheduled";
import { Completed } from "@/components/roles/tsa/activity/planner/completed/completed";
import { Done } from "@/components/roles/tsa/activity/planner/done/done";
import { Overdue } from "@/components/roles/tsa/activity/planner/overdue/overdue";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  PlusCircle,
  Loader2,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Bell,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  industry: string;
  status?: string;
  company_group?: string;
}

interface SupervisorDetails {
  firstname: string;
  lastname: string;
  email: string;
  profilePicture: string;
  signatureImage: string;
  contact: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  target_quota: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  signature: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
}

interface QuotationNotification {
  id: number;
  company_name: string;
  quotation_number?: string;
  quotation_amount?: number;
  tsm_approved_status: string;
  tsm_approval_date?: string;
  manager_approval_date?: string;
  tsm_remarks?: string;
  manager_remarks?: string;
  date_updated?: string;
  date_created: string;
}

// ─── Notification Dropdown Component ────────────────────────────────────────

function NotificationDropdown({ referenceid }: { referenceid: string }) {
  const [notifications, setNotifications] = useState<QuotationNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  const READ_KEY = `notif_read_${referenceid}`;

  // Load read IDs from localStorage on mount
  useEffect(() => {
    if (!referenceid) return;
    try {
      const saved = localStorage.getItem(READ_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch {
      localStorage.removeItem(READ_KEY);
    }
  }, [referenceid]);

  const fetchNotifications = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    try {
      const url = new URL(
        "/api/activity/tsa/quotation/fetch",
        window.location.origin,
      );
      url.searchParams.append("referenceid", referenceid);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      const filtered = (data.activities || []).filter(
        (a: QuotationNotification) =>
          a.tsm_approved_status === "Approved" ||
          a.tsm_approved_status === "Decline",
      );

      // Sort: most recently actioned first
      filtered.sort((a: QuotationNotification, b: QuotationNotification) => {
        const dateA = new Date(
          a.manager_approval_date ??
            a.tsm_approval_date ??
            a.date_updated ??
            a.date_created,
        ).getTime();
        const dateB = new Date(
          b.manager_approval_date ??
            b.tsm_approval_date ??
            b.date_updated ??
            b.date_created,
        ).getTime();
        return dateB - dateA;
      });

      setNotifications(filtered);
    } catch {
      // non-critical — fail silently
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark all as read when dropdown opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length > 0) {
      const allIds = new Set(notifications.map((n) => n.id));
      setReadIds(allIds);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(Array.from(allIds)));
      } catch {}
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return null;
    return `₱${parseFloat(String(amount)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors focus:outline-none">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[360px] max-h-[480px] overflow-y-auto rounded-none p-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b flex items-center justify-between">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Quotation Notifications
          </DropdownMenuLabel>
          {notifications.length > 0 && (
            <Badge variant="secondary" className="text-xs rounded-sm">
              {notifications.length} total
            </Badge>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground text-xs gap-1">
            <Bell className="w-6 h-6 opacity-30" />
            <span>No approved or declined quotations</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => {
              const isApproved = notif.tsm_approved_status === "Approved";
              const approvedByManager = !!notif.manager_approval_date;
              const isUnread = !readIds.has(notif.id);

              return (
                <div
                  key={notif.id}
                  className={`px-4 py-3 text-xs flex flex-col gap-1.5 ${isUnread ? "bg-muted/40" : "bg-background"}`}
                >
                  {/* Company name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm leading-tight flex-1">
                      {notif.company_name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-semibold
                                                ${
                                                  isApproved
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {notif.tsm_approved_status}
                    </span>
                  </div>

                  {/* Quotation number + amount */}
                  <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                    {notif.quotation_number && (
                      <span className="uppercase font-mono">
                        {notif.quotation_number}
                      </span>
                    )}
                    {formatAmount(notif.quotation_amount) && (
                      <span className="font-semibold text-foreground">
                        {formatAmount(notif.quotation_amount)}
                      </span>
                    )}
                  </div>

                  {/* TSM approval date */}
                  {notif.tsm_approval_date && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle className="w-3 h-3 shrink-0 text-green-600" />
                      <span>
                        <span className="font-medium text-foreground">
                          TSM {isApproved ? "Approved" : "Declined"}:
                        </span>{" "}
                        {formatDate(notif.tsm_approval_date)}
                      </span>
                    </div>
                  )}

                  {/* Manager approval date — labeled clearly */}
                  {approvedByManager && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle className="w-3 h-3 shrink-0 text-blue-600" />
                      <span>
                        <span className="font-medium text-foreground">
                          {isApproved ? "Approved" : "Declined"} by Manager:
                        </span>{" "}
                        {formatDate(notif.manager_approval_date)}
                      </span>
                    </div>
                  )}

                  {/* TSM remarks */}
                  {notif.tsm_remarks && (
                    <p className="text-muted-foreground italic">
                      TSM: &ldquo;{notif.tsm_remarks}&rdquo;
                    </p>
                  )}

                  {/* Manager remarks */}
                  {notif.manager_remarks && (
                    <p className="text-muted-foreground italic">
                      Manager: &ldquo;{notif.manager_remarks}&rdquo;
                    </p>
                  )}

                  {/* Unread indicator dot */}
                  {isUnread && (
                    <div className="flex justify-end mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
    target_quota: "",
    firstname: "",
    lastname: "",
    email: "",
    contact: "",
    tsmname: "",
    managername: "",
    signature: "",
    managerDetails: null,
    tsmDetails: null,
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>(undefined);

  const [collapseState, setCollapseState] = useState({
    inProgress: true,
    scheduled: true,
    completed: true,
    done: true,
    overdue: true,
  });

  const [progressCount, setProgressCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  const [hierarchy, setHierarchy] = useState({ manager: null, tsm: null });

  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(
          `/api/user?id=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          target_quota: data.TargetQuota || "",
          firstname: data.Firstname || "",
          lastname: data.Lastname || "",
          email: data.Email || "",
          contact: data.ContactNumber || "",
          tsmname: data.TSMName || "",
          managername: data.ManagerName || "",
          signature: data.signatureImage || "",
          managerDetails: data.managerDetails || null,
          tsmDetails: data.tsmDetails || null,
        });

        setHierarchy({
          manager: data.managerDetails,
          tsm: data.tsmDetails,
        });

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } catch (err) {
        sileo.warning({
          title: "Failed",
          description: "Error fetching user data:",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        sileo.error({
          title: "Failed",
          description:
            "Failed to connect to server. Please try again later or refresh your network connection",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  async function handleSaveAccount(data: Account & UserDetails) {
    const payload = {
      ...data,
      contactperson: Array.isArray(data.contact_person)
        ? data.contact_person
        : typeof data.contact_person === "string"
          ? data.contact_person.split(",").map((v) => v.trim())
          : [],
      contactnumber: Array.isArray(data.contact_number)
        ? data.contact_number
        : typeof data.contact_number === "string"
          ? data.contact_number.split(",").map((v) => v.trim())
          : [],
      emailaddress: Array.isArray(data.email_address)
        ? data.email_address
        : typeof data.email_address === "string"
          ? data.email_address.split(",").map((v) => v.trim())
          : [],
    };

    try {
      const isEdit = Boolean(payload.id);
      const url = isEdit ? "/api/com-edit-account" : "/api/com-save-account";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save account");

      sileo.success({
        title: "Success",
        description: `Account ${isEdit ? "updated" : "created"} successfully!`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      await refreshAccounts();
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to save account.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }

  async function refreshAccounts() {
    try {
      const response = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`,
      );
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setPosts(data.data || []);
      sileo.success({
        title: "Success",
        description: "Accounts loaded successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (error) {
      sileo.error({
        title: "Failed",
        description:
          "Failed to connect to server. Please try again later or refresh your network connection",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }

  const COLLAPSE_KEY = "activity_planner_collapsible_state";

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved) {
      try {
        setCollapseState(JSON.parse(saved));
      } catch {
        localStorage.removeItem(COLLAPSE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapseState));
  }, [collapseState]);

  const toggleCollapse = (key: keyof typeof collapseState) => {
    setCollapseState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1">
                      Activity Planners
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* ─── Notification Bell ─── */}
            <div className="flex items-center gap-2 px-3">
              {userDetails.referenceid && (
                <NotificationDropdown referenceid={userDetails.referenceid} />
              )}
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <div className="w-full columns-1 sm:columns-2 lg:columns-2 gap-4 [&>*]:break-inside-avoid">
              <Card className="rounded-none h-auto transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PlusCircle className="w-5 h-5" />
                    <span>New Task</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your latest Endorsed Tickets and Outbound Calls
                    efficiently. Stay updated with pending tasks and streamline
                    your workflow.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <NewTask
                    referenceid={userDetails.referenceid}
                    userDetails={userDetails}
                    onSaveAccountAction={handleSaveAccount}
                    onRefreshAccountsAction={refreshAccounts}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-none h-auto transition-all duration-300">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCollapse("inProgress")}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Loader2
                        className={`w-4 h-4 ${progressCount > 0 ? "animate-spin" : ""}`}
                      />
                      <span>In Progress</span>
                      <span className="text-xs text-red-600 font-bold">
                        ({progressCount})
                      </span>
                    </div>
                    <span className="text-xs rounded-sm border p-1">
                      {collapseState.inProgress ? (
                        <ChevronRight />
                      ) : (
                        <ChevronDown />
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    View and track all ongoing tasks to ensure timely completion
                    and effective follow-up.
                  </CardDescription>
                </CardHeader>

                <CardContent
                  className={`transition-all duration-300 overflow-hidden ${
                    collapseState.inProgress
                      ? "max-h-[2000px] opacity-100"
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <Progress
                    referenceid={userDetails.referenceid}
                    firstname={userDetails.firstname}
                    lastname={userDetails.lastname}
                    email={userDetails.email}
                    contact={userDetails.contact}
                    tsmname={userDetails.tsmname}
                    managername={userDetails.managername}
                    target_quota={userDetails.target_quota}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={
                      setDateCreatedFilterRangeAction
                    }
                    onCountChange={setProgressCount}
                    managerDetails={userDetails.managerDetails ?? null}
                    tsmDetails={userDetails.tsmDetails ?? null}
                    signature={userDetails.signature}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-none h-auto transition-all duration-300">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCollapse("scheduled")}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Scheduled</span>
                      <span className="text-xs text-red-600 font-bold">
                        ({scheduledCount})
                      </span>
                    </div>
                    <span className="text-xs rounded-sm border p-1">
                      {collapseState.scheduled ? (
                        <ChevronRight />
                      ) : (
                        <ChevronDown />
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    View all upcoming scheduled tasks and track their progress
                    for timely completion.
                  </CardDescription>
                </CardHeader>

                <CardContent
                  className={`transition-all duration-300 overflow-hidden ${
                    collapseState.scheduled
                      ? "max-h-[2000px] opacity-100"
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <Scheduled
                    referenceid={userDetails.referenceid}
                    firstname={userDetails.firstname}
                    lastname={userDetails.lastname}
                    email={userDetails.email}
                    contact={userDetails.contact}
                    tsmname={userDetails.tsmname}
                    tsm={userDetails.tsm}
                    managername={userDetails.managername}
                    target_quota={userDetails.target_quota}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={
                      setDateCreatedFilterRangeAction
                    }
                    onCountChange={setScheduledCount}
                    managerDetails={userDetails.managerDetails ?? null}
                    tsmDetails={userDetails.tsmDetails ?? null}
                    signature={userDetails.signature}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-none h-auto transition-all duration-300">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCollapse("completed")}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Completed</span>
                      <span className="text-xs text-red-600 font-bold">
                        ({completedCount})
                      </span>
                    </div>
                    <span className="text-xs rounded-sm border p-1">
                      {collapseState.completed ? (
                        <ChevronRight />
                      ) : (
                        <ChevronDown />
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Review all delivered transactions and successfully completed
                    tasks for your records.
                  </CardDescription>
                </CardHeader>

                <CardContent
                  className={`transition-all duration-300 overflow-hidden ${
                    collapseState.completed
                      ? "max-h-[2000px] opacity-100"
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <Completed
                    referenceid={userDetails.referenceid}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={
                      setDateCreatedFilterRangeAction
                    }
                    onCountChange={setCompletedCount}
                    managerDetails={userDetails.managerDetails ?? null}
                    tsmDetails={userDetails.tsmDetails ?? null}
                    signature={userDetails.signature}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-none h-auto transition-all duration-300">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCollapse("done")}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Done</span>
                      <span className="text-xs text-red-600 font-bold">
                        ({doneCount})
                      </span>
                    </div>
                    <span className="text-xs rounded-sm border p-1">
                      {collapseState.done ? <ChevronRight /> : <ChevronDown />}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    This task has been completed.
                  </CardDescription>
                </CardHeader>

                <CardContent
                  className={`transition-all duration-300 overflow-hidden ${
                    collapseState.done
                      ? "max-h-[2000px] opacity-100"
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <Done
                    referenceid={userDetails.referenceid}
                    firstname={userDetails.firstname}
                    lastname={userDetails.lastname}
                    email={userDetails.email}
                    contact={userDetails.contact}
                    tsmname={userDetails.tsmname}
                    managername={userDetails.managername}
                    target_quota={userDetails.target_quota}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={
                      setDateCreatedFilterRangeAction
                    }
                    onCountChange={setDoneCount}
                    managerDetails={userDetails.managerDetails ?? null}
                    tsmDetails={userDetails.tsmDetails ?? null}
                    signature={userDetails.signature}
                  />
                </CardContent>
              </Card>

              <Card className="border-3 border-red-400 rounded-none shadow-lg h-auto transition-all duration-300">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCollapse("overdue")}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Overdue</span>
                      <span className="text-xs text-red-600 font-bold">
                        ({overdueCount})
                      </span>
                    </div>
                    <span className="text-xs rounded-sm border p-1">
                      {collapseState.overdue ? (
                        <ChevronRight />
                      ) : (
                        <ChevronDown />
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    This activity has passed its scheduled date and requires
                    attention.
                  </CardDescription>
                </CardHeader>

                <CardContent
                  className={`transition-all duration-300 overflow-hidden ${
                    collapseState.overdue
                      ? "max-h-[2000px] opacity-100"
                      : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  <Overdue
                    referenceid={userDetails.referenceid}
                    firstname={userDetails.firstname}
                    lastname={userDetails.lastname}
                    email={userDetails.email}
                    contact={userDetails.contact}
                    tsmname={userDetails.tsmname}
                    managername={userDetails.managername}
                    target_quota={userDetails.target_quota}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={
                      setDateCreatedFilterRangeAction
                    }
                    managerDetails={userDetails.managerDetails ?? null}
                    tsmDetails={userDetails.tsmDetails ?? null}
                    signature={userDetails.signature}
                    onCountChange={setOverdueCount}
                  />
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>

        <SidebarRight
          userId={userId ?? undefined}
          dateCreatedFilterRange={dateCreatedFilterRange}
          setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
        />
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
