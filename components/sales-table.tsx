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

import {
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

interface Sales {
    id: number;
    actual_sales?: number;
    delivery_date?: string;
}

interface SalesProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
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

    // New state for chart mode toggle
    const [chartMode, setChartMode] = useState<"current" | "comparison">("current");

    // Fetch activities
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

    // Helper: get year-month string like '2025-12'
    const getYearMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    // Get current month string e.g. '2025-12'
    const currentMonth = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }, []);

    // Get last month string e.g. '2025-11'
    const lastMonth = useMemo(() => {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth(); // zero-based
        if (month === 0) {
            year--;
            month = 12;
        }
        return `${year}-${String(month).padStart(2, "0")}`;
    }, []);

    // Group sales by date and filter by month
    const groupSalesByDate = (data: Sales[], monthYear: string) => {
        const grouped: { [date: string]: number } = {};
        data.forEach((item) => {
            if (!item.delivery_date) return;
            if (getYearMonth(item.delivery_date) !== monthYear) return;
            if (!(item.delivery_date in grouped)) grouped[item.delivery_date] = 0;
            grouped[item.delivery_date] += item.actual_sales ?? 0;
        });
        return grouped;
    };

    // Prepare current month grouped data
    const currentMonthGrouped = useMemo(() => {
        return groupSalesByDate(activities, currentMonth);
    }, [activities, currentMonth]);

    // Prepare last month grouped data
    const lastMonthGrouped = useMemo(() => {
        return groupSalesByDate(activities, lastMonth);
    }, [activities, lastMonth]);

    // Merge dates for chart (all unique dates from current and last month)
    const mergedDates = useMemo(() => {
        const dateSet = new Set<string>([
            ...Object.keys(currentMonthGrouped),
            ...Object.keys(lastMonthGrouped),
        ]);
        return Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }, [currentMonthGrouped, lastMonthGrouped]);

    // Prepare chart data based on merged dates and grouping, with optional last month
    const chartData = useMemo(() => {
        return mergedDates.map((date) => ({
            date,
            current_month_sales: currentMonthGrouped[date] ?? 0,
            last_month_sales: lastMonthGrouped[date] ?? 0,
        }));
    }, [mergedDates, currentMonthGrouped, lastMonthGrouped]);

    // Sum total actual sales (current month)
    const totalActualSales = useMemo(() => {
        return Object.values(currentMonthGrouped).reduce((a, b) => a + b, 0);
    }, [currentMonthGrouped]);

    // Sum total actual sales (last month)
    const totalLastMonthSales = useMemo(() => {
        return Object.values(lastMonthGrouped).reduce((a, b) => a + b, 0);
    }, [lastMonthGrouped]);

    // Parse target_quota as number (default to 0 if not valid)
    const targetQuotaNumber = useMemo(() => {
        const parsed = Number(target_quota);
        return isNaN(parsed) ? 0 : parsed;
    }, [target_quota]);

    // Compute variance = targetQuota - totalActualSales
    const variance = useMemo(() => {
        return targetQuotaNumber - totalActualSales;
    }, [targetQuotaNumber, totalActualSales]);

    // Compute achievement % = (actual / target) * 100
    const achievement = useMemo(() => {
        if (targetQuotaNumber === 0) return 0;
        return (totalActualSales / targetQuotaNumber) * 100;
    }, [totalActualSales, targetQuotaNumber]);

    // Compute working days excluding Sundays from start of month to yesterday
    const getWorkingDaysCount = (date: Date) => {
        let count = 0;
        const year = date.getFullYear();
        const month = date.getMonth();

        for (let day = 1; day < date.getDate(); day++) {
            const d = new Date(year, month, day);
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0) count++;
        }

        return count;
    };

    const fixedDays = 26;
    const today = new Date();
    const workingDaysSoFar = getWorkingDaysCount(today);
    const parPercentage = (workingDaysSoFar / fixedDays) * 100;
    const percentToPlan = Math.round(achievement);

    // Calculate difference between current month and last month sales
    const salesDifference = totalActualSales - totalLastMonthSales;

    // Percentage change from last month (handle divide by zero)
    const salesPercentageChange =
        totalLastMonthSales === 0 ? 0 : (salesDifference / totalLastMonthSales) * 100;

    // Chart config object for ChartContainer
    const chartConfig: ChartConfig = {
        current_month_sales: {
            label: "Current Month Sales",
            color: "var(--color-desktop)",
        },
        last_month_sales: {
            label: "Last Month Sales",
            color: "var(--color-muted)",
        },
    };

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
            {/* Metrics Table Card */}
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
                            <TableCell
                                className={`text-right ${variance < 0 ? "text-green-600" : "text-red-600"
                                    }`}
                            >
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

            {/* Chart Mode Selector */}
            <div className="flex items-center gap-2">
                <label htmlFor="chartMode" className="text-sm font-medium">
                    Chart View:
                </label>
                <select
                    id="chartMode"
                    className="border rounded p-1 text-sm"
                    value={chartMode}
                    onChange={(e) => setChartMode(e.target.value as "current" | "comparison")}
                >
                    <option value="current">Current Month</option>
                    {/* Show comparison option only if last month has data */}
                    {Object.keys(lastMonthGrouped).length > 0 && (
                        <option value="comparison">Current vs Last Month</option>
                    )}
                </select>
            </div>

            {/* Sales Area Chart Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Sales by Delivery Date</CardTitle>
                    <CardDescription>
                        Showing actual sales grouped by delivery date
                        {chartMode === "comparison" ? " (Current Month vs Last Month)" : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mergedDates.length === 0 ? (
                        <p className="text-xs text-center text-gray-500">No sales data to display.</p>
                    ) : (
                        <ChartContainer config={chartConfig}>
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }} data={chartData}>
                                    <defs>
                                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
                                        </linearGradient>
                                        <linearGradient id="colorLast" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-muted)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--color-muted)" stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(dateStr) => {
                                            const d = new Date(dateStr);
                                            return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                                        }}
                                        minTickGap={20}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis
                                        tickFormatter={(value) =>
                                            value.toLocaleString(undefined, {
                                                style: "currency",
                                                currency: "PHP",
                                                maximumFractionDigits: 0,
                                            })
                                        }
                                        tick={{ fontSize: 10 }}
                                        width={70}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <ChartTooltip
                                        formatter={(value: number) =>
                                            value.toLocaleString(undefined, { style: "currency", currency: "PHP" })
                                        }
                                        labelFormatter={(label) => {
                                            const d = new Date(label);
                                            return d.toLocaleDateString(undefined, {
                                                weekday: "short",
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            });
                                        }}
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="line" />}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="current_month_sales"
                                        stroke="var(--color-desktop)"
                                        fillOpacity={1}
                                        fill="url(#colorCurrent)"
                                        name="Current Month"
                                    />
                                    {chartMode === "comparison" && (
                                        <Area
                                            type="monotone"
                                            dataKey="last_month_sales"
                                            stroke="var(--color-muted)"
                                            fillOpacity={1}
                                            fill="url(#colorLast)"
                                            name="Last Month"
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
                <CardFooter>
                    <small className="text-gray-400">
                        Data is grouped by delivery date, based on actual sales amounts.
                    </small>
                </CardFooter>
            </Card>

            {/* Dynamic Comparison Explanation Card */}
            <div className="rounded-md border p-4 bg-white shadow-sm">
                <h2 className="font-semibold text-sm mb-4">Comparison Explanation</h2>
                <div className="text-xs text-gray-700 space-y-2">
                    {chartMode === "comparison" ? (
                        <>
                            <p>
                                This chart compares <strong>current month sales</strong> against <strong>last month sales</strong> by delivery date.
                            </p>
                            <p>
                                <strong>Total sales last month:</strong>{" "}
                                {totalLastMonthSales.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                                <br />
                                <strong>Total sales this month:</strong>{" "}
                                {totalActualSales.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                            </p>
                            <p>
                                The sales have{" "}
                                <strong
                                    className={
                                        salesDifference > 0
                                            ? "text-green-600"
                                            : salesDifference < 0
                                                ? "text-red-600"
                                                : ""
                                    }
                                >
                                    {salesDifference > 0 ? "increased" : salesDifference < 0 ? "decreased" : "remained the same"}
                                </strong>{" "}
                                by{" "}
                                <strong
                                    className={
                                        salesDifference > 0
                                            ? "text-green-600"
                                            : salesDifference < 0
                                                ? "text-red-600"
                                                : ""
                                    }
                                >
                                    {Math.abs(salesDifference).toLocaleString(undefined, {
                                        style: "currency",
                                        currency: "PHP",
                                    })}{" "}
                                    ({salesPercentageChange.toFixed(2)}%)
                                </strong>{" "}
                                compared to last month.
                            </p>
                            <p>
                                Use this information to track sales trends and adjust your strategies accordingly.
                            </p>
                        </>
                    ) : (
                        <p>
                            The chart shows <strong>current month sales</strong> by delivery date. Switch to comparison mode to see how this month stacks up against last month’s sales data.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesTable;
