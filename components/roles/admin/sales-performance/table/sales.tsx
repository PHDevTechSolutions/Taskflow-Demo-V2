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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sales {
  id: number;
  actual_sales?: number;
  si_date?: string;
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

  // Fetch activities from API
  const fetchActivities = useCallback(() => {
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch("/api/act-fetch-admin-history")
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, []);

  useEffect(() => {
        fetchActivities();

        // Subscribe to realtime updates from Supabase (ALL history)
        const channel = supabase
            .channel("public:history")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
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
    }, [fetchActivities]);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetch("/api/fetch-admin-all-user");
                if (!response.ok) throw new Error("Failed to fetch agents");
                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error("Error fetching agents:", err);
                setErrorActivities("Failed to load agents.");
            }
        };

        fetchAgents();
    }, []);

  // Filter activities by date range only (agent filtering is handled later)
  const filteredActivitiesByDate = useMemo(() => {
    let fromDate = dateCreatedFilterRange?.from;
    let toDate = dateCreatedFilterRange?.to;

    if (!fromDate || !toDate) {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    } else {
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

  // Group activities by agent ReferenceID only (no TSM grouping or aggregation)
  const activitiesByAgent = useMemo(() => {
    const map: Record<string, Sales[]> = {};

    filteredActivitiesByDate.forEach((activity) => {
      const key = activity.referenceid;
      if (!map[key]) map[key] = [];
      map[key].push(activity);
    });

    return map;
  }, [filteredActivitiesByDate]);

  // Compute sales data per agent with target quota from Agent interface
  // Compute sales data per agent with target quota from Agent interface
  const salesDataPerAgent = useMemo(() => {
    return agents
      .filter(a => a.Role === "Territory Sales Associate") // Only TSA agents
      .map((agent) => {
        const agentId = agent.ReferenceID;
        const sales = activitiesByAgent[agentId] || []; // may empty array kung walang sales
        const totalActualSales = sales.reduce(
          (sum, s) => sum + (s.actual_sales ?? 0),
          0
        );

        const totalTargetQuota =
          parseFloat((agent.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")) || 0;

        const variance = totalTargetQuota - totalActualSales;
        const achievement =
          totalTargetQuota === 0 ? 0 : (totalActualSales / totalTargetQuota) * 100;

        return {
          agentId,
          totalActualSales,
          totalTargetQuota,
          variance,
          achievement,
        };
      });
  }, [agents, activitiesByAgent]);

  // Filter sales data for selected agent or show all
  const filteredSalesData = useMemo(() => {
    if (selectedAgent === "all") return salesDataPerAgent;
    return salesDataPerAgent.filter(
      (d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()
    );
  }, [salesDataPerAgent, selectedAgent]);

  // Working days excluding Sundays (for par)
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

      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Sales Metrics</h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Agent</TableHead>
              <TableHead className="w-[120px] text-xs">Target Quota</TableHead>
              <TableHead className="text-xs text-right">Total Sales Invoice</TableHead>
              <TableHead className="text-xs">Variance</TableHead>
              <TableHead className="text-xs">Achievement</TableHead>
              <TableHead className="text-xs">Par</TableHead>
              <TableHead className="text-xs">% To Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalesData.map(
              ({
                agentId,
                totalActualSales,
                totalTargetQuota,
                variance,
                achievement,
              }) => {
                const agent = agents.find(
                  (a) => a.ReferenceID.toLowerCase() === agentId.toLowerCase()
                );
                const agentName = agent
                  ? `${agent.Firstname} ${agent.Lastname}`
                  : agentId;
                const percentToPlan = Math.round(achievement);

                return (
                  <TableRow key={agentId} className="hover:bg-muted/30 text-xs">
                    <TableCell className="capitalize">{agentName}</TableCell>
                    <TableCell>
                      {totalTargetQuota.toLocaleString(undefined, {
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
                    <TableCell className="uppercase text-red-500">
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
            )}
          </TableBody>
        </Table>
      </div>

      {/* Computation Explanation Card */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
        <div className="text-xs space-y-3 text-gray-700">
          <p>
            <strong>Achievement:</strong> Calculated as the total actual sales
            divided by the target quota, multiplied by 100 to get a percentage.
            <br />
            <code>
              Achievement = (Total Actual Sales / Target Quota) × 100%
            </code>
          </p>
          <p>
            <strong>Par:</strong> A benchmark percentage to track progress based
            on the number of working days (Monday to Saturday) passed in the
            month, excluding Sundays.
            <br />
            It adjusts the expected progress relative to time.
            <br />
            <code>Par Percentage = (Working Days So Far / 26) × 100%</code>
          </p>
          <p>
            <strong>Variance:</strong> The difference between the target quota
            and the total actual sales.
            <br />
            <code>Variance = Target Quota - Total Actual Sales</code>
          </p>
          <p>
            <strong>% To Plan:</strong> The rounded achievement percentage,
            representing how close actual sales are to the target plan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesTable;
