"use client";

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

export function OutboundCard({ history, agents }: OutboundCardProps) {
  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => {
      map.set(a.ReferenceID.toLowerCase(), `${a.Firstname} ${a.Lastname}`);
    });
    return map;
  }, [agents]);

  const agentPictureMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => {
      map.set(a.ReferenceID.toLowerCase(), a.profilePicture);
    });
    return map;
  }, [agents]);

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
      const agentID = item.referenceid.toLowerCase();
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

  const outboundCalls = useMemo(
    () => history.filter((item) => item.type_activity === "Outbound Calls"),
    [history]
  );

  const totalOutboundDurationMs = useMemo(() => {
    return outboundCalls.reduce((total, item) => {
      if (!item.start_date || !item.end_date) return total; // skip if null/undefined

      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end = new Date(item.end_date.replace(" ", "T")).getTime();

      if (!isNaN(start) && !isNaN(end) && end > start) return total + (end - start);
      return total;
    }, 0);
  }, [outboundCalls]);

  const grandTotals = useMemo(() => {
    const totals = {
      touchbaseCount: 0,
      touchbaseSuccessful: 0,
      touchbaseUnsuccessful: 0,
      followupCount: 0,
      followupSuccessful: 0,
      followupUnsuccessful: 0,
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

                    return (
                      <TableRow key={stat.agentID} className="text-xs">
                        <TableCell className="flex items-center gap-2 font-mono capitalize">
                          {profilePicture ? (
                            <img
                              src={profilePicture}
                              alt={agentName}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                              ?
                            </div>
                          )}
                          {agentName}
                        </TableCell>

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
  );
}
