"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Sales {
    id: number;
    actual_sales?: number;
    si_date?: string;
}

interface SalesProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: {
        from?: Date | undefined;
        to?: Date | undefined;
    };
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const SalesTable: React.FC<SalesProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Sales[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    // Fetch activities from API
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/act-fetch-history?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        // Subscribe to realtime updates from Supabase
        const channel = supabase
            .channel(`public:history:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as Sales;
                    const oldRecord = payload.old as Sales;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;
                            case "UPDATE":
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
                            case "DELETE":
                                return curr.filter((a) => a.id !== oldRecord.id);
                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    // Group sales by date without limiting to current month
    const groupSalesByDate = (data: Sales[]) => {
        const grouped: { [date: string]: number } = {};
        data.forEach((item) => {
            if (!item.si_date) return;
            if (!(item.si_date in grouped)) grouped[item.si_date] = 0;
            grouped[item.si_date] += item.actual_sales ?? 0;
        });
        return grouped;
    };

    // Helper: Get start and end of current month
    const getCurrentMonthRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
        // Normalize time for comparison
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    // Filter activities based on date range selected or default current month
    const filteredActivities = useMemo(() => {
        let fromDate = dateCreatedFilterRange?.from;
        let toDate = dateCreatedFilterRange?.to;

        if (!fromDate || !toDate) {
            // No date range selected, default to current month
            const { start, end } = getCurrentMonthRange();
            fromDate = start;
            toDate = end;
        } else {
            // Normalize time for inclusive filtering
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
        }

        const fromTime = fromDate.getTime();
        const toTime = toDate.getTime();

        return activities.filter((activity) => {
            if (!activity.si_date) return false;
            const activityDate = new Date(activity.si_date);
            const activityTime = activityDate.getTime();
            return activityTime >= fromTime && activityTime <= toTime;
        });
    }, [activities, dateCreatedFilterRange]);

    // Group filtered activities by date
    const groupedSales = useMemo(() => {
        return groupSalesByDate(filteredActivities);
    }, [filteredActivities]);

    // Sum total actual sales based on grouped sales
    const totalActualSales = useMemo(() => {
        return Object.values(groupedSales).reduce((a, b) => a + b, 0);
    }, [groupedSales]);

    // Parse target_quota as number (default 0)
    const targetQuotaNumber = useMemo(() => {
        const parsed = Number(target_quota);
        return isNaN(parsed) ? 0 : parsed;
    }, [target_quota]);

    // Calculate variance and achievement
    const variance = useMemo(() => targetQuotaNumber - totalActualSales, [targetQuotaNumber, totalActualSales]);

    const achievement = useMemo(() => {
        if (targetQuotaNumber === 0) return 0;
        return (totalActualSales / targetQuotaNumber) * 100;
    }, [totalActualSales, targetQuotaNumber]);

    // Calculate working days excluding Sundays from start of month to yesterday
    const getWorkingDaysCount = (date: Date) => {
        let count = 0;
        const year = date.getFullYear();
        const month = date.getMonth();

        for (let day = 1; day < date.getDate(); day++) {
            const d = new Date(year, month, day);
            if (d.getDay() !== 0) count++;
        }
        return count;
    };

    const fixedDays = 26;
    const today = new Date();
    const workingDaysSoFar = getWorkingDaysCount(today);
    const parPercentage = (workingDaysSoFar / fixedDays) * 100;
    const percentToPlan = Math.round(achievement);

    if (loadingActivities) {
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (errorActivities) {
        return (
            <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
                <AlertCircleIcon className="h-6 w-6 text-red-600" />
                <div>
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{errorActivities}</AlertDescription>
                </div>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-md border p-4 bg-white shadow-sm">
                <h2 className="font-semibold text-sm mb-4">Sales Metrics</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Target Quota</TableCell>
                            <TableCell className="text-right">
                                {targetQuotaNumber.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Total Actual Sales</TableCell>
                            <TableCell className="text-right">
                                {totalActualSales.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Variance</TableCell>
                            <TableCell className={`text-right ${variance < 0 ? "text-green-600" : "text-red-600"}`}>
                                {variance.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Achievement</TableCell>
                            <TableCell className="text-right">{achievement.toFixed(2)}%</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Par</TableCell>
                            <TableCell className="text-right">{parPercentage.toFixed(2)}%</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>% To Plan</TableCell>
                            <TableCell className="text-right">{percentToPlan}%</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            {/* Computation Explanation Card */}
            <div className="rounded-md border p-4 bg-white shadow-sm">
                <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
                <div className="text-xs space-y-3 text-gray-700">
                    <p>
                        <strong>Achievement:</strong> Calculated as the total actual sales divided by the target quota, multiplied by 100 to get a percentage.
                        <br />
                        <code>Achievement = (Total Actual Sales / Target Quota) × 100%</code>
                    </p>
                    <p>
                        <strong>Par:</strong> A benchmark percentage to track progress based on the number of working days (Monday to Saturday) passed in the month, excluding Sundays.
                        <br />
                        It adjusts the expected progress relative to time.
                        <br />
                        <code>Par Percentage = (Working Days So Far / 26) × 100%</code>
                    </p>
                    <p>
                        <strong>Variance:</strong> The difference between the target quota and the total actual sales.
                        <br />
                        <code>Variance = Target Quota - Total Actual Sales</code>
                    </p>
                    <p>
                        <strong>% To Plan:</strong> The rounded achievement percentage, representing how close actual sales are to the target plan.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SalesTable;
