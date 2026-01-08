"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  referenceid: string;
  start_date: string;
  end_date: string;
  actual_sales: string;
  dr_number: string;
  quotation_amount: string;
  quotation_number: string;
  so_amount: string;
  so_number: string;
  date_created: string;
  status?: string; // Added optional status here for type safety
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
  Position?: string;
  Status?: string;
}

interface Props {
  agent: Agent;
  agentActivities: HistoryItem[];
}

export function AgentCard({ agent, agentActivities }: Props) {
  // Filter activities by status
  const soDoneActivities = agentActivities.filter(
    (item) => item.status === "SO-Done"
  );
  const cancelledActivities = agentActivities.filter(
    (item) => item.status === "Cancelled"
  );

  // Total working duration (ms)
  const totalDurationMs = agentActivities.reduce((total, item) => {
    const start = new Date(item.start_date.replace(" ", "T")).getTime();
    const end = new Date(item.end_date.replace(" ", "T")).getTime();

    if (!isNaN(start) && !isNaN(end) && end > start) {
      return total + (end - start);
    }
    return total;
  }, 0);

  // Format duration helper
  const formatDurationMs = (ms: number) => {
    if (ms <= 0) return "-";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      hours && `${hours} hr${hours > 1 ? "s" : ""}`,
      minutes && `${minutes} min${minutes > 1 ? "s" : ""}`,
      seconds && `${seconds} sec${seconds > 1 ? "s" : ""}`,
    ]
      .filter(Boolean)
      .join(" ");
  };

  // Sum numeric fields helper with a list of items to process
  const sumField = (field: keyof HistoryItem, items: HistoryItem[]) =>
    items.reduce((sum, item) => {
      const val = parseFloat(item[field] ?? "0");
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  // Sum total sales invoice from all activities
  const totalActualSales = sumField("actual_sales", agentActivities);

  // Sum total sales order only from SO-Done activities
  const totalSoAmount = sumField("so_amount", soDoneActivities);

  // Sum total quotation amount from all activities
  const totalQuotationAmount = sumField("quotation_amount", agentActivities);

  // Sum total cancelled sales order amount
  const totalCancelledSoAmount = sumField("so_amount", cancelledActivities);

  // Unique count helper for a field from given items
  const uniqueCount = (field: keyof HistoryItem, items: HistoryItem[]) => {
    const set = new Set(
      items
        .map((item) => item[field]?.trim())
        .filter((v) => v && v.length > 0)
    );
    return set.size;
  };

  // Count Delivered transactions by unique dr_number from all activities
  const countDrNumber = uniqueCount("dr_number", agentActivities);

  // Count Quotations by unique quotation_number from all activities
  const countQuotationNumber = uniqueCount("quotation_number", agentActivities);

  // Count Sales Orders by unique so_number only from SO-Done activities
  const countSoNumber = uniqueCount("so_number", soDoneActivities);

  // Count Cancelled Sales Orders by unique so_number only from Cancelled activities
  const countCancelledSoNumber = uniqueCount("so_number", cancelledActivities);

  return (
    <Card className="min-h-[160px]">
      <CardHeader className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {agent.profilePicture ? (
            <img
              src={agent.profilePicture}
              alt={`${agent.Firstname} ${agent.Lastname}`}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-xl text-gray-600">
              ?
            </div>
          )}

          {/* Text container */}
          <div className="flex flex-col">
            <p className="font-semibold text-lg uppercase">
              {agent.Firstname} {agent.Lastname}
            </p>
            {agent.Position && (
              <p className="text-xs text-muted-foreground font-mono mb-2">
                {agent.Position}
              </p>
            )}
            {agent.Status && (
              <p className="text-xs text-muted-foreground font-mono">
                <Badge className="text-[8px] p-2 font-mono">{agent.Status}</Badge>
              </p>
            )}
          </div>
        </div>

        {totalDurationMs > 0 && (
          <Badge className="p-4 font-mono">
            Total Working Hours: {formatDurationMs(totalDurationMs)}
          </Badge>
        )}

      </CardHeader>

      <CardContent className="flex flex-col gap-1 text-center sm:text-left px-6 font-mono">
        {totalActualSales > 0 && (
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Total Sales Invoice:{" "}</ItemTitle>
              <ItemDescription>
                {totalActualSales.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
            <ItemFooter>
              Total Delivered Transactions:{" "}
              <Badge className="px-4 py-2 font-mono">{countDrNumber}</Badge>
            </ItemFooter>
          </Item>
        )}

        {totalSoAmount > 0 && (
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Total Sales Order:{" "}</ItemTitle>
              <ItemDescription>
                {totalSoAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
            <ItemFooter>
              Sales Orders:{" "}
              <Badge className="px-4 py-2 font-mono">{countSoNumber}</Badge>
            </ItemFooter>
          </Item>
        )}

        {totalCancelledSoAmount > 0 && (
          <Item variant="outline" className="border-red-500">
            <ItemContent>
              <ItemTitle>Total Cancelled Sales Order:{" "}</ItemTitle>
              <ItemDescription className="text-red-600 font-semibold">
                {totalCancelledSoAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
            <ItemFooter>
              Cancelled Sales Orders:{" "}
              <Badge className="px-4 py-2 font-mono">{countCancelledSoNumber}</Badge>
            </ItemFooter>
          </Item>
        )}

        {totalQuotationAmount > 0 && (
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Total Quotation Amount:{" "}</ItemTitle>
              <ItemDescription>
                {totalQuotationAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions />
            <ItemFooter>
              Quotations:{" "}
              <Badge className="px-4 py-2 font-mono">{countQuotationNumber}</Badge>
            </ItemFooter>
          </Item>
        )}
      </CardContent>
    </Card>
  );
}
