import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  formatDate?: (dateStr?: string) => string;
}

export function AgentMeetings({ agents, selectedAgent, formatDate }: Props) {
  const [agentMeetingMap, setAgentMeetingMap] = useState<Record<string, Meeting[]>>(
    {}
  );

  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!agents.length) return;

    setAgentMeetingMap({});
    setExpandedAgents(new Set());

    const unsubscribes: (() => void)[] = [];

    const agentsToWatch =
      selectedAgent === "all"
        ? agents
        : agents.filter((a) => a.ReferenceID === selectedAgent);

    agentsToWatch.forEach((agent) => {
      const q = query(
        collection(db, "meetings"),
        where("referenceid", "==", agent.ReferenceID),
        orderBy("date_created", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setAgentMeetingMap((prev) => ({
            ...prev,
            [agent.ReferenceID]: [],
          }));
          return;
        }

        const meetings: Meeting[] = snapshot.docs.map((doc) => {
          const data = doc.data();

          const formatDateRaw = (d: any) => {
            if (!d) return null;
            if (d.toDate) return d.toDate().toLocaleString();
            if (typeof d === "string") return new Date(d).toLocaleString();
            return null;
          };

          return {
            start_date: formatDateRaw(data.start_date),
            end_date: formatDateRaw(data.end_date),
            remarks: data.remarks ?? "—",
            type_activity: data.type_activity ?? "—",
            date_created: data.date_created ?? "—",
          };
        });

        setAgentMeetingMap((prev) => ({
          ...prev,
          [agent.ReferenceID]: meetings,
        }));
      });

      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [selectedAgent, agents]);

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

  /** ✅ agents na MAY meetings lang */
  const agentsWithMeetings = useMemo(
    () =>
      agents.filter(
        (a) => Array.isArray(agentMeetingMap[a.ReferenceID]) &&
          agentMeetingMap[a.ReferenceID].length > 0
      ),
    [agents, agentMeetingMap]
  );

  /** OPTIONAL: kung ayaw mo ipakita card kapag walang meetings kahit isa */
  if (agentsWithMeetings.length === 0) {
    return null;
  }

  return (
    <Card>
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
              const meetings = agentMeetingMap[agent.ReferenceID];

              const meetingsToShow = expandedAgents.has(agent.ReferenceID)
                ? meetings
                : [meetings[0]]; // latest only by default

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
                      onClick={() => idx === 0 && toggleAgent(agent.ReferenceID)}
                      className={`cursor-pointer ${idx === 0 ? "font-semibold" : "pl-10"
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
