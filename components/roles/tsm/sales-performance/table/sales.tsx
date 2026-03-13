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
  TableFooter,
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
  so_amount?: number;
  delivery_date?: string;
  target_quota: string;
  referenceid: string;
  agentName?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  Role: string;
  TargetQuota: string;
}

interface SalesProps {
  referenceid: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

// Count working days (Mon–Sat, no Sundays) between two dates inclusive
const countWorkingDays = (from: Date, to: Date): number => {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    if (cursor.getDay() !== 0) count++; // exclude Sunday
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

// Custom tooltip showing per-agent breakdown
const CustomDailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  const hit = data.actualSales >= data.dailyQuota;

  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-xs min-w-[220px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>

      {/* Overall summary */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1">
        <span className="text-gray-500">Daily Quota</span>
        <span className="font-semibold text-right">
          {data.dailyQuota.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
        </span>
        <span className="text-gray-500">Total Sales</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>
          {data.actualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
        </span>
        <span className="text-gray-500">Variance</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>
          {(data.actualSales - data.dailyQuota).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
        </span>
      </div>
      <p className={`text-xs font-bold mb-2 ${hit ? "text-green-600" : "text-red-500"}`}>
        {hit ? "✓ Hit" : "✗ Missed"}
      </p>
      {data.agentsBreakdown?.length > 0 && (
        <>
          <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1">
            Agent Breakdown
          </p>
          <div className="space-y-1.5">
            {data.agentsBreakdown
              .sort((a: any, b: any) => b.sales - a.sales)
              .map((agent: any, i: number) => (
                <div key={i} className="flex flex-col gap-0.5 border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                  <div className="flex justify-between gap-4 items-center">
                    <span className="capitalize text-gray-700 font-semibold">{agent.name}</span>
                    <span className={`text-xs font-bold ${agent.hit ? "text-green-600" : "text-red-500"}`}>
                      {agent.hit ? "✓ Hit" : "✗ Missed"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                    <span>Quota</span>
                    <span className="font-medium text-gray-600 text-right">
                      {agent.dailyQuota.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                    </span>
                    <span>Sales</span>
                    <span className={`font-medium text-right ${agent.hit ? "text-green-600" : "text-red-500"}`}>
                      {agent.sales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                    </span>
                    <span>Variance</span>
                    <span className={`font-medium text-right ${agent.hit ? "text-green-600" : "text-red-500"}`}>
                      {(agent.sales - agent.dailyQuota).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

export const SalesTable: React.FC<SalesProps> = ({
  referenceid,
  userDetails,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Sales[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

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

    // Always send from/to — default to current month when no date filter
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : defaultFrom.toISOString().slice(0, 10);
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : defaultTo.toISOString().slice(0, 10);

    const url = new URL(
      "/api/sales-performance/tsm/fetch",
      window.location.origin
    );
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
      .channel(`public:history:manager=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `manager=eq.${referenceid}`,
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
                return curr.map((a) =>
                  a.id === newRecord.id ? newRecord : a
                );
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

  // Fetch agents (TSAs)
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-all-user?id=${encodeURIComponent(
            userDetails.referenceid
          )}`
        );
        if (!response.ok) throw new Error("Failed to fetch agents");
        const data = await response.json();
        setAgents(data);
      } catch (err) {
        console.error("Error fetching agents:", err);
        setErrorActivities("Failed to load agents.");
      }
    };

    fetchAgents();
  }, [userDetails.referenceid]);

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

  // Working days elapsed within the selected date range (up to today)
  const workingDaysSoFar = useMemo(() => {
    const rangeEnd = toDate < new Date() ? toDate : new Date();
    if (fromDate > rangeEnd) return 0;
    return countWorkingDays(fromDate, rangeEnd);
  }, [fromDate, toDate]);

  // Pro-rated target quota based on date range
  // If no date range is selected, return the full month quota as-is
  const hasDateRange = !!(dateCreatedFilterRange?.from && dateCreatedFilterRange?.to);

  // When no date filter: elapsed = full working days (show full month context)
  // When date filter: elapsed = actual days so far within range
  const effectiveElapsedDays = hasDateRange ? workingDaysSoFar : totalWorkingDays;

  const getProratedQuota = (fullQuota: number) => {
    if (!hasDateRange) return fullQuota;
    return (fullQuota / totalWorkingDays) * workingDaysSoFar;
  };

  // Filter activities by resolved date range
  const filteredActivitiesByDate = useMemo(() => {
    const fromTime = fromDate.getTime();
    const toTime = toDate.getTime();

    return activities.filter((activity) => {
      if (!activity.delivery_date) return false;
      const t = new Date(activity.delivery_date).getTime();
      return t >= fromTime && t <= toTime;
    });
  }, [activities, fromDate, toDate]);

  // Group activities by agent ReferenceID
  const activitiesByAgent = useMemo(() => {
    const map: Record<string, Sales[]> = {};
    filteredActivitiesByDate.forEach((activity) => {
      const key = activity.referenceid;
      if (!map[key]) map[key] = [];
      map[key].push(activity);
    });
    return map;
  }, [filteredActivitiesByDate]);

  // Compute sales metrics per agent
  const salesDataPerAgent = useMemo(() => {
    return agents
      .filter((a) => a.Role === "Territory Sales Associate")
      .map((agent) => {
        const agentId = agent.ReferenceID;
        const sales = activitiesByAgent[agentId] || [];

        const totalActualSales = sales.reduce(
          (sum, s) => sum + (s.actual_sales ?? 0),
          0
        );

        // so_amount: sum of all so_amount entries
        const totalSoAmount = sales.reduce(
          (sum, s) => sum + (s.so_amount ?? 0),
          0
        );

        const fullMonthQuota =
          parseFloat(
            (agent.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")
          ) || 0;

        // Dynamic pro-rated target quota
        const proratedQuota = getProratedQuota(fullMonthQuota);

        const variance = proratedQuota - totalActualSales;
        const achievement =
          proratedQuota === 0
            ? 0
            : (totalActualSales / proratedQuota) * 100;

        // Par: when no date filter use full month (effectiveElapsedDays = totalWorkingDays = 100%)
        const parPercentage = (effectiveElapsedDays / totalWorkingDays) * 100;

        const percentToPlan = Math.round(achievement);

        return {
          agentId,
          totalActualSales,
          totalSoAmount,
          fullMonthQuota,
          proratedQuota,
          variance,
          achievement,
          parPercentage,
          percentToPlan,
        };
      });
  }, [agents, activitiesByAgent, totalWorkingDays, workingDaysSoFar, effectiveElapsedDays]);


  // Filter by selected agent
  const filteredSalesData = useMemo(() => {
    if (selectedAgent === "all") return salesDataPerAgent;
    return salesDataPerAgent.filter(
      (d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()
    );
  }, [salesDataPerAgent, selectedAgent]);

  // Column totals for tfoot
  const columnTotals = useMemo(() => {
    return filteredSalesData.reduce(
      (acc, d) => ({
        proratedQuota: acc.proratedQuota + d.proratedQuota,
        totalSoAmount: acc.totalSoAmount + d.totalSoAmount,
        totalActualSales: acc.totalActualSales + d.totalActualSales,
        variance: acc.variance + d.variance,
      }),
      { proratedQuota: 0, totalSoAmount: 0, totalActualSales: 0, variance: 0 }
    );
  }, [filteredSalesData]);


  // Build per-day chart data with per-agent breakdown for tooltip
  const dailyChartData = useMemo(() => {
    const days: Record<string, any>[] = [];
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const totalFullQuota = filteredSalesData.reduce(
      (sum, d) => sum + d.fullMonthQuota,
      0
    );
    const dailyQuota = totalFullQuota / totalWorkingDays;

    // Build agent name + daily quota lookup from ALL agents (not filtered)
    // so tooltip shows correct quota regardless of agent filter
    const agentNameMap: Record<string, string> = {};
    const agentDailyQuotaMap: Record<string, number> = {};
    salesDataPerAgent.forEach((d) => {
      const agent = agents.find(
        (a) => a.ReferenceID.toLowerCase() === d.agentId.toLowerCase()
      );
      const key = d.agentId.toLowerCase();
      agentNameMap[key] = agent
        ? `${agent.Firstname} ${agent.Lastname}`
        : d.agentId;
      agentDailyQuotaMap[key] = d.fullMonthQuota / totalWorkingDays;
    });

    // Helper: format local date as YYYY-MM-DD without UTC conversion
    const toLocalDateStr = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0) {
        const dateStr = toLocalDateStr(cursor);
        const label = cursor.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        });

        // Per-agent sales for this day
        const agentSalesMap: Record<string, number> = {};
        let dayTotal = 0;

        // Use all activities (not just filteredActivitiesByDate) so chart works
        // even when API returns data outside the delivery_date range
        activities
          .filter((a) => {
            if (!a.delivery_date) return false;
            if (
              selectedAgent !== "all" &&
              a.referenceid.toLowerCase() !== selectedAgent.toLowerCase()
            )
              return false;
            // Normalize delivery_date to local YYYY-MM-DD for comparison
            const deliveryLocal = toLocalDateStr(new Date(a.delivery_date));
            return deliveryLocal === dateStr;
          })
          .forEach((a) => {
            const key = a.referenceid.toLowerCase();
            agentSalesMap[key] = (agentSalesMap[key] ?? 0) + (a.actual_sales ?? 0);
            dayTotal += a.actual_sales ?? 0;
          });

        // Build agents breakdown array for tooltip with individual quota
        const agentsBreakdown = Object.entries(agentSalesMap).map(
          ([refId, sales]) => {
            const agentDailyQuota = agentDailyQuotaMap[refId] ?? 0;
            return {
              name: agentNameMap[refId] || refId,
              sales,
              dailyQuota: Math.round(agentDailyQuota),
              hit: sales >= agentDailyQuota,
            };
          }
        );

        days.push({
          date: label,
          actualSales: dayTotal,
          dailyQuota: Math.round(dailyQuota),
          agentsBreakdown,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [fromDate, toDate, activities, salesDataPerAgent, filteredSalesData, totalWorkingDays, selectedAgent, agents]);

  if (loadingActivities) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (errorActivities) {
    return (
      <Alert
        variant="destructive"
        className="flex items-center space-x-3 p-4 text-xs"
      >
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
      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Agent Filter */}
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[220px] text-xs">
            <SelectValue placeholder="Filter by Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents
              .filter((a) => a.Role === "Territory Sales Associate")
              .map((agent) => (
                <SelectItem
                  className="capitalize"
                  key={agent.ReferenceID}
                  value={agent.ReferenceID}
                >
                  {agent.Firstname} {agent.Lastname}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Working Days Dropdown */}
        <Select
          value={String(totalWorkingDays)}
          onValueChange={(val) =>
            setTotalWorkingDays(Number(val) as 26 | 22)
          }
        >
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="Working Days" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="26">26 Working Days (Mon–Sat)</SelectItem>
            <SelectItem value="22">22 Working Days (Mon–Fri)</SelectItem>
          </SelectContent>
        </Select>

        {/* Info chip */}
        <span className="text-xs text-gray-500">
          Days elapsed:{" "}
          <strong>{workingDaysSoFar}</strong> / {totalWorkingDays} &nbsp;|&nbsp;
          Par: <strong>{((effectiveElapsedDays / totalWorkingDays) * 100).toFixed(1)}%</strong>
        </span>
      </div>

      {/* Sales Metrics Table */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Sales Metrics</h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Agent</TableHead>
              <TableHead className="text-xs">Target Quota</TableHead>
              <TableHead className="text-xs">SO Amount</TableHead>
              <TableHead className="text-xs text-right">
                Total Sales Invoice
              </TableHead>
              <TableHead className="text-xs">Variance</TableHead>
              <TableHead className="text-xs">Achievement</TableHead>
              <TableHead className="text-xs">Par</TableHead>
              <TableHead className="text-xs">% To Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalesData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-xs text-gray-400 py-8"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              filteredSalesData.map(
                ({
                  agentId,
                  totalActualSales,
                  totalSoAmount,
                  proratedQuota,
                  variance,
                  achievement,
                  parPercentage,
                  percentToPlan,
                }) => {
                  const agent = agents.find(
                    (a) =>
                      a.ReferenceID.toLowerCase() === agentId.toLowerCase()
                  );
                  const agentName = agent
                    ? `${agent.Firstname} ${agent.Lastname}`
                    : agentId;

                  return (
                    <TableRow
                      key={agentId}
                      className="hover:bg-muted/30 text-xs"
                    >
                      <TableCell className="capitalize">{agentName}</TableCell>
                      {/* Pro-rated target quota */}
                      <TableCell>
                        {proratedQuota.toLocaleString(undefined, {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </TableCell>
                      {/* SO Amount */}
                      <TableCell>
                        {totalSoAmount.toLocaleString(undefined, {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalActualSales.toLocaleString(undefined, {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </TableCell>
                      <TableCell
                        className={
                          variance > 0
                            ? "text-red-500 uppercase"
                            : "text-green-600 uppercase"
                        }
                      >
                        {variance.toLocaleString(undefined, {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </TableCell>
                      <TableCell>{achievement.toFixed(2)}%</TableCell>
                      <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                      <TableCell>{percentToPlan}%</TableCell>
                    </TableRow>
                  );
                }
              )
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50 font-semibold text-xs">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs">
                {columnTotals.proratedQuota.toLocaleString(undefined, {
                  style: "currency",
                  currency: "PHP",
                })}
              </TableCell>
              <TableCell className="text-xs">
                {columnTotals.totalSoAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "PHP",
                })}
              </TableCell>
              <TableCell className="text-xs text-right">
                {columnTotals.totalActualSales.toLocaleString(undefined, {
                  style: "currency",
                  currency: "PHP",
                })}
              </TableCell>
              <TableCell
                className={
                  columnTotals.variance > 0
                    ? "text-xs text-red-500"
                    : "text-xs text-green-600"
                }
              >
                {columnTotals.variance.toLocaleString(undefined, {
                  style: "currency",
                  currency: "PHP",
                })}
              </TableCell>
              <TableCell className="text-xs">—</TableCell>
              <TableCell className="text-xs">—</TableCell>
              <TableCell className="text-xs">—</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>


      {/* Daily Sales Trend Chart */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-1">Daily Sales Trend</h2>
        <p className="text-xs text-gray-400 mb-4">
          Bar shows actual sales per working day vs. daily quota target (dashed line).
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-500"></span> Hit
            <span className="inline-block w-3 h-3 rounded-sm bg-red-400 ml-2"></span> Missed
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
                  v >= 1000000
                    ? `₱${(v / 1000000).toFixed(1)}M`
                    : v >= 1000
                    ? `₱${(v / 1000).toFixed(0)}K`
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

      {/* Computation Explanation Card */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
        <div className="text-xs space-y-3 text-gray-700">
          <p>
            <strong>Target Quota (Pro-rated):</strong> The full month quota is
            adjusted based on the selected working days standard and how many
            working days have elapsed in the selected date range.
            <br />
            <code>
              Pro-rated Quota = (Full Month Quota / Total Working Days) ×
              Working Days Elapsed
            </code>
          </p>
          <p>
            <strong>SO Amount:</strong> The total sum of all Sales Order amounts
            within the selected date range for the agent.
          </p>
          <p>
            <strong>Achievement:</strong> Actual sales as a percentage of the
            pro-rated target quota.
            <br />
            <code>
              Achievement = (Total Actual Sales / Pro-rated Quota) × 100%
            </code>
          </p>
          <p>
            <strong>Par:</strong> The expected progress benchmark based on
            working days elapsed versus the total working days standard (26 or
            22).
            <br />
            <code>
              Par = (Working Days Elapsed / Total Working Days) × 100%
            </code>
          </p>
          <p>
            <strong>Variance:</strong> The gap between the pro-rated quota and
            actual sales. Positive (red) means below target; negative (green)
            means above target.
            <br />
            <code>Variance = Pro-rated Quota − Total Actual Sales</code>
          </p>
          <p>
            <strong>% To Plan:</strong> The rounded achievement percentage
            showing how close actual sales are to the pro-rated target.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesTable;