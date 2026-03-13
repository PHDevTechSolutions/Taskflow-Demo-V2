"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
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

const isOnline = (connection: string) =>
  connection?.toLowerCase() === "online";

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "—";
  const cleaned = dateStr.replace(" at ", " ").replace(/ GMT.*$/, "");
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export function AgentActivityLogs({ agents, agentActivityMap }: Props) {
  const online = agents.filter((a) => isOnline(a.Connection));
  const offline = agents.filter((a) => !isOnline(a.Connection));
  const sorted = [...online, ...offline];

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Agent Login Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">Real-time connection status of your team</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {online.length} Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
              {offline.length} Offline
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {sorted.map((agent) => {
            const activity = agentActivityMap[agent.ReferenceID];
            const online = isOnline(agent.Connection);

            return (
              <div
                key={agent.ReferenceID}
                className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                  online
                    ? "border-green-200 bg-green-50/40"
                    : "border-gray-100 bg-white"
                }`}
              >
                {/* Status bar on left edge */}
                <div
                  className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${
                    online ? "bg-green-500" : "bg-gray-200"
                  }`}
                />

                {/* Avatar */}
                <div className="relative flex-shrink-0 ml-1.5">
                  <img
                    src={agent.profilePicture || "/Taskflow.png"}
                    alt={`${agent.Firstname} ${agent.Lastname}`}
                    className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      online ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 capitalize truncate leading-tight">
                    {agent.Firstname} {agent.Lastname}
                  </p>

                  <p className={`text-[10px] font-medium mt-0.5 ${online ? "text-green-600" : "text-gray-400"}`}>
                    {agent.Connection || "Offline"}
                  </p>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                      </svg> Login:
                      <span className="truncate">{formatDateTime(activity?.latestLogin)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                      </svg> Logout:
                      <span className="truncate">{formatDateTime(activity?.latestLogout)}</span>
                    </div>
                  </div>

                  {/* Target Quota badge */}
                  <div className="mt-2.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                      <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Target Quota: ₱{Number(agent.TargetQuota).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="col-span-full text-center py-10 text-xs text-gray-400">
              No agents found.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}