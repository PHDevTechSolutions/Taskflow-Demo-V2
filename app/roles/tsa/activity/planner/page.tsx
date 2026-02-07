"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

import { NewTask } from "@/components/roles/tsa/activity/planner/new-task/new";
import { Progress } from "@/components/roles/tsa/activity/planner/progress/progress";
import { Scheduled } from "@/components/roles/tsa/activity/planner/scheduled/scheduled";
import { Completed } from "@/components/roles/tsa/activity/planner/completed/completed";
import { Done } from "@/components/roles/tsa/activity/planner/done/done";

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
    target_quota: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsmname: string;
    managername: string;
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
    });

    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
        DateRange | undefined
    >(undefined);

    // NEW: State to toggle completed card visibility
    const [showCompleted, setShowCompleted] = useState(false);

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

    const loading = loadingUser || loadingAccounts;

    async function handleSaveAccount(data: Account & UserDetails) {
        const payload = {
            ...data,
            contactperson: Array.isArray(data.contact_person)
                ? data.contact_person
                : typeof data.contact_person === 'string'
                    ? data.contact_person.split(',').map((v) => v.trim())
                    : [],
            contactnumber: Array.isArray(data.contact_number)
                ? data.contact_number
                : typeof data.contact_number === 'string'
                    ? data.contact_number.split(',').map((v) => v.trim())
                    : [],
            emailaddress: Array.isArray(data.email_address)
                ? data.email_address
                : typeof data.email_address === 'string'
                    ? data.email_address.split(',').map((v) => v.trim())
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

            toast.success(`Account ${isEdit ? "updated" : "created"} successfully!`);

            // Refresh accounts after save
            await refreshAccounts();
        } catch (error) {
            toast.error((error as Error).message || "Failed to save account.");
        }
    }

    // Refresh accounts list from API
    async function refreshAccounts() {
        try {
            const response = await fetch(
                `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
            );
            if (!response.ok) throw new Error("Failed to fetch accounts");
            const data = await response.json();
            setPosts(data.data || []);
            toast.success("Accounts loaded successfully!");
        } catch (error) {
            toast.error("Failed to connect to server. Please try again later or refresh your network connection");
        }
    }

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
                                        <BreadcrumbPage className="line-clamp-1">Activity Planners</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-${showCompleted ? "4" : "2"}  `}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>New Task</CardTitle>
                                    <CardDescription>
                                        Manage your latest Endorsed Tickets and Outbound Calls efficiently.
                                        Stay updated with pending tasks and streamline your workflow.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    <NewTask
                                        referenceid={userDetails.referenceid}
                                        userDetails={userDetails}
                                        onSaveAccountAction={handleSaveAccount}
                                        onRefreshAccountsAction={refreshAccounts} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>In Progress</CardTitle>
                                    <CardDescription>
                                        View and track all ongoing tasks to ensure timely completion and effective follow-up.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Scheduled</CardTitle>
                                    <CardDescription>
                                        View all upcoming scheduled tasks and track their progress for timely completion.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Completed</CardTitle>
                                    <CardDescription>
                                        Review all delivered transactions and successfully completed tasks for your records.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    <Completed
                                        referenceid={userDetails.referenceid}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Done</CardTitle>
                                    <CardDescription>
                                        Done Task.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
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
