"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription, } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner"
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
  const totalFollowUp = activities.filter((a) => a.source === "Outbound - Follow-up").length;

  if (loading) {
    return (
      <Card className="p-6 flex justify-center items-center">
        <Spinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 flex justify-center items-center">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card className="p-2 gap-2 bg-white text-black z-10">
      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Outbound - Touchbase</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums text-white bg-blue-500">
                {totalOutboundTouchbase}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Successful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums text-white bg-green-500">
                {totalSuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Unsuccessful Calls</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums" variant="destructive">
                {totalUnsuccessful}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent className="w-full">
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">Total Follow Up</ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums" variant="destructive">
                {totalFollowUp}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>
    </Card>
  );
}
