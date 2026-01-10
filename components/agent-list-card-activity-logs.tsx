"use client";

import {
    Card,
    CardHeader,
    CardContent,
} from "@/components/ui/card";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from "@/components/ui/item";

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
}

interface Activity {
    latestLogin?: string | null;
    latestLogout?: string | null;
}

interface Props {
    agents: Agent[];
    agentActivityMap: Record<string, Activity>;
}

export function AgentActivityLogs({ agents, agentActivityMap }: Props) {
    return (
        <Card>
            <CardHeader className="font-semibold">
                Agent Login Activity
            </CardHeader>

            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {agents.map((agent) => {
                    const activity = agentActivityMap[agent.ReferenceID];

                    return (
                        <Item key={agent.ReferenceID} variant="outline">
                            <ItemContent className="flex gap-3">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={agent.profilePicture || "/Taskflow.png"}
                                        alt={`${agent.Firstname} ${agent.Lastname}`}
                                        className="h-20 w-20 rounded-sm object-cover border flex-shrink-0"
                                    />
                                    <div className="flex flex-col">
                                        <ItemTitle className="text-sm capitalize leading-tight">
                                            {agent.Firstname} {agent.Lastname}
                                        </ItemTitle>

                                        <ItemDescription className="flex flex-col gap-0.5 text-xs">
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
