"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";

import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Laptop, Smartphone, Monitor, Globe, AlertCircle } from "lucide-react";
import { UAParser } from "ua-parser-js";

function SettingsContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
    const queryUserId = searchParams?.get("id") ?? "";
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);
    const [mounted, setMounted] = useState(false);
    const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState("");
    const [loadingUser, setLoadingUser] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;

    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    useEffect(() => setMounted(true), []);

    // Fetch user info
    useEffect(() => {
        if (!userId) return;

        const fetchUserData = async () => {
            setLoadingUser(true);
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!response.ok) throw new Error("Failed to fetch user data");

                const data = await response.json();
                setUserEmail(data.Email || "");
                toast.success("User data loaded successfully!");
            } catch (err) {
                console.error("Error fetching user data:", err);
                toast.error("Failed to fetch user data");
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    // Fetch security alerts
    useEffect(() => {
        if (!userEmail) return;

        const fetchSecurityAlerts = async () => {
            try {
                const res = await fetch("/api/security-alerts");
                const data = await res.json();
                const filteredAlerts = (data || []).filter((alert: any) => alert.Email === userEmail);
                setSecurityAlerts(filteredAlerts);
                setCurrentPage(1);
            } catch (err) {
                console.error("Failed to fetch security alerts", err);
            }
        };

        fetchSecurityAlerts();
    }, [userEmail]);

    if (!mounted) return null;

    const totalPages = Math.ceil(securityAlerts.length / pageSize);
    const paginatedAlerts = securityAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <>
            <SidebarLeft />
            <SidebarInset>
                {/* Header */}
                <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
                    <div className="flex flex-1 items-center gap-2 px-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-base font-semibold">Settings</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-4 p-4 w-full">
                    <Card className="border border-muted shadow-sm w-full">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Security Alerts</CardTitle>
                            <CardDescription className="text-sm text-gray-500">
                                List of recent security alerts including email, IP address, device, and message details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto w-full">
                            {loadingUser ? (
                                <p className="text-center text-muted-foreground">Loading user data...</p>
                            ) : (
                                <>
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="p-2 text-left">Email</th>
                                                <th className="p-2 text-left">Device ID</th>
                                                <th className="p-2 text-left">Device Type</th>
                                                <th className="p-2 text-left">Message</th>
                                                <th className="p-2 text-left">Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedAlerts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-2 text-center text-muted-foreground">
                                                        No security alerts for your account
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedAlerts.map((alert, idx) => {
                                                    // Identify device type
                                                    const parser = new UAParser(alert.userAgent);
                                                    const deviceType = parser.getDevice().type || "desktop"; // fallback

                                                    let DeviceIcon;
                                                    switch (deviceType) {
                                                        case "mobile":
                                                            DeviceIcon = Smartphone;
                                                            break;
                                                        case "tablet":
                                                            DeviceIcon = Laptop; // optional: could use Tablet icon if available
                                                            break;
                                                        case "desktop":
                                                        default:
                                                            DeviceIcon = Monitor;
                                                    }

                                                    return (
                                                        <tr key={idx} className="border-b last:border-b-0">
                                                            <td className="p-2 flex items-center gap-2">
                                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                                                Email: {alert.Email}
                                                            </td>
                                                            <td className="p-2 flex items-center gap-2">
                                                                <Globe className="w-4 h-4 text-blue-500" />
                                                                IP Address: {alert.ipAddress}
                                                            </td>
                                                            <td className="p-2">{alert.deviceId}</td>
                                                            <td className="p-2 flex items-center gap-2 uppercase">
                                                                <DeviceIcon className="w-4 h-4 text-green-500" />
                                                                {deviceType}
                                                            </td>
                                                            <td className="p-2">{alert.message}</td>
                                                            <td className="p-2">{new Date(alert.timestamp).toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex justify-center mt-4 gap-2">
                                            <button
                                                className="px-3 py-1 border rounded disabled:opacity-50"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage((p) => p - 1)}
                                            >
                                                Prev
                                            </button>
                                            {[...Array(totalPages)].map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    className={`px-3 py-1 border rounded ${currentPage === idx + 1 ? "bg-primary text-white" : ""
                                                        }`}
                                                    onClick={() => setCurrentPage(idx + 1)}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                            <button
                                                className="px-3 py-1 border rounded disabled:opacity-50"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage((p) => p + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
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

export default function SettingsPage() {
    return (
        <ProtectedPageWrapper>
            <UserProvider>
                <FormatProvider>
                    <SidebarProvider>
                        <Suspense fallback={<div>Loading...</div>}>
                            <SettingsContent />
                        </Suspense>
                    </SidebarProvider>
                </FormatProvider>
            </UserProvider>
        </ProtectedPageWrapper>
    );
}
