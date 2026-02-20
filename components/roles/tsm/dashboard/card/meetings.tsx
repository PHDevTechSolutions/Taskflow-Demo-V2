"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/utils/supabase";

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

interface Meeting {
  start_date?: string | null;
  end_date?: string | null;
  remarks?: string | null;
  type_activity?: string | null;
  date_created?: string | null;
}

interface Props {
  agents: Agent[];
  selectedAgent: string;
  dateCreatedFilterRange?: [Date, Date];
  setDateCreatedFilterRangeAction?: (range: [Date, Date] | undefined) => void;
  formatDate?: (dateStr?: string | null) => string;
}

export function AgentMeetings({
  agents,
  selectedAgent,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  formatDate,
}: Props) {
  const [agentMeetingMap, setAgentMeetingMap] = useState<
    Record<string, Meeting[]>
  >({});
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const safeFormatDate =
    formatDate ??
    ((dateStr?: string | null) =>
      dateStr ? new Date(dateStr).toLocaleString() : "N/A");

  const toggleAgent = (refId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      next.has(refId) ? next.delete(refId) : next.add(refId);
      return next;
    });
  };

  // Helper: fetch all meetings for an agent in batches
  const fetchAllMeetingsForAgent = async (agentId: string) => {
    let allMeetings: Meeting[] = [];
    let from = 0;
    const batchSize = 5000; // adjust as needed

    while (true) {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("referenceid", agentId)
        .order("date_created", { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) {
        console.error(`Error fetching meetings for ${agentId}:`, error);
        break;
      }

      if (!data || data.length === 0) break;

      allMeetings = allMeetings.concat(
        data.map((row: any) => ({
          start_date: row.start_date,
          end_date: row.end_date,
          remarks: row.remarks ?? "—",
          type_activity: row.type_activity ?? "—",
          date_created: row.date_created ?? null,
        }))
      );

      if (data.length < batchSize) break; // last batch reached
      from += batchSize;
    }

    return allMeetings;
  };

  useEffect(() => {
    if (!agents.length) return;

    setAgentMeetingMap({});
    setExpandedAgents(new Set());

    const agentsToFetch =
      selectedAgent === "all"
        ? agents
        : agents.filter((a) => a.ReferenceID === selectedAgent);

    // Fetch all meetings for each agent sequentially to prevent overload
    (async () => {
      for (const agent of agentsToFetch) {
        let meetings = await fetchAllMeetingsForAgent(agent.ReferenceID);

        // Apply date range filter if provided
        if (dateCreatedFilterRange?.length === 2) {
          const [start, end] = dateCreatedFilterRange;
          meetings = meetings.filter((m) => {
            if (!m.date_created) return false;
            const created = new Date(m.date_created);
            return created >= start && created <= end;
          });
        }

        setAgentMeetingMap((prev) => ({
          ...prev,
          [agent.ReferenceID]: meetings,
        }));
      }
    })();
  }, [agents, selectedAgent, dateCreatedFilterRange]);

  // Only include agents with at least 1 meeting
  const agentsWithMeetings = useMemo(
    () =>
      agents.filter(
        (a) =>
          Array.isArray(agentMeetingMap[a.ReferenceID]) &&
          agentMeetingMap[a.ReferenceID].length > 0
      ),
    [agents, agentMeetingMap]
  );

  if (agentsWithMeetings.length === 0) return null;

  return (
    <Card className="rounded-none">
      <CardHeader className="font-semibold">Meetings</CardHeader>
      <CardContent className="font-mono overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Type of Activity</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {agentsWithMeetings.map((agent) => {
              const meetings = agentMeetingMap[agent.ReferenceID] || [];
              const meetingsToShow =
                dateCreatedFilterRange?.length === 2
                  ? meetings
                  : expandedAgents.has(agent.ReferenceID)
                  ? meetings
                  : meetings.length
                  ? [meetings[0]]
                  : [];

              return meetingsToShow.map((meeting, idx) => {
                let duration = "—";
                if (meeting.start_date && meeting.end_date) {
                  const start = new Date(meeting.start_date);
                  const end = new Date(meeting.end_date);
                  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const mins = Math.floor(
                      (end.getTime() - start.getTime()) / 60000
                    );
                    duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
                  }
                }

                return (
                  <TableRow key={`${agent.ReferenceID}-${idx}`}>
                    <TableCell
                      onClick={() =>
                        !dateCreatedFilterRange &&
                        idx === 0 &&
                        toggleAgent(agent.ReferenceID)
                      }
                      className={`cursor-pointer ${
                        idx === 0 ? "font-semibold" : "pl-10"
                      }`}
                    >
                      {idx === 0 && (
                        <div className="flex items-center gap-3">
                          <img
                            src={agent.profilePicture || "/Taskflow.png"}
                            className="h-10 w-10 rounded-sm border object-cover"
                          />
                          <span className="text-xs capitalize">
                            {agent.Firstname} {agent.Lastname}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {safeFormatDate(meeting.start_date ?? undefined)}
                    </TableCell>

                    <TableCell className="text-xs">
                      {safeFormatDate(meeting.end_date ?? undefined)}
                    </TableCell>

                    <TableCell className="text-xs">{duration}</TableCell>
                    <TableCell className="text-xs">
                      {meeting.type_activity ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {meeting.remarks ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              });
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}