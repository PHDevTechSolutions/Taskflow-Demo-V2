"use client";

import React, { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface Activity {
  status?: string;
  type_activity?: string;
  so_amount?: number | string;
  actual_sales?: number | string;
}

interface SourceCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
  dateRange?: DateRange;
}

export function SOCard({ activities, loading, error, dateRange }: SourceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Count activities with status "SO-Done"
  const totalSODone = useMemo(() => {
    return activities.filter((a) => a.status === "SO-Done").length;
  }, [activities]);

  // Sum so_amount only for activities with status "SO-Done"
  const totalSOAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "SO-Done") // <-- filter here
      .reduce((sum, a) => sum + (Number(a.so_amount) || 0), 0);
  }, [activities]);

  // Count activities with status "Delivered"
  const totalDelivered = useMemo(() => {
    return activities.filter((a) => a.status === "Delivered").length;
  }, [activities]);

  // Sum actual_sales for all activities (Total Sales Invoice)
  const totalSalesInvoice = useMemo(() => {
    return activities.reduce((sum, a) => sum + (Number(a.actual_sales) || 0), 0);
  }, [activities]);

  // Calculate SO to SI Conversion (%)
  const soToSIConversion = useMemo(() => {
    if (totalSOAmount === 0) return 0;
    return (totalSalesInvoice / totalSOAmount) * 100;
  }, [totalSalesInvoice, totalSOAmount]);

  return (
    <Card className="bg-white text-black z-10">
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle>Sales Order Summary</CardTitle>
          <CardDescription>
            Counts and totals based on status filters
          </CardDescription>
        </div>

        <div
          className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
          aria-label="Information about sales order statuses"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>

          {showTooltip && (
            <div className="absolute right-0 top-full mt-1 z-50 w-110 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
              <ul className="list-disc list-inside space-y-1">
                <li>Count of activities with status "SO-Done".</li>
                <li>Total SO Amount summed only from activities with status "SO-Done".</li>
                <li>Count of activities with status "Delivered".</li>
                <li>Total Sales Invoice summed from actual_sales.</li>
                <li>SO to SI Conversion (%) = (Total Sales Invoice ÷ Total SO Amount) × 100</li>
              </ul>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total SO-Done</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-blue-500">
                      {totalSODone}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total SO Amount</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-green-500">
                      ₱ {totalSOAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total Delivered</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-purple-500">
                      {totalDelivered}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total Sales Invoice</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-yellow-500">
                      ₱ {totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">SO to SI Conversion (%)</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-teal-500">
                      {soToSIConversion.toFixed(2)}%
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          </div>
        )}
      </CardContent>

      <CardFooter className="text-muted-foreground text-xs">
        Counts activities with status "SO-Done" and "Delivered", sums SO amounts and sales invoices, and calculates conversion percentage.
      </CardFooter>
    </Card>
  );
}
