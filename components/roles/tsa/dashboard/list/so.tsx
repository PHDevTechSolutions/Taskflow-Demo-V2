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
import { type DateRange } from "react-day-picker";

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
  so_number?: string;
}

interface SOCardProps {
  activities: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateRange?: DateRange;
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

export function SOCard({
  activities,
  loading,
  error,
  dateRange,
}: SOCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Compute stats ---- */
  const stats = useMemo(() => {
    let totalSODoneCount = 0;
    let totalSOAmount = 0;
    let totalDeliveredCount = 0;
    let totalSalesInvoice = 0;

    activities.forEach((item) => {
      // SO-Done
      if (item.status === "SO-Done") {
        totalSODoneCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) totalSOAmount += val;
      }

      // Delivered / Closed Transaction
      if (item.type_activity === "Delivered / Closed Transaction") {
        totalDeliveredCount++;
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) totalSalesInvoice += val;
      }
    });

    const soToSIVal = pctVal(totalDeliveredCount, totalSODoneCount);
    const soToSI = pct(totalDeliveredCount, totalSODoneCount);

    return {
      totalSODoneCount,
      totalSOAmount,
      totalDeliveredCount,
      totalSalesInvoice,
      soToSIVal,
      soToSI,
    };
  }, [activities]);

  return (
    <Card className="rounded-xl border shadow-sm z-[20]">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sales Order Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">SO-Done</span> and{" "}
              <span className="font-medium text-gray-500">
                Delivered / Closed Transaction
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
                  Total SO Done
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Total SO Amount
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Total Sales Invoice
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  SO → SI
                  <span className="block text-[9px] font-normal text-gray-400">
                    (Delivered ÷ SO-Done)
                  </span>
                </TableHead>
                <TableHead className="text-gray-900 text-center">
                  Total Delivered
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-xs font-mono">
                {/* Total SO Done */}
                <TableCell className="text-center font-semibold text-gray-800">
                  {stats.totalSODoneCount}
                </TableCell>

                {/* Total SO Amount */}
                <TableCell className="text-center text-gray-700">
                  ₱ {fmt(stats.totalSOAmount)}
                </TableCell>

                {/* Total Sales Invoice */}
                <TableCell className="text-center font-semibold text-gray-800">
                  ₱ {fmt(stats.totalSalesInvoice)}
                </TableCell>

                {/* SO → SI */}
                <TableCell className="text-center">
                  <span
                    className={`font-semibold ${stats.soToSIVal >= 70
                        ? "text-green-600"
                        : stats.soToSIVal >= 40
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                  >
                    {stats.soToSI}
                  </span>
                  <span className="ml-1 text-green-600 text-[10px] font-medium">
                    ({stats.totalDeliveredCount})
                  </span>
                </TableCell>

                {/* Total Delivered */}
                <TableCell className="text-center text-gray-700">
                  {stats.totalDeliveredCount}
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
              <strong>Total SO Done:</strong> Count of activities where{" "}
              <code>status = "SO-Done"</code>.
            </p>
            <p>
              <strong>Total SO Amount:</strong> Sum of <code>so_amount</code> from
              SO-Done activities.
            </p>
            <p>
              <strong>Total Delivered:</strong> Count of activities where{" "}
              <code>type_activity = "Delivered / Closed Transaction"</code>.
            </p>
            <p>
              <strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code>{" "}
              from Delivered / Closed Transaction activities.
            </p>
            <p>
              <strong>SO → SI %:</strong> (Total Delivered ÷ Total SO-Done) × 100%{" "}
              — <em>count-based, not amount-based.</em>
            </p>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}