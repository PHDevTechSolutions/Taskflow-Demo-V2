"use client";

import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source?: string;
  call_status?: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  type_activity: string;
  status: string;
  actual_sales: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
  type_client: string;
  activity_reference_number: string;
  company_name?: string;
}

interface OutboundCardProps {
  history: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateCreatedFilterRange?: { from: Date; to: Date };
}

/* ================= HELPERS ================= */

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const convBadge = (count: number) => (
  <span className="ml-1 text-green-600 text-[10px] font-medium">({count})</span>
);

/* ================= COMPONENT ================= */

export function OutboundCallsCard({
  history,
  loading,
  error,
  dateCreatedFilterRange,
}: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Step 1: Successful OB ---- */
  const successfulOBCalls = useMemo(() => {
    let base = history.filter(
      (h) =>
        h.source === "Outbound - Touchbase" &&
        h.call_status === "Successful"
    );

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      base = base.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- Step 2: Total OB ---- */
  const totalOBCalls = useMemo(() => {
    let base = history.filter((h) => h.source === "Outbound - Touchbase");

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      base = base.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- Step 3: Map by ref ---- */
  const historyByRefNum = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    history.forEach((h) => {
      if (!h.activity_reference_number) return;
      if (!map.has(h.activity_reference_number)) {
        map.set(h.activity_reference_number, []);
      }
      map.get(h.activity_reference_number)!.push(h);
    });
    return map;
  }, [history]);

  /* ---- Step 4: Target ---- */
  const daysCount = useMemo(() => {
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const diff =
        dateCreatedFilterRange.to.getTime() -
        dateCreatedFilterRange.from.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }
    return 26;
  }, [dateCreatedFilterRange]);

  const obTarget = 20 * daysCount;

  /* ---- Step 5: Stats ---- */
  const stats = useMemo(() => {
    const totalCalls = successfulOBCalls.length;

    const obRefNums = new Set(
      successfulOBCalls.map((c) => c.activity_reference_number).filter(Boolean)
    );

    const quoteRefNums = new Set<string>();
    const soRefNums = new Set<string>();
    const siRefNums = new Set<string>();

    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.status === "Quote-Done") quoteRefNums.add(refNum);
        if (act.status === "SO-Done") soRefNums.add(refNum);
        if (act.type_activity === "Delivered / Closed Transaction") siRefNums.add(refNum);
      });
    });

    const numQuotes = quoteRefNums.size;
    const numSO = soRefNums.size;
    const numSI = siRefNums.size;

    // Calculate Quote Amount (sum of quotation_amount from Quote-Done activities)
    let quoteAmount = 0;
    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.status === "Quote-Done" && act.quotation_amount) {
          const amount = parseFloat(act.quotation_amount);
          if (!isNaN(amount)) {
            quoteAmount += amount;
          }
        }
      });
    });

    const achievement = obTarget > 0 ? (totalCalls / obTarget) * 100 : 0;

    const totalSales = history.reduce((sum, h) => {
      const v = parseFloat(h.actual_sales ?? "");
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    return {
      totalCalls,
      numQuotes,
      numSO,
      numSI,
      quoteAmount,
      achievement,
      callsToQuote: pct(numQuotes, totalCalls),
      quoteToSO: pct(numSO, numQuotes),
      soToSI: pct(numSI, numSO),
      totalSales,
    };
  }, [successfulOBCalls, historyByRefNum, obTarget, history]);

  return (
    <Card className="relative rounded-xl border shadow-sm z-[20]">
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound Calls (Touchbase)</h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComputation(!showComputation)}
            className="flex items-center gap-1.5 text-xs text-blue-600 rounded-lg"
          >
            <Info className="w-3.5 h-3.5" />
            {showComputation ? "Hide" : "Details"}
          </Button>
        </div>

        {/* Stats */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-center">OB Target</TableHead>
                <TableHead className="text-center">Successful OB</TableHead>
                <TableHead className="text-center">Achievement</TableHead>
                <TableHead className="text-center">Calls → Quote</TableHead>
                <TableHead className="text-center">Quote Amount</TableHead>
                <TableHead className="text-center">Quote → SO</TableHead>
                <TableHead className="text-center">SO → SI</TableHead>
                <TableHead className="text-center">Total Sales</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow className="text-xs font-mono">
                <TableCell className="text-center">{obTarget}</TableCell>
                <TableCell className="text-center font-semibold">{stats.totalCalls}</TableCell>
                <TableCell className="text-center">{stats.achievement.toFixed(2)}%</TableCell>
                <TableCell className="text-center">
                  {stats.callsToQuote} {convBadge(stats.numQuotes)}
                </TableCell>
                <TableCell className="text-center font-semibold text-green-600">
                  ₱{stats.quoteAmount.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  {stats.quoteToSO} {convBadge(stats.numSO)}
                </TableCell>
                <TableCell className="text-center">
                  {stats.soToSI} {convBadge(stats.numSI)}
                </TableCell>
                <TableCell className="text-center font-semibold">
                  {stats.totalSales.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {showComputation && (
          <div className="mt-3 p-3 text-xs bg-blue-50 rounded-lg">
            Computation details here...
          </div>
        )}
      </CardHeader>
    </Card>
  );
}