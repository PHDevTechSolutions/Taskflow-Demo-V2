"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HistoryItem {
  source: string;
  company_name: string;
  call_status: string;
  type_activity: string;
  start_date: string | null;
  end_date: string | null;
  referenceid: string;
  remarks: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

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

function parseDateMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return isNaN(ms) ? null : ms;
}

interface InboundRepliesCardProps {
  history: HistoryItem[];
  agents: Agent[];
}

export function InboundRepliesCard({ history, agents }: InboundRepliesCardProps) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [expandedActivityName, setExpandedActivityName] = useState<string | null>(null);

  // Map agents for quick lookup
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.ReferenceID.toLowerCase(), a));
    return map;
  }, [agents]);

  // Organize data per agent -> activities
  const agentList = useMemo(() => {
    return agents.map((agent) => {
      const agentId = agent.ReferenceID.toLowerCase();
      // Filter history for this agent
      const agentHistory = history.filter(
        (h) => h.referenceid?.toLowerCase() === agentId
      );

      // Aggregate activities
      const activitiesData = agentHistory.reduce((acc, h) => {
        const type = h.type_activity || "Unknown";
        if (!acc[type]) {
          acc[type] = { count: 0, totalDurationMs: 0, records: [] as HistoryItem[] };
        }
        acc[type].count += 1;

        const start = parseDateMs(h.start_date);
        const end = parseDateMs(h.end_date);
        if (start && end && end > start) {
          acc[type].totalDurationMs += end - start;
        }
        acc[type].records.push(h);

        return acc;
      }, {} as Record<string, { count: number; totalDurationMs: number; records: HistoryItem[] }>);

      // Compute total duration and total count at agent level
      const totalDurationMs = Object.values(activitiesData).reduce(
        (sum, a) => sum + a.totalDurationMs,
        0
      );
      const totalActivities = Object.values(activitiesData).reduce(
        (sum, a) => sum + a.count,
        0
      );

      return {
        agentId,
        agentName: `${agent.Firstname} ${agent.Lastname}`,
        profilePicture: agent.profilePicture,
        activities: Object.entries(activitiesData).map(([name, data]) => ({
          name,
          count: data.count,
          totalDurationMs: data.totalDurationMs,
          records: data.records,
        })),
        totalActivities,
        totalDurationMs,
      };
    });
  }, [agents, history]);

  return (
    <Card className="flex flex-col h-full bg-white">
      <CardHeader>
        <CardTitle>Other Activities Duration</CardTitle>
        <CardDescription>
          Summary of all activities grouped per agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {agentList.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">
            No records found. Coordinate with your TSA to create activities.
          </p>
        ) : (
          agentList.map((agent) => (
            <div key={agent.agentId} className="p-2 border-b">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => {
                  setExpandedAgentId(expandedAgentId === agent.agentId ? null : agent.agentId);
                  setExpandedActivityName(null); // collapse activity details on agent change
                }}
              >
                <div className="flex items-center gap-3 text-xs">
                  {agent.profilePicture ? (
                    <img
                      src={agent.profilePicture}
                      alt={agent.agentName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                      ?
                    </div>
                  )}
                  <span>{agent.agentName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-gray-700">
                    Total Activities: {agent.totalActivities}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    Total Duration: {formatDurationMs(agent.totalDurationMs)}
                  </span>
                  <button className="text-xs text-blue-600 hover:underline">
                    {expandedAgentId === agent.agentId ? "Hide Summary" : "View Summary"}
                  </button>
                </div>
              </div>

              {expandedAgentId === agent.agentId && (
                <div className="mt-4 ml-10">
                  {agent.activities.map((activity) => (
                    <div key={activity.name} className="p-2 border-t text-xs">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => {
                          setExpandedActivityName(expandedActivityName === activity.name ? null : activity.name);
                        }}
                      >
                        <span className="capitalize font-medium">Count: {activity.count} | {activity.name}</span>

                        <div className="flex items-center gap-4">
                          <div className="text-gray-600 whitespace-nowrap">
                            Duration: {formatDurationMs(activity.totalDurationMs)}
                          </div>

                          <button className="text-xs text-blue-600 hover:underline">
                            {expandedActivityName === activity.name ? "Hide Details" : "View Details"}
                          </button>
                        </div>
                      </div>

                      {expandedActivityName === activity.name && (
                        <div className="mt-2 ml-6 text-xs text-gray-700 space-y-1 max-h-48 overflow-auto">
                          {activity.records.map((record, idx) => (
                            <div key={idx} className="border-b border-gray-200 py-1">
                              <div>
                                <strong>Company Name:</strong> {record.company_name || "-"}
                              </div>
                              <div>
                                <strong>Source:</strong> {record.source || "-"}
                              </div>
                              <div>
                                <strong>Call Status:</strong> {record.call_status || "-"}
                              </div>
                              <div>
                                <strong>Start:</strong>{" "}
                                {record.start_date
                                  ? new Date(record.start_date.replace(" ", "T")).toLocaleString()
                                  : "-"}
                              </div>
                              <div>
                                <strong>End:</strong>{" "}
                                {record.end_date
                                  ? new Date(record.end_date.replace(" ", "T")).toLocaleString()
                                  : "-"}
                              </div>

                              <div>
                                <strong>Remarks:</strong> {record.remarks || "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <CardFooter className="border-t">
        <span className="text-sm font-semibold">
          Total Activities: {agentList.reduce((sum, a) => sum + a.totalActivities, 0)}
        </span>
        <span className="text-sm font-semibold ml-4">
          Total Duration: {formatDurationMs(agentList.reduce((sum, a) => sum + a.totalDurationMs, 0))}
        </span>
      </CardFooter>
    </Card>
  );
}
