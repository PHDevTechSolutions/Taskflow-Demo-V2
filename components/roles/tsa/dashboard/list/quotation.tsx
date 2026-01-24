"use client";

import React, { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface Activity {
  status?: string;
  quotation_amount?: number | string;
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

export function QuotationCard({ activities, loading, error, dateRange }: SourceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Count quotations with status "Quote-Done"
  const totalQuotationsDone = useMemo(() => {
    return activities.filter((a) => a.status === "Quote-Done").length;
  }, [activities]);

  // Sum quotation_amount for status "Quote-Done"
  const totalQuotationAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "Quote-Done")
      .reduce((sum, a) => sum + (Number(a.quotation_amount) || 0), 0);
  }, [activities]);

  // Count Sales Order Preparation by type_activity
  const totalSOPreparation = useMemo(() => {
    return activities.filter((a) => a.status === "SO-Done").length;
  }, [activities]);

  // Sum so_amount for Sales Order Preparation
  const totalSOAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "SO-Done")
      .reduce((sum, a) => sum + (Number(a.so_amount) || 0), 0);
  }, [activities]);

  // Sum actual_sales from all activities (or filter if needed)
  const totalSalesInvoice = useMemo(() => {
    return activities.reduce((sum, a) => sum + (Number(a.actual_sales) || 0), 0);
  }, [activities]);

  // Calculate Quote to SO Conversion (%)
  const quoteToSOConversion = useMemo(() => {
    if (totalQuotationsDone === 0) return 0;
    return (totalSOPreparation / totalQuotationsDone) * 100;
  }, [totalSOPreparation, totalQuotationsDone]);

  // Calculate Quotation to SI Conversion (%)
  const quotationToSIConversion = useMemo(() => {
    if (totalQuotationAmount === 0) return 0;
    return (totalSalesInvoice / totalQuotationAmount) * 100;
  }, [totalSalesInvoice, totalQuotationAmount]);

  return (
    <Card className="bg-white text-black z-10">
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle>Quotations</CardTitle>
          <CardDescription>
            Counts and totals for quotations (status "Quote-Done") and Sales Order Preparation
          </CardDescription>
        </div>

        <div
          className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
          aria-label="Information about quotations and sales orders"
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
            <div className="absolute right-0 top-full mt-1 z-50 w-150 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
              <ul className="list-disc list-inside space-y-1">
                <li>Counts all Quotations with status "Quote-Done".</li>
                <li>Sums Quotation Amount from Quotations.</li>
                <li>Counts Sales Order Preparation based on Type of Activity.</li>
                <li>Sums SO Amount from Sales Order Preparation activities.</li>
                <li>Quote to SO Conversion (%) = (Total SO Preparation ÷ Total Quote Count) × 100</li>
                <li>Total Sales Invoice = sum of Sales Invoice from all activities</li>
                <li>Quotation to SI Conversion (%) = (Total Sales Invoice ÷ Total Quotation Amount) × 100</li>
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
                  <ItemTitle className="text-xs font-medium">Total Quotations (Quote-Done)</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-blue-500">
                      {totalQuotationsDone}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total Quotation Amount</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-green-500">
                      ₱ {totalQuotationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total Sales Order Preparation</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-purple-500">
                      {totalSOPreparation}
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
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-pink-500">
                      ₱ {totalSOAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Quote to SO Conversion (%)</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-teal-500">
                      {quoteToSOConversion.toFixed(2)}%
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            {/* Total Sales Invoice */}
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Total Sales Invoice</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-yellow-500">
                      ₱ {totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>

            {/* Quotation to SI Conversion */}
            <Item variant="outline" className="w-full rounded-md border border-gray-200 dark:border-gray-200">
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">Quotation to SI Conversion (%)</ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-indigo-500">
                      {quotationToSIConversion.toFixed(2)}%
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          </div>
        )}
      </CardContent>

      <CardFooter className="text-muted-foreground text-xs">
        Only activities with status "Quote-Done" and type_activity "Sales Order Preparation" are counted.
      </CardFooter>
    </Card>
  );
}
