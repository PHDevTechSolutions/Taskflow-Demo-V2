import React, { useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
    source: string;
    call_status: string;
    type_activity: string;
    start_date: string; // ISO string timestamp
    end_date: string;   // ISO string timestamp
}

interface OutboundCardProps {
    history: HistoryItem[];
}

// Helper: format milliseconds into readable string
function formatDurationMs(ms: number) {
    if (ms <= 0) return "-";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
    if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
    if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

    return parts.join(" ") || "0 sec";
}

// Helper: calculate average duration in ms for given filtered items
function averageDurationMs(items: HistoryItem[]) {
    if (items.length === 0) return 0;

    const totalMs = items.reduce((acc, curr) => {
        const start = new Date(curr.start_date).getTime();
        const end = new Date(curr.end_date).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
            return acc + (end - start);
        }
        return acc;
    }, 0);

    return totalMs / items.length;
}

export function InboundRepliesCard({ history }: OutboundCardProps) {
    // Counts based on filtered history
    const inboundCount = useMemo(() => {
        return history.filter((item) => item.type_activity === "Inbound Calls").length;
    }, [history]);

    const viberCount = useMemo(() => {
        return history.filter((item) => item.type_activity === "Viber Replies / Messages").length;
    }, [history]);

    const fbMarketplaceCount = useMemo(() => {
        return history.filter((item) => item.type_activity === "FB Marketplace Replies / Messages").length;
    }, [history]);

    // Average durations in ms
    const avgDurationInboundMs = useMemo(() => {
        const filtered = history.filter((item) => item.type_activity === "Inbound Calls");
        return averageDurationMs(filtered);
    }, [history]);

    const avgDurationViberUpMs = useMemo(() => {
        const filtered = history.filter((item) => item.type_activity === "Viber Replies / Messages");
        return averageDurationMs(filtered);
    }, [history]);

    const avgDurationFBfulMs = useMemo(() => {
        const filtered = history.filter((item) => item.type_activity === "FB Marketplace Replies / Messages");
        return averageDurationMs(filtered);
    }, [history]);


    // Total average duration summed
    const totalAverageDurationMs = useMemo(() => {
        return (
            avgDurationInboundMs +
            avgDurationViberUpMs +
            avgDurationFBfulMs
        );
    }, [avgDurationInboundMs, avgDurationViberUpMs, avgDurationFBfulMs]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Inbound and Other Replies History</CardTitle>
                <CardDescription>
                    Summary of all inbound calls, Viber replies/messages, and Facebook Marketplace replies/messages
                    including counts for the selected agent.
                </CardDescription>

            </CardHeader>

            <CardContent className="space-y-4 flex-1 overflow-auto">
                {inboundCount > 0 && (
                    <Item variant="outline">
                        <ItemContent>
                            <div className="flex w-full items-center justify-between">
                                <ItemTitle className="text-sm font-mono tabular-nums">
                                    Inbound Calls
                                </ItemTitle>

                                <ItemDescription className="text-lg font-bold">
                                    <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                                        {inboundCount}
                                    </Badge>
                                </ItemDescription>
                            </div>
                            <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationInboundMs)}</p>
                        </ItemContent>
                    </Item>
                )}

                {viberCount > 0 && (
                    <Item variant="outline">
                        <ItemContent>
                            <div className="flex w-full items-center justify-between">
                                <ItemTitle className="text-sm font-mono tabular-nums">
                                    Total Viber Replies / Messages
                                </ItemTitle>

                                <ItemDescription className="text-lg font-bold">
                                    <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                                        {viberCount}
                                    </Badge>
                                </ItemDescription>
                            </div>
                            <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationViberUpMs)}</p>
                        </ItemContent>
                    </Item>
                )}

                {fbMarketplaceCount > 0 && (
                    <Item variant="outline">
                        <ItemContent>
                            <div className="flex w-full items-center justify-between">
                                <ItemTitle className="text-sm font-mono tabular-nums whitespace-normal">
                                    Total FB Marketplace Replies
                                </ItemTitle>
                                <ItemDescription className="text-lg font-bold">
                                    <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                                        {fbMarketplaceCount}
                                    </Badge>
                                </ItemDescription>
                            </div>
                            <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationFBfulMs)}</p>
                        </ItemContent>
                    </Item>
                )}
            </CardContent>

            <CardFooter className="flex justify-between sticky bottom-0 bg-white">
                {totalAverageDurationMs > 0 && (
                    <>
                        <p className="self-center text-xs italic">
                            Avg duration total: {formatDurationMs(totalAverageDurationMs)}
                        </p>
                        <Badge className="h-8 min-w-8 rounded-full px-4 font-mono tabular-nums">
                            Total: {inboundCount + viberCount + fbMarketplaceCount}
                        </Badge>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
