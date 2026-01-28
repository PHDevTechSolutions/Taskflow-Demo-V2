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

export function AgentActivityLogs({
  agents,
  agentActivityMap,
}: Props) {
  /* 🔹 FILTER OUT resigned & terminated */
  const activeAgents = agents.filter(
    (a) =>
      !["resigned", "terminated"].includes(
        (a.Status || "").toLowerCase()
      )
  );

  /* 🔹 GROUP BY ROLE */
  const tsaAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Associate"
  );

  const tsmAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Manager"
  );

  /* 🔹 RENDER GRID */
  const renderAgentsGrid = (list: Agent[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {list.map((agent) => {
        const activity =
          agentActivityMap?.[agent.ReferenceID];

        return (
          <Item
            key={agent.ReferenceID}
            variant="outline"
          >
            <ItemContent className="flex gap-3 font-mono">
              <div className="flex items-center gap-4">
                <img
                  src={
                    agent.profilePicture ||
                    "/Taskflow.png"
                  }
                  alt={`${agent.Firstname} ${agent.Lastname}`}
                  className="h-20 w-20 rounded-full shadow-sm object-cover border flex-shrink-0"
                />

                <div className="flex flex-col">
                  <ItemTitle className="text-xs capitalize leading-tight">
                    {agent.Firstname}{" "}
                    {agent.Lastname}
                  </ItemTitle>

                  <ItemDescription className="flex flex-col gap-0.5 text-xs">
                    <span>
                      Latest login:{" "}
                      {activity?.latestLogin ??
                        "—"}
                    </span>
                    <span>
                      Latest logout:{" "}
                      {activity?.latestLogout ??
                        "—"}
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

  /* =======================
     Render
  ======================= */

  return (
    <Card>
      <CardHeader className="font-semibold">
        User&apos;s Login Activity
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* TSA */}
        {tsaAgents.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Territory Sales Associates
            </h4>
            {renderAgentsGrid(tsaAgents)}
          </div>
        )}

        {/* TSM */}
        {tsmAgents.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Territory Sales Managers
            </h4>
            {renderAgentsGrid(tsmAgents)}
          </div>
        )}

        {/* EMPTY STATE */}
        {tsaAgents.length === 0 &&
          tsmAgents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              No active agents to display
            </p>
          )}
      </CardContent>
    </Card>
  );
}
