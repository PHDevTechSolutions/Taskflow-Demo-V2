"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription, } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner"
import { Card, CardFooter } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button"

import { PhoneOutgoing, PhoneCall, PhoneMissed, PhoneForwarded } from "lucide-react";

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

  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? null;


  const hasAnyData =
    totalOutboundTouchbase > 0 ||
    totalSuccessful > 0 ||
    totalUnsuccessful > 0 ||
    totalFollowUp > 0;

  return (
    <Card className="p-3 bg-white text-black min-h-[220px] flex flex-col justify-center z-50">
      {!hasAnyData ? (
        /* ===================== EMPTY STATE UI ===================== */
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">📊</div>
          <p className="text-sm font-medium text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-500">Create more activities to see analytics</p>
          <Button asChild>
            <Link
              href={
                userId
                  ? `/roles/tsa/activity/planner?id=${encodeURIComponent(userId)}`
                  : "/roles/tsa/activity/planner"
              }
            >
              Create Activity
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {totalOutboundTouchbase > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent className="w-full">
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium"><PhoneOutgoing /> Total Outbound - Touchbase</ItemTitle>
                  <ItemDescription className="text-xs font-semibold">
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums text-white bg-blue-500 m-4">
                      {totalOutboundTouchbase}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {totalSuccessful > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent className="w-full">
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium"><PhoneCall /> Total Successful Calls</ItemTitle>
                  <ItemDescription className="text-xs font-semibold">
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums text-white bg-green-500 m-4">
                      {totalSuccessful}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {totalUnsuccessful > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent className="w-full">
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium"><PhoneMissed /> Total Unsuccessful Calls</ItemTitle>
                  <ItemDescription className="text-xs font-semibold">
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums" variant="destructive">
                      {totalUnsuccessful}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {totalFollowUp > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent className="w-full">
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium"><PhoneForwarded /> Total Follow Up</ItemTitle>
                  <ItemDescription className="text-xs font-semibold">
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums" variant="destructive">
                      {totalFollowUp}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}
        </div>
      )}
    </Card>
  );
}
