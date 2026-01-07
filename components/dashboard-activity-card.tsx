"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner"

interface Activity {
  type_activity?: string;
  actual_sales?: number | string;
  quotation_number?: string | null;
  so_number?: string | null;
}

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

export function ActivityCard({ activities, loading, error }: Props) {
  // ✅ Delivered / Closed Transactions
  const deliveredActivities = activities.filter(
    (a) => a.type_activity === "Delivered / Closed Transaction"
  );

  const totalDeliveries = deliveredActivities.length;

  const totalSales = deliveredActivities.reduce((sum, a) => {
    const value = Number(a.actual_sales);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // ✅ Count quotations & SO numbers (unique optional)
  const quotationCount = activities.filter(
    (a) => a.quotation_number && a.quotation_number.trim() !== ""
  ).length;

  const soCount = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== ""
  ).length;

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
    <Card className="p-2 gap-3 bg-white text-black z-10">
      {/* Total Deliveries */}
      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">
              Total Delivered Transactions
            </ItemTitle>
            <ItemDescription>
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono tabular-nums text-white bg-green-500">
                {totalDeliveries}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      {/* Total Sales */}
      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium">
              Total Sales Invoice
            </ItemTitle>
            <ItemDescription className="text-xs font-semibold">
              <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono tabular-nums text-white bg-green-500">
                ₱ {totalSales.toLocaleString()}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>

      {/* Quotation & SO — same row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Quotation */}
        <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
          <ItemContent>
            <div className="flex justify-between w-full">
              <ItemTitle className="text-xs font-medium">
                Quotations
              </ItemTitle>
              <ItemDescription>
                <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-blue-500">
                  {quotationCount}
                </Badge>
              </ItemDescription>
            </div>
          </ItemContent>
        </Item>

        {/* Sales Order */}
        <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
          <ItemContent>
            <div className="flex justify-between w-full">
              <ItemTitle className="text-xs font-medium">
                Sales Orders
              </ItemTitle>
              <ItemDescription>
                <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-purple-500">
                  {soCount}
                </Badge>
              </ItemDescription>
            </div>
          </ItemContent>
        </Item>
      </div>
    </Card>
  );
}
