import React, { useMemo, useState, useEffect } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, Settings2, RotateCcw, Download } from "lucide-react";
import ExcelJS from "exceljs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ─── Storage key ────────────────────────────────────────────────────────── */

const STORAGE_KEY = "so_computation_config";

/* ─── Config shape ───────────────────────────────────────────────────────── */

type AmountField = "quotation_amount" | "so_amount" | "actual_sales";

interface SOConfig {
  // SO Done row definition
  soStatus: string;                     // default: "SO-Done"
  soAmountField: AmountField;           // default: so_amount

  // Delivered row definition
  deliveredTypeActivity: string;        // default: "Delivered / Closed Transaction"
  deliveredAmountField: AmountField;    // default: actual_sales

  // SO → SI conversion: count-based or amount-based
  soToSIMode: "count" | "amount";

  // Color thresholds
  thresholdHigh: number;  // default: 70
  thresholdMid: number;   // default: 40
}

const DEFAULT_CONFIG: SOConfig = {
  soStatus: "SO-Done",
  soAmountField: "so_amount",
  deliveredTypeActivity: "Delivered / Closed Transaction",
  deliveredAmountField: "actual_sales",
  soToSIMode: "count",
  thresholdHigh: 70,
  thresholdMid: 40,
};

function loadConfig(): SOConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { return DEFAULT_CONFIG; }
}

function saveConfig(cfg: SOConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const fmt = (val: number) =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pctVal = (num: number, den: number) =>
  den > 0 ? (num / den) * 100 : 0;

const getField = (item: HistoryItem, field: AmountField): number => {
  const raw =
    field === "actual_sales" ? item.actual_sales :
    field === "so_amount" ? item.so_amount :
    item.quotation_amount;
  const val = parseFloat(raw ?? "0");
  return isNaN(val) ? 0 : val;
};

/* ─── Toggle button ──────────────────────────────────────────────────────── */

const ToggleBtn = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs border rounded-none font-semibold transition-colors ${
      active
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
    }`}
  >
    {children}
  </button>
);

/* ─── Field select buttons ───────────────────────────────────────────────── */

const FieldToggle = ({
  value, onChange,
}: { value: AmountField; onChange: (v: AmountField) => void }) => (
  <div className="flex gap-1 flex-wrap">
    {(["quotation_amount", "so_amount", "actual_sales"] as const).map((f) => (
      <ToggleBtn key={f} active={value === f} onClick={() => onChange(f)}>{f}</ToggleBtn>
    ))}
  </div>
);

/* ─── Edit Computation Dialog ────────────────────────────────────────────── */

const EditComputationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  config: SOConfig;
  onSave: (cfg: SOConfig) => void;
}> = ({ open, onClose, config, onSave }) => {
  const [draft, setDraft] = useState<SOConfig>(config);
  useEffect(() => { if (open) setDraft(config); }, [open, config]);

  const set = <K extends keyof SOConfig>(k: K, v: SOConfig[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Settings2 className="h-4 w-4" /> Edit Computation Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Customize how Sales Order metrics are calculated. Saved to your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1 max-h-[65vh] overflow-y-auto pr-1">

          {/* ── Sales Order rows ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Sales Order Row Definition
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                status value
              </Label>
              <p className="text-[11px] text-gray-400">
                Rows matching this status are counted as a Sales Order.
              </p>
              <Input
                value={draft.soStatus}
                onChange={(e) => set("soStatus", e.target.value)}
                className="text-xs rounded-none w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                SO Amount field
              </Label>
              <p className="text-[11px] text-gray-400">
                Which column is summed as the "Total SO Amount".
              </p>
              <FieldToggle value={draft.soAmountField} onChange={(v) => set("soAmountField", v)} />
            </div>
          </section>

          {/* ── Delivered rows ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Delivered / Sales Invoice Row Definition
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                type_activity value
              </Label>
              <p className="text-[11px] text-gray-400">
                Rows matching this type_activity are counted as Delivered.
              </p>
              <Input
                value={draft.deliveredTypeActivity}
                onChange={(e) => set("deliveredTypeActivity", e.target.value)}
                className="text-xs rounded-none w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Sales Invoice Amount field
              </Label>
              <p className="text-[11px] text-gray-400">
                Which column is summed as the "Total Sales Invoice".
              </p>
              <FieldToggle value={draft.deliveredAmountField} onChange={(v) => set("deliveredAmountField", v)} />
            </div>
          </section>

          {/* ── SO → SI formula ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              SO → SI Conversion Formula
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Conversion mode
              </Label>
              <p className="text-[11px] text-gray-400">
                How to measure the conversion rate from SO to SI.
              </p>
              <div className="flex gap-2 flex-wrap">
                <ToggleBtn
                  active={draft.soToSIMode === "count"}
                  onClick={() => set("soToSIMode", "count")}
                >
                  Count-based (Delivered ÷ SO-Done)
                </ToggleBtn>
                <ToggleBtn
                  active={draft.soToSIMode === "amount"}
                  onClick={() => set("soToSIMode", "amount")}
                >
                  Amount-based (SI amount ÷ SO amount)
                </ToggleBtn>
              </div>
            </div>
          </section>

          {/* ── Color thresholds ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Color Thresholds (SO → SI column)
            </p>
            <p className="text-[11px] text-gray-400">
              Green if ≥ High, Amber if ≥ Mid, Red if below Mid.
            </p>
            <div className="flex gap-6 items-center">
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500 font-semibold">High (green) %</Label>
                <Input
                  type="number" min={0} max={100}
                  value={draft.thresholdHigh}
                  onChange={(e) => set("thresholdHigh", Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 text-xs rounded-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500 font-semibold">Mid (amber) %</Label>
                <Input
                  type="number" min={0} max={100}
                  value={draft.thresholdMid}
                  onChange={(e) => set("thresholdMid", Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 text-xs rounded-none"
                />
              </div>
            </div>
          </section>

          {/* ── Live preview ── */}
          <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-700 text-xs mb-1.5">Current Settings Preview</p>
            <p><span className="text-gray-400 w-44 inline-block">SO filter:</span>
              <strong>status = "{draft.soStatus}"</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SO amount field:</span>
              <strong>{draft.soAmountField}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Delivered filter:</span>
              <strong>type_activity = "{draft.deliveredTypeActivity}"</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SI amount field:</span>
              <strong>{draft.deliveredAmountField}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SO → SI mode:</span>
              <strong>{draft.soToSIMode === "count" ? "Count-based" : "Amount-based"}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Thresholds:</span>
              <strong className="text-green-600">≥{draft.thresholdHigh}% green</strong>
              &nbsp;/&nbsp;
              <strong className="text-amber-500">≥{draft.thresholdMid}% amber</strong>
              &nbsp;/&nbsp;
              <strong className="text-red-500">below red</strong>
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_CONFIG)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset to defaults
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs rounded-none" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs rounded-none" onClick={() => { onSave(draft); onClose(); }}>
              Save Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function SalesOrderTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: SalesOrderCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [config, setConfig] = useState<SOConfig>(DEFAULT_CONFIG);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const handleSave = (cfg: SOConfig) => { setConfig(cfg); saveConfig(cfg); };

  const {
    soStatus, soAmountField,
    deliveredTypeActivity, deliveredAmountField,
    soToSIMode, thresholdHigh, thresholdMid,
  } = config;

  /* ── Agent map ── */
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

  /* ── Aggregate stats per agent ── */
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

      // Sales Order rows
      if (item.status === soStatus) {
        stat.totalSODoneCount++;
        stat.totalSOAmount += getField(item, soAmountField);
      }

      // Delivered rows
      if (item.type_activity === deliveredTypeActivity) {
        stat.totalDeliveredCount++;
        stat.totalSalesInvoice += getField(item, deliveredAmountField);
      }
    });

    return Array.from(map.values());
  }, [history, soStatus, soAmountField, deliveredTypeActivity, deliveredAmountField]);

  /* ── Conversion helper ── */
  const getSoToSIVal = (stat: (typeof statsByAgent)[0]) =>
    soToSIMode === "count"
      ? pctVal(stat.totalDeliveredCount, stat.totalSODoneCount)
      : pctVal(stat.totalSalesInvoice, stat.totalSOAmount);

  const colorClass = (val: number) =>
    val >= thresholdHigh ? "text-green-600"
    : val >= thresholdMid ? "text-amber-500"
    : "text-red-500";

  /* ── Footer totals ── */
  const totals = useMemo(() => {
    // Only include agents with name info in totals
    const visibleAgents = statsByAgent.filter((a) => agentMap.has(a.agentID));
    const totalSODoneCount = visibleAgents.reduce((s, a) => s + a.totalSODoneCount, 0);
    const totalSOAmount = visibleAgents.reduce((s, a) => s + a.totalSOAmount, 0);
    const totalDeliveredCount = visibleAgents.reduce((s, a) => s + a.totalDeliveredCount, 0);
    const totalSalesInvoice = visibleAgents.reduce((s, a) => s + a.totalSalesInvoice, 0);
    const soToSIVal = soToSIMode === "count"
      ? pctVal(totalDeliveredCount, totalSODoneCount)
      : pctVal(totalSalesInvoice, totalSOAmount);
    return { totalSODoneCount, totalSOAmount, totalDeliveredCount, totalSalesInvoice, soToSIVal };
  }, [statsByAgent, soToSIMode, agentMap]);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (statsByAgent.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Order Performance");

      // Headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 25 },
        { header: `Total SO Done (${soStatus})`, key: "soCount", width: 20 },
        { header: `Total SO Amount (${soAmountField})`, key: "soAmount", width: 25 },
        { header: `Total Sales Invoice (${deliveredAmountField})`, key: "siAmount", width: 25 },
        { header: "SO → SI (%)", key: "soToSI", width: 15 },
        { header: `Total Delivered (${deliveredTypeActivity})`, key: "deliveredCount", width: 25 },
      ];

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data (only agents with name info)
      const filteredStats = statsByAgent.filter((stat) => agentMap.has(stat.agentID));
      filteredStats.forEach((stat) => {
        const info = agentMap.get(stat.agentID)!;
        const soToSIVal = getSoToSIVal(stat);

        worksheet.addRow({
          agent: info.name,
          soCount: stat.totalSODoneCount,
          soAmount: stat.totalSOAmount,
          siAmount: stat.totalSalesInvoice,
          soToSI: soToSIVal / 100,
          deliveredCount: stat.totalDeliveredCount,
        });
      });

      // Add Totals Row
      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        soCount: totals.totalSODoneCount,
        soAmount: totals.totalSOAmount,
        siAmount: totals.totalSalesInvoice,
        soToSI: totals.soToSIVal / 100,
        deliveredCount: totals.totalDeliveredCount,
      });
      totalRow.font = { bold: true };

      // Formatting
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (rowNumber > 1) {
            // Percentages
            if (colNumber === 5) {
              cell.numFmt = '0.00%';
            }
            // Currency
            if (colNumber === 3 || colNumber === 4) {
              cell.numFmt = '#,##0.00" ₱"';
            }
          }
        });
      });

      // Filename
      let filename = "TSM_Sales_Order_Performance";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromStr = new Date(dateCreatedFilterRange.from).toISOString().split('T')[0];
        const toStr = new Date(dateCreatedFilterRange.to).toISOString().split('T')[0];
        filename += `_${fromStr}_to_${toStr}`;
      }
      filename += ".xlsx";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      <EditComputationDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        config={config}
        onSave={handleSave}
      />

      {/* ── Header ── */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sales Order Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">{soStatus}</span> and{" "}
              <span className="font-medium text-gray-500">{deliveredTypeActivity}</span> activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={statsByAgent.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs border-dashed"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Edit Computation
            </Button>
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
                  <TableHead className="text-gray-500 text-center">
                    Total SO Done
                    <span className="block text-[9px] font-normal text-gray-400">({soStatus})</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Total SO Amount
                    <span className="block text-[9px] font-normal text-gray-400">({soAmountField})</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Total Sales Invoice
                    <span className="block text-[9px] font-normal text-gray-400">({deliveredAmountField})</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    SO → SI
                    <span className="block text-[9px] font-normal text-gray-400">
                      {soToSIMode === "count"
                        ? "(Delivered ÷ SO-Done)"
                        : "(SI amount ÷ SO amount)"}
                    </span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Total Delivered
                    <span className="block text-[9px] font-normal text-gray-400">({deliveredTypeActivity})</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent
                  .filter((stat) => agentMap.has(stat.agentID)) // Only show agents with name info
                  .map((stat) => {
                  const info = agentMap.get(stat.agentID)!;
                  const soToSIVal = getSoToSIVal(stat);

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
                              {info.name[0]}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-semibold text-gray-800">
                        {stat.totalSODoneCount}
                      </TableCell>

                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalSOAmount)}
                      </TableCell>

                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalSalesInvoice)}
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={`font-semibold ${colorClass(soToSIVal)}`}>
                          {soToSIVal.toFixed(2)}%
                        </span>
                      </TableCell>

                      <TableCell className="text-center text-gray-700">
                        {stat.totalDeliveredCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-gray-800">{totals.totalSODoneCount}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalSOAmount)}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalSalesInvoice)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${colorClass(totals.soToSIVal)}`}>
                      {totals.soToSIVal.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-gray-700">{totals.totalDeliveredCount}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* ── Computation details panel ── */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details (Current Settings)</p>
            <p>
              <strong>Total SO Done:</strong> Count where <code>status = "{soStatus}"</code>.
            </p>
            <p>
              <strong>Total SO Amount:</strong> Sum of <code>{soAmountField}</code> from SO-Done rows.
            </p>
            <p>
              <strong>Total Delivered:</strong> Count where <code>type_activity = "{deliveredTypeActivity}"</code>.
            </p>
            <p>
              <strong>Total Sales Invoice:</strong> Sum of <code>{deliveredAmountField}</code> from Delivered rows.
            </p>
            <p>
              <strong>SO → SI %:</strong>{" "}
              {soToSIMode === "count"
                ? <>Total Delivered count ÷ Total SO-Done count × 100% — <em>count-based.</em></>
                : <>Total SI amount ÷ Total SO amount × 100% — <em>amount-based.</em></>}
            </p>
            <p>
              <strong>Colors:</strong>{" "}
              <span className="text-green-700">Green ≥ {thresholdHigh}%</span> /{" "}
              <span className="text-amber-600">Amber ≥ {thresholdMid}%</span> /{" "}
              <span className="text-red-600">Red below</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}