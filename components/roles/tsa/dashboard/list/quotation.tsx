import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Info } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid?: string;
  source?: string;
  call_status?: string;
  status?: string;
  type_activity?: string;
  actual_sales?: string;
  quotation_amount?: string;
  so_amount?: string;
  start_date?: string;
  end_date?: string;
  date_created?: string;
  activity_reference_number?: string;
  company_name?: string;
  quotation_number?: string;
  so_number?: string;
}

interface QuotationCardProps {
  activities: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateRange?: { from?: Date; to?: Date };
}

/* ================= HELPERS ================= */

const fmt = (val: number) =>
  val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const pctVal = (num: number, den: number) =>
  den > 0 ? (num / den) * 100 : 0;

/* ================= COMPONENT ================= */

export function QuotationCard({
  activities,
  loading,
  error,
  dateRange,
}: QuotationCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Compute stats ---- */
  const stats = useMemo(() => {
    let totalQuoteDoneCount = 0;
    let totalQuotationAmount = 0;
    let totalSOPreparationCount = 0;
    let totalSOAmount = 0;
    let totalSalesInvoice = 0;

    activities.forEach((item) => {
      // Quote-Done
      if (
        item.type_activity === "Quotation Preparation" &&
        item.status === "Quote-Done"
      ) {
        totalQuoteDoneCount++;
        const val = parseFloat(item.quotation_amount ?? "0");
        if (!isNaN(val)) totalQuotationAmount += val;
      }

      // SO-Done
      if (item.status === "SO-Done") {
        totalSOPreparationCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) totalSOAmount += val;
      }

      // Sales Invoice — Delivered
      if (item.status === "Delivered") {
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) totalSalesInvoice += val;
      }
    });

    return {
      totalQuoteDoneCount,
      totalQuotationAmount,
      totalSOPreparationCount,
      totalSOAmount,
      totalSalesInvoice,
      quoteToSOVal: pctVal(totalSOPreparationCount, totalQuoteDoneCount),
      quoteToSO: pct(totalSOPreparationCount, totalQuoteDoneCount),
      quotationToSIVal: pctVal(totalSalesInvoice, totalQuotationAmount),
      quotationToSI: pct(totalSalesInvoice, totalQuotationAmount),
    };
  }, [activities]);

  return (
    <Card className="rounded-xl border shadow-sm z-[20]">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Quotations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">
                Quotation Preparation · Quote-Done
              </span>{" "}
              activities
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 rounded-lg"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
          </div>
        </div>

        {/* Stats Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-900 text-center">
                  Total Quotations
                  <span className="block text-[9px] font-normal text-gray-400">
                    (Quote-Done)
                  </span>
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Quotation Amount
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Quote → SO
                  <span className="block text-[9px] font-normal text-gray-400">
                    (SO ÷ Quotes)
                  </span>
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Quotation → SI
                  <span className="block text-[9px] font-normal text-gray-400">
                    (SI ÷ Quot. Amount)
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-xs font-mono">
                {/* Total Quotations */}
                <TableCell className="text-center font-semibold text-gray-800">
                  {stats.totalQuoteDoneCount}
                </TableCell>

                {/* Quotation Amount */}
                <TableCell className="text-center text-gray-700">
                  ₱ {fmt(stats.totalQuotationAmount)}
                </TableCell>

                {/* Quote → SO */}
                <TableCell className="text-center">
                  <span
                    className={`font-semibold ${
                      stats.quoteToSOVal >= 70
                        ? "text-green-600"
                        : stats.quoteToSOVal >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {stats.quoteToSO}
                  </span>
                  <span className="ml-1 text-green-600 text-[10px] font-medium">
                    ({stats.totalSOPreparationCount})
                  </span>
                </TableCell>

                {/* Quotation → SI */}
                <TableCell className="text-center">
                  <span
                    className={`font-semibold ${
                      stats.quotationToSIVal >= 70
                        ? "text-green-600"
                        : stats.quotationToSIVal >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {stats.quotationToSI}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Computation Details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p>
              <strong>Total Quotations:</strong> Count of activities where{" "}
              <code>type_activity = "Quotation Preparation"</code> AND{" "}
              <code>status = "Quote-Done"</code>.
            </p>
            <p>
              <strong>Quotation Amount:</strong> Sum of <code>quotation_amount</code>{" "}
              from all Quote-Done activities.
            </p>
            <p>
              <strong>Quote → SO %:</strong> (Count of{" "}
              <code>status = "SO-Done"</code> ÷ Total Quotations) × 100%
            </p>
            <p>
              <strong>Total SO Amount:</strong> Sum of <code>so_amount</code> from{" "}
              SO-Done activities.
            </p>
            <p>
              <strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code>{" "}
              where <code>status = "Delivered"</code>.
            </p>
            <p>
              <strong>Quotation → SI %:</strong> (Total Sales Invoice ÷ Total
              Quotation Amount) × 100%
            </p>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}