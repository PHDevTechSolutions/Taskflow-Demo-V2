"use client";

import React, { useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface Activity {
    source?: string;
    status?: string;
    date_created?: string;
    start_date?: string;
    end_date?: string;
    activity_reference_number?: string;
}

interface CSRMetricsCardProps {
    activities: Activity[];
    loading?: boolean;
    error?: string | null;
}

interface CSRMetricRow {
    date_created: string;
    responseTimeHours: number;
    rfqHandlingHours: number;
    nonRfqHandlingHours: number;
}

function diffHours(start?: string, end?: string) {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return diff > 0 ? diff / (1000 * 60 * 60) : 0;
}

export function CSRMetricsCard({ activities, loading, error }: CSRMetricsCardProps) {
    // Filter only CSR Client source activities
    const csrActivities = useMemo(
        () => activities.filter((act) => act.source === "CSR Client"),
        [activities]
    );

    // Group by activity_reference_number
    const groupedByReference = useMemo(() => {
        const groups: Record<string, Activity[]> = {};
        for (const act of csrActivities) {
            const ref = act.activity_reference_number || "unknown";
            if (!groups[ref]) groups[ref] = [];
            groups[ref].push(act);
        }
        return groups;
    }, [csrActivities]);

    // Compute rows for the table
    const rows: CSRMetricRow[] = useMemo(() => {
        const results: CSRMetricRow[] = [];

        for (const [ref, acts] of Object.entries(groupedByReference)) {
            // Sort activities by start_date or date_created for time range
            const sortedByStart = acts
                .filter((a) => a.start_date)
                .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());

            if (sortedByStart.length === 0) continue;

            const firstStart = sortedByStart[0].start_date!;

            // Safely get latest end_date using timestamps and Math.max
            const endDates = acts
                .map((a) => a.end_date)
                .filter((d): d is string => Boolean(d))
                .map((d) => new Date(d).getTime());

            const maxEndTimestamp = endDates.length > 0 ? Math.max(...endDates) : new Date(firstStart).getTime();
            const lastEnd = new Date(maxEndTimestamp).toISOString();

            // Overall Response Time (between first start and last end)
            const responseTimeHours = diffHours(firstStart, lastEnd);

            // RFQ Handling time (status === "QUOTE-DONE")
            const rfqActs = acts.filter((a) => a.status === "Quote-Done" && a.start_date && a.end_date);
            let rfqHandlingHours = 0;
            for (const a of rfqActs) {
                rfqHandlingHours += diffHours(a.start_date, a.end_date);
            }

            // Non-RFQ Handling time (status === "ASSISTED")
            const nonRfqActs = acts.filter((a) => a.status === "Assisted" && a.start_date && a.end_date);
            let nonRfqHandlingHours = 0;
            for (const a of nonRfqActs) {
                nonRfqHandlingHours += diffHours(a.start_date, a.end_date);
            }

            // Use date_created of first activity for display (fallback to firstStart)
            const dateCreated = acts[0].date_created || firstStart;

            results.push({
                date_created: dateCreated,
                responseTimeHours,
                rfqHandlingHours,
                nonRfqHandlingHours,
            });
        }

        // Sort rows by date_created descending
        results.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

        return results;
    }, [groupedByReference]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>CSR Metrics</CardTitle>
                <CardDescription>Response times and handling times per activity</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {loading ? (
                    <div className="text-center py-12 text-lg font-semibold">Loading...</div>
                ) : error ? (
                    <div className="text-center py-12 text-red-500 text-sm">{error}</div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No CSR data available</div>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-gray-300">
                                <th className="text-left py-2 px-3">Date Created</th>
                                <th className="text-right py-2 px-3">Response Time (hrs)</th>
                                <th className="text-right py-2 px-3">RFQ Handling Time (hrs)</th>
                                <th className="text-right py-2 px-3">Non-RFQ Handling Time (hrs)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-muted/50" : ""}>
                                    <td className="py-2 px-3">{new Date(row.date_created).toLocaleDateString()}</td>
                                    <td className="py-2 px-3 text-right">{row.responseTimeHours.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right">{row.rfqHandlingHours.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right">{row.nonRfqHandlingHours.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
            <CardFooter className="text-muted-foreground text-xs italic">
                Computed metrics based on CSR Client activities in the selected date range
            </CardFooter>
        </Card>
    );
}
