"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ===================== TYPES ===================== */

interface HistoryItem {
  source: string;
  call_status: string;
  type_activity: string;
  start_date: string | null;
  end_date: string | null;
  referenceid: string;
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

/* ===================== HELPERS ===================== */

// Convert milliseconds to readable duration
function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (minutes) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
  if (seconds) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

  return parts.join(" ");
}

// Safe date parsing (NULL-SAFE)
function parseDateMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return isNaN(ms) ? null : ms;
}

/* ===================== COMPONENT ===================== */

export function InboundRepliesCard({ history, agents }: InboundRepliesCardProps) {
  /* Map agents for quick lookup */
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), a)
    );
    return map;
  }, [agents]);

  /* Remove Outbound Calls */
  const filteredHistory = useMemo(() => history, [history]);

  /* Group by agent + activity */
  const statsByAgentAndActivity = useMemo(() => {
    const grouping = new Map<
      string,
      Record<
        string,
        { count: number; totalDurationMs: number }
      >
    >();

    filteredHistory.forEach((item) => {
      const agentId = item.referenceid?.toLowerCase();
      if (!agentId) return;

      if (!grouping.has(agentId)) grouping.set(agentId, {});
      const activities = grouping.get(agentId)!;

      if (!activities[item.type_activity]) {
        activities[item.type_activity] = {
          count: 0,
          totalDurationMs: 0,
        };
      }

      activities[item.type_activity].count += 1;

      const start = parseDateMs(item.start_date);
      const end = parseDateMs(item.end_date);

      if (start && end && end > start) {
        activities[item.type_activity].totalDurationMs += end - start;
      }
    });

    /* Flatten result */
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
      const agentName = agent
        ? `${agent.Firstname} ${agent.Lastname}`
        : agentId;

      Object.entries(activities).forEach(([activity, data]) => {
        result.push({
          agentId,
          agentName,
          profilePicture: agent?.profilePicture || "",
          activity,
          count: data.count,
          totalDurationMs: data.totalDurationMs,
        });
      });
    });

    return result.sort(
      (a, b) =>
        a.agentName.localeCompare(b.agentName) ||
        a.activity.localeCompare(b.activity)
    );
  }, [filteredHistory, agentMap]);

  const totalCount = useMemo(
    () => statsByAgentAndActivity.reduce((t, r) => t + r.count, 0),
    [statsByAgentAndActivity]
  );

  /* ===================== UI ===================== */

  return (
    <Card className="flex flex-col h-full bg-white">
      <CardHeader>
        <CardTitle>Other Activities Duration</CardTitle>
        <CardDescription>
          Summary of all activities except Outbound Calls, grouped per agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {statsByAgentAndActivity.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">
            No records found. Coordinate with your TSA to create activities.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Activity</TableHead>
                <TableHead className="text-xs text-center">Count</TableHead>
                <TableHead className="text-xs text-center">Duration</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {statsByAgentAndActivity.map((row) => (
                <TableRow key={`${row.agentId}-${row.activity}`} className="text-xs">
                  <TableCell className="flex items-center gap-2 capitalize">
                    {row.profilePicture ? (
                      <img
                        src={row.profilePicture}
                        className="w-6 h-6 rounded-full object-cover"
                        alt={row.agentName}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                        ?
                      </div>
                    )}
                    {row.agentName}
                  </TableCell>

                  <TableCell>{row.activity}</TableCell>

                  <TableCell className="text-center">
                    {row.count}
                  </TableCell>

                  <TableCell className="text-center">
                    {formatDurationMs(row.totalDurationMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {totalCount > 0 && (
        <CardFooter className="border-t">
          <Badge className="rounded-full px-4 py-2">
            Total Activities: {totalCount}
          </Badge>
        </CardFooter>
      )}
    </Card>
  );
}
