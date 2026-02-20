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
  Role?: string;
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

  // ✅ per-agent expanded activity
  const [expandedActivity, setExpandedActivity] = useState<
    Record<string, string | null>
  >({});

  // ✅ TSA only
  const filteredAgents = useMemo(() => {
    return agents.filter(
      (a) => a.Role?.toLowerCase() === "territory sales associate"
    );
  }, [agents]);

  // ✅ Build agent list with STRICT filtering
  const agentList = useMemo(() => {
    return filteredAgents
      .map((agent) => {
        const agentId = agent.ReferenceID.trim().toLowerCase();

        // 🔒 only records that REALLY belong to agent
        const agentHistory = history.filter(
          (h) => h.referenceid?.trim().toLowerCase() === agentId
        );

        // 🚫 skip agent if no records
        if (agentHistory.length === 0) return null;

        const activitiesMap: Record<
          string,
          { count: number; totalDurationMs: number; records: HistoryItem[] }
        > = {};

        agentHistory.forEach((h) => {
          const type = h.type_activity || "Unknown";

          if (!activitiesMap[type]) {
            activitiesMap[type] = {
              count: 0,
              totalDurationMs: 0,
              records: [],
            };
          }

          activitiesMap[type].count += 1;

          const start = parseDateMs(h.start_date);
          const end = parseDateMs(h.end_date);
          if (start && end && end > start) {
            activitiesMap[type].totalDurationMs += end - start;
          }

          activitiesMap[type].records.push(h);
        });

        const activities = Object.entries(activitiesMap).map(
          ([name, data]) => ({
            name,
            count: data.count,
            totalDurationMs: data.totalDurationMs,
            records: data.records,
          })
        );

        const totalActivities = activities.reduce(
          (sum, a) => sum + a.count,
          0
        );
        const totalDurationMs = activities.reduce(
          (sum, a) => sum + a.totalDurationMs,
          0
        );

        return {
          agentId,
          agentName: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture,
          activities,
          totalActivities,
          totalDurationMs,
        };
      })
      .filter(
        (a): a is {
          agentId: string;
          agentName: string;
          profilePicture: string;
          activities: {
            name: string;
            count: number;
            totalDurationMs: number;
            records: HistoryItem[];
          }[];
          totalActivities: number;
          totalDurationMs: number;
        } => a !== null
      );

  }, [filteredAgents, history]);

  return (
    <Card className="flex flex-col h-full bg-white rounded-none">
      <CardHeader>
        <CardTitle>Other Activities Duration</CardTitle>
        <CardDescription>
          Summary of all activities grouped per agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {agentList.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">
            No records found.
          </p>
        ) : (
          agentList.map((agent) => (
            <div key={agent.agentId} className="p-2 border-b">
              {/* AGENT HEADER */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => {
                  setExpandedAgentId(
                    expandedAgentId === agent.agentId
                      ? null
                      : agent.agentId
                  );
                  setExpandedActivity({});
                }}
              >
                <div className="flex items-center gap-3 text-xs">
                  {agent.profilePicture ? (
                    <img
                      src={agent.profilePicture}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                      ?
                    </div>
                  )}
                  <span>{agent.agentName}</span>
                </div>

                <div className="flex gap-4 text-xs font-semibold text-gray-700">
                  <span>Total Activities: {agent.totalActivities}</span>
                  <span>
                    Total Duration:{" "}
                    {formatDurationMs(agent.totalDurationMs)}
                  </span>
                </div>
              </div>

              {/* ACTIVITIES */}
              {expandedAgentId === agent.agentId && (
                <div className="mt-4 ml-10">
                  {agent.activities.map((activity) => (
                    <div key={activity.name} className="border-t p-2 text-xs">
                      <div
                        className="flex justify-between cursor-pointer"
                        onClick={() =>
                          setExpandedActivity((prev) => ({
                            ...prev,
                            [agent.agentId]:
                              prev[agent.agentId] === activity.name
                                ? null
                                : activity.name,
                          }))
                        }
                      >
                        <span className="font-medium capitalize">
                          {activity.name} ( {activity.count} )
                        </span>
                        <span className="text-gray-600">
                          {formatDurationMs(activity.totalDurationMs)}
                        </span>
                      </div>

                      {/* RECORDS */}
                      {expandedActivity[agent.agentId] === activity.name && (
                        <div className="ml-6 mt-2 space-y-1 max-h-48 overflow-auto">
                          {activity.records.map((r, i) => (
                            <div
                              key={i}
                              className="border-b pb-1 text-gray-700"
                            >
                              <div>
                                <strong>Company:</strong>{" "}
                                {r.company_name || "-"}
                              </div>
                              <div>
                                <strong>Source:</strong> {r.source || "-"}
                              </div>
                              <div>
                                <strong>Status:</strong>{" "}
                                {r.call_status || "-"}
                              </div>
                              <div>
                                <strong>Start:</strong>{" "}
                                {r.start_date
                                  ? new Date(
                                    r.start_date.replace(" ", "T")
                                  ).toLocaleString()
                                  : "-"}
                              </div>
                              <div>
                                <strong>End:</strong>{" "}
                                {r.end_date
                                  ? new Date(
                                    r.end_date.replace(" ", "T")
                                  ).toLocaleString()
                                  : "-"}
                              </div>
                              <div>
                                <strong>Remarks:</strong>{" "}
                                {r.remarks || "-"}
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

      <CardFooter className="border-t text-sm font-semibold">
        <span>
          Total Activities:{" "}
          {agentList.reduce((s, a) => s + a.totalActivities, 0)}
        </span>
        <span className="ml-4">
          Total Duration:{" "}
          {formatDurationMs(
            agentList.reduce((s, a) => s + a.totalDurationMs, 0)
          )}
        </span>
      </CardFooter>
    </Card>
  );
}
