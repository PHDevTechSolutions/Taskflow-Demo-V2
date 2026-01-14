import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
  Role: string;
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
  agentMeetingMap: Record<string, Meeting>;
  formatDate?: (dateStr?: string) => string;
}

export function AgentMeetings({ agents, agentMeetingMap, formatDate }: Props) {
  // 👉 group by role
  const tsaAgents = agents.filter(
    (a) => a.Role === "Territory Sales Associate"
  );

  const tsmAgents = agents.filter(
    (a) => a.Role === "Territory Sales Manager"
  );

  const renderRows = (list: Agent[]) =>
    list.map((agent) => {
      const meeting = agentMeetingMap[agent.ReferenceID];

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
        <TableRow key={agent.ReferenceID}>
          <TableCell>
            <div className="flex items-center gap-3">
              <img
                src={agent.profilePicture || "/Taskflow.png"}
                alt={`${agent.Firstname} ${agent.Lastname}`}
                className="h-10 w-10 rounded-sm shadow-sm object-cover border"
              />
              <span className="text-xs font-medium capitalize">
                {agent.Firstname} {agent.Lastname}
              </span>
            </div>
          </TableCell>

          <TableCell className="text-xs">
            {meeting?.start_date ?? "no set date"}
          </TableCell>

          <TableCell className="text-xs">
            {meeting?.end_date ?? "no set date"}
          </TableCell>

          <TableCell className="text-xs">{duration}</TableCell>
          <TableCell className="text-xs">
            {meeting?.type_activity ?? "no type"}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {meeting?.remarks ?? "no remarks"}
          </TableCell>
        </TableRow>
      );
    });

  return (
    <Card>
      <CardHeader className="font-semibold">Meetings</CardHeader>

      <CardContent className="font-mono">
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
            {/* TSA SECTION */}
            {tsaAgents.length > 0 && (
              <>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-xs font-semibold uppercase bg-muted"
                  >
                    Territory Sales Associates
                  </TableCell>
                </TableRow>
                {renderRows(tsaAgents)}
              </>
            )}

            {/* TSM SECTION */}
            {tsmAgents.length > 0 && (
              <>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-xs font-semibold uppercase bg-muted"
                  >
                    Territory Sales Managers
                  </TableCell>
                </TableRow>
                {renderRows(tsmAgents)}
              </>
            )}

            {/* EMPTY STATE */}
            {tsaAgents.length === 0 && tsmAgents.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-xs text-muted-foreground"
                >
                  No meetings found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
