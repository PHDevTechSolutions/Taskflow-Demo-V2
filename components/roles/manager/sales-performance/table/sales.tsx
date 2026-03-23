"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft } from "lucide-react";
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
import { Button } from "@/components/ui/button";


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
  TSM?: string;
}

interface SalesProps {
  referenceid: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

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

const CustomDailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  const hit = data.actualSales >= data.dailyQuota;

  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-xs min-w-[220px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
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
  const [totalWorkingDays, setTotalWorkingDays] = useState<26 | 22>(26);

  // ─── Drill-down: null = TSM view, string = selected TSM id ───────────────
  const [selectedTSMId, setSelectedTSMId] = useState<string | null>(null);
  const [selectedTSMName, setSelectedTSMName] = useState<string>("");

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
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

    const url = new URL("/api/sales-performance/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    url.searchParams.append("from", from);
    url.searchParams.append("to", to);

    fetch(url.toString())
      .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:manager=eq.${referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Sales;
          const oldRecord = payload.old as Sales;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT": return curr.some((a) => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE": return curr.map((a) => a.id === newRecord.id ? newRecord : a);
              case "DELETE": return curr.filter((a) => a.id !== oldRecord.id);
              default: return curr;
            }
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch agents");
        setAgents(await response.json());
      } catch (err) {
        console.error("Error fetching agents:", err);
        setErrorActivities("Failed to load agents.");
      }
    };
    fetchAgents();
  }, [userDetails.referenceid]);

  const { fromDate, toDate } = useMemo(() => {
    let from: Date, to: Date;
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

  const workingDaysSoFar = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const rangeEnd = toDate < today ? toDate : today;
    if (fromDate > rangeEnd) return 0;
    return countWorkingDays(fromDate, rangeEnd);
  }, [fromDate, toDate]);

  const parPercentage = (workingDaysSoFar / totalWorkingDays) * 100;
  const getProratedQuota = (fullQuota: number) =>
    (fullQuota / totalWorkingDays) * workingDaysSoFar;

  const filteredActivitiesByDate = useMemo(() => {
    const fromTime = fromDate.getTime();
    const toTime = toDate.getTime();
    return activities.filter((a) => {
      if (!a.delivery_date) return false;
      const t = new Date(a.delivery_date).getTime();
      return t >= fromTime && t <= toTime;
    });
  }, [activities, fromDate, toDate]);

  const activitiesByAgent = useMemo(() => {
    const map: Record<string, Sales[]> = {};
    filteredActivitiesByDate.forEach((a) => {
      if (!map[a.referenceid]) map[a.referenceid] = [];
      map[a.referenceid].push(a);
    });
    return map;
  }, [filteredActivitiesByDate]);

  // ─── Agent metrics ────────────────────────────────────────────────────────
  const salesDataPerAgent = useMemo(() => {
    return agents
      .filter((a) => a.Role === "Territory Sales Associate")
      .map((agent) => {
        const agentId = agent.ReferenceID;
        const sales = activitiesByAgent[agentId] || [];
        const totalActualSales = sales.reduce((sum, s) => sum + (s.actual_sales ?? 0), 0);
        const totalSoAmount = sales.reduce((sum, s) => sum + (s.so_amount ?? 0), 0);
        const fullMonthQuota = parseFloat((agent.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const proratedQuota = getProratedQuota(fullMonthQuota);
        const variance = proratedQuota - totalActualSales;
        const achievement = proratedQuota === 0 ? 0 : (totalActualSales / proratedQuota) * 100;
        return {
          agentId,
          tsmId: (agent.TSM ?? "").toLowerCase(),
          totalActualSales,
          totalSoAmount,
          fullMonthQuota,
          proratedQuota,
          variance,
          achievement,
          parPercentage,
          percentToPlan: Math.round(achievement),
        };
      });
  }, [agents, activitiesByAgent, totalWorkingDays, workingDaysSoFar]);

  // ─── TSM metrics ──────────────────────────────────────────────────────────
  const salesDataPerTSM = useMemo(() => {
    return agents
      .filter((a) => a.Role === "Territory Sales Manager")
      .map((tsm) => {
        const tsmId = tsm.ReferenceID.toLowerCase();
        const agentsUnder = salesDataPerAgent.filter((d) => d.tsmId === tsmId);
        const totalProratedQuota = agentsUnder.reduce((sum, d) => sum + d.proratedQuota, 0);
        const totalActualSales = agentsUnder.reduce((sum, d) => sum + d.totalActualSales, 0);
        const totalVariance = totalProratedQuota - totalActualSales;
        const achievement = totalProratedQuota === 0 ? 0 : (totalActualSales / totalProratedQuota) * 100;
        return {
          tsmId,
          tsmName: `${tsm.Firstname} ${tsm.Lastname}`,
          totalProratedQuota,
          totalActualSales,
          totalVariance,
          parPercentage,
          percentToPlan: Math.round(achievement),
        };
      });
  }, [agents, salesDataPerAgent, parPercentage]);

  // ─── Drill-down: agents under selected TSM ────────────────────────────────
  const agentsUnderSelectedTSM = useMemo(() => {
    if (!selectedTSMId) return [];
    return salesDataPerAgent.filter((d) => d.tsmId === selectedTSMId);
  }, [salesDataPerAgent, selectedTSMId]);

  const filteredAgentDrillDown = useMemo(() => {
    if (selectedAgent === "all") return agentsUnderSelectedTSM;
    return agentsUnderSelectedTSM.filter(
      (d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()
    );
  }, [agentsUnderSelectedTSM, selectedAgent]);

  // ─── Totals ───────────────────────────────────────────────────────────────
  const tsmColumnTotals = useMemo(() => salesDataPerTSM.reduce(
    (acc, d) => ({
      totalProratedQuota: acc.totalProratedQuota + d.totalProratedQuota,
      totalActualSales: acc.totalActualSales + d.totalActualSales,
      totalVariance: acc.totalVariance + d.totalVariance,
    }),
    { totalProratedQuota: 0, totalActualSales: 0, totalVariance: 0 }
  ), [salesDataPerTSM]);

  const agentDrillDownTotals = useMemo(() => filteredAgentDrillDown.reduce(
    (acc, d) => ({
      proratedQuota: acc.proratedQuota + d.proratedQuota,
      totalActualSales: acc.totalActualSales + d.totalActualSales,
      variance: acc.variance + d.variance,
    }),
    { proratedQuota: 0, totalActualSales: 0, variance: 0 }
  ), [filteredAgentDrillDown]);

  // ─── Chart: scope changes based on drill-down state ───────────────────────
  const chartAgents = selectedTSMId ? agentsUnderSelectedTSM : salesDataPerAgent;

  const dailyChartData = useMemo(() => {
    const days: Record<string, any>[] = [];
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const totalFullQuota = chartAgents.reduce((sum, d) => sum + d.fullMonthQuota, 0);
    const dailyQuota = totalFullQuota / totalWorkingDays;

    const agentNameMap: Record<string, string> = {};
    const agentDailyQuotaMap: Record<string, number> = {};
    chartAgents.forEach((d) => {
      const agent = agents.find((a) => a.ReferenceID.toLowerCase() === d.agentId.toLowerCase());
      const key = d.agentId.toLowerCase();
      agentNameMap[key] = agent ? `${agent.Firstname} ${agent.Lastname}` : d.agentId;
      agentDailyQuotaMap[key] = d.fullMonthQuota / totalWorkingDays;
    });

    const toLocalDateStr = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    while (cursor <= end) {
      if (cursor.getDay() !== 0) {
        const dateStr = toLocalDateStr(cursor);
        const label = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        const agentSalesMap: Record<string, number> = {};
        let dayTotal = 0;

        activities
          .filter((a) => {
            if (!a.delivery_date) return false;
            if (selectedTSMId) {
              const agentData = salesDataPerAgent.find(
                (d) => d.agentId.toLowerCase() === a.referenceid.toLowerCase()
              );
              if (!agentData || agentData.tsmId !== selectedTSMId) return false;
            }
            if (selectedAgent !== "all" && a.referenceid.toLowerCase() !== selectedAgent.toLowerCase())
              return false;
            return toLocalDateStr(new Date(a.delivery_date)) === dateStr;
          })
          .forEach((a) => {
            const key = a.referenceid.toLowerCase();
            agentSalesMap[key] = (agentSalesMap[key] ?? 0) + (a.actual_sales ?? 0);
            dayTotal += a.actual_sales ?? 0;
          });

        const agentsBreakdown = Object.entries(agentSalesMap).map(([refId, sales]) => ({
          name: agentNameMap[refId] || refId,
          sales,
          dailyQuota: Math.round(agentDailyQuotaMap[refId] ?? 0),
          hit: sales >= (agentDailyQuotaMap[refId] ?? 0),
        }));

        days.push({ date: label, actualSales: dayTotal, dailyQuota: Math.round(dailyQuota), agentsBreakdown });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [fromDate, toDate, activities, chartAgents, salesDataPerAgent, totalWorkingDays, selectedAgent, selectedTSMId, agents]);

  if (loadingActivities) {
    return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;
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
      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Agent filter — only visible in drill-down view */}
        {selectedTSMId && (
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[220px] text-xs">
              <SelectValue placeholder="Filter by Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agentsUnderSelectedTSM.map((d) => {
                const agent = agents.find(
                  (a) => a.ReferenceID.toLowerCase() === d.agentId.toLowerCase()
                );
                return agent ? (
                  <SelectItem className="capitalize" key={agent.ReferenceID} value={agent.ReferenceID}>
                    {agent.Firstname} {agent.Lastname}
                  </SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
        )}

        <Select
          value={String(totalWorkingDays)}
          onValueChange={(val) => setTotalWorkingDays(Number(val) as 26 | 22)}
        >
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="Working Days" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="26">26 Working Days (Mon–Sat)</SelectItem>
            <SelectItem value="22">22 Working Days (Mon–Fri)</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-gray-500">
          Days elapsed: <strong>{workingDaysSoFar}</strong> / {totalWorkingDays} &nbsp;|&nbsp;
          Par: <strong>{parPercentage.toFixed(1)}%</strong>
        </span>
      </div>

      {/* ─── TSM Table (default view) ─────────────────────────────────────────── */}
      {!selectedTSMId && (
        <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
          <h2 className="font-semibold text-sm mb-4">TSM Sales Metrics</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">TSM</TableHead>
                <TableHead className="text-xs">Target Quota</TableHead>
                <TableHead className="text-xs text-right">Total Sales Invoice</TableHead>
                <TableHead className="text-xs">Variance</TableHead>
                <TableHead className="text-xs">Par</TableHead>
                <TableHead className="text-xs">% To Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesDataPerTSM.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">
                    No TSM data available
                  </TableCell>
                </TableRow>
              ) : (
                salesDataPerTSM.map(({
                  tsmId, tsmName, totalProratedQuota, totalActualSales, totalVariance, percentToPlan,
                }) => (
                  <TableRow
                    key={tsmId}
                    className="hover:bg-muted/30 text-xs cursor-pointer group"
                    onClick={() => {
                      setSelectedTSMId(tsmId);
                      setSelectedTSMName(tsmName);
                      setSelectedAgent("all");
                    }}
                  >
                    <TableCell className="capitalize font-medium text-blue-600 group-hover:underline">
                      {tsmName}
                    </TableCell>
                    <TableCell>
                      {totalProratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                    </TableCell>
                    <TableCell className={totalVariance > 0 ? "text-red-500" : "text-green-600"}>
                      {totalVariance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                    </TableCell>
                    <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                    <TableCell>{percentToPlan}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 font-semibold text-xs">
                <TableCell className="text-xs font-bold">Total</TableCell>
                <TableCell className="text-xs">
                  {tsmColumnTotals.totalProratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {tsmColumnTotals.totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className={tsmColumnTotals.totalVariance > 0 ? "text-xs text-red-500" : "text-xs text-green-600"}>
                  {tsmColumnTotals.totalVariance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className="text-xs">—</TableCell>
                <TableCell className="text-xs">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* ─── Agent Drill-down Table ───────────────────────────────────────────── */}
      {selectedTSMId && (
        <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-none flex items-center gap-1"
              onClick={() => {
                setSelectedTSMId(null);
                setSelectedTSMName("");
                setSelectedAgent("all");
              }}
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Button>
            <h2 className="font-semibold text-sm capitalize">
              {selectedTSMName} — Agent Sales Metrics
            </h2>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Target Quota</TableHead>
                <TableHead className="text-xs text-right">Total Sales Invoice</TableHead>
                <TableHead className="text-xs">Variance</TableHead>
                <TableHead className="text-xs">Par</TableHead>
                <TableHead className="text-xs">% To Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgentDrillDown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">
                    No agents found under this TSM
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgentDrillDown.map(({
                  agentId, totalActualSales, proratedQuota, variance, percentToPlan,
                }) => {
                  const agent = agents.find(
                    (a) => a.ReferenceID.toLowerCase() === agentId.toLowerCase()
                  );
                  return (
                    <TableRow key={agentId} className="hover:bg-muted/30 text-xs">
                      <TableCell className="capitalize">
                        {agent ? `${agent.Firstname} ${agent.Lastname}` : agentId}
                      </TableCell>
                      <TableCell>
                        {proratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                      </TableCell>
                      <TableCell className={variance > 0 ? "text-red-500" : "text-green-600"}>
                        {variance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                      </TableCell>
                      <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                      <TableCell>{percentToPlan}%</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 font-semibold text-xs">
                <TableCell className="text-xs font-bold">Total</TableCell>
                <TableCell className="text-xs">
                  {agentDrillDownTotals.proratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {agentDrillDownTotals.totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className={agentDrillDownTotals.variance > 0 ? "text-xs text-red-500" : "text-xs text-green-600"}>
                  {agentDrillDownTotals.variance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell className="text-xs">—</TableCell>
                <TableCell className="text-xs">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Daily Sales Trend Chart */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-1">
          Daily Sales Trend
          {selectedTSMId && (
            <span className="text-gray-400 font-normal ml-2 text-xs capitalize">
              — {selectedTSMName}
            </span>
          )}
        </h2>
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
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) =>
                  v >= 1000000 ? `₱${(v / 1000000).toFixed(1)}M`
                    : v >= 1000 ? `₱${(v / 1000).toFixed(0)}K`
                    : `₱${v}`
                }
              />
              <Tooltip content={<CustomDailyTooltip />} />
              <ReferenceLine
                y={dailyChartData[0]?.dailyQuota ?? 0}
                stroke="#6366f1"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: "Daily Quota", position: "insideTopRight", fontSize: 10, fill: "#6366f1" }}
              />
              <Bar dataKey="actualSales" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {dailyChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.actualSales >= entry.dailyQuota ? "#22c55e" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Computation Explanation */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
        <div className="text-xs space-y-3 text-gray-700">
          <p>
            <strong>Target Quota (Pro-rated):</strong> Full month quota adjusted by working days elapsed.
            <br /><code>Pro-rated Quota = (Full Month Quota / Total Working Days) × Working Days Elapsed</code>
          </p>
          <p>
            <strong>TSM Target Quota:</strong> Sum of all pro-rated quotas of TSA agents under that TSM.
          </p>
          <p>
            <strong>Achievement:</strong> Actual sales as a percentage of the pro-rated quota.
            <br /><code>Achievement = (Total Actual Sales / Pro-rated Quota) × 100%</code>
          </p>
          <p>
            <strong>Par:</strong> Expected progress benchmark based on working days elapsed.
            <br /><code>Par = (Working Days Elapsed / Total Working Days) × 100%</code>
          </p>
          <p>
            <strong>Variance:</strong> Positive (red) = below target; negative (green) = above target.
            <br /><code>Variance = Pro-rated Quota − Total Actual Sales</code>
          </p>
          <p>
            <strong>% To Plan:</strong> Rounded achievement percentage vs. pro-rated target.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesTable;