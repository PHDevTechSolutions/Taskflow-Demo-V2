"use client";

import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, Download } from "lucide-react";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source: string; // "Outbound - Touchbase" | "Outbound - Follow-up"
  call_status: string; // "Successful" | "Unsuccessful"
  type_activity: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface OutboundCardProps {
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
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
}

/* ================= COMPONENT ================= */

export function OutboundCard({ history, agents }: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Agent map ---- */
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; picture: string }>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), {
        name: `${a.Firstname} ${a.Lastname}`,
        picture: a.profilePicture,
      })
    );
    return map;
  }, [agents]);

  /* ---- Per-agent stats ---- */
  const statsByAgent = useMemo(() => {
    type AgentStats = {
      agentID: string;
      touchbaseCount: number;
      touchbaseSuccessful: number;
      touchbaseUnsuccessful: number;
      followupCount: number;
      followupSuccessful: number;
      followupUnsuccessful: number;
    };

    const map = new Map<string, AgentStats>();

    history.forEach((item) => {
      const agentID = item.referenceid?.toLowerCase();
      if (!agentID) return;

      if (!map.has(agentID)) {
        map.set(agentID, {
          agentID,
          touchbaseCount: 0,
          touchbaseSuccessful: 0,
          touchbaseUnsuccessful: 0,
          followupCount: 0,
          followupSuccessful: 0,
          followupUnsuccessful: 0,
        });
      }

      const stat = map.get(agentID)!;

      if (item.source === "Outbound - Touchbase") {
        stat.touchbaseCount++;
        if (item.call_status === "Successful") stat.touchbaseSuccessful++;
        else stat.touchbaseUnsuccessful++;
      } else if (item.source === "Outbound - Follow-up") {
        stat.followupCount++;
        if (item.call_status === "Successful") stat.followupSuccessful++;
        else stat.followupUnsuccessful++;
      }
    });

    return Array.from(map.values());
  }, [history]);

  /* ---- Outbound calls duration ---- */
  const outboundCalls = useMemo(
    () => history.filter((item) => item.type_activity === "Outbound Calls"),
    [history]
  );

  const totalOutboundDurationMs = useMemo(() => {
    return outboundCalls.reduce((total, item) => {
      if (!item.start_date || !item.end_date) return total;
      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end = new Date(item.end_date.replace(" ", "T")).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) return total + (end - start);
      return total;
    }, 0);
  }, [outboundCalls]);

  /* ---- Grand totals ---- */
  const grandTotals = useMemo(() => {
    // Only include agents with name info in totals
    const visibleAgents = statsByAgent.filter((s) => agentMap.has(s.agentID));
    const t = {
      touchbaseCount: 0,
      touchbaseSuccessful: 0,
      touchbaseUnsuccessful: 0,
      followupCount: 0,
      followupSuccessful: 0,
      followupUnsuccessful: 0,
    };
    visibleAgents.forEach((s) => {
      t.touchbaseCount += s.touchbaseCount;
      t.touchbaseSuccessful += s.touchbaseSuccessful;
      t.touchbaseUnsuccessful += s.touchbaseUnsuccessful;
      t.followupCount += s.followupCount;
      t.followupSuccessful += s.followupSuccessful;
      t.followupUnsuccessful += s.followupUnsuccessful;
    });
    return { ...t, subtotal: t.touchbaseCount + t.followupCount };
  }, [statsByAgent, agentMap]);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (statsByAgent.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Outbound History");

      // Headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 25 },
        { header: "Touchbase Total", key: "tbTotal", width: 15 },
        { header: "Touchbase Success", key: "tbSuccess", width: 18 },
        { header: "Touchbase Fail", key: "tbFail", width: 15 },
        { header: "Follow-up Total", key: "fuTotal", width: 15 },
        { header: "Follow-up Success", key: "fuSuccess", width: 18 },
        { header: "Follow-up Fail", key: "fuFail", width: 15 },
        { header: "Subtotal", key: "subtotal", width: 15 },
      ];

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data (only agents with name info)
      const filteredStats = statsByAgent.filter((stat) => agentMap.has(stat.agentID));
      filteredStats.forEach((stat) => {
        const info = agentMap.get(stat.agentID)!;
        const subtotal = stat.touchbaseCount + stat.followupCount;

        worksheet.addRow({
          agent: info.name,
          tbTotal: stat.touchbaseCount,
          tbSuccess: stat.touchbaseSuccessful,
          tbFail: stat.touchbaseUnsuccessful,
          fuTotal: stat.followupCount,
          fuSuccess: stat.followupSuccessful,
          fuFail: stat.followupUnsuccessful,
          subtotal: subtotal,
        });
      });

      // Add Totals Row
      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        tbTotal: grandTotals.touchbaseCount,
        tbSuccess: grandTotals.touchbaseSuccessful,
        tbFail: grandTotals.touchbaseUnsuccessful,
        fuTotal: grandTotals.followupCount,
        fuSuccess: grandTotals.followupSuccessful,
        fuFail: grandTotals.followupUnsuccessful,
        subtotal: grandTotals.subtotal,
      });
      totalRow.font = { bold: true };

      const filename = `TSM_Outbound_History_${new Date().toISOString().split('T')[0]}.xlsx`;

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

  if (outboundCalls.length === 0) return null;

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound History</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-medium text-gray-500">Touchbase</span> and{" "}
              <span className="font-medium text-gray-500">Follow-up</span> outbound calls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={statsByAgent.length === 0}
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
        {statsByAgent.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No outbound records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                {/* Group row */}
                <TableRow className="bg-gray-50 text-[11px] border-b-0">
                  <TableHead className="text-gray-500" rowSpan={2}>Agent</TableHead>
                  <TableHead className="text-center text-amber-600 bg-amber-50 border-l" colSpan={3}>
                    Touchbase
                  </TableHead>
                  <TableHead className="text-center text-blue-600 bg-blue-50 border-l" colSpan={3}>
                    Follow-up
                  </TableHead>
                  <TableHead className="text-center text-gray-500 bg-gray-100 border-l" rowSpan={2}>
                    Subtotal
                  </TableHead>
                </TableRow>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-center text-gray-500 bg-amber-50 border-l">Total</TableHead>
                  <TableHead className="text-center text-green-600 bg-amber-50">✓ Success</TableHead>
                  <TableHead className="text-center text-red-500 bg-amber-50">✗ Fail</TableHead>
                  <TableHead className="text-center text-gray-500 bg-blue-50 border-l">Total</TableHead>
                  <TableHead className="text-center text-green-600 bg-blue-50">✓ Success</TableHead>
                  <TableHead className="text-center text-red-500 bg-blue-50">✗ Fail</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent
                  .filter((stat) => agentMap.has(stat.agentID)) // Only show agents with name info
                  .map((stat) => {
                  const info = agentMap.get(stat.agentID)!;
                  const subtotal = stat.touchbaseCount + stat.followupCount;

                  return (
                    <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                      {/* Agent */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img
                              src={info.picture}
                              alt={info.name}
                              className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info.name[0]}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info.name}</span>
                        </div>
                      </TableCell>

                      {/* Touchbase */}
                      <TableCell className="text-center font-semibold text-amber-700 bg-amber-50/40 border-l">{stat.touchbaseCount}</TableCell>
                      <TableCell className="text-center text-green-600 font-semibold bg-amber-50/40">{stat.touchbaseSuccessful}</TableCell>
                      <TableCell className="text-center text-red-500 font-semibold bg-amber-50/40">{stat.touchbaseUnsuccessful}</TableCell>

                      {/* Follow-up */}
                      <TableCell className="text-center font-semibold text-blue-700 bg-blue-50/40 border-l">{stat.followupCount}</TableCell>
                      <TableCell className="text-center text-green-600 font-semibold bg-blue-50/40">{stat.followupSuccessful}</TableCell>
                      <TableCell className="text-center text-red-500 font-semibold bg-blue-50/40">{stat.followupUnsuccessful}</TableCell>

                      {/* Subtotal */}
                      <TableCell className="text-center font-bold text-gray-800 bg-gray-50 border-l">{subtotal}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Footer totals */}
              <TableFooter>
                <TableRow className="text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-amber-700 bg-amber-50 border-l">{grandTotals.touchbaseCount}</TableCell>
                  <TableCell className="text-center text-green-600 bg-amber-50">{grandTotals.touchbaseSuccessful}</TableCell>
                  <TableCell className="text-center text-red-500 bg-amber-50">{grandTotals.touchbaseUnsuccessful}</TableCell>
                  <TableCell className="text-center text-blue-700 bg-blue-50 border-l">{grandTotals.followupCount}</TableCell>
                  <TableCell className="text-center text-green-600 bg-blue-50">{grandTotals.followupSuccessful}</TableCell>
                  <TableCell className="text-center text-red-500 bg-blue-50">{grandTotals.followupUnsuccessful}</TableCell>
                  <TableCell className="text-center font-bold text-gray-800 bg-gray-100 border-l">{grandTotals.subtotal}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Duration + Details */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 italic">
            Total call duration:{" "}
            <span className="font-medium text-gray-600">{formatDurationMs(totalOutboundDurationMs)}</span>
          </p>
          <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
            Total Outbound: {grandTotals.subtotal}
          </span>
        </div>

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Touchbase:</strong> Activities where <code>source = "Outbound - Touchbase"</code>.</p>
            <p><strong>Follow-up:</strong> Activities where <code>source = "Outbound - Follow-up"</code>.</p>
            <p><strong>Successful / Fail:</strong> Based on <code>call_status</code> field.</p>
            <p><strong>Subtotal:</strong> Touchbase count + Follow-up count per agent.</p>
            <p><strong>Duration:</strong> Sum of <code>end_date - start_date</code> for all <code>type_activity = "Outbound Calls"</code> records.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}