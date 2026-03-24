"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
  Role: string;
  Status?: string | null;
  TargetQuota: string;
  Connection: string;
  TSM?: string; // ReferenceID of the TSM this agent belongs to
}

interface Activity {
  latestLogin?: string | null;
  latestLogout?: string | null;
}

interface Props {
  agents: Agent[];
  agentActivityMap: Record<string, Activity>;
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentItem({ agent, activity }: { agent: Agent; activity?: Activity }) {
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
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    agent.Connection === "Online"
                      ? "bg-green-500 animate-pulse border border-black"
                      : "bg-red-600 animate-pulse border border-black"
                  }`}
                  aria-label={`Connection: ${agent.Connection || "Offline"}`}
                />
                <span>{agent.Connection || "Not Connected"}</span>
                {" | "}
                <span>TQ: {Number(agent.TargetQuota).toLocaleString()}</span>
              </div>
              <span>Latest login: {activity?.latestLogin ?? "—"}</span>
              <span>Latest logout: {activity?.latestLogout ?? "—"}</span>
            </ItemDescription>
          </div>
        </div>
      </ItemContent>
    </Item>
  );
}

// ─── TSM Row (collapsible) ────────────────────────────────────────────────────

function TSMRow({
  tsm,
  tsaUnder,
  agentActivityMap,
}: {
  tsm: Agent;
  tsaUnder: Agent[];
  agentActivityMap: Record<string, Activity>;
}) {
  const [expanded, setExpanded] = useState(false);
  const activity = agentActivityMap?.[tsm.ReferenceID];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* ── TSM header row ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors
          ${expanded ? "bg-green-50 border-b border-green-100" : "bg-white hover:bg-gray-50"}`}
      >
        <div className="flex items-center gap-4">
          <img
            src={tsm.profilePicture || "/Taskflow.png"}
            alt={`${tsm.Firstname} ${tsm.Lastname}`}
            className="h-14 w-14 rounded-full shadow-sm object-cover border flex-shrink-0"
          />
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800 capitalize">
              {tsm.Firstname} {tsm.Lastname}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  tsm.Connection === "Online"
                    ? "bg-green-500 animate-pulse border border-black"
                    : "bg-red-600 border border-black"
                }`}
              />
              <span className="text-xs text-gray-500">
                {tsm.Connection || "Not Connected"}
              </span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">
                TQ: {tsaUnder.reduce((sum, a) => sum + (Number(a.TargetQuota) || 0), 0).toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
              Login: {activity?.latestLogin ?? "—"}
            </p>
            <p className="text-[11px] text-gray-400 font-mono">
              Logout: {activity?.latestLogout ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Agent count badge */}
          <div className="flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-1 rounded-full border border-green-200">
            <Users size={11} />
            {tsaUnder.length} agent{tsaUnder.length !== 1 ? "s" : ""}
          </div>
          {expanded ? (
            <ChevronDown size={16} className="text-green-600" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* ── TSA agents under this TSM ── */}
      {expanded && (
        <div className="px-4 py-4 bg-gray-50">
          {tsaUnder.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No agents under this TSM.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tsaUnder.map((agent) => (
                <AgentItem
                  key={agent.ReferenceID}
                  agent={agent}
                  activity={agentActivityMap?.[agent.ReferenceID]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentActivityLogs({ agents, agentActivityMap }: Props) {
  // Filter out resigned / terminated agents
  const activeAgents = agents.filter(
    (a) => !["resigned", "terminated"].includes((a.Status || "").toLowerCase())
  );

  const tsmAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Manager"
  );
  const tsaAgents = activeAgents.filter(
    (a) => a.Role === "Territory Sales Associate"
  );

  // TSAs that have no TSM assigned (orphaned)
  const orphanedTSAs = tsaAgents.filter(
    (tsa) =>
      !tsa.TSM ||
      !tsmAgents.some(
        (tsm) => tsm.ReferenceID.toLowerCase() === tsa.TSM?.toLowerCase()
      )
  );

  return (
    <Card>
      <CardHeader className="font-semibold">
        User&apos;s Login Activity
      </CardHeader>

      <CardContent className="flex flex-col gap-4">

        {/* ── TSMs (each expandable to show their TSAs) ── */}
        {tsmAgents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Territory Sales Managers
            </h4>
            <div className="flex flex-col gap-3">
              {tsmAgents.map((tsm) => {
                const tsaUnder = tsaAgents.filter(
                  (tsa) =>
                    tsa.TSM?.toLowerCase() === tsm.ReferenceID.toLowerCase()
                );
                return (
                  <TSMRow
                    key={tsm.ReferenceID}
                    tsm={tsm}
                    tsaUnder={tsaUnder}
                    agentActivityMap={agentActivityMap}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Orphaned TSAs (no TSM assigned) ── */}
        {orphanedTSAs.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Territory Sales Associates (Unassigned)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {orphanedTSAs.map((agent) => (
                <AgentItem
                  key={agent.ReferenceID}
                  agent={agent}
                  activity={agentActivityMap?.[agent.ReferenceID]}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {tsmAgents.length === 0 && orphanedTSAs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No active agents to display.
          </p>
        )}
      </CardContent>
    </Card>
  );
}