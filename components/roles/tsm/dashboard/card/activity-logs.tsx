"use client";

import { Card, CardHeader, CardContent, } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle, } from "@/components/ui/item";

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

const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;

    // Clean date string to be parseable by JS Date
    const cleanedStr = dateStr.replace(" at ", " ").replace(/ GMT.*$/, "");
    const date = new Date(cleanedStr);
    const today = new Date();

    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
};

export function AgentActivityLogs({ agents, agentActivityMap }: Props) {
    return (
        <Card>
            <CardHeader className="font-semibold">
                Agent Login Activity
            </CardHeader>

            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {agents.map((agent) => {
                    const activity = agentActivityMap[agent.ReferenceID];
                    const activeNow = isToday(activity?.latestLogin);

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

                                        <ItemDescription className="flex flex-col gap-0.5 text-xs">
                                            <div className="flex items-center gap-2">
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
            </CardContent>

        </Card>
    );
}
