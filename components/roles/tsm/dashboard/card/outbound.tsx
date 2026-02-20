import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  referenceid: string;
  source: string;
  call_status: string;
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
  // Map agent ReferenceID to fullname
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

  // Aggregate stats per agent (counts only)
  const statsByAgent = useMemo(() => {
    type AgentStats = {
      agentID: string;
      touchbaseCount: number;
      followupCount: number;
      successfulCount: number;
      unsuccessfulCount: number;
    };

    const map = new Map<string, AgentStats>();

    history.forEach((item) => {
      const agentID = item.referenceid.toLowerCase();
      if (!map.has(agentID)) {
        map.set(agentID, {
          agentID,
          touchbaseCount: 0,
          followupCount: 0,
          successfulCount: 0,
          unsuccessfulCount: 0,
        });
      }
      const stat = map.get(agentID)!;

      if (item.source === "Outbound - Touchbase") {
        stat.touchbaseCount++;
      } else if (item.source === "Outbound - Follow-up") {
        stat.followupCount++;
      }

      if (item.call_status === "Successful") {
        stat.successfulCount++;
      } else if (item.call_status === "Unsuccessful") {
        stat.unsuccessfulCount++;
      }
    });

    return Array.from(map.values());
  }, [history]);

  // Count all Outbound Calls based on type_activity
  const outboundCalls = useMemo(() => {
    return history.filter((item) => item.type_activity === "Outbound Calls");
  }, [history]);

  // Count all Outbound Calls
  const totalOutboundCalls = outboundCalls.length;

  // Compute total duration (ms) of all outbound calls (end_date - start_date)
  const totalOutboundDurationMs = useMemo(() => {
    return outboundCalls.reduce((total, item) => {
      // parse date safely, replacing space with T for ISO format
      const startDateStr = item.start_date;
      const endDateStr = item.end_date;

      if (typeof startDateStr === "string" && typeof endDateStr === "string") {
        const start = new Date(startDateStr.replace(" ", "T")).getTime();
        const end = new Date(endDateStr.replace(" ", "T")).getTime();

        if (!isNaN(start) && !isNaN(end) && end > start) {
          return total + (end - start);
        }
      }
      return total;

    }, 0);
  }, [outboundCalls]);

  return (
    <>
      {totalOutboundCalls > 0 && (
        <Card className="flex flex-col h-full bg-white text-black rounded-none">
          <CardHeader>
            <CardTitle>Outbound History</CardTitle>
            <CardDescription>Summary of outbound call activities per agent.</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto">
            {statsByAgent.length === 0 ? (
              <p className="text-center text-sm italic text-gray-500">
                No records found. Coordinate with your TSA to create activities.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="font-mono">
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs text-center">Touchbase Count</TableHead>
                    <TableHead className="text-xs text-center">Follow-up Count</TableHead>
                    <TableHead className="text-xs text-center">Successful Count</TableHead>
                    <TableHead className="text-xs text-center">Unsuccessful Count</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {statsByAgent.map((stat) => {
                    const agentName = agentMap.get(stat.agentID) || stat.agentID;
                    const profilePicture = agentPictureMap.get(stat.agentID);

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

                        <TableCell className="text-center">
                          {stat.touchbaseCount}
                        </TableCell>

                        <TableCell className="text-center">
                          {stat.followupCount}
                        </TableCell>

                        <TableCell className="text-center">
                          {stat.successfulCount}
                        </TableCell>

                        <TableCell className="text-center">
                          {stat.unsuccessfulCount}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

                <tfoot>
                  <TableRow className="text-xs font-semibold border-t">
                    <TableCell className="font-mono">Total</TableCell>

                    <TableCell className="text-center font-bold">
                      {statsByAgent.reduce((acc, stat) => acc + stat.touchbaseCount, 0)}
                    </TableCell>

                    <TableCell className="text-center font-bold">
                      {statsByAgent.reduce((acc, stat) => acc + stat.followupCount, 0)}
                    </TableCell>

                    <TableCell className="text-center font-bold">
                      {statsByAgent.reduce((acc, stat) => acc + stat.successfulCount, 0)}
                    </TableCell>

                    <TableCell className="text-center font-bold">
                      {statsByAgent.reduce((acc, stat) => acc + stat.unsuccessfulCount, 0)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            )}
          </CardContent>

          {totalOutboundCalls > 0 && (
            <CardFooter className="flex justify-between border-t bg-white">
              <p className="text-xs italic">
                Total Duration of Outbound Calls: {formatDurationMs(totalOutboundDurationMs)}
              </p>
              <Badge className="rounded-none px-6 py-4 font-mono">
                Total Outbound Calls: {totalOutboundCalls}
              </Badge>
            </CardFooter>
          )}
        </Card>
      )}
    </>
  );
}
