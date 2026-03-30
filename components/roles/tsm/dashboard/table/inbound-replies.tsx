"use client";

import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Info, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

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

interface InboundRepliesCardProps {
  history: HistoryItem[];
  agents: Agent[];
}

/* ================= HELPERS ================= */

function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(" ") || "-";
}

function parseDateMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return isNaN(ms) ? null : ms;
}

/* ================= COMPONENT ================= */

export function InboundRepliesCard({ history, agents }: InboundRepliesCardProps) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<Record<string, string | null>>({});
  const [showComputation, setShowComputation] = useState(false);

  /* ---- TSA only ---- */
  const filteredAgents = useMemo(() =>
    agents.filter((a) => a.Role?.toLowerCase() === "territory sales associate"),
    [agents]
  );

  /* ---- Build per-agent data ---- */
  const agentList = useMemo(() => {
    return filteredAgents
      .map((agent) => {
        const agentId = agent.ReferenceID.trim().toLowerCase();
        const agentHistory = history.filter(
          (h) => h.referenceid?.trim().toLowerCase() === agentId
        );
        if (agentHistory.length === 0) return null;

        const activitiesMap: Record<string, {
          count: number;
          totalDurationMs: number;
          records: HistoryItem[];
        }> = {};

        agentHistory.forEach((h) => {
          const type = h.type_activity || "Unknown";
          if (!activitiesMap[type]) {
            activitiesMap[type] = { count: 0, totalDurationMs: 0, records: [] };
          }
          activitiesMap[type].count += 1;
          const start = parseDateMs(h.start_date);
          const end = parseDateMs(h.end_date);
          if (start && end && end > start) {
            activitiesMap[type].totalDurationMs += end - start;
          }
          activitiesMap[type].records.push(h);
        });

        const activities = Object.entries(activitiesMap).map(([name, data]) => ({
          name,
          count: data.count,
          totalDurationMs: data.totalDurationMs,
          records: data.records,
        }));

        return {
          agentId,
          agentName: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture,
          activities,
          totalActivities: activities.reduce((s, a) => s + a.count, 0),
          totalDurationMs: activities.reduce((s, a) => s + a.totalDurationMs, 0),
        };
      })
      .filter(Boolean) as {
        agentId: string;
        agentName: string;
        profilePicture: string;
        activities: { name: string; count: number; totalDurationMs: number; records: HistoryItem[] }[];
        totalActivities: number;
        totalDurationMs: number;
      }[];
  }, [filteredAgents, history]);

  const grandTotalActivities = agentList.reduce((s, a) => s + a.totalActivities, 0);
  const grandTotalDuration = agentList.reduce((s, a) => s + a.totalDurationMs, 0);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (agentList.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Sheet 1: Summary per Agent
      const summarySheet = workbook.addWorksheet("Agent Summary");
      summarySheet.columns = [
        { header: "Agent Name", key: "agentName", width: 25 },
        { header: "Total Activities", key: "totalCount", width: 15 },
        { header: "Total Duration", key: "totalDuration", width: 20 },
      ];
      
      const header1 = summarySheet.getRow(1);
      header1.font = { bold: true };
      header1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      agentList.forEach(agent => {
        summarySheet.addRow({
          agentName: agent.agentName,
          totalCount: agent.totalActivities,
          totalDuration: formatDurationMs(agent.totalDurationMs),
        });
      });

      // Sheet 2: All Detailed Activities
      const detailSheet = workbook.addWorksheet("Activity Details");
      detailSheet.columns = [
        { header: "Agent Name", key: "agent", width: 20 },
        { header: "Activity Type", key: "activity", width: 20 },
        { header: "Company Name", key: "company", width: 25 },
        { header: "Source", key: "source", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Start Date", key: "start", width: 20 },
        { header: "End Date", key: "end", width: 20 },
        { header: "Duration", key: "duration", width: 15 },
        { header: "Remarks", key: "remarks", width: 40 },
      ];

      const header2 = detailSheet.getRow(1);
      header2.font = { bold: true };
      header2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      agentList.forEach(agent => {
        agent.activities.forEach(act => {
          act.records.forEach(r => {
            const start = parseDateMs(r.start_date);
            const end = parseDateMs(r.end_date);
            const durationMs = (start && end && end > start) ? end - start : 0;

            detailSheet.addRow({
              agent: agent.agentName,
              activity: act.name,
              company: r.company_name || "-",
              source: r.source || "-",
              status: r.call_status || "-",
              start: r.start_date ? new Date(r.start_date.replace(" ", "T")).toLocaleString() : "-",
              end: r.end_date ? new Date(r.end_date.replace(" ", "T")).toLocaleString() : "-",
              duration: formatDurationMs(durationMs),
              remarks: r.remarks || "-",
            });
          });
        });
      });

      const filename = `TSM_Other_Activities_${new Date().toISOString().split('T')[0]}.xlsx`;

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

    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Other Activities Duration</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Summary of all activities <span className="font-medium text-gray-500">grouped per agent</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={agentList.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {agentList.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No activity records found.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {agentList.map((agent) => {
              const isAgentOpen = expandedAgentId === agent.agentId;

              return (
                <div key={agent.agentId}>
                  {/* Agent row */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
                    onClick={() => {
                      setExpandedAgentId(isAgentOpen ? null : agent.agentId);
                      setExpandedActivity({});
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-gray-400">
                        {isAgentOpen
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                      {agent.profilePicture ? (
                        <img
                          src={agent.profilePicture}
                          alt={agent.agentName}
                          className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                          {agent.agentName[0]}
                        </div>
                      )}
                      <span className="text-xs font-medium capitalize text-gray-700">
                        {agent.agentName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                      <span>
                        <span className="text-gray-400 mr-1">Activities:</span>
                        <span className="font-semibold text-gray-700">{agent.totalActivities}</span>
                      </span>
                      <span>
                        <span className="text-gray-400 mr-1">Duration:</span>
                        <span className="font-semibold text-gray-700">{formatDurationMs(agent.totalDurationMs)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Activity rows */}
                  {isAgentOpen && (
                    <div className="bg-gray-50/40 divide-y divide-gray-100">
                      {agent.activities.map((activity) => {
                        const isActivityOpen = expandedActivity[agent.agentId] === activity.name;

                        return (
                          <div key={activity.name}>
                            <div
                              className="flex items-center justify-between px-8 py-2.5 cursor-pointer hover:bg-gray-100/60 transition-colors"
                              onClick={() =>
                                setExpandedActivity((prev) => ({
                                  ...prev,
                                  [agent.agentId]: isActivityOpen ? null : activity.name,
                                }))
                              }
                            >
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="text-gray-300">
                                  {isActivityOpen
                                    ? <ChevronDown className="w-3 h-3" />
                                    : <ChevronRight className="w-3 h-3" />}
                                </span>
                                <span className="capitalize font-medium">{activity.name}</span>
                                <span className="bg-gray-200 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                  {activity.count}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-gray-500">
                                {formatDurationMs(activity.totalDurationMs)}
                              </span>
                            </div>

                            {/* Records */}
                            {isActivityOpen && (
                              <div className="px-12 pb-3 pt-1 space-y-2 max-h-60 overflow-y-auto">
                                {activity.records.map((r, i) => (
                                  <div
                                    key={i}
                                    className="bg-white border border-gray-100 rounded-lg p-3 text-[11px] text-gray-600 space-y-0.5 shadow-sm"
                                  >
                                    <p><span className="font-semibold text-gray-700">Company:</span> {r.company_name || "—"}</p>
                                    <p><span className="font-semibold text-gray-700">Source:</span> {r.source || "—"}</p>
                                    <p><span className="font-semibold text-gray-700">Status:</span> {r.call_status || "—"}</p>
                                    <p>
                                      <span className="font-semibold text-gray-700">Start:</span>{" "}
                                      {r.start_date ? new Date(r.start_date.replace(" ", "T")).toLocaleString() : "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-gray-700">End:</span>{" "}
                                      {r.end_date ? new Date(r.end_date.replace(" ", "T")).toLocaleString() : "—"}
                                    </p>
                                    <p><span className="font-semibold text-gray-700">Remarks:</span> {r.remarks || "—"}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-xs text-gray-400 italic">
            All TSA agents · grouped by activity type
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-gray-500">
              Total Activities:{" "}
              <span className="font-semibold text-gray-700">{grandTotalActivities}</span>
            </span>
            <span className="text-gray-500">
              Total Duration:{" "}
              <span className="font-semibold text-gray-700">{formatDurationMs(grandTotalDuration)}</span>
            </span>
          </div>
        </div>

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Agents shown:</strong> Only agents with <code>Role = "Territory Sales Associate"</code>.</p>
            <p><strong>Activities:</strong> Grouped by <code>type_activity</code> per agent.</p>
            <p><strong>Duration:</strong> Sum of <code>end_date - start_date</code> per activity group.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}