"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { supabase } from "@/utils/supabase";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig, } from "@/components/ui/chart";

interface FB {
    id: number;
    quotation_amount?: number;
    quotation_number?: string;
    remarks?: string;
    date_created: string;
    date_updated?: string;
    company_name?: string;
    contact_number?: string;
    contact_person: string;
    source: string;
    status: string;
}

interface FBProps {
    referenceid: string;
    target_quota?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

const PAGE_SIZE = 10;

export const FBTable: React.FC<FBProps> = ({
    referenceid,
    target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<FB[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Pagination state
    const [page, setPage] = useState(1);

    // Fetch activities
    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        const url = new URL("/api/reports/tsa/fetch", window.location.origin);
        url.searchParams.append("referenceid", referenceid);
        if (from && to) {
            url.searchParams.append("from", from);
            url.searchParams.append("to", to);
        }

        fetch(url.toString())
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [referenceid, dateCreatedFilterRange]);

    // Real-time subscription using Supabase
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
                    const newRecord = payload.new as FB;
                    const oldRecord = payload.old as FB;

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

    // Filter logic
    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();

        return activities
            // TYPE CLIENT FILTER
            .filter((item) =>
                ["facebook marketplace"].includes(
                    item.source?.toLowerCase() ?? ""
                )
            )

            // SEARCH FILTER
            .filter((item) => {
                if (!search) return true;
                return (
                    (item.company_name?.toLowerCase().includes(search) ?? false) ||
                    (item.quotation_number?.toLowerCase().includes(search) ?? false) ||
                    (item.remarks?.toLowerCase().includes(search) ?? false)
                );
            })

            // STATUS FILTER
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                return true;
            })

            // DATE CREATED FILTER
            .filter((item) => {
                if (
                    !dateCreatedFilterRange ||
                    (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)
                ) {
                    return true;
                }

                const updatedDate = item.date_created
                    ? new Date(item.date_created)
                    : new Date(item.date_created);

                if (isNaN(updatedDate.getTime())) return false;

                const fromDate = dateCreatedFilterRange.from
                    ? new Date(dateCreatedFilterRange.from)
                    : null;
                const toDate = dateCreatedFilterRange.to
                    ? new Date(dateCreatedFilterRange.to)
                    : null;

                const isSameDay = (d1: Date, d2: Date) =>
                    d1.getFullYear() === d2.getFullYear() &&
                    d1.getMonth() === d2.getMonth() &&
                    d1.getDate() === d2.getDate();

                if (fromDate && toDate && isSameDay(fromDate, toDate)) {
                    return isSameDay(updatedDate, fromDate);
                }

                if (fromDate && updatedDate < fromDate) return false;
                if (toDate && updatedDate > toDate) return false;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_updated ?? a.date_created).getTime();
                const dateB = new Date(b.date_updated ?? b.date_created).getTime();
                return dateB - dateA; // descending: newest first
            });

    }, [activities, searchTerm, filterStatus, dateCreatedFilterRange]);

    // Calculate totals for footer (for filteredActivities, not paginated subset)
    const totalQuotationAmount = useMemo(() => {
        return filteredActivities.reduce((acc, item) => acc + (item.quotation_amount ?? 0), 0);
    }, [filteredActivities]);

    // Count unique quotation_number (non-null)
    const uniqueQuotationCount = useMemo(() => {
        const uniqueSet = new Set<string>();
        filteredActivities.forEach((item) => {
            if (item.quotation_number) uniqueSet.add(item.quotation_number);
        });
        return uniqueSet.size;
    }, [filteredActivities]);

    // Pagination logic
    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(start, start + PAGE_SIZE);
    }, [filteredActivities, page]);

    // Reset to page 1 if filter or search changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterStatus, dateCreatedFilterRange]);

    const chartData = useMemo(() => {
        const dataByDate: Record<string, { count: number; amount: number }> = {};

        filteredActivities.forEach(({ date_created, quotation_amount }) => {
            const date = new Date(date_created).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
            if (!dataByDate[date]) {
                dataByDate[date] = { count: 0, amount: 0 };
            }
            dataByDate[date].count += 1;
            dataByDate[date].amount += quotation_amount ?? 0;
        });

        return Object.entries(dataByDate)
            .map(([date, { count, amount }]) => ({ date, count, amount }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredActivities]);

    // Chart config for colors to feed to ChartContainer
    const chartConfig = {
        count: { label: "Count", color: "var(--chart-1)" },
        amount: { label: "SO Amount", color: "var(--chart-2)" },
    } satisfies ChartConfig;

    return (
        <>
            {!error && filteredActivities.length === 0 && (
                <div className="flex justify-center items-center h-40">
                    <Alert
                        variant="destructive"
                        className="flex flex-col items-center space-y-2 p-4 text-center text-xs"
                    >
                        <AlertTitle>No Data Found</AlertTitle>
                        <AlertDescription>Please check your date range or try again later.</AlertDescription>
                    </Alert>
                </div>
            )}

            {!error && filteredActivities.length !== 0 && (
                <div className={`flex flex-col md:flex-row gap-2`}>
                    {/* Left: Area Chart */}
                    {chartData.length > 0 && (
                        <Card className="md:w-1/2 bg-white rounded-md shadow p-4">
                            <CardHeader>
                                <CardTitle>Facebook Marketplace Activities Over Time</CardTitle>
                                <CardDescription>{`Showing ${filteredActivities.length} records`}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex justify-center items-center h-40">
                                        <Spinner />
                                    </div>
                                ) : (
                                    <ChartContainer config={chartConfig}>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <AreaChart
                                                data={chartData}
                                                margin={{ left: 12, right: 12, top: 10, bottom: 0 }}
                                            >
                                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickMargin={8}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <ChartTooltip
                                                    cursor={false}
                                                    content={<ChartTooltipContent indicator="line" />}
                                                    formatter={(value: number, name: string) => {
                                                        if (name === "amount") {
                                                            return value.toLocaleString(undefined, {
                                                                style: "currency",
                                                                currency: "PHP",
                                                            });
                                                        }
                                                        return value;
                                                    }}
                                                    labelFormatter={(label) => `Date: ${label}`}
                                                />
                                                <Area
                                                    type="natural"
                                                    dataKey="count"
                                                    name="Count"
                                                    fill="var(--chart-1)"
                                                    fillOpacity={0.4}
                                                    stroke="var(--chart-1)"
                                                    strokeWidth={2}
                                                />
                                                <Area
                                                    type="natural"
                                                    dataKey="amount"
                                                    name="SI Amount"
                                                    fill="var(--chart-2)"
                                                    fillOpacity={0.4}
                                                    stroke="var(--chart-2)"
                                                    strokeWidth={2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                )}
                            </CardContent>
                            <CardFooter>
                                <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
                                    <div>
                                        Data from {chartData[0]?.date} to {chartData[chartData.length - 1]?.date}
                                    </div>
                                </div>
                            </CardFooter>
                        </Card>
                    )}

                    {/* Right: Table */}
                    <div
                        className={`${chartData.length > 1 ? "md:w-1/2" : "w-full"
                            } overflow-auto bg-white rounded-md shadow p-4`}
                    >
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <Input
                                type="text"
                                placeholder="Search..."
                                className="input input-bordered input-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Search quotations"
                            />
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px] text-xs">Date Created</TableHead>
                                    <TableHead className="text-xs text-right">Quotation Amount</TableHead>
                                    <TableHead className="text-xs">Quotation Number</TableHead>
                                    <TableHead className="text-xs">Company Name</TableHead>
                                    <TableHead className="text-xs">Contact Person</TableHead>
                                    <TableHead className="text-xs">Contact Number</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedActivities.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                                        <TableCell>{new Date(item.date_created).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            {item.quotation_amount !== undefined && item.quotation_amount !== null
                                                ? item.quotation_amount.toLocaleString(undefined, {
                                                    style: "currency",
                                                    currency: "PHP",
                                                })
                                                : "-"}
                                        </TableCell>
                                        <TableCell className="uppercase">{item.quotation_number || "-"}</TableCell>
                                        <TableCell>{item.company_name}</TableCell>
                                        <TableCell>{item.contact_person}</TableCell>
                                        <TableCell>{item.contact_number}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <tfoot>
                                <TableRow className="bg-muted font-semibold text-xs">
                                    <TableCell colSpan={1} className="text-right pr-4">
                                        Totals:
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {totalQuotationAmount.toLocaleString(undefined, {
                                            style: "currency",
                                            currency: "PHP",
                                        })}
                                    </TableCell>
                                    <TableCell colSpan={6}></TableCell>
                                </TableRow>
                            </tfoot>
                        </Table>
                        {pageCount > 1 && (
                            <Pagination>
                                <PaginationContent className="flex items-center space-x-4 justify-center mt-4 text-xs">
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (page > 1) setPage(page - 1);
                                            }}
                                            aria-disabled={page === 1}
                                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>

                                    <div className="px-4 font-medium select-none">
                                        {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
                                    </div>

                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (page < pageCount) setPage(page + 1);
                                            }}
                                            aria-disabled={page === pageCount}
                                            className={page === pageCount ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
