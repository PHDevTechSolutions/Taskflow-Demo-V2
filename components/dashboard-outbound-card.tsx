"use client";

import React, { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface Activity {
    source?: string;
    status?: string;
    actual_sales?: number | string;
    type_activity?: string;
}

interface SourceCardProps {
    activities: Activity[];
    loading?: boolean;
    error?: string | null;
    dateRange?: DateRange;
}

function calculateWorkingDays(from?: Date, to?: Date): number {
    if (!from || !to) return 0;

    let count = 0;
    const current = new Date(from);
    while (current <= to) {
        const day = current.getDay();
        // Count Mon-Fri as working days (1 to 5)
        if (day !== 0 && day !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

export function OutboundCard({ activities, loading, error, dateRange }: SourceCardProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    const workingDays = useMemo(() => {
        return calculateWorkingDays(dateRange?.from, dateRange?.to);
    }, [dateRange]);

    // Total Outbound - Touchbase activities
    const totalOutboundTouchbase = useMemo(() => {
        return activities.filter((a) => a.source === "Outbound - Touchbase").length;
    }, [activities]);

    // Total Quotation Preparation activities
    const totalQuotationPreparation = useMemo(() => {
        return activities.filter((a) => a.type_activity === "Quotation Preparation").length;
    }, [activities]);

    // Total Delivered (by status)
    const totalDelivered = useMemo(() => {
        return activities.filter((a) => a.status === "Delivered").length;
    }, [activities]);

    // Total Sales Invoice from Delivered activities
    const totalSalesInvoice = useMemo(() => {
        return activities
            .filter((a) => a.status === "Delivered")
            .reduce((sum, a) => {
                let val = 0;
                if (typeof a.actual_sales === "number") {
                    val = a.actual_sales;
                } else if (typeof a.actual_sales === "string") {
                    const cleaned = a.actual_sales.replace(/[^0-9.-]+/g, "");
                    val = parseFloat(cleaned);
                }
                return !isNaN(val) && val > 0 ? sum + val : sum;
            }, 0);
    }, [activities]);

    // OB Target calculation
    const obTarget = 35 * workingDays;

    // Achievement calculation
    const achievement = obTarget > 0 ? (totalOutboundTouchbase / obTarget) * 100 : 0;

    // Calls to Quote Conversion (%)
    const callsToQuoteConversion = useMemo(() => {
        if (totalOutboundTouchbase === 0) return 0;
        return (totalQuotationPreparation / totalOutboundTouchbase) * 100;
    }, [totalQuotationPreparation, totalOutboundTouchbase]);

    // Outbound to Sales Conversion (%)
    const outboundToSalesConversion = useMemo(() => {
        if (totalOutboundTouchbase === 0) return 0;
        return (totalDelivered / totalOutboundTouchbase) * 100;
    }, [totalDelivered, totalOutboundTouchbase]);

    return (
        <Card>
            <CardHeader className="flex justify-between items-center">
                <div>
                    <CardTitle>Outbound Calls (Touch-Based Only)</CardTitle>
                    <CardDescription>
                        Counts based on Source, Type of Activity, Status filters and OB Target computed from working days
                    </CardDescription>
                </div>

                <div
                    className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onFocus={() => setShowTooltip(true)}
                    onBlur={() => setShowTooltip(false)}
                    tabIndex={0}
                    aria-label="Information about activity filters and OB Target"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
                        />
                    </svg>

                    {showTooltip && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-180 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Counts activities with Source "Outbound - Touchbase", Type of Activity "Quotation Preparation", and Status "Delivered".</li>
                                <li>OB Target = 35 × WorkingDays, where Working Days is calculated from date range.</li>
                                <li>Achievement = (Total OB ÷ OB Target) × 100</li>
                                <li>Calls to Quote Conversion = (Total Quotations ÷ Total OB) × 100</li>
                                <li>Outbound to Sales Conversion = (Total Delivered ÷ Total OB) × 100</li>
                                <li>Total Sales Invoice = sum of Sales Invoice from Delivered activities</li>
                            </ul>
                        </div>
                    )}

                </div>
            </CardHeader>

            <CardContent>
                {loading && <p className="text-sm text-gray-500">Loading...</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}

                {!loading && !error && (
                    <div className="space-y-2">
                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">OB Target</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-blue-500">
                                            {obTarget.toLocaleString()} (35 × {workingDays} WD)
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Total OB</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-indigo-500">
                                            {totalOutboundTouchbase}
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Total Quote</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-yellow-500">
                                            {totalQuotationPreparation}
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Total SI</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-emerald-500">
                                            {totalDelivered}
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Achievement</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-purple-500">
                                            {achievement.toFixed(2)}%
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Calls to Quote Conversion</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-pink-500">
                                            {callsToQuoteConversion.toFixed(2)}%
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Outbound to Sales Conversion</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-red-500">
                                            {outboundToSalesConversion.toFixed(2)}%
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>

                        <Item variant="outline" size="sm">
                            <ItemContent>
                                <div className="flex justify-between w-full">
                                    <ItemTitle className="text-xs font-medium">Total Sales Invoice</ItemTitle>
                                    <ItemDescription>
                                        <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono bg-teal-500">
                                            ₱ {totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Badge>
                                    </ItemDescription>
                                </div>
                            </ItemContent>
                        </Item>
                    </div>
                )}
            </CardContent>

            <CardFooter className="text-muted-foreground text-xs">
                Only predefined sources, activity types, and statuses are counted. OB Target depends on working days.
            </CardFooter>
        </Card>
    );
}
