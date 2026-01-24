"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription, } from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSearchParams } from "next/navigation";
import { TruckElectric, Coins, ReceiptText, PackageCheck, PackageX, CircleOff } from "lucide-react";

interface Activity {
  type_activity?: string;
  actual_sales?: number | string;
  quotation_number?: string | null;
  so_number?: string | null;
  status?: string;
  so_amount?: number | string;
}

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

export function ActivityCard({ activities, loading, error }: Props) {
  /* ===================== CALCULATIONS ===================== */

  const deliveredActivities = activities.filter(
    (a) => a.type_activity === "Delivered / Closed Transaction"
  );

  const totalDeliveries = deliveredActivities.length;

  const totalSales = deliveredActivities.reduce((sum, a) => {
    const value = Number(a.actual_sales);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const quotationCount = activities.filter(
    (a) => a.quotation_number && a.quotation_number.trim() !== ""
  ).length;

  const soDoneActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "SO-Done"
  );

  const soCount = soDoneActivities.length;

  const totalSOAmount = soDoneActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const cancelledSOActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "Cancelled"
  );

  const cancelledSOCount = cancelledSOActivities.length;

  const totalCancelledSOAmount = cancelledSOActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  /* ===================== EMPTY STATE CHECK ===================== */

  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? null;


  const hasAnyData =
    totalDeliveries > 0 ||
    totalSales > 0 ||
    quotationCount > 0 ||
    soCount > 0 ||
    cancelledSOCount > 0 ||
    totalCancelledSOAmount > 0;

  /* ===================== LOADING / ERROR ===================== */

  if (loading) {
    return (
      <Card className="p-6 flex justify-center items-center min-h-[200px]">
        <Spinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 flex justify-center items-center min-h-[200px]">
        <p className="text-red-500 text-sm">{error}</p>
      </Card>
    );
  }

  /* ===================== RENDER ===================== */

  return (
    <Card className="p-3 bg-white text-black min-h-[220px] flex flex-col justify-center">
      {!hasAnyData ? (
        /* ===================== EMPTY STATE UI ===================== */
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">📊</div>
          <p className="text-sm font-medium text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-500">Create more activities to see analytics</p>
          <a href={ userId ? `/roles/tsa/activity/planner?id=${encodeURIComponent(userId)}` : "/roles/tsa/activity/planner" }
            className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition">
            Create Activity
          </a>
        </div>
      ) : (
        /* ===================== DATA UI ===================== */
        <div className="flex flex-col gap-2">
          {/* Total Deliveries */}
          {totalDeliveries > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">
                   <TruckElectric /> Total Delivered Transactions
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-green-500">
                      {totalDeliveries}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* Total Sales */}
          {totalSales > 0 && (
            <Item variant="outline" className="w-full rounded-md border border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">
                  <Coins /> Total Sales Invoice
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-green-500">
                      ₱ {totalSales.toLocaleString()}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* Quotation & SO */}
          <div className="grid grid-cols-2 gap-2">
            {quotationCount > 0 && (
              <Item
                variant="outline"
                className={`rounded-md border border-gray-200 ${soCount === 0 ? "col-span-2" : ""
                  }`}
              >
                <ItemContent>
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium">
                     <ReceiptText /> Quotes
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-blue-500">
                        {quotationCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                </ItemContent>
              </Item>
            )}

            {soCount > 0 && (
              <Item
                variant="outline"
                className={`rounded-md border border-gray-200 ${quotationCount === 0 ? "col-span-2" : ""
                  }`}
              >
                <ItemContent>
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium">
                    <PackageCheck /> Orders
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-purple-500">
                        {soCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                </ItemContent>
              </Item>
            )}
          </div>

          {/* Cancelled */}
          {(cancelledSOCount > 0 || totalCancelledSOAmount > 0) && (
            <Item variant="outline" className="rounded-md border border-gray-200">
              <ItemContent className="space-y-1">
                {cancelledSOCount > 0 && (
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium text-red-600">
                     <PackageX /> Cancelled Sales Orders
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-red-600">
                        {cancelledSOCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                )}

                {totalCancelledSOAmount > 0 && (
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium text-red-600">
                     <CircleOff /> Cancelled SO Amount
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-red-800">
                        ₱ {totalCancelledSOAmount.toLocaleString()}
                      </Badge>
                    </ItemDescription>
                  </div>
                )}
              </ItemContent>
            </Item>
          )}
        </div>
      )}
    </Card>
  );
}
