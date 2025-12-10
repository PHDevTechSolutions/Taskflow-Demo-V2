"use client";

import React, { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"; // Adjust path as needed
import { Button } from "@/components/ui/button";

interface Company {
    type_client?: string;
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

    // Fetch total accounts
    useEffect(() => {
        if (!referenceid) {
            setTotalAccounts(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`/api/com-fetch-account?referenceid=${encodeURIComponent(referenceid)}`, {
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
                    setTotalAccounts(data.data.length);
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

    // Fetch breakdown when sheet opens
    useEffect(() => {
        if (!open) return; // fetch only when sheet opens
        if (!referenceid) return;

        setLoadingBreakdown(true);
        setBreakdownError(null);

        fetch(`/api/com-fetch-account?referenceid=${encodeURIComponent(referenceid)}`, {
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
                    // Aggregate counts by type_client, lowercase to avoid duplicates due to case differences
                    const counts: Record<string, number> = {};
                    data.data.forEach((company: Company) => {
                        const type = (company.type_client || "Unknown").toLowerCase();
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
        <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-center items-center">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Accounts</h3>
            {loading ? (
                <div className="text-lg font-semibold text-gray-700">Loading...</div>
            ) : error ? (
                <div className="text-red-500 text-xs text-center">{error}</div>
            ) : (
                <div className="text-3xl font-bold text-gray-900 mb-4">{totalAccounts ?? "-"}</div>
            )}

            {/* Show Breakdown Button */}
            <Button
                onClick={() => setOpen(true)}
                disabled={loading || !!error || !totalAccounts}
            >
                Show Breakdown
            </Button>

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
                                        <li key={type} className="flex justify-between py-2 text-gray-700">
                                            <span>{type}</span>
                                            <span className="font-semibold">{count}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 flex justify-between font-semibold border-t border-gray-300 pt-2 text-gray-900 text-xs">
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
        </div>
    );
};
