"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

/* =======================
   Types
======================= */

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
  Role: string;
  Status?: string | null;
  TargetQuota: string;
  Connection: string;
}

interface Activity {
  latestLogin?: string | null;
  latestLogout?: string | null;
}

interface Props {
  agents: Agent[];
  agentActivityMap: Record<string, Activity>;
}

/* =======================
   Component
======================= */

export function AgentActivityLogs({ agents, agentActivityMap }: Props) {
  // Filter out resigned or terminated agents (case insensitive)
  const activeAgents = agents.filter(
    (a) =>
      !["resigned", "terminated"].includes((a.Status || "").toLowerCase())
  );

  // Group by role
  const tsaAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Associate"
  );
  const tsmAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Manager"
  );

  // Check if a date string is today
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;

    // Clean date string to parse correctly
    const cleanedStr = dateStr.replace(" at ", " ").replace(/ GMT.*$/, "");
    const date = new Date(cleanedStr);
    const today = new Date();

    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Render a responsive grid of agent cards
  const renderAgentsGrid = (list: Agent[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {list.map((agent) => {
        const activity = agentActivityMap?.[agent.ReferenceID];

        return (
          <Item key={agent.ReferenceID} variant="outline">
            <ItemContent className="flex gap-3 font-mono">
              <div className="flex items-center gap-4">
                <img
                  src={agent.profilePicture || "/Taskflow.png"}
                  alt={`${agent.Firstname} ${agent.Lastname}`}
                  className="h-20 w-20 rounded-full shadow-sm object-cover border flex-shrink-0"
                />

                <div className="flex flex-col">
                  <ItemTitle className="text-xs capitalize leading-tight">
                    {agent.Firstname} {agent.Lastname}
                  </ItemTitle>

                  <ItemDescription className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      {/* Connection status circle */}
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${agent.Connection === "Online"
                          ? "bg-green-500 animate-pulse border border-black"
                          : agent.Connection
                            ? "bg-red-600 animate-pulse border border-black"
                            : "bg-red-600 border border-black"
                          }`}
                        aria-label={`Connection status: ${agent.Connection || "Offline"
                          }`}
                      />
                      <span>{agent.Connection || "Not Connected"}</span> |{" "}
                      <span>TQ: {Number(agent.TargetQuota).toLocaleString()}</span>
                    </div>

                    <span>
                      Latest login: {activity?.latestLogin ?? "—"}
                    </span>
                    <span>
                      Latest logout: {activity?.latestLogout ?? "—"}
                    </span>
                  </ItemDescription>
                </div>
              </div>
            </ItemContent>
          </Item>
        );
      })}
    </div>
  );

  return (
    <Card>
      <CardHeader className="font-semibold">
        User&apos;s Login Activity
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Territory Sales Associates */}
        {tsaAgents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Territory Sales Associates
            </h4>
            {renderAgentsGrid(tsaAgents)}
          </section>
        )}

        {/* Territory Sales Managers */}
        {tsmAgents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Territory Sales Managers
            </h4>
            {renderAgentsGrid(tsmAgents)}
          </section>
        )}

        {/* Empty state */}
        {tsaAgents.length === 0 && tsmAgents.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            No active agents to display
          </p>
        )}
      </CardContent>
    </Card>
  );
}
