"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { AlertCircleIcon } from "lucide-react";

// FIX: Was incorrectly importing as "Scheduled" — the export is "PendingQuotation"
import { PendingQuotation } from "@/components/roles/manager/activity/quotation/pending/pending-quotation";
import { EndorsedQuotation } from "@/components/roles/manager/activity/quotation/endorsed/endorsed-quotation";
// import { AccountsCards } from "@/components/roles/tsm/accounts/transfer/transfer";
// import { RequestTable } from "@/components/roles/tsa/accounts/approval/table/table";

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
    profilePicture: string;
    signature: string;
}

interface Account {
    id: string;
    referenceid: string;
    tsm: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    type_client: string;
    date_created: string;
    industry: string;
    status?: string;
    transfer_to: string;
    date_transferred: string;
    date_removed: string;
}

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
        profilePicture: "",
        signature: "",
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [agentFilter, setAgentFilter] = useState<string>("all");

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
                    target_quota: data.TargetQuota || "",
                    firstname: data.Firstname || "",
                    lastname: data.Lastname || "",
                    email: data.Email || "",
                    contact: data.ContactNumber || "",
                    tsmname: data.TSMName || "",
                    managername: data.ManagerName || "",
                    profilePicture: data.profilePicture || "",
                    signature: data.signatureImage || "",
                });

                sileo.success({
                    title: "Success",
                    description: "User data loaded successfully!",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } catch (err) {
                sileo.warning({
                    title: "Failed",
                    description: "Error fetching user data:",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
                sileo.error({
                    title: "Failed",
                    description: "Failed to connect to server. Please try again later or refresh your network connection",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);


    const filteredData = useMemo(() => {
        let filteredPosts = posts;

        if (
            dateCreatedFilterRange &&
            dateCreatedFilterRange.from &&
            dateCreatedFilterRange.to
        ) {
            const fromTime = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
            const toTime = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);

            filteredPosts = filteredPosts.filter((item) => {
                if (!item.date_removed) return false;

                const removedTime = new Date(item.date_removed).getTime();

                return removedTime >= fromTime && removedTime <= toTime;
            });
        }

        if (agentFilter !== "all") {
            filteredPosts = filteredPosts.filter((item) => item.tsm === agentFilter);
        }

        return filteredPosts;
    }, [posts, dateCreatedFilterRange, agentFilter]);

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">
                    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
                        <div className="flex flex-1 items-center gap-2 px-3">
                            <SidebarTrigger />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="line-clamp-1">Activity Planner</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        {/* 4-card grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending TSM Approval of Quotations</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        These are the quotations that are awaiting for TSM approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {/* FIX: Was <Scheduled ... /> — renamed to match the actual export */}
                                    <PendingQuotation
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 2 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Head Approval of Quotations</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Quotations that are awaiting manager approval
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <EndorsedQuotation
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 3 */}
                            {/* <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Transfer</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Accounts that are currently marked as subject for transfer and waiting for approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <AccountsCards
                                        posts={filteredData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshAccounts}
                                    />
                                </CardContent>
                            </Card> */}

                            {/* Card 4 */}
                            {/* <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Request Account Deletion</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Below is the list of accounts pending deletion requests. You can review and approve the selected accounts.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <RequestTable
                                        posts={filteredData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshAccounts}
                                    />
                                </CardContent>
                            </Card> */}
                        </div>

                        {/* Existing content or other cards can go below */}
                    </main>
                </SidebarInset>

                <SidebarRight
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