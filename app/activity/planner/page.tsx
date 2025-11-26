"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Alert, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button"
import { toast } from "sonner";

import { NewTask } from "@/components/activity-planner-newtask";
import { Progress } from "@/components/activity-planner-progress";
import { Scheduled } from "@/components/activity-planner-scheduled";
import { Completed } from "@/components/activity-planner-completed";

import { type DateRange } from "react-day-picker";
import { Eye } from "lucide-react";

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
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        target_quota: "",
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
            setError("User ID is missing.");
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

    // Filter accounts by created date range (optional)
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
                    {loadingUser ? (
                        <div className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>

                    ) : loadingAccounts ? (
                        <div className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircleIcon />
                                    <AlertTitle>{error}</AlertTitle>
                                </Alert>
                            )}

                            {/* BUTTON TOGGLE VIEW COMPLETED */}
                            <div className="flex justify-start">
                                <Button type="button" onClick={() => setShowCompleted((v) => !v)} variant="outline"><Eye size={16} />
                                    {showCompleted ? "Hide Completed" : "View Completed"}</Button>
                            </div>

                            <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${showCompleted ? "4" : "3"}  `}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>New Task</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <NewTask referenceid={userDetails.referenceid} />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>In Progress</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Progress
                                            referenceid={userDetails.referenceid}
                                            target_quota={userDetails.target_quota}
                                            dateCreatedFilterRange={dateCreatedFilterRange}
                                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Scheduled</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Scheduled
                                            referenceid={userDetails.referenceid}
                                            target_quota={userDetails.target_quota}
                                            dateCreatedFilterRange={dateCreatedFilterRange}
                                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                    </CardContent>
                                </Card>

                                {showCompleted && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Completed</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Completed
                                            referenceid={userDetails.referenceid}
                                            target_quota={userDetails.target_quota}
                                            dateCreatedFilterRange={dateCreatedFilterRange}
                                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction} />
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </>
                    )}
                </main>
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
