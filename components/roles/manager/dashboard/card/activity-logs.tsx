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
  TSM?: string;
}

interface Activity {
  latestLogin?: string | null;
  latestLogout?: string | null;
}

interface Props {
  agents: Agent[];
  agentActivityMap: Record<string, Activity>;
  selectedAgent?: string;
  onSelectAgent?: (referenceId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSame(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentItem({
  agent,
  activity,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  activity?: Activity;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border transition-all duration-150 overflow-hidden
        ${isSelected
          ? "ring-2 ring-green-500 border-green-300 bg-green-50 shadow-md"
          : "border-gray-200 bg-white hover:border-green-300 hover:shadow-md hover:bg-green-50/40"
        }`}
    >
      <Item variant="outline" className="border-0 shadow-none bg-transparent">
        <ItemContent className="flex gap-3 font-mono">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <img
                src={agent.profilePicture || "/Taskflow.png"}
                alt={`${agent.Firstname} ${agent.Lastname}`}
                className="h-20 w-20 rounded-full shadow-sm object-cover border"
              />
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">✓</span>
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <ItemTitle className={`text-xs capitalize leading-tight ${isSelected ? "text-green-800 font-bold" : ""}`}>
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
    </button>
  );
}

// ─── TSM Row ──────────────────────────────────────────────────────────────────

function TSMRow({
  tsm,
  tsaUnder,
  agentActivityMap,
  selectedAgent,
  onSelectAgent,
}: {
  tsm: Agent;
  tsaUnder: Agent[];
  agentActivityMap: Record<string, Activity>;
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
}) {
  const isTSMSelected   = isSame(tsm.ReferenceID, selectedAgent);
  const hasSelectedChild = tsaUnder.some((a) => isSame(a.ReferenceID, selectedAgent));
  const [expanded, setExpanded] = useState(isTSMSelected || hasSelectedChild);

  const activity = agentActivityMap?.[tsm.ReferenceID];
  const summedTQ = tsaUnder.reduce((sum, a) => sum + (Number(a.TargetQuota) || 0), 0);

  function handleTSMClick() {
    // Toggle expand; select/deselect TSM
    setExpanded((v) => !v);
    onSelectAgent(isTSMSelected ? "all" : tsm.ReferenceID);
  }

  function handleAgentClick(agentId: string) {
    onSelectAgent(isSame(agentId, selectedAgent) ? "all" : agentId);
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-sm border transition-all duration-150
      ${isTSMSelected ? "ring-2 ring-green-500 border-green-300" : "border-gray-200"}`}
    >
      {/* TSM header */}
      <button
        type="button"
        onClick={handleTSMClick}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors
          ${expanded || isTSMSelected
            ? "bg-green-50 border-b border-green-100"
            : "bg-white hover:bg-gray-50"
          }`}
      >
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img
              src={tsm.profilePicture || "/Taskflow.png"}
              alt={`${tsm.Firstname} ${tsm.Lastname}`}
              className="h-14 w-14 rounded-full shadow-sm object-cover border"
            />
            {isTSMSelected && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">✓</span>
              </span>
            )}
          </div>

          <div className="text-left">
            <p className={`text-sm font-bold capitalize ${isTSMSelected ? "text-green-800" : "text-gray-800"}`}>
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
              <span className="text-xs text-gray-500">{tsm.Connection || "Not Connected"}</span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">
                Team TQ: {summedTQ.toLocaleString()}
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
          <div className="flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-1 rounded-full border border-green-200">
            <Users size={11} />
            {tsaUnder.length} agent{tsaUnder.length !== 1 ? "s" : ""}
          </div>
          {expanded
            ? <ChevronDown size={16} className="text-green-600" />
            : <ChevronRight size={16} className="text-gray-400" />
          }
        </div>
      </button>

      {/* TSA agents */}
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
                  isSelected={isSame(agent.ReferenceID, selectedAgent)}
                  onSelect={() => handleAgentClick(agent.ReferenceID)}
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

export function AgentActivityLogs({
  agents,
  agentActivityMap,
  selectedAgent,
  onSelectAgent,
}: Props) {
  // Normalize — always a string so nothing downstream can crash
  const safeSelected   = selectedAgent ?? "all";
  const handleSelect   = onSelectAgent ?? (() => {});

  const activeAgents = agents.filter(
    (a) => !["resigned", "terminated"].includes((a.Status ?? "").toLowerCase())
  );

  const tsmAgents    = activeAgents.filter((a) => a.Role === "Territory Sales Manager");
  const tsaAgents    = activeAgents.filter((a) => a.Role === "Territory Sales Associate");
  const orphanedTSAs = tsaAgents.filter(
    (tsa) =>
      !tsa.TSM ||
      !tsmAgents.some((tsm) => isSame(tsm.ReferenceID, tsa.TSM))
  );

  return (
    <Card>
      <CardHeader className="font-semibold flex flex-row items-center justify-between">
        <span>User&apos;s Login Activity</span>
        {safeSelected !== "all" && (
          <button
            onClick={() => handleSelect("all")}
            className="text-xs text-red-500 hover:text-red-700 font-semibold underline underline-offset-2"
          >
            Clear selection
          </button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">

        {/* TSMs */}
        {tsmAgents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Territory Sales Managers
            </h4>
            <div className="flex flex-col gap-3">
              {tsmAgents.map((tsm) => {
                const tsaUnder = tsaAgents.filter((tsa) => isSame(tsa.TSM, tsm.ReferenceID));
                return (
                  <TSMRow
                    key={tsm.ReferenceID}
                    tsm={tsm}
                    tsaUnder={tsaUnder}
                    agentActivityMap={agentActivityMap}
                    selectedAgent={safeSelected}
                    onSelectAgent={handleSelect}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Orphaned TSAs */}
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
                  isSelected={isSame(agent.ReferenceID, safeSelected)}
                  onSelect={() =>
                    handleSelect(isSame(agent.ReferenceID, safeSelected) ? "all" : agent.ReferenceID)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {tsmAgents.length === 0 && orphanedTSAs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No active agents to display.
          </p>
        )}
      </CardContent>
    </Card>
  );
}