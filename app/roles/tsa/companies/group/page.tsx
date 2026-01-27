"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

import { AccountsTable } from "@/components/roles/tsa/accounts/group/table/group";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<DateRange | undefined>(undefined);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details when userId changes
  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
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
        toast.error("Failed to connect to server. Please try again later or refresh your network connection");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch accounts when userDetails.referenceid changes
  useEffect(() => {
    if (!userDetails.referenceid) {
      setPosts([]);
      return;
    }

    // Sa loob ng fetchAccounts useEffect:
    const fetchAccounts = async () => {
      setError(null);
      setLoadingAccounts(true);
      try {
        const response = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
        );
        const data = await response.json();
        setPosts(data.data || []);
        toast.success("Accounts loaded successfully!");
      } catch (err) {
        console.error("Error fetching accounts:", err);
        toast.error("Failed to connect to server. Please try again later or refresh your network connection");
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [userDetails.referenceid]);

  const loading = loadingUser || loadingAccounts;

  // Filter accounts by created date range
  const filteredData = useMemo(() => {
    if (
      !dateCreatedFilterRange ||
      !dateCreatedFilterRange.from ||
      !dateCreatedFilterRange.to
    ) {
      return posts;
    }

    const fromTime = dateCreatedFilterRange.from.setHours(0, 0, 0, 0);
    const toTime = dateCreatedFilterRange.to.setHours(23, 59, 59, 999);

    return posts.filter((item) => {
      const createdDate = new Date(item.date_created).getTime();
      return createdDate >= fromTime && createdDate <= toTime;
    });
  }, [posts, dateCreatedFilterRange]);

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
                      Customer Database - Group
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingUser ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>

            ) : loadingAccounts ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <AccountsTable
                  posts={filteredData}
                  dateCreatedFilterRange={dateCreatedFilterRange}
                  setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
              </>
            )}
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
