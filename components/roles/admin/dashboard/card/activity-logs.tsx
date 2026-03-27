"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { ChevronDown, ChevronRight, Users, Briefcase } from "lucide-react";

import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, onSnapshot,
} from "firebase/firestore";

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
  Manager?: string;
}

interface Activity {
  latestLogin?: string | null;
  latestLogout?: string | null;
}

interface Props {
  agents: Agent[];
  selectedAgent?: string;
  onSelectAgent?: (referenceId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSame(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function formatFirestoreDate(value: any): string | null {
  if (!value) return null;
  const options: Intl.DateTimeFormatOptions = {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  };
  if (value?.toDate) return value.toDate().toLocaleString("en-PH", options);
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString("en-PH", options);
  }
  return null;
}

// ─── Hook: subscribe to login/logout for a single agent ───────────────────────

function useAgentActivity(referenceId: string): Activity {
  const [activity, setActivity] = useState<Activity>({
    latestLogin: null,
    latestLogout: null,
  });

  useEffect(() => {
    if (!referenceId) return;

    const q = query(
      collection(db, "activity_logs"),
      where("ReferenceID", "==", referenceId),
      orderBy("date_created", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loginDoc  = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "login");
        const logoutDoc = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "logout");
        setActivity({
          latestLogin:  loginDoc  ? formatFirestoreDate(loginDoc.data().date_created)  : null,
          latestLogout: logoutDoc ? formatFirestoreDate(logoutDoc.data().date_created) : null,
        });
      },
      (err) => console.error("[AgentActivityLogs] Firestore error:", err)
    );

    return () => unsub();
  }, [referenceId]);

  return activity;
}

// ─── Agent Item (TSA) ─────────────────────────────────────────────────────────

function AgentItem({
  agent,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const activity = useAgentActivity(agent.ReferenceID);

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
                <span>Latest login: {activity.latestLogin ?? "—"}</span>
                <span>Latest logout: {activity.latestLogout ?? "—"}</span>
              </ItemDescription>
            </div>
          </div>
        </ItemContent>
      </Item>
    </button>
  );
}

// ─── TSM Row (TSM -> TSA) ─────────────────────────────────────────────────────

function TSMRow({
  tsm,
  tsaUnder,
  selectedAgent,
  onSelectAgent,
}: {
  tsm: Agent;
  tsaUnder: Agent[];
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
}) {
  const isTSMSelected    = isSame(tsm.ReferenceID, selectedAgent);
  const hasSelectedChild = tsaUnder.some((a) => isSame(a.ReferenceID, selectedAgent));
  const [expanded, setExpanded] = useState(isTSMSelected || hasSelectedChild);

  const activity  = useAgentActivity(tsm.ReferenceID);
  
  // Total TQ: TSM's own TQ + all TSAs under them
  const teamTQ = useMemo(() => {
    const tsmTQ = Number(tsm.TargetQuota) || 0;
    const tsasTQ = tsaUnder.reduce((sum, a) => sum + (Number(a.TargetQuota) || 0), 0);
    return tsmTQ + tsasTQ;
  }, [tsm, tsaUnder]);

  function handleTSMClick() {
    setExpanded((v) => !v);
    onSelectAgent(isTSMSelected ? "all" : tsm.ReferenceID);
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-sm border transition-all duration-150
      ${isTSMSelected ? "ring-2 ring-green-500 border-green-300" : "border-gray-200"}`}
    >
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
                Team TQ: {teamTQ.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
              Login: {activity.latestLogin ?? "—"}
            </p>
            <p className="text-[11px] text-gray-400 font-mono">
              Logout: {activity.latestLogout ?? "—"}
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
                  isSelected={isSame(agent.ReferenceID, selectedAgent)}
                  onSelect={() => onSelectAgent(isSame(agent.ReferenceID, selectedAgent) ? "all" : agent.ReferenceID)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manager Row (Manager -> TSM) ─────────────────────────────────────────────

function ManagerRow({
  manager,
  tsmsUnder,
  tsaAgents,
  selectedAgent,
  onSelectAgent,
}: {
  manager: Agent;
  tsmsUnder: Agent[];
  tsaAgents: Agent[];
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
}) {
  const isManagerSelected = isSame(manager.ReferenceID, selectedAgent);
  const hasSelectedChild = tsmsUnder.some((tsm) => {
    if (isSame(tsm.ReferenceID, selectedAgent)) return true;
    return tsaAgents.some(tsa => isSame(tsa.TSM, tsm.ReferenceID) && isSame(tsa.ReferenceID, selectedAgent));
  });

  const [expanded, setExpanded] = useState(isManagerSelected || hasSelectedChild);
  const activity = useAgentActivity(manager.ReferenceID);

  // Total TQ: Manager's TQ + TSMs' TQ + TSAs' TQ
  const teamTQ = useMemo(() => {
    const managerTQ = Number(manager.TargetQuota) || 0;
    const tsmsTQ = tsmsUnder.reduce((sum, tsm) => sum + (Number(tsm.TargetQuota) || 0), 0);
    const tsasTQ = tsaAgents.filter(tsa => tsmsUnder.some(tsm => isSame(tsa.TSM, tsm.ReferenceID)))
                             .reduce((sum, tsa) => sum + (Number(tsa.TargetQuota) || 0), 0);
    return managerTQ + tsmsTQ + tsasTQ;
  }, [manager, tsmsUnder, tsaAgents]);

  function handleManagerClick() {
    setExpanded((v) => !v);
    onSelectAgent(isManagerSelected ? "all" : manager.ReferenceID);
  }

  return (
    <div className={`rounded-xl overflow-hidden shadow-md border transition-all duration-150 mb-4
      ${isManagerSelected ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200"}`}
    >
      <button
        type="button"
        onClick={handleManagerClick}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors
          ${expanded || isManagerSelected
            ? "bg-blue-50 border-b border-blue-100"
            : "bg-white hover:bg-gray-50"
          }`}
      >
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <img
              src={manager.profilePicture || "/Taskflow.png"}
              alt={`${manager.Firstname} ${manager.Lastname}`}
              className="h-16 w-16 rounded-full shadow-md object-cover border-2 border-white"
            />
            {isManagerSelected && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">✓</span>
              </span>
            )}
          </div>

          <div className="text-left">
            <p className={`text-base font-bold capitalize ${isManagerSelected ? "text-blue-800" : "text-gray-900"}`}>
              {manager.Firstname} {manager.Lastname}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  manager.Connection === "Online"
                    ? "bg-green-500 animate-pulse border border-black"
                    : "bg-red-600 border border-black"
                }`}
              />
              <span className="text-xs font-medium text-gray-600">{manager.Connection || "Not Connected"}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                Manager
              </span>
            </div>
            <div className="flex flex-col mt-2 gap-0.5">
              <p className="text-[11px] text-gray-500 font-mono">
                Team TQ: {teamTQ.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-500 font-mono">
                Latest login: {activity.latestLogin ?? "—"}
              </p>
              <p className="text-[11px] text-gray-500 font-mono">
                Latest logout: {activity.latestLogout ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 shadow-sm">
            <Briefcase size={14} />
            {tsmsUnder.length} TSM{tsmsUnder.length !== 1 ? "s" : ""}
          </div>
          {expanded
            ? <ChevronDown size={20} className="text-blue-600" />
            : <ChevronRight size={20} className="text-gray-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-6 py-6 bg-gray-50/50 flex flex-col gap-4">
          {tsmsUnder.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 italic bg-white rounded-lg border border-dashed border-gray-200">
              No TSMs assigned to this manager.
            </p>
          ) : (
            tsmsUnder.map((tsm) => {
              const tsasUnderTSM = tsaAgents.filter(tsa => isSame(tsa.TSM, tsm.ReferenceID));
              return (
                <TSMRow
                  key={tsm.ReferenceID}
                  tsm={tsm}
                  tsaUnder={tsasUnderTSM}
                  selectedAgent={selectedAgent}
                  onSelectAgent={onSelectAgent}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentActivityLogs({
  agents,
  selectedAgent,
  onSelectAgent,
}: Props) {
  const safeSelected = selectedAgent ?? "all";
  const handleSelect = onSelectAgent ?? (() => {});

  const activeAgents = agents.filter(
    (a) => !["resigned", "terminated"].includes((a.Status ?? "").toLowerCase())
  );

  const managerAgents = activeAgents.filter((a) => a.Role === "Manager");
  const tsmAgents     = activeAgents.filter((a) => a.Role === "Territory Sales Manager");
  const tsaAgents     = activeAgents.filter((a) => a.Role === "Territory Sales Associate");

  // Orphaned TSMs (no manager assigned)
  const orphanedTSMs = tsmAgents.filter(
    (tsm) =>
      !tsm.Manager ||
      !managerAgents.some((m) => isSame(m.ReferenceID, tsm.Manager))
  );

  // Orphaned TSAs (no TSM or Manager chain)
  const orphanedTSAs = tsaAgents.filter(
    (tsa) =>
      (!tsa.TSM || !tsmAgents.some(tsm => isSame(tsm.ReferenceID, tsa.TSM))) &&
      (!tsa.Manager || !managerAgents.some(m => isSame(m.ReferenceID, tsa.Manager)))
  );

  return (
    <Card>
      <CardHeader className="font-bold text-lg border-b border-gray-100 flex flex-row items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Users className="text-blue-600" />
          <span>Organization Login Activity</span>
        </div>
        {safeSelected !== "all" && (
          <button
            onClick={() => handleSelect("all")}
            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-full font-bold transition-colors border border-red-200"
          >
            Clear selection
          </button>
        )}
      </CardHeader>

      <CardContent className="p-6 flex flex-col gap-8">
        {/* Managers with their hierarchy */}
        {managerAgents.length > 0 && (
          <section className="flex flex-col gap-4">
            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-l-4 border-blue-600 pl-3">
              Sales Managers
            </h4>
            <div className="flex flex-col">
              {managerAgents.map((manager) => {
                const tsmsUnder = tsmAgents.filter((tsm) => isSame(tsm.Manager, manager.ReferenceID));
                return (
                  <ManagerRow
                    key={manager.ReferenceID}
                    manager={manager}
                    tsmsUnder={tsmsUnder}
                    tsaAgents={tsaAgents}
                    selectedAgent={safeSelected}
                    onSelectAgent={handleSelect}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* TSMs with no manager assigned */}
        {orphanedTSMs.length > 0 && (
          <section className="flex flex-col gap-4">
            <h4 className="text-xs font-black text-green-600 uppercase tracking-widest border-l-4 border-green-600 pl-3">
              Unassigned TSMs
            </h4>
            <div className="flex flex-col gap-3">
              {orphanedTSMs.map((tsm) => {
                const tsaUnder = tsaAgents.filter((tsa) => isSame(tsa.TSM, tsm.ReferenceID));
                return (
                  <TSMRow
                    key={tsm.ReferenceID}
                    tsm={tsm}
                    tsaUnder={tsaUnder}
                    selectedAgent={safeSelected}
                    onSelectAgent={handleSelect}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* TSAs with no hierarchy */}
        {orphanedTSAs.length > 0 && (
          <section className="flex flex-col gap-4">
            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest border-l-4 border-gray-400 pl-3">
              Other Agents
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {orphanedTSAs.map((agent) => (
                <AgentItem
                  key={agent.ReferenceID}
                  agent={agent}
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
        {managerAgents.length === 0 && tsmAgents.length === 0 && tsaAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 italic">
            <Users size={48} className="mb-4 opacity-10" />
            <p className="text-sm">No active organization members found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
