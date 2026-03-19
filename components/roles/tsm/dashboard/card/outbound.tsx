"use client";

<<<<<<< HEAD
import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/* ================= TYPES ================= */
=======
import React, { useMemo } from "react";
import {
  Card,
  CardContent,
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
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07

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
<<<<<<< HEAD
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
=======
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
  if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);
  return parts.join(" ") || "0 sec";
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
}

/* ================= COMPONENT ================= */

export function OutboundCard({ history, agents }: OutboundCardProps) {
<<<<<<< HEAD
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Agent map ---- */
=======
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
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

<<<<<<< HEAD
  /* ---- Per-agent stats ---- */
=======
  const agentPictureMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => {
      map.set(a.ReferenceID.toLowerCase(), a.profilePicture);
    });
    return map;
  }, [agents]);

>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
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

<<<<<<< HEAD
  /* ---- Outbound calls duration ---- */
=======
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
  const outboundCalls = useMemo(
    () => history.filter((item) => item.type_activity === "Outbound Calls"),
    [history]
  );

  const totalOutboundDurationMs = useMemo(() => {
    return outboundCalls.reduce((total, item) => {
<<<<<<< HEAD
      if (!item.start_date || !item.end_date) return total;
      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end = new Date(item.end_date.replace(" ", "T")).getTime();
=======
      if (!item.start_date || !item.end_date) return total; // skip if null/undefined

      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end = new Date(item.end_date.replace(" ", "T")).getTime();

>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
      if (!isNaN(start) && !isNaN(end) && end > start) return total + (end - start);
      return total;
    }, 0);
  }, [outboundCalls]);

<<<<<<< HEAD
  /* ---- Grand totals ---- */
  const grandTotals = useMemo(() => {
    const t = {
=======
  const grandTotals = useMemo(() => {
    const totals = {
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
      touchbaseCount: 0,
      touchbaseSuccessful: 0,
      touchbaseUnsuccessful: 0,
      followupCount: 0,
      followupSuccessful: 0,
      followupUnsuccessful: 0,
<<<<<<< HEAD
    };
    statsByAgent.forEach((s) => {
      t.touchbaseCount += s.touchbaseCount;
      t.touchbaseSuccessful += s.touchbaseSuccessful;
      t.touchbaseUnsuccessful += s.touchbaseUnsuccessful;
      t.followupCount += s.followupCount;
      t.followupSuccessful += s.followupSuccessful;
      t.followupUnsuccessful += s.followupUnsuccessful;
    });
    return { ...t, subtotal: t.touchbaseCount + t.followupCount };
  }, [statsByAgent]);

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
                {statsByAgent.map((stat) => {
                  const info = agentMap.get(stat.agentID);
                  const subtotal = stat.touchbaseCount + stat.followupCount;
=======
      subtotal: 0,
      totalOutbound: 0,
    };

    statsByAgent.forEach((s) => {
      totals.touchbaseCount += s.touchbaseCount;
      totals.touchbaseSuccessful += s.touchbaseSuccessful;
      totals.touchbaseUnsuccessful += s.touchbaseUnsuccessful;
      totals.followupCount += s.followupCount;
      totals.followupSuccessful += s.followupSuccessful;
      totals.followupUnsuccessful += s.followupUnsuccessful;
    });

    totals.subtotal = totals.touchbaseCount + totals.followupCount;
    totals.totalOutbound = totals.subtotal;

    return totals;
  }, [statsByAgent]);

  return (
    <>
      {outboundCalls.length > 0 && (
        <Card className="flex flex-col h-full bg-white text-black rounded-none">
          <CardHeader>
            <CardTitle>Outbound History</CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto">
            {statsByAgent.length === 0 ? (
              <p className="text-center text-sm italic text-gray-500">
                No records found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="font-mono">
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs text-center bg-yellow-100">Touchbase</TableHead>
                    <TableHead className="text-xs text-center bg-green-100">Success</TableHead>
                    <TableHead className="text-xs text-center bg-red-200">Unsuccess</TableHead>
                    <TableHead className="text-xs text-center bg-blue-100">Follow-up</TableHead>
                    <TableHead className="text-xs text-center bg-green-100">Success</TableHead>
                    <TableHead className="text-xs text-center bg-red-200">Unsuccess</TableHead>
                    <TableHead className="text-xs text-center bg-gray-200">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {statsByAgent.map((stat) => {
                    const agentName = agentMap.get(stat.agentID) || stat.agentID;
                    const profilePicture = agentPictureMap.get(stat.agentID);
                    const subtotal = stat.touchbaseCount + stat.followupCount;
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07

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
                              {info?.name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info?.name ?? stat.agentID}</span>
                        </div>
                      </TableCell>

<<<<<<< HEAD
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
=======
                        <TableCell className="text-center bg-yellow-100 font-bold">{stat.touchbaseCount}</TableCell>
                        <TableCell className="text-center bg-green-100 font-bold">{stat.touchbaseSuccessful}</TableCell>
                        <TableCell className="text-center bg-red-200 font-bold">{stat.touchbaseUnsuccessful}</TableCell>
                        <TableCell className="text-center bg-blue-100 font-bold">{stat.followupCount}</TableCell>
                        <TableCell className="text-center bg-green-100 font-bold">{stat.followupSuccessful}</TableCell>
                        <TableCell className="text-center bg-red-200 font-bold">{stat.followupUnsuccessful}</TableCell>
                        <TableCell className="text-center bg-gray-200 font-bold">{subtotal}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

                <tfoot>
                  <TableRow className="text-xs font-semibold border-t">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-center bg-yellow-200 font-bold">{grandTotals.touchbaseCount}</TableCell>
                    <TableCell className="text-center bg-green-200 font-bold">{grandTotals.touchbaseSuccessful}</TableCell>
                    <TableCell className="text-center bg-red-300 font-bold">{grandTotals.touchbaseUnsuccessful}</TableCell>
                    <TableCell className="text-center bg-blue-200 font-bold">{grandTotals.followupCount}</TableCell>
                    <TableCell className="text-center bg-green-200 font-bold">{grandTotals.followupSuccessful}</TableCell>
                    <TableCell className="text-center bg-red-300 font-bold">{grandTotals.followupUnsuccessful}</TableCell>
                    <TableCell className="text-center bg-gray-300 font-bold">{grandTotals.totalOutbound}</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t bg-white">
            <p className="text-xs italic">
              Total Duration of Outbound Calls: {formatDurationMs(totalOutboundDurationMs)}
            </p>
            <Badge className="rounded-none px-6 py-4 font-mono">
              Total Outbound Calls: {grandTotals.totalOutbound}
            </Badge>
          </CardFooter>
        </Card>
      )}
    </>
>>>>>>> 5f746a8e50b4c421f4879ea8192c5cab4a450f07
  );
}