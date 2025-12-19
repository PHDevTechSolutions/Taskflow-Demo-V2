"use client";

import React, { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Company {
    type_client?: string;
    status?: string;
}

interface AccountCardProps {
    referenceid: string;
}

export const AccountCard: React.FC<AccountCardProps> = ({ referenceid }) => {
    const [totalAccounts, setTotalAccounts] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Breakdown data state
    const [breakdownData, setBreakdownData] = useState<Record<string, number> | null>(null);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);
    const [breakdownError, setBreakdownError] = useState<string | null>(null);

    // Sheet open state (controlled)
    const [open, setOpen] = useState(false);

    // Fetch total accounts excluding status "removed" and "subject for approval"
    useEffect(() => {
        if (!referenceid) {
            setTotalAccounts(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`, {
            cache: "no-store",
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(json.error || "Failed to fetch accounts");
                }
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data.data)) {
                    const filteredData = data.data.filter((company: Company) => {
                        const status = (company.status || "").toLowerCase();
                        return status !== "removed" && status !== "subject for approval";
                    });
                    setTotalAccounts(filteredData.length);
                } else {
                    setTotalAccounts(0);
                }
            })
            .catch((err) => {
                setError(err.message || "Error fetching accounts");
                setTotalAccounts(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [referenceid]);

    // Fetch breakdown when sheet opens, excluding status "removed" and "subject for approval"
    useEffect(() => {
        if (!open) return; // fetch only when sheet opens
        if (!referenceid) return;

        setLoadingBreakdown(true);
        setBreakdownError(null);

        fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`, {
            cache: "no-store",
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(json.error || "Failed to fetch accounts");
                }
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data.data)) {
                    const filteredData = data.data.filter((company: Company) => {
                        const status = (company.status || "").toLowerCase();
                        return status !== "removed" && status !== "subject for approval";
                    });

                    const counts: Record<string, number> = {};
                    filteredData.forEach((company: Company) => {
                        // group by type_client for breakdown display (or change if needed)
                        const type = (company.type_client || "unknown").toLowerCase();
                        counts[type] = (counts[type] ?? 0) + 1;
                    });

                    setBreakdownData(counts);
                } else {
                    setBreakdownData(null);
                }
            })
            .catch((err) => {
                setBreakdownError(err.message || "Error fetching breakdown");
                setBreakdownData(null);
            })
            .finally(() => {
                setLoadingBreakdown(false);
            });
    }, [open, referenceid]);

    return (
        <Card className="flex flex-col justify-center items-center">
            <CardTitle className="text-center">Total Accounts</CardTitle>
            <div className="text-3xl font-bold mb-1">
                {loading
                    ? "Loading..."
                    : error
                        ? error
                        : totalAccounts !== null
                            ? `${totalAccounts}`
                            : "-"}
            </div>

            <CardContent className="flex justify-center">
                <Button
                    onClick={() => setOpen(true)}
                    disabled={loading || !!error || !totalAccounts}
                    className="cursor-pointer"
                >
                    Show Breakdown
                </Button>
            </CardContent>

            {/* Sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="right">
                    <SheetHeader>
                        <SheetTitle>Accounts Breakdown</SheetTitle>
                        <SheetDescription>
                            Number of accounts grouped by client type
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 p-6">
                        {loadingBreakdown && <p>Loading breakdown...</p>}
                        {breakdownError && (
                            <p className="text-red-500 text-xs">{breakdownError}</p>
                        )}
                        {!loadingBreakdown && !breakdownError && breakdownData && (
                            <>
                                <ul className="divide-y divide-gray-200 text-xs uppercase">
                                    {Object.entries(breakdownData).map(([type, count]) => (
                                        <li key={type} className="flex justify-between py-2">
                                            <span>{type}</span>
                                            <span className="font-semibold">{count}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 flex justify-between font-semibold border-t border-gray-300 pt-2 text-xs">
                                    <span>TOTAL</span>
                                    <span>{Object.values(breakdownData).reduce((a, b) => a + b, 0)}</span>
                                </div>
                            </>
                        )}

                        {!loadingBreakdown && !breakdownError && !breakdownData && (
                            <p>No data available</p>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </Card>
    );
};
