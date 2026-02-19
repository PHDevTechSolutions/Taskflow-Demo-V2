"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription, } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner"
import { Card, CardFooter } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button"

import { PhoneOutgoing, PhoneCall, PhoneMissed, PhoneForwarded, Activity } from "lucide-react";

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
    <Card className="bg-white z-10 text-black flex flex-col justify-between rounded-none">
      {!hasAnyData ? (
        /* ===================== EMPTY STATE UI ===================== */
        <div className="flex flex-col items-center justify-center text-center gap-3 mt-20">
          {/* LOTTIE CONTAINER */}
          <div className="flex items-center justify-center w-24 h-24 mb-8">
            <iframe src="https://lottie.host/embed/bcb66921-23b0-42e0-8c0e-38cca063563f/jaQLwTIXFi.lottie" className="w-50 h-50 border-0 pointer-events-none"
              title="No Data Animation"></iframe>
          </div>

          <p className="text-sm font-medium text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-500">Create more activities to see analytics</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {totalOutboundTouchbase > 0 && (
            <Item variant="outline" className="w-full rounded-none border border-gray-200 dark:border-gray-200">
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
            <Item variant="outline" className="w-full rounded-none border border-gray-200 dark:border-gray-200">
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
            <Item variant="outline" className="w-full rounded-none border border-gray-200 dark:border-gray-200">
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
            <Item variant="outline" className="w-full rounded-none border border-gray-200 dark:border-gray-200">
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

      <CardFooter className="flex justify-end border-t">
        <Button asChild className="rounded-none p-6">
          <Link
            href={
              userId
                ? `/roles/tsa/activity/planner?id=${encodeURIComponent(userId)}`
                : "/roles/tsa/activity/planner"
            }
          >
           <Activity /> Add Activity
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
