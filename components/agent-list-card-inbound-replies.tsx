import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  source: string;
  call_status: string;
  type_activity: string;
  start_date: string;
  end_date: string;
  referenceid: string; // para i-link sa agent
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface InboundRepliesCardProps {
  history: HistoryItem[];
  agents: Agent[];
}

// Format milliseconds duration into "X hr Y min Z sec" string
function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
  if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

  return parts.join(" ") || "0 sec";
}

export function InboundRepliesCard({ history, agents }: InboundRepliesCardProps) {
  // Map agent ReferenceID to agent object for quick lookup
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => {
      map.set(a.ReferenceID.toLowerCase(), a);
    });
    return map;
  }, [agents]);

  // Filter out "Outbound Calls"
  const filteredHistory = useMemo(() => {
    return history.filter((item) => item.type_activity !== "Outbound Calls");
  }, [history]);

  // Group filtered history by agent and activity, calculate count and total duration per group
  const statsByAgentAndActivity = useMemo(() => {
    const grouping = new Map<
      string,
      {
        [activity: string]: { items: HistoryItem[]; totalDurationMs: number };
      }
    >();

    filteredHistory.forEach((item) => {
      const agentId = item.referenceid?.toLowerCase() ?? "";
      if (!agentId) return;

      if (!grouping.has(agentId)) grouping.set(agentId, {});
      const activities = grouping.get(agentId)!;

      if (!activities[item.type_activity])
        activities[item.type_activity] = { items: [], totalDurationMs: 0 };

      activities[item.type_activity].items.push(item);

      // Parse dates safely and accumulate duration if valid
      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end = new Date(item.end_date.replace(" ", "T")).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        activities[item.type_activity].totalDurationMs += end - start;
      }
    });

    const result: {
      agentId: string;
      agentName: string;
      profilePicture: string;
      activity: string;
      count: number;
      totalDurationMs: number;
    }[] = [];

    grouping.forEach((activities, agentId) => {
      const agent = agentMap.get(agentId);
      const agentName = agent ? `${agent.Firstname} ${agent.Lastname}` : agentId;
      const profilePicture = agent?.profilePicture || "";

      Object.entries(activities).forEach(([activity, data]) => {
        result.push({
          agentId,
          agentName,
          profilePicture,
          activity,
          count: data.items.length,
          totalDurationMs: data.totalDurationMs,
        });
      });
    });

    // Sort by agentName then activity alphabetically
    result.sort((a, b) => {
      if (a.agentName < b.agentName) return -1;
      if (a.agentName > b.agentName) return 1;
      if (a.activity < b.activity) return -1;
      if (a.activity > b.activity) return 1;
      return 0;
    });

    return result;
  }, [filteredHistory, agentMap]);

  // Total count of all grouped activities (excluding Outbound Calls)
  const totalCount = useMemo(
    () => statsByAgentAndActivity.reduce((acc, cur) => acc + cur.count, 0),
    [statsByAgentAndActivity]
  );

  return (
    <Card className="flex flex-col h-full bg-white text-black">
      <CardHeader>
        <CardTitle>Other Activities Duration</CardTitle>
        <CardDescription>
          Summary of all activities except Outbound Calls, grouped per agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {statsByAgentAndActivity.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">No records found. Coordinate with your TSA to create activities.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="font-mono">
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Activity</TableHead>
                <TableHead className="text-xs text-center">Count</TableHead>
                <TableHead className="text-xs text-center">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsByAgentAndActivity.map((row) => (
                <TableRow key={`${row.agentId}-${row.activity}`} className="text-xs">
                  <TableCell className="flex items-center gap-2 font-mono">
                    {row.profilePicture ? (
                      <img
                        src={row.profilePicture}
                        alt={row.agentName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                        ?
                      </div>
                    )}
                    {row.agentName}
                  </TableCell>
                  <TableCell className="font-medium font-mono">{row.activity}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="rounded-full px-3 font-mono">{row.count}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {formatDurationMs(row.totalDurationMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      
      {totalCount > 0 && (
      <CardFooter className="flex justify-between border-t bg-white">
        <Badge className="rounded-full px-4 py-2 font-mono">
          Total Activities: {totalCount}
        </Badge>
      </CardFooter>
      )}

    </Card>
  );
}
