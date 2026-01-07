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

export function OutboundCard({ history }: OutboundCardProps) {
  // Counts
  const outboundTouchbaseCount = useMemo(() => {
    return history.filter((item) => item.source === "Outbound - Touchbase").length;
  }, [history]);

  const outboundFollowupCount = useMemo(() => {
    return history.filter((item) => item.source === "Outbound - Follow-up").length;
  }, [history]);

  const successfulCallsCount = useMemo(() => {
    return history.filter((item) => item.call_status === "Successful").length;
  }, [history]);

  const unsuccessfulCallsCount = useMemo(() => {
    return history.filter((item) => item.call_status === "Unsuccessful").length;
  }, [history]);

  const outboundCallsCount = useMemo(() => {
    return history.filter((item) => item.type_activity === "Outbound Calls").length;
  }, [history]);

  // Average durations in ms
  const avgDurationTouchbaseMs = useMemo(() => {
    const filtered = history.filter((item) => item.source === "Outbound - Touchbase");
    return averageDurationMs(filtered);
  }, [history]);

  const avgDurationFollowUpMs = useMemo(() => {
    const filtered = history.filter((item) => item.source === "Outbound - Follow-up");
    return averageDurationMs(filtered);
  }, [history]);

  const avgDurationSuccessfulMs = useMemo(() => {
    const filtered = history.filter((item) => item.call_status === "Successful");
    return averageDurationMs(filtered);
  }, [history]);

  const avgDurationUnsuccessfulMs = useMemo(() => {
    const filtered = history.filter((item) => item.call_status === "Unsuccessful");
    return averageDurationMs(filtered);
  }, [history]);

  // Total average duration summed
  const totalAverageDurationMs = useMemo(() => {
    return (
      avgDurationTouchbaseMs +
      avgDurationFollowUpMs +
      avgDurationSuccessfulMs +
      avgDurationUnsuccessfulMs
    );
  }, [avgDurationTouchbaseMs, avgDurationFollowUpMs, avgDurationSuccessfulMs, avgDurationUnsuccessfulMs]);

  const hasAnyActivity =
    outboundTouchbaseCount +
    outboundFollowupCount +
    successfulCallsCount +
    unsuccessfulCallsCount > 0;

  return (
    <Card className="flex flex-col h-full bg-white z-20 text-black">
      <CardHeader>
        <CardTitle>Outbound History</CardTitle>
        <CardDescription>
          Summary of all outbound call activities including touchbase, follow-ups,
          and call outcomes for the selected agent.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 overflow-auto">
        {!hasAnyActivity ? (
          <p className="text-center text-sm italic text-gray-500 mt-4">
            No records found. Coordinate with your TSA to create activities.
          </p>
        ) : (
          <>
            {outboundTouchbaseCount > 0 && (
              <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
                <ItemContent>
                  <div className="flex w-full items-center justify-between">
                    <ItemTitle className="text-sm font-mono tabular-nums">
                      Outbound - Touchbase
                    </ItemTitle>
                    <ItemDescription className="text-lg font-bold">
                      <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                        {outboundTouchbaseCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                  <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationTouchbaseMs)}</p>
                </ItemContent>
              </Item>
            )}

            {successfulCallsCount > 0 && (
              <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
                <ItemContent>
                  <div className="flex w-full items-center justify-between">
                    <ItemTitle className="text-sm font-mono tabular-nums">Total Successful Calls</ItemTitle>
                    <ItemDescription className="text-lg font-bold">
                      <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                        {successfulCallsCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                  <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationSuccessfulMs)}</p>
                </ItemContent>
              </Item>
            )}

            {unsuccessfulCallsCount > 0 && (
              <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
                <ItemContent>
                  <div className="flex w-full items-center justify-between">
                    <ItemTitle className="text-sm font-mono tabular-nums">Total Unsuccessful Calls</ItemTitle>
                    <ItemDescription className="text-lg font-bold">
                      <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                        {unsuccessfulCallsCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                  <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationUnsuccessfulMs)}</p>
                </ItemContent>
              </Item>
            )}

            {outboundFollowupCount > 0 && (
              <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
                <ItemContent>
                  <div className="flex w-full items-center justify-between">
                    <ItemTitle className="text-sm font-mono tabular-nums">Outbound - Follow-up</ItemTitle>
                    <ItemDescription className="text-lg font-bold">
                      <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">
                        {outboundFollowupCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                  <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationFollowUpMs)}</p>
                </ItemContent>
              </Item>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between sticky bottom-0 bg-white space-x-4">
        {outboundCallsCount > 0 && (
          <>
            <p className="self-center text-xs italic">
              Avg duration total: {formatDurationMs(totalAverageDurationMs)}
            </p>
            <Badge className="h-8 min-w-8 rounded-full px-4 font-mono tabular-nums">
              Total: {outboundCallsCount}
            </Badge>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
