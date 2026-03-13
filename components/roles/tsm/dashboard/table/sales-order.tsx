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

interface SalesOrderCardProps {
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

export function SalesOrderTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: SalesOrderCardProps) {
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
      totalSODoneCount: number;
      totalSOAmount: number;
      totalDeliveredCount: number;
      totalSalesInvoice: number;
    };

    const map = new Map<string, AgentStats>();

    history.forEach((item) => {
      const agentID = item.referenceid?.toLowerCase();
      if (!agentID) return;

      if (!map.has(agentID)) {
        map.set(agentID, {
          agentID,
          totalSODoneCount: 0,
          totalSOAmount: 0,
          totalDeliveredCount: 0,
          totalSalesInvoice: 0,
        });
      }

      const stat = map.get(agentID)!;

      if (item.status === "SO-Done") {
        stat.totalSODoneCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) stat.totalSOAmount += val;
      }

      // Delivered / Closed Transaction — via type_activity
      if (item.type_activity === "Delivered / Closed Transaction") {
        stat.totalDeliveredCount++;
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) stat.totalSalesInvoice += val;
      }
    });

    return Array.from(map.values());
  }, [history]);

  /* ---- Footer totals ---- */
  const totals = useMemo(() => {
    const totalSODoneCount = statsByAgent.reduce((s, a) => s + a.totalSODoneCount, 0);
    const totalSOAmount = statsByAgent.reduce((s, a) => s + a.totalSOAmount, 0);
    const totalDeliveredCount = statsByAgent.reduce((s, a) => s + a.totalDeliveredCount, 0);
    const totalSalesInvoice = statsByAgent.reduce((s, a) => s + a.totalSalesInvoice, 0);
    return {
      totalSODoneCount,
      totalSOAmount,
      totalDeliveredCount,
      totalSalesInvoice,
      // SO → SI = Delivered count ÷ SO-Done count × 100
      soToSI: pct(totalDeliveredCount, totalSODoneCount),
    };
  }, [statsByAgent]);

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sales Order Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on <span className="font-medium text-gray-500">SO-Done</span> and{" "}
              <span className="font-medium text-gray-500">Delivered / Closed Transaction</span> activities
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
            No sales order records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-gray-500">Agent</TableHead>
                  <TableHead className="text-gray-500 text-center">Total SO Done</TableHead>
                  <TableHead className="text-gray-500 text-center">Total SO Amount</TableHead>
                  <TableHead className="text-gray-500 text-center">Total Sales Invoice</TableHead>
                  <TableHead className="text-gray-500 text-center">
                    SO → SI
                    <span className="block text-[9px] font-normal text-gray-400">(Delivered ÷ SO-Done)</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">Total Delivered</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent.map((stat) => {
                  const info = agentMap.get(stat.agentID);
                  // SO → SI: count of Delivered / Closed ÷ count of SO-Done
                  const soToSIVal = pctVal(stat.totalDeliveredCount, stat.totalSODoneCount);

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

                      {/* Total SO Done */}
                      <TableCell className="text-center font-semibold text-gray-800">
                        {stat.totalSODoneCount}
                      </TableCell>

                      {/* Total SO Amount */}
                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalSOAmount)}
                      </TableCell>

                      {/* Total Sales Invoice */}
                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalSalesInvoice)}
                      </TableCell>

                      {/* SO → SI % */}
                      <TableCell className="text-center">
                        <span className={`font-semibold ${soToSIVal >= 70 ? "text-green-600" : soToSIVal >= 40 ? "text-amber-500" : "text-red-500"}`}>
                          {soToSIVal.toFixed(2)}%
                        </span>
                      </TableCell>

                      {/* Total Delivered */}
                      <TableCell className="text-center text-gray-700">
                        {stat.totalDeliveredCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Footer totals */}
              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-gray-800">{totals.totalSODoneCount}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalSOAmount)}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalSalesInvoice)}</TableCell>
                  <TableCell className="text-center text-gray-700">{totals.soToSI}</TableCell>
                  <TableCell className="text-center text-gray-700">{totals.totalDeliveredCount}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Total SO Done:</strong> Count of activities where <code>status = "SO-Done"</code>.</p>
            <p><strong>Total SO Amount:</strong> Sum of <code>so_amount</code> from SO-Done activities.</p>
            <p><strong>Total Delivered:</strong> Count of activities where <code>type_activity = "Delivered / Closed Transaction"</code>.</p>
            <p><strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code> from Delivered / Closed Transaction activities.</p>
            <p><strong>SO → SI %:</strong> (Total Delivered count ÷ Total SO-Done count) × 100% — <em>count-based, not amount-based.</em></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}