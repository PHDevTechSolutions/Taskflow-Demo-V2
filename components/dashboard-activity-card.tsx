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
import { Spinner } from "@/components/ui/spinner";

interface Activity {
  type_activity?: string;
  actual_sales?: number | string;
  quotation_number?: string | null;
  so_number?: string | null;
  status?: string;       // added for filtering by status
  so_amount?: number | string;  // added for summing SO amount
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

  // ✅ Count quotations (unique optional)
  const quotationCount = activities.filter(
    (a) => a.quotation_number && a.quotation_number.trim() !== ""
  ).length;

  // ✅ Sales Orders count - only count those with status "SO-Done"
  const soDoneActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "SO-Done"
  );
  const soCount = soDoneActivities.length;

  // ✅ Sum so_amount for SO-Done sales orders
  const totalSOAmount = soDoneActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // ✅ Cancelled sales orders count and sum
  const cancelledSOActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "Cancelled"
  );
  const cancelledSOCount = cancelledSOActivities.length;
  const totalCancelledSOAmount = cancelledSOActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

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
        <p className="text-red-500">{error}</p>
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

        {/* Sales Order (SO-Done only) */}
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

      {/* New Cancelled SO Count & Amount */}
      <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
        <ItemContent>
          <div className="flex justify-between w-full">
            <ItemTitle className="text-xs font-medium text-red-600">
              Cancelled Sales Orders
            </ItemTitle>
            <ItemDescription>
              <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-red-600">
                {cancelledSOCount}
              </Badge>
            </ItemDescription>
          </div>
          <div className="flex justify-between w-full mt-1">
            <ItemTitle className="text-xs font-medium text-red-600">
              Cancelled SO Amount
            </ItemTitle>
            <ItemDescription>
              <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-red-800">
                ₱ {totalCancelledSOAmount.toLocaleString()}
              </Badge>
            </ItemDescription>
          </div>
        </ItemContent>
      </Item>
    </Card>
  );
}
