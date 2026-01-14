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
  referenceid: string; // this is the TSM's referenceid
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
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    fetch(
      `/api/act-fetch-manager-history?referenceid=${encodeURIComponent(
        referenceid
      )}`
    )
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

  // Fetch agents (TSAs)
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-manager-all-user?id=${encodeURIComponent(
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

  // Group activities by agent ReferenceID (without combining target quota from sales)
  const activitiesByAgent = useMemo(() => {
    const map: Record<string, Sales[]> = {};

    filteredActivitiesByDate.forEach((activity) => {
      const key = activity.referenceid;
      if (!map[key]) map[key] = [];
      map[key].push(activity);
    });

    // Combine TSA sales for TSM (optional, depends if you want TSM aggregate row)
    const tsaAgents = agents.filter(
      (a) => a.Role === "Territory Sales Associate"
    );
    const tsmSales: Sales[] = [];
    tsaAgents.forEach((tsa) => {
      if (map[tsa.ReferenceID]) {
        tsmSales.push(...map[tsa.ReferenceID]);
      }
    });

    if (userDetails?.referenceid && tsmSales.length > 0) {
      map[userDetails.referenceid] = tsmSales;
    }

    return map;
  }, [filteredActivitiesByDate, agents, userDetails.referenceid]);

  // Compute sales data with target quota from Agent interface
  const salesDataPerAgent = useMemo(() => {
    const tsaAgents = agents.filter(
      (a) => a.Role === "Territory Sales Associate"
    );

    return Object.entries(activitiesByAgent).map(([agentId, sales]) => {
      const totalActualSales = sales.reduce(
        (sum, s) => sum + (s.actual_sales ?? 0),
        0
      );

      let totalTargetQuota = 0;

      if (agentId.toLowerCase() === userDetails.referenceid.toLowerCase()) {
        totalTargetQuota = tsaAgents.reduce((sum, tsa) => {
          return (
            sum +
            (parseFloat((tsa.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")) || 0)
          );
        }, 0);
      } else {
        const agent = agents.find(
          (a) => a.ReferenceID.toLowerCase() === agentId.toLowerCase()
        );
        totalTargetQuota = agent
          ? parseFloat((agent.TargetQuota ?? "0").replace(/[^0-9.-]+/g, "")) || 0
          : 0;
      }

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
  }, [activitiesByAgent, agents, userDetails.referenceid]);

  // Filter sales data for selected agent or show all
  const filteredSalesData = useMemo(() => {
    if (selectedAgent === "all") return salesDataPerAgent;
    return salesDataPerAgent.filter(
      (d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()
    );
  }, [salesDataPerAgent, selectedAgent]);

  // --- Group salesDataPerAgent by TSM ---

  const groupedByTSM = useMemo(() => {
    // Key: TSM ReferenceID
    // Value: { tsmName: string, agents: {agentId, agentName, salesData}[] }
    const map: Record<
      string,
      {
        tsmName: string;
        agents: {
          agentId: string;
          agentName: string;
          salesData: {
            totalActualSales: number;
            totalTargetQuota: number;
            variance: number;
            achievement: number;
          };
        }[];
      }
    > = {};

    // First create entry for TSM
    map[userDetails.referenceid] = {
      tsmName: `${userDetails.firstname} ${userDetails.lastname}`,
      agents: [],
    };

    // Filter agents with role TSA only
    const tsaAgents = agents.filter(
      (a) => a.Role === "Territory Sales Associate"
    );

    tsaAgents.forEach((agent) => {
      // Find sales for this agent
      const sales = salesDataPerAgent.find(
        (d) => d.agentId.toLowerCase() === agent.ReferenceID.toLowerCase()
      );

      map[userDetails.referenceid].agents.push({
        agentId: agent.ReferenceID,
        agentName: `${agent.Firstname} ${agent.Lastname}`,
        salesData:
          sales || {
            totalActualSales: 0,
            totalTargetQuota: 0,
            variance: 0,
            achievement: 0,
          },
      });
    });

    // Add TSM as an agent also (their own sales)
    const tsmSales = salesDataPerAgent.find(
      (d) => d.agentId.toLowerCase() === userDetails.referenceid.toLowerCase()
    );

    if (tsmSales) {
      map[userDetails.referenceid].agents.push({
        agentId: userDetails.referenceid,
        agentName: `${userDetails.firstname} ${userDetails.lastname} (TSM)`,
        salesData: tsmSales,
      });
    }

    return map;
  }, [agents, salesDataPerAgent, userDetails]);

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
          {agents.map((agent) => (
            <SelectItem
              className="capitalize"
              key={agent.ReferenceID}
              value={agent.ReferenceID}
            >
              {agent.Firstname} {agent.Lastname}
            </SelectItem>
          ))}
          {/* Add TSM option too */}
          {userDetails.referenceid && (
            <SelectItem
              className="capitalize font-bold"
              value={userDetails.referenceid}
            >
              {userDetails.firstname} {userDetails.lastname} (TSM)
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Sales Metrics</h2>

        {Object.entries(groupedByTSM).map(([tsmId, group]) => (
          <div key={tsmId} className="mb-6">
            {/* TSM Header */}
            <div className="font-bold text-base mb-2 border-b border-gray-300 pb-1 capitalize">
              {group.tsmName}
            </div>

            {/* Agents Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Agent</TableHead>
                  <TableHead className="w-[120px] text-xs">Target Quota</TableHead>
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
                {group.agents
                  .filter((agent) =>
                    selectedAgent === "all"
                      ? true
                      : agent.agentId.toLowerCase() === selectedAgent.toLowerCase()
                  )
                  .map(
                    ({
                      agentId,
                      agentName,
                      salesData: {
                        totalActualSales,
                        totalTargetQuota,
                        variance,
                        achievement,
                      },
                    }) => {
                      const percentToPlan = Math.round(achievement);
                      return (
                        <TableRow
                          key={agentId}
                          className="hover:bg-muted/30 text-xs"
                        >
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
        ))}
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
