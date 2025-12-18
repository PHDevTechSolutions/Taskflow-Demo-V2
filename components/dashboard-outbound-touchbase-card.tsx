"use client";

import React from "react";
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemMedia,
} from "@/components/ui/item";

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
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-lg font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-red-500 text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-2 justify-center  items-center space-y-2">
      <Item variant="outline" size="sm">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium text-gray-700">Total Outbound - Touchbase</ItemTitle>
            <ItemDescription className="text-xs font-semibold text-gray-900">
              <Badge className="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums bg-blue-500">
                {totalOutboundTouchbase}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium text-gray-700">Total Successful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold text-gray-900">
              <Badge className="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums bg-green-500">
                {totalSuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium text-gray-700">Total Unsuccessful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold text-gray-900">
              <Badge className="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums" variant="destructive">
                {totalUnsuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>
    </div>
  );
}
