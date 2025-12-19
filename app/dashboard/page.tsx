"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

import { AccountCard } from "@/components/dashboard-accounts-card";
import { OutboundTouchbaseCard } from "@/components/dashboard-outbound-touchbase-card";

// Assuming you will create these two cards as components
import { TimemotionCard } from "@/components/dashboard-timemotion";
import { ActivityCard } from "@/components/dashboard-activity-card";

import { SourceCard } from "@/components/dashboard-source-card";
import { CSRMetricsCard } from "@/components/dashboard-csr-metrics-card";
import { OutboundCard } from "@/components/dashboard-outbound-card";
import { QuotationCard } from "@/components/dashboard-quotation-card";
import { SOCard } from "@/components/dashboard-so-card";

interface UserDetails {
  referenceid: string;
  tsm?: string;
  manager?: string;
}

interface Activity {
  referenceid: string;
  source?: string;
  call_status?: string;
  date_created?: string;
  start_date?: string;
  end_date?: string;
  type_activity: string;
  status: string;
  actual_sales: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
}

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
    DateRange | undefined
  >(undefined);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  useEffect(() => {
    if (!dateCreatedFilterRange) {
      const today = new Date();
      const from = new Date(today);
      from.setHours(0, 0, 0, 0);
      const to = new Date(today);
      to.setHours(23, 59, 59, 999);
      setDateCreatedFilterRangeAction({ from, to });
    }
  }, [dateCreatedFilterRange]);

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorUser, setErrorUser] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) {
      setErrorUser("User ID is missing.");
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setErrorUser(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
        });

        toast.success("User data loaded successfully!");
      } catch (err) {
        console.error("Error fetching user data:", err);
        setErrorUser("Failed to fetch user data");
        toast.error(
          "Failed to connect to server. Please try again later or refresh your network connection"
        );
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const fetchActivities = useCallback(() => {
    const referenceid = userDetails.referenceid;
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    fetch(`/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const isInDateRange = (dateString: string | undefined): boolean => {
    if (!dateString) return true;
    if (!dateCreatedFilterRange) return true;

    const date = new Date(dateString);
    const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
    const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;

    if (from && date < from) return false;
    if (to) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      if (date > toEnd) return false;
    }
    return true;
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => isInDateRange(activity.date_created));
  }, [activities, dateCreatedFilterRange]);

  return (
    <>
      <SidebarLeft />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {/* Cards container: 4 cards in a row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <AccountCard referenceid={userDetails.referenceid} />

            <OutboundTouchbaseCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
            />

            <TimemotionCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              referenceid={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />

            <ActivityCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
            />
          </div>

          {/* New: Two large cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Large Card 1 */}
            <SourceCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
            />

            <CSRMetricsCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
            />

            <OutboundCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              dateRange={dateCreatedFilterRange}
            />

            <QuotationCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              dateRange={dateCreatedFilterRange}
            />

            <SOCard
              activities={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              dateRange={dateCreatedFilterRange}
            />

          </div>
        </div>
      </SidebarInset>
      <SidebarRight
        userId={userId ?? undefined}
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
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
