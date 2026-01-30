import React, { useEffect, useState } from "react";
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
  // Map agent ReferenceID to meetings array
  const [agentMeetingMap, setAgentMeetingMap] = useState<Record<string, Meeting[]>>({});

  // Track which agents are expanded (showing all meetings)
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!agents.length) return;

    setAgentMeetingMap({}); // clear old data
    setExpandedAgents(new Set()); // collapse all on reload

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

  const safeFormatDate = formatDate ?? ((dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  });

  // Toggle expand/collapse for an agent
  const toggleAgent = (refId: string) => {
    setExpandedAgents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(refId)) {
        newSet.delete(refId);
      } else {
        newSet.add(refId);
      }
      return newSet;
    });
  };

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
            {agents.map((agent) => {
              const meetings = Array.isArray(agentMeetingMap[agent.ReferenceID])
                ? agentMeetingMap[agent.ReferenceID]
                : [];

              if (meetings.length === 0) {
                return (
                  <TableRow key={agent.ReferenceID + "-no-meetings"}>
                    <TableCell colSpan={6} className="text-left text-xs text-muted-foreground">
                      No meetings for {agent.Firstname} {agent.Lastname}
                    </TableCell>
                  </TableRow>
                );
              }

              // If expanded, show all meetings; otherwise, only show latest meeting (index 0)
              const meetingsToShow = expandedAgents.has(agent.ReferenceID) ? meetings : [meetings[0]];

              return meetingsToShow.map((meeting, idx) => {
                let duration = "no compute duration";
                if (meeting?.start_date && meeting?.end_date) {
                  const start = new Date(meeting.start_date);
                  const end = new Date(meeting.end_date);
                  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                    const diffMs = end.getTime() - start.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const hours = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    duration = `${hours}h ${mins}m`;
                  }
                }

                return (
                  <TableRow key={agent.ReferenceID + "-" + idx}>
                    <TableCell
                      onClick={() => idx === 0 && toggleAgent(agent.ReferenceID)}
                      className={`cursor-pointer select-none ${idx === 0 ? "font-semibold" : "pl-10"}`}
                      title={idx === 0 ? "Click to expand/collapse meetings" : ""}
                    >
                      {idx === 0 ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={agent.profilePicture || "/Taskflow.png"}
                            alt={`${agent.Firstname} ${agent.Lastname}`}
                            className="h-10 w-10 rounded-sm object-cover border"
                          />
                          <span className="text-xs font-medium capitalize">
                            {agent.Firstname} {agent.Lastname}
                          </span>

                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{safeFormatDate(meeting.start_date ?? undefined)}</TableCell>
                    <TableCell className="text-xs">{safeFormatDate(meeting.end_date ?? undefined)}</TableCell>
                    <TableCell className="text-xs">{duration}</TableCell>
                    <TableCell className="text-xs">{meeting.type_activity ?? "no type"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{meeting.remarks ?? "no remarks"}</TableCell>
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
