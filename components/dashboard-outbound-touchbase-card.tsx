"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";

interface Activity {
  call_status?: string;
  source?: string;
}

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

export function OutboundTouchbaseCard({ activities, loading, error }: Props) {
  const totalSuccessful = activities.filter((a) => a.call_status === "Successful").length;
  const totalUnsuccessful = activities.filter((a) => a.call_status && a.call_status !== "Successful").length;
  const totalOutboundTouchbase = activities.filter((a) => a.source === "Outbound - Touchbase").length;

  if (loading) {
    return (
      <Card className="p-6 text-center">
        <div className="text-lg font-semibold text-gray-700">Loading...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <div className="text-red-500 text-xs">{error}</div>
      </Card>
    );
  }

  return (
    <Card className="p-2 gap-2">
      <Item variant="outline" className="w-full">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Outbound - Touchbase</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono tabular-nums bg-blue-500">
                {totalOutboundTouchbase}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm" className="w-full">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Successful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono tabular-nums bg-green-500">
                {totalSuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm" className="w-full">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Unsuccessful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-5 min-w-[1.25rem] rounded-full px-1 font-mono tabular-nums" variant="destructive">
                {totalUnsuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>
    </Card>
  );
}
