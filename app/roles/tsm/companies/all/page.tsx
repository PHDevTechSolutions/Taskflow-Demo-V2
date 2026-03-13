"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";

import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { AccountsTable } from "@/components/roles/tsm/accounts/table/all";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface Account {
    id: string;
    tsm: string;
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
    firstname: string;
    lastname: string;
    tsm: string;
    manager: string;
    profilepicture: string;
}

/* ─── Batched fetch — keeps calling until a batch comes back smaller than the page size ─── */
const BATCH_SIZE = 1000;

async function fetchAllAccounts(tsmRefId: string): Promise<Account[]> {
    const all: Account[] = [];
    let offset = 0;

    while (true) {
        const res = await fetch(
            `/api/com-fetch-approval-account?tsm=${encodeURIComponent(tsmRefId)}&limit=${BATCH_SIZE}&offset=${offset}`
        );
        if (!res.ok) throw new Error("Failed to fetch accounts");

        const json = await res.json();
        const batch: Account[] = json.data ?? json ?? [];

        all.push(...batch);

        // If the batch is smaller than BATCH_SIZE there are no more rows
        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }

    return all;
}

/* ─────────────────────────────────────────────────────── */

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "", firstname: "", lastname: "", tsm: "", manager: "", profilepicture: "",
    });
    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);

    const queryUserId = searchParams?.get("id") ?? "";

    useEffect(() => {
        if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
    }, [queryUserId, userId, setUserId]);

    /* ── Fetch user ── */
    useEffect(() => {
        if (!userId) { setLoadingUser(false); return; }

        const fetchUserData = async () => {
            setError(null);
            setLoadingUser(true);
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!response.ok) throw new Error("Failed to fetch user data");
                const data = await response.json();
                setUserDetails({
                    referenceid: data.ReferenceID || "",
                    firstname: data.FirstName || "",
                    lastname: data.LastName || "",
                    tsm: data.TSM || "",
                    manager: data.Manager || "",
                    profilepicture: data.profilePicture || "",
                });
                sileo.success({ title: "Success", description: "User data loaded successfully!", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
            } catch {
                sileo.error({ title: "Failed", description: "Failed to connect to server. Please try again later or refresh your network connection", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    /* ── Fetch ALL accounts using batched loop ── */
    useEffect(() => {
        if (!userDetails.referenceid) { setPosts([]); return; }

        const fetchAccounts = async () => {
            setError(null);
            setLoadingAccounts(true);
            try {
                // ✅ Loops until all rows are fetched — no more 1000-row cap
                const all = await fetchAllAccounts(userDetails.referenceid);

                // ✅ Pass raw data — AccountsTable handles Active filtering internally
                setPosts(all);

                sileo.success({
                    title: "Success",
                    description: `${all.length} accounts loaded.`,
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: { title: "text-white!", description: "text-white" },
                });
            } catch {
                sileo.error({
                    title: "Failed",
                    description: "Failed to connect to server. Please try again later or refresh your network connection",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: { title: "text-white!", description: "text-white" },
                });
            } finally {
                setLoadingAccounts(false);
            }
        };

        fetchAccounts();
    }, [userDetails.referenceid]);

    /* ── Optional date filter (agent filter removed — table handles it) ── */
    const filteredData = useMemo(() => {
        if (!dateCreatedFilterRange?.from || !dateCreatedFilterRange?.to) return posts;
        const from = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
        const to   = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);
        return posts.filter((item) => {
            const t = new Date(item.date_created).getTime();
            return t >= from && t <= to;
        });
    }, [posts, dateCreatedFilterRange]);

    return (
        <ProtectedPageWrapper>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden">
                <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
                    <div className="flex flex-1 items-center gap-2 px-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="line-clamp-1">Customer Database - All</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                    {(loadingUser || loadingAccounts) ? (
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
                            {/* ✅ Pass raw posts — table handles Active filter internally */}
                            <AccountsTable posts={filteredData} userDetails={userDetails} />
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