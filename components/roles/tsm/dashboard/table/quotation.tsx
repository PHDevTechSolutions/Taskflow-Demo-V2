import React, { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source: string;
  call_status: string;
  status: string;
  type_activity: string;
  actual_sales?: string;
  quotation_amount: string;
  so_amount: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface QuotationCardProps {
  history: HistoryItem[];
  agents: Agent[];
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
}

/* ================= HELPERS ================= */

const fmt = (val: number) =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const pctVal = (num: number, den: number) =>
  den > 0 ? (num / den) * 100 : 0;

/* ================= COMPONENT ================= */

export function QuotationTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: QuotationCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  /* ---- Agent map ---- */
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; picture: string }>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), {
        name: `${a.Firstname} ${a.Lastname}`,
        picture: a.profilePicture,
      })
    );
    return map;
  }, [agents]);

  /* ---- Aggregate stats per agent ---- */
  const statsByAgent = useMemo(() => {
    type AgentStats = {
      agentID: string;
      totalQuoteDoneCount: number;
      totalQuotationAmount: number;
      totalSOPreparationCount: number;
      totalSOAmount: number;
      totalSalesInvoice: number;
    };

    const map = new Map<string, AgentStats>();

    history.forEach((item) => {
      const agentID = item.referenceid?.toLowerCase();
      if (!agentID) return;

      if (!map.has(agentID)) {
        map.set(agentID, {
          agentID,
          totalQuoteDoneCount: 0,
          totalQuotationAmount: 0,
          totalSOPreparationCount: 0,
          totalSOAmount: 0,
          totalSalesInvoice: 0,
        });
      }

      const stat = map.get(agentID)!;

      // Quotations with status "Quote-Done"
      if (item.type_activity === "Quotation Preparation" && item.status === "Quote-Done") {
        stat.totalQuoteDoneCount++;
        const val = parseFloat(item.quotation_amount ?? "0");
        if (!isNaN(val)) stat.totalQuotationAmount += val;
      }

      // Sales Order — status "SO-Done"
      if (item.status === "SO-Done") {
        stat.totalSOPreparationCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) stat.totalSOAmount += val;
      }

      // Sales Invoice — status "Delivered"
      if (item.status === "Delivered") {
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) stat.totalSalesInvoice += val;
      }
    });

    return Array.from(map.values());
  }, [history]);

  /* ---- Footer totals ---- */
  const totals = useMemo(() => {
    const totalQuoteDoneCount = statsByAgent.reduce((s, a) => s + a.totalQuoteDoneCount, 0);
    const totalQuotationAmount = statsByAgent.reduce((s, a) => s + a.totalQuotationAmount, 0);
    const totalSOPreparationCount = statsByAgent.reduce((s, a) => s + a.totalSOPreparationCount, 0);
    const totalSalesInvoice = statsByAgent.reduce((s, a) => s + a.totalSalesInvoice, 0);
    return {
      totalQuoteDoneCount,
      totalQuotationAmount,
      totalSOPreparationCount,
      totalSalesInvoice,
      quoteToSO: pct(totalSOPreparationCount, totalQuoteDoneCount),
      quotationToSI: pct(totalSalesInvoice, totalQuotationAmount),
    };
  }, [statsByAgent]);

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Quotations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on <span className="font-medium text-gray-500">Quotation Preparation · Quote-Done</span> activities
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComputation(!showComputation)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
          >
            <Info className="w-3.5 h-3.5" />
            {showComputation ? "Hide" : "Details"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {statsByAgent.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No quotation records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-gray-500">Agent</TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Total Quotations
                    <span className="block text-[9px] font-normal text-gray-400">(Quote-Done)</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quotation Amount
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quote → SO
                    <span className="block text-[9px] font-normal text-gray-400">(SO ÷ Quotes)</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quotation → SI
                    <span className="block text-[9px] font-normal text-gray-400">(SI ÷ Quot. Amount)</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent.map((stat) => {
                  const info = agentMap.get(stat.agentID);
                  const quoteToSOVal = pctVal(stat.totalSOPreparationCount, stat.totalQuoteDoneCount);
                  const quotationToSIVal = pctVal(stat.totalSalesInvoice, stat.totalQuotationAmount);

                  return (
                    <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                      {/* Agent */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img
                              src={info.picture}
                              alt={info.name}
                              className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info?.name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info?.name ?? stat.agentID}</span>
                        </div>
                      </TableCell>

                      {/* Total Quotations */}
                      <TableCell className="text-center font-semibold text-gray-800">
                        {stat.totalQuoteDoneCount}
                      </TableCell>

                      {/* Quotation Amount */}
                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalQuotationAmount)}
                      </TableCell>

                      {/* Quote → SO */}
                      <TableCell className="text-center">
                        <span className={`font-semibold ${quoteToSOVal >= 70 ? "text-green-600" : quoteToSOVal >= 40 ? "text-amber-500" : "text-red-500"}`}>
                          {quoteToSOVal.toFixed(2)}%
                        </span>
                        <span className="ml-1 text-green-600 text-[10px] font-medium">
                          ({stat.totalSOPreparationCount})
                        </span>
                      </TableCell>

                      {/* Quotation → SI */}
                      <TableCell className="text-center">
                        <span className={`font-semibold ${quotationToSIVal >= 70 ? "text-green-600" : quotationToSIVal >= 40 ? "text-amber-500" : "text-red-500"}`}>
                          {quotationToSIVal.toFixed(2)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Footer totals */}
              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-gray-800">{totals.totalQuoteDoneCount}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalQuotationAmount)}</TableCell>
                  <TableCell className="text-center text-gray-700">
                    {totals.quoteToSO}
                    <span className="ml-1 text-green-600 text-[10px] font-medium">({totals.totalSOPreparationCount})</span>
                  </TableCell>
                  <TableCell className="text-center text-gray-700">{totals.quotationToSI}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Total Quotations:</strong> Count of activities where <code>type_activity = "Quotation Preparation"</code> AND <code>status = "Quote-Done"</code>.</p>
            <p><strong>Quotation Amount:</strong> Sum of <code>quotation_amount</code> from all Quote-Done activities.</p>
            <p><strong>Quote → SO %:</strong> (Count of <code>status = "SO-Done"</code> ÷ Total Quotations) × 100%</p>
            <p><strong>Quotation → SI %:</strong> (Sum of <code>actual_sales</code> where <code>status = "Delivered"</code> ÷ Total Quotation Amount) × 100%</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}