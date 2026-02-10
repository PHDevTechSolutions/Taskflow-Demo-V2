"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { SidebarInset, SidebarProvider, SidebarTrigger, } from "@/components/ui/sidebar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner"

import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

// Cards
import { AccountCard } from "@/components/roles/tsa/dashboard/card/accounts";
import { OutboundTouchbaseCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase";
import { TimemotionCard } from "@/components/roles/tsa/dashboard/card/time-and-motion";
import { ActivityCard } from "@/components/roles/tsa/dashboard/card/other-activities";
// Charts
import { SourceCard } from "@/components/roles/tsa/dashboard/chart/source";
import { CSRMetricsCard } from "@/components/roles/tsa/dashboard/chart/csr";
// Lists
import { OutboundCard } from "@/components/roles/tsa/dashboard/list/outbound";
import { QuotationCard } from "@/components/roles/tsa/dashboard/list/quotation";
import { SOCard } from "@/components/roles/tsa/dashboard/list/so";
// Maps
import { SiteVisitCard } from "@/components/roles/tsa/dashboard/maps/site-visit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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
  type_client: string;
  activity_reference_number: string;
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
    const referenceid = userDetails.referenceid; // <- add this line

    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    setErrorActivities(null);

    // Prepare date params (convert to YYYY-MM-DD)
    const from =
      dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
        : null;
    const to =
      dateCreatedFilterRange?.to
        ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
        : null;

    // Build URL with query params
    const url = new URL("/api/activity/tsa/dashboard/fetch", window.location.origin);
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
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [userDetails.referenceid, dateCreatedFilterRange]);

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
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset>
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-[50]">
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
              <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-10 pointer-events-none"
              />

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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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

              <SiteVisitCard
                referenceid={userDetails.referenceid}
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
