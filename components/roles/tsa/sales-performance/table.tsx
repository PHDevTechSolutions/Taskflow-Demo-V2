"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, Download } from "lucide-react";
import { supabase } from "@/utils/supabase";
import ExcelJS from "exceljs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Cell,
} from "recharts";

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

// Count working days (Mon–Sat, no Sundays) between two dates inclusive
const countWorkingDays = (from: Date, to: Date): number => {
    let count = 0;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
        if (cursor.getDay() !== 0) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
};

// Custom tooltip for the daily bar chart
const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    const hit = data.actualSales >= data.dailyQuota;

    return (
        <div className="bg-white border border-gray-200 rounded-none shadow-md p-3 text-xs min-w-[200px]">
            <p className="font-bold text-gray-700 mb-2">{label}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-gray-500">Daily Quota</span>
                <span className="font-semibold text-right">
                    {data.dailyQuota.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </span>
                <span className="text-gray-500">Actual Sales</span>
                <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>
                    {data.actualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </span>
                <span className="text-gray-500">Variance</span>
                <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>
                    {(data.actualSales - data.dailyQuota).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </span>
            </div>
            <p className={`text-xs font-bold mt-2 ${hit ? "text-green-600" : "text-red-500"}`}>
                {hit ? "✓ Hit" : "✗ Missed"}
            </p>
        </div>
    );
};

export const SalesTable: React.FC<SalesProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Sales[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    // Working days dropdown: 26 (Mon–Sat) or 22 (Mon–Fri)
    const [totalWorkingDays, setTotalWorkingDays] = useState<26 | 22>(26);

    // Fetch activities from API
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoadingActivities(true);
        setErrorActivities(null);

        const now = new Date();
        const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : defaultFrom.toISOString().slice(0, 10);
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : defaultTo.toISOString().slice(0, 10);

        const url = new URL("/api/sales-performance/tsa/fetch", window.location.origin);
        url.searchParams.append("referenceid", referenceid);
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);

        fetch(url.toString())
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid, dateCreatedFilterRange]);

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

    // Resolve date range (default = current month)
    const { fromDate, toDate } = useMemo(() => {
        let from: Date;
        let to: Date;

        if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
            from = new Date(dateCreatedFilterRange.from);
            to = new Date(dateCreatedFilterRange.to);
        } else {
            const now = new Date();
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return { fromDate: from, toDate: to };
    }, [dateCreatedFilterRange]);

    const hasDateRange = !!(dateCreatedFilterRange?.from && dateCreatedFilterRange?.to);

    // Working days elapsed within the selected range (up to today)
    const workingDaysSoFar = useMemo(() => {
        const rangeEnd = toDate < new Date() ? toDate : new Date();
        if (fromDate > rangeEnd) return 0;
        return countWorkingDays(fromDate, rangeEnd);
    }, [fromDate, toDate]);

    // When no date filter: use full working days for par/quota (full month context)
    const effectiveElapsedDays = hasDateRange ? workingDaysSoFar : totalWorkingDays;

    // Full month quota as number
    const fullMonthQuota = useMemo(() => {
        const parsed = parseFloat((target_quota ?? "0").replace(/[^0-9.-]+/g, ""));
        return isNaN(parsed) ? 0 : parsed;
    }, [target_quota]);

    // Pro-rated quota based on date range
    const proratedQuota = useMemo(() => {
        if (!hasDateRange) return fullMonthQuota;
        return (fullMonthQuota / totalWorkingDays) * workingDaysSoFar;
    }, [fullMonthQuota, hasDateRange, totalWorkingDays, workingDaysSoFar]);

    // Filter activities to selected date range
    const filteredActivities = useMemo(() => {
        const fromTime = fromDate.getTime();
        const toTime = toDate.getTime();

        return activities.filter((activity) => {
            if (!activity.delivery_date) return false;
            const t = new Date(activity.delivery_date).getTime();
            return t >= fromTime && t <= toTime;
        });
    }, [activities, fromDate, toDate]);

    // Group by date and sum
    const groupedSales = useMemo(() => {
        const grouped: { [date: string]: number } = {};
        filteredActivities.forEach((item) => {
            if (!item.delivery_date) return;
            grouped[item.delivery_date] = (grouped[item.delivery_date] ?? 0) + (item.actual_sales ?? 0);
        });
        return grouped;
    }, [filteredActivities]);

    const totalActualSales = useMemo(
        () => Object.values(groupedSales).reduce((a, b) => a + b, 0),
        [groupedSales]
    );

    const variance = useMemo(() => proratedQuota - totalActualSales, [proratedQuota, totalActualSales]);

    const achievement = useMemo(() => {
        if (proratedQuota === 0) return 0;
        return (totalActualSales / proratedQuota) * 100;
    }, [totalActualSales, proratedQuota]);

    const parPercentage = (effectiveElapsedDays / totalWorkingDays) * 100;
    const percentToPlan = Math.round(achievement);

    // Build daily chart data
    const dailyChartData = useMemo(() => {
        const days: { date: string; actualSales: number; dailyQuota: number }[] = [];
        const cursor = new Date(fromDate);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        const dailyQuota = fullMonthQuota / totalWorkingDays;

        const toLocalDateStr = (d: Date) => {
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        while (cursor <= end) {
            if (cursor.getDay() !== 0) {
                const dateStr = toLocalDateStr(cursor);
                const label = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });

                const dayTotal = activities
                    .filter((a) => {
                        if (!a.delivery_date) return false;
                        return toLocalDateStr(new Date(a.delivery_date)) === dateStr;
                    })
                    .reduce((sum, a) => sum + (a.actual_sales ?? 0), 0);

                days.push({
                    date: label,
                    actualSales: dayTotal,
                    dailyQuota: Math.round(dailyQuota),
                });
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        return days;
    }, [fromDate, toDate, activities, fullMonthQuota, totalWorkingDays]);

    /* ---- Excel Export ---- */
    const exportToExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Sales Performance");

            // Add Metrics Table
            worksheet.addRow(["Sales Metrics Report"]).font = { bold: true, size: 14 };
            worksheet.addRow([`Period: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`]);
            worksheet.addRow([]);

            worksheet.columns = [
                { header: "Metric", key: "metric", width: 35 },
                { header: "Value", key: "value", width: 20 }
            ];

            // Style headers
            worksheet.getRow(4).font = { bold: true };
            worksheet.getRow(4).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            const metrics = [
                { metric: `Target Quota ${hasDateRange ? "(Pro-rated)" : ""}`, value: proratedQuota },
                { metric: "Total Actual Sales", value: totalActualSales },
                { metric: "Variance", value: variance },
                { metric: "Par (%)", value: parPercentage / 100 },
                { metric: "% To Plan", value: percentToPlan / 100 }
            ];

            metrics.forEach(m => worksheet.addRow(itemToRow(m)));

            // Format values
            worksheet.getColumn('value').eachCell((cell, rowNumber) => {
                if (rowNumber > 4) {
                    if (rowNumber <= 7) {
                        cell.numFmt = '#,##0.00" ₱"';
                    } else {
                        cell.numFmt = '0.00%';
                    }
                }
            });

            // Add Daily Trend Data
            worksheet.addRow([]);
            worksheet.addRow(["Daily Sales Trend"]).font = { bold: true, size: 12 };
            const trendHeaderRow = worksheet.addRow(["Date", "Actual Sales", "Daily Quota", "Status"]);
            trendHeaderRow.font = { bold: true };
            trendHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            dailyChartData.forEach(day => {
                worksheet.addRow([
                    day.date,
                    day.actualSales,
                    day.dailyQuota,
                    day.actualSales >= day.dailyQuota ? "Hit" : "Missed"
                ]);
            });

            // Format daily trend sales
            const lastRow = worksheet.lastRow?.number || 0;
            const startTrendRow = lastRow - dailyChartData.length + 1;
            for (let i = startTrendRow; i <= lastRow; i++) {
                worksheet.getCell(`B${i}`).numFmt = '#,##0.00" ₱"';
                worksheet.getCell(`C${i}`).numFmt = '#,##0.00" ₱"';
            }

            // Filename
            let filename = "TSA_Sales_Performance";
            if (hasDateRange) {
                const fromStr = fromDate.toLocaleDateString().replace(/\//g, '-');
                const toStr = toDate.toLocaleDateString().replace(/\//g, '-');
                filename += `_${fromStr}_to_${toStr}`;
            }
            filename += ".xlsx";

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error exporting to Excel:", error);
            alert("Failed to export data to Excel");
        }
    };

    const itemToRow = (item: any) => [item.metric, item.value];

    if (loadingActivities) {
        return (
            <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
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
        <div className="space-y-6 text-black">

            {/* Working Days Selector + Info */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                    <Select
                        value={String(totalWorkingDays)}
                        onValueChange={(val) => setTotalWorkingDays(Number(val) as 26 | 22)}
                    >
                        <SelectTrigger className="w-[200px] text-xs rounded-none">
                            <SelectValue placeholder="Working Days" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="26">26 Working Days (Mon–Sat)</SelectItem>
                            <SelectItem value="22">22 Working Days (Mon–Fri)</SelectItem>
                        </SelectContent>
                    </Select>

                    <span className="text-xs text-gray-500">
                        Days elapsed: <strong>{workingDaysSoFar}</strong> / {totalWorkingDays}
                        &nbsp;|&nbsp;
                        Par: <strong>{parPercentage.toFixed(1)}%</strong>
                    </span>
                </div>

                {/*<button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors"
                >
                    <Download size={14} />
                    Export Excel
                </button>*/}
                
            </div>

            {/* Sales Metrics Table */}
            <div className="rounded-none border p-4 bg-white shadow-sm">
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
                            <TableCell>Target Quota {hasDateRange ? "(Pro-rated)" : ""}</TableCell>
                            <TableCell className="text-right">
                                {proratedQuota.toLocaleString(undefined, {
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
                            <TableCell className={`text-right ${variance > 0 ? "text-red-600" : "text-green-600"}`}>
                                {variance.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: "PHP",
                                })}
                            </TableCell>
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

            {/* Daily Sales Trend Chart */}
            <div className="rounded-none border p-4 bg-white shadow-sm">
                <h2 className="font-semibold text-sm mb-1">Daily Sales Trend</h2>
                <p className="text-xs text-gray-400 mb-4">
                    Bar shows actual sales per working day vs. daily quota target (dashed line).
                    <span className="ml-2 inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-none bg-green-500"></span> Hit
                        <span className="inline-block w-3 h-3 rounded-none bg-red-400 ml-2"></span> Missed
                    </span>
                </p>
                {dailyChartData.length === 0 ? (
                    <div className="text-center text-xs text-gray-400 py-8">No data for selected range</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={dailyChartData} margin={{ top: 8, right: 16, left: 16, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                angle={-45}
                                textAnchor="end"
                                interval={0}
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                tickFormatter={(v) =>
                                    v >= 1_000_000
                                        ? `₱${(v / 1_000_000).toFixed(1)}M`
                                        : v >= 1_000
                                            ? `₱${(v / 1_000).toFixed(0)}K`
                                            : `₱${v}`
                                }
                            />
                            <Tooltip content={<CustomDailyTooltip />} />
                            <ReferenceLine
                                y={dailyChartData[0]?.dailyQuota ?? 0}
                                stroke="#6366f1"
                                strokeDasharray="5 4"
                                strokeWidth={1.5}
                                label={{
                                    value: "Daily Quota",
                                    position: "insideTopRight",
                                    fontSize: 10,
                                    fill: "#6366f1",
                                }}
                            />
                            <Bar dataKey="actualSales" radius={[3, 3, 0, 0]} maxBarSize={40}>
                                {dailyChartData.map((entry, index) => (
                                    <Cell
                                        key={index}
                                        fill={entry.actualSales >= entry.dailyQuota ? "#22c55e" : "#f87171"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Computation Explanation */}
            <div className="rounded-none border p-4 bg-white shadow-sm">
                <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
                <div className="text-xs space-y-3 text-gray-700">
                    <p>
                        <strong>Target Quota (Pro-rated):</strong> When a date range is selected, the full month quota
                        is adjusted based on working days elapsed vs. the total working days standard.
                        <br />
                        <code>Pro-rated Quota = (Full Month Quota / Total Working Days) × Working Days Elapsed</code>
                    </p>
                    <p>
                        <strong>Achievement:</strong> Actual sales as a percentage of the (pro-rated) target quota.
                        <br />
                        <code>Achievement = (Total Actual Sales / Target Quota) × 100%</code>
                    </p>
                    <p>
                        <strong>Par:</strong> Expected progress benchmark based on working days elapsed vs. total working days.
                        <br />
                        <code>Par = (Working Days Elapsed / Total Working Days) × 100%</code>
                    </p>
                    <p>
                        <strong>Variance:</strong> Gap between the target quota and actual sales.
                        Positive (red) = below target; negative (green) = above target.
                        <br />
                        <code>Variance = Target Quota − Total Actual Sales</code>
                    </p>
                    <p>
                        <strong>% To Plan:</strong> Rounded achievement percentage showing how close actual sales are to the target.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SalesTable;