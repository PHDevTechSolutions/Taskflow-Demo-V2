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
import { Overdue } from "@/components/roles/tsa/activity/planner/overdue/overdue";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import { PlusCircle, Loader2, Calendar, CheckCircle, ClipboardCheck, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"

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
        tsmDetails: null
    });

    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
        DateRange | undefined
    >(undefined);

    // NEW: State to toggle completed card visibility
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

    // Sync URL query param with userId context
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    const [hierarchy, setHierarchy] = useState({ manager: null, tsm: null });

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
                    signature: data.signatureImage || "",
                    managerDetails: data.managerDetails || null, 
                    tsmDetails: data.tsmDetails || null
                });

                // Set the new hierarchy details
                setHierarchy({
                    manager: data.managerDetails,
                    tsm: data.tsmDetails
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

    const COLLAPSE_KEY = "activity_planner_collapsible_state";

    useEffect(() => {
        const saved = localStorage.getItem(COLLAPSE_KEY);
        if (saved) {
            try {
                setCollapseState(JSON.parse(saved));
            } catch {
                // fallback kung may corrupted data
                localStorage.removeItem(COLLAPSE_KEY);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapseState));
    }, [collapseState]);

    const toggleCollapse = (key: keyof typeof collapseState) => {
        setCollapseState(prev => ({
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
                        <div className="w-full columns-1 sm:columns-2 lg:columns-2 gap-4 [&>*]:break-inside-avoid">
                            <Card className="rounded-none h-auto transition-all duration-300">
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <PlusCircle className="w-5 h-5" />
                                        <span>New Task</span>
                                    </CardTitle>
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
                                            {/* Loader only spins when count > 0 */}
                                            <Loader2
                                                className={`w-4 h-4 ${progressCount > 0 ? "animate-spin" : ""}`}
                                            />
                                            <span>In Progress</span>
                                            <span className="text-xs text-red-600 font-bold">
                                                ({progressCount})
                                            </span>
                                        </div>
                                        <span className="text-xs rounded-sm border p-1">
                                            {collapseState.inProgress ? <ChevronRight /> : <ChevronDown />}
                                        </span>
                                    </CardTitle>
                                    <CardDescription>
                                        View and track all ongoing tasks to ensure timely completion and effective follow-up.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent
                                    className={`transition-all duration-300 overflow-hidden ${collapseState.inProgress
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
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
                                            {collapseState.scheduled ? <ChevronRight /> : <ChevronDown />}
                                        </span>
                                    </CardTitle>
                                    <CardDescription>
                                        View all upcoming scheduled tasks and track their progress for timely completion.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent
                                    className={`transition-all duration-300 overflow-hidden ${collapseState.scheduled
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
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
                                            {collapseState.completed ? <ChevronRight /> : <ChevronDown />}
                                        </span>
                                    </CardTitle>
                                    <CardDescription>
                                        Review all delivered transactions and successfully completed tasks for your records.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent
                                    className={`transition-all duration-300 overflow-hidden ${collapseState.completed
                                        ? "max-h-[2000px] opacity-100"
                                        : "max-h-0 opacity-0 p-0"
                                        }`}
                                >
                                    <Completed
                                        referenceid={userDetails.referenceid}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
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
                                    className={`transition-all duration-300 overflow-hidden ${collapseState.done
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
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
                                            {collapseState.overdue ? <ChevronRight /> : <ChevronDown />}
                                        </span>
                                    </CardTitle>
                                    <CardDescription>
                                        This activity has passed its scheduled date and requires attention.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent
                                    className={`transition-all duration-300 overflow-hidden ${collapseState.overdue
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
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
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
