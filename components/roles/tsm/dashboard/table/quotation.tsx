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

const STORAGE_KEY = "quotation_computation_config";

/* ─── Config shape ───────────────────────────────────────────────────────── */

interface QuotationConfig {
  // Quotation row definition
  quotationTypeActivity: string;         // default: "Quotation Preparation"
  quotationStatus: string;               // default: "Quote-Done"
  quotationAmountField: "quotation_amount" | "so_amount" | "actual_sales";

  // Sales Order row definition
  soStatus: string;                      // default: "SO-Done"
  soAmountField: "quotation_amount" | "so_amount" | "actual_sales";

  // Delivered row definition (used for Quotation → SI count)
  deliveredTypeActivity: string;         // default: "Delivered / Closed Transaction"
  siAmountField: "quotation_amount" | "so_amount" | "actual_sales";

  // Quote → SO: count-based or amount-based
  quoteToSOMode: "count" | "amount";

  // Quotation → SI: count-based (Delivered ÷ Quote-Done) or amount-based (SI amt ÷ Quote amt)
  quotationToSIMode: "count" | "amount";

  // Color thresholds
  thresholdHigh: number; // default: 70
  thresholdMid: number;  // default: 40
}

const DEFAULT_CONFIG: QuotationConfig = {
  quotationTypeActivity: "Quotation Preparation",
  quotationStatus: "Quote-Done",
  quotationAmountField: "quotation_amount",

  soStatus: "SO-Done",
  soAmountField: "so_amount",

  deliveredTypeActivity: "Delivered / Closed Transaction",
  siAmountField: "actual_sales",

  quoteToSOMode: "count",
  quotationToSIMode: "count",   // ← correct default: Delivered count ÷ Quote-Done count

  thresholdHigh: 70,
  thresholdMid: 40,
};

function loadConfig(): QuotationConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { return DEFAULT_CONFIG; }
}

function saveConfig(cfg: QuotationConfig) {
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

interface QuotationCardProps {
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

const getField = (
  item: HistoryItem,
  field: "quotation_amount" | "so_amount" | "actual_sales"
): number => {
  const raw =
    field === "actual_sales" ? item.actual_sales
    : field === "so_amount" ? item.so_amount
    : item.quotation_amount;
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

const FieldToggle = ({
  value, onChange,
}: {
  value: "quotation_amount" | "so_amount" | "actual_sales";
  onChange: (v: "quotation_amount" | "so_amount" | "actual_sales") => void;
}) => (
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
  config: QuotationConfig;
  onSave: (cfg: QuotationConfig) => void;
}> = ({ open, onClose, config, onSave }) => {
  const [draft, setDraft] = useState<QuotationConfig>(config);
  useEffect(() => { if (open) setDraft(config); }, [open, config]);

  const set = <K extends keyof QuotationConfig>(k: K, v: QuotationConfig[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Settings2 className="h-4 w-4" /> Edit Computation Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Customize how quotation metrics are calculated. Saved to your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1 max-h-[65vh] overflow-y-auto pr-1">

          {/* ── Quotation rows ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Quotation Row Definition
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">type_activity value</Label>
              <p className="text-[11px] text-gray-400">Row is counted as a quotation only when this matches.</p>
              <Input value={draft.quotationTypeActivity}
                onChange={(e) => set("quotationTypeActivity", e.target.value)}
                className="text-xs rounded-none w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">status value</Label>
              <p className="text-[11px] text-gray-400">Row must also match this status to be counted.</p>
              <Input value={draft.quotationStatus}
                onChange={(e) => set("quotationStatus", e.target.value)}
                className="text-xs rounded-none w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Amount field</Label>
              <p className="text-[11px] text-gray-400">Which column is summed as the "Quotation Amount".</p>
              <FieldToggle value={draft.quotationAmountField}
                onChange={(v) => set("quotationAmountField", v)} />
            </div>
          </section>

          {/* ── Sales Order rows ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Sales Order Row Definition
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">status value</Label>
              <Input value={draft.soStatus}
                onChange={(e) => set("soStatus", e.target.value)}
                className="text-xs rounded-none w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Amount field</Label>
              <FieldToggle value={draft.soAmountField}
                onChange={(v) => set("soAmountField", v)} />
            </div>
          </section>

          {/* ── Delivered rows ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Delivered / Closed Transaction Row Definition
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">type_activity value</Label>
              <p className="text-[11px] text-gray-400">
                Rows matching this are counted as "Delivered" — used as the numerator of Quotation → SI.
              </p>
              <Input value={draft.deliveredTypeActivity}
                onChange={(e) => set("deliveredTypeActivity", e.target.value)}
                className="text-xs rounded-none w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">SI Amount field</Label>
              <p className="text-[11px] text-gray-400">Used only when Quotation → SI is set to Amount-based.</p>
              <FieldToggle value={draft.siAmountField}
                onChange={(v) => set("siAmountField", v)} />
            </div>
          </section>

          {/* ── Conversion formulas ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Conversion Formulas
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Quote → SO %</Label>
              <p className="text-[11px] text-gray-400">How to measure conversion from quotation to sales order.</p>
              <div className="flex gap-2 flex-wrap">
                <ToggleBtn active={draft.quoteToSOMode === "count"}
                  onClick={() => set("quoteToSOMode", "count")}>
                  Count-based (SO count ÷ Quote count)
                </ToggleBtn>
                <ToggleBtn active={draft.quoteToSOMode === "amount"}
                  onClick={() => set("quoteToSOMode", "amount")}>
                  Amount-based (SO amount ÷ Quote amount)
                </ToggleBtn>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Quotation → SI %</Label>
              <p className="text-[11px] text-gray-400">How to measure conversion from quotation to sales invoice.</p>
              <div className="flex gap-2 flex-wrap">
                <ToggleBtn active={draft.quotationToSIMode === "count"}
                  onClick={() => set("quotationToSIMode", "count")}>
                  Count-based (Delivered count ÷ Quote-Done count)
                </ToggleBtn>
                <ToggleBtn active={draft.quotationToSIMode === "amount"}
                  onClick={() => set("quotationToSIMode", "amount")}>
                  Amount-based (SI amount ÷ Quote amount)
                </ToggleBtn>
              </div>
            </div>
          </section>

          {/* ── Color thresholds ── */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
              Color Thresholds (Conversion Columns)
            </p>
            <p className="text-[11px] text-gray-400">Green if ≥ High, Amber if ≥ Mid, Red if below Mid.</p>
            <div className="flex gap-6 items-center">
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500 font-semibold">High (green) %</Label>
                <Input type="number" min={0} max={100} value={draft.thresholdHigh}
                  onChange={(e) => set("thresholdHigh", Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 text-xs rounded-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500 font-semibold">Mid (amber) %</Label>
                <Input type="number" min={0} max={100} value={draft.thresholdMid}
                  onChange={(e) => set("thresholdMid", Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 text-xs rounded-none" />
              </div>
            </div>
          </section>

          {/* ── Live preview ── */}
          <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-700 text-xs mb-1.5">Current Settings Preview</p>
            <p><span className="text-gray-400 w-44 inline-block">Quotation filter:</span>
              <strong>type_activity="{draft.quotationTypeActivity}" &amp;&amp; status="{draft.quotationStatus}"</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Quotation amount field:</span>
              <strong>{draft.quotationAmountField}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SO filter:</span>
              <strong>status="{draft.soStatus}"</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SO amount field:</span>
              <strong>{draft.soAmountField}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Delivered filter:</span>
              <strong>type_activity="{draft.deliveredTypeActivity}"</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">SI amount field:</span>
              <strong>{draft.siAmountField}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Quote → SO mode:</span>
              <strong>{draft.quoteToSOMode === "count" ? "Count-based" : "Amount-based"}</strong></p>
            <p><span className="text-gray-400 w-44 inline-block">Quotation → SI mode:</span>
              <strong>{draft.quotationToSIMode === "count" ? "Count-based (Delivered ÷ Quote-Done)" : "Amount-based (SI amt ÷ Quote amt)"}</strong></p>
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
          <button type="button" onClick={() => setDraft(DEFAULT_CONFIG)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <RotateCcw className="h-3 w-3" /> Reset to defaults
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs rounded-none" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="text-xs rounded-none"
              onClick={() => { onSave(draft); onClose(); }}>
              Save Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function QuotationTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: QuotationCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [config, setConfig] = useState<QuotationConfig>(DEFAULT_CONFIG);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const handleSave = (cfg: QuotationConfig) => { setConfig(cfg); saveConfig(cfg); };

  const {
    quotationTypeActivity, quotationStatus, quotationAmountField,
    soStatus, soAmountField,
    deliveredTypeActivity, siAmountField,
    quoteToSOMode, quotationToSIMode,
    thresholdHigh, thresholdMid,
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
      totalQuoteDoneCount: number;    // Quote-Done count
      totalQuotationAmount: number;
      totalSOCount: number;           // SO-Done count
      totalSOAmount: number;
      totalDeliveredCount: number;    // Delivered / Closed count  ← numerator of Quotation→SI
      totalSIAmount: number;
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
          totalSOCount: 0,
          totalSOAmount: 0,
          totalDeliveredCount: 0,
          totalSIAmount: 0,
        });
      }

      const stat = map.get(agentID)!;

      // Quotation rows
      if (item.type_activity === quotationTypeActivity && item.status === quotationStatus) {
        stat.totalQuoteDoneCount++;
        stat.totalQuotationAmount += getField(item, quotationAmountField);
      }

      // Sales Order rows
      if (item.status === soStatus) {
        stat.totalSOCount++;
        stat.totalSOAmount += getField(item, soAmountField);
      }

      // Delivered / Closed Transaction rows
      if (item.type_activity === deliveredTypeActivity) {
        stat.totalDeliveredCount++;
        stat.totalSIAmount += getField(item, siAmountField);
      }
    });

    return Array.from(map.values());
  }, [
    history,
    quotationTypeActivity, quotationStatus, quotationAmountField,
    soStatus, soAmountField,
    deliveredTypeActivity, siAmountField,
  ]);

  /* ── Per-row conversion values ── */
  const getQuoteToSOVal = (stat: (typeof statsByAgent)[0]) =>
    quoteToSOMode === "count"
      ? pctVal(stat.totalSOCount, stat.totalQuoteDoneCount)
      : pctVal(stat.totalSOAmount, stat.totalQuotationAmount);

  // ✅ Fixed: count-based by default — Delivered count ÷ Quote-Done count
  const getQuotationToSIVal = (stat: (typeof statsByAgent)[0]) =>
    quotationToSIMode === "count"
      ? pctVal(stat.totalDeliveredCount, stat.totalQuoteDoneCount)
      : pctVal(stat.totalSIAmount, stat.totalQuotationAmount);

  const colorClass = (val: number) =>
    val >= thresholdHigh ? "text-green-600"
    : val >= thresholdMid ? "text-amber-500"
    : "text-red-500";

  /* ── Footer totals ── */
  const totals = useMemo(() => {
    const totalQuoteDoneCount = statsByAgent.reduce((s, a) => s + a.totalQuoteDoneCount, 0);
    const totalQuotationAmount = statsByAgent.reduce((s, a) => s + a.totalQuotationAmount, 0);
    const totalSOCount = statsByAgent.reduce((s, a) => s + a.totalSOCount, 0);
    const totalSOAmount = statsByAgent.reduce((s, a) => s + a.totalSOAmount, 0);
    const totalDeliveredCount = statsByAgent.reduce((s, a) => s + a.totalDeliveredCount, 0);
    const totalSIAmount = statsByAgent.reduce((s, a) => s + a.totalSIAmount, 0);

    const quoteToSOVal = quoteToSOMode === "count"
      ? pctVal(totalSOCount, totalQuoteDoneCount)
      : pctVal(totalSOAmount, totalQuotationAmount);

    const quotationToSIVal = quotationToSIMode === "count"
      ? pctVal(totalDeliveredCount, totalQuoteDoneCount)
      : pctVal(totalSIAmount, totalQuotationAmount);

    return {
      totalQuoteDoneCount, totalQuotationAmount,
      totalSOCount, totalSOAmount,
      totalDeliveredCount, totalSIAmount,
      quoteToSOVal, quotationToSIVal,
    };
  }, [statsByAgent, quoteToSOMode, quotationToSIMode]);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (statsByAgent.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Quotation Performance");

      // Headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 25 },
        { header: `Total Quotations (${quotationStatus})`, key: "totalQuotes", width: 20 },
        { header: `Quotation Amount (${quotationAmountField})`, key: "quoteAmount", width: 25 },
        { header: "Quote → SO (%)", key: "quoteToSO", width: 15 },
        { header: "Quote → SO (Detail)", key: "quoteToSODetail", width: 20 },
        { header: "Quotation → SI (%)", key: "quoteToSI", width: 15 },
        { header: "Quotation → SI (Detail)", key: "quoteToSIDetail", width: 20 },
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

      // Add Data
      statsByAgent.forEach((stat) => {
        const info = agentMap.get(stat.agentID);
        const quoteToSOVal = getQuoteToSOVal(stat);
        const quotationToSIVal = getQuotationToSIVal(stat);

        worksheet.addRow({
          agent: info?.name ?? stat.agentID,
          totalQuotes: stat.totalQuoteDoneCount,
          quoteAmount: stat.totalQuotationAmount,
          quoteToSO: quoteToSOVal / 100,
          quoteToSODetail: quoteToSOMode === "count" ? stat.totalSOCount : stat.totalSOAmount,
          quoteToSI: quotationToSIVal / 100,
          quoteToSIDetail: quotationToSIMode === "count" ? stat.totalDeliveredCount : stat.totalSIAmount,
        });
      });

      // Add Totals Row
      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        totalQuotes: totals.totalQuoteDoneCount,
        quoteAmount: totals.totalQuotationAmount,
        quoteToSO: totals.quoteToSOVal / 100,
        quoteToSODetail: quoteToSOMode === "count" ? totals.totalSOCount : totals.totalSOAmount,
        quoteToSI: totals.quotationToSIVal / 100,
        quoteToSIDetail: quotationToSIMode === "count" ? totals.totalDeliveredCount : totals.totalSIAmount,
      });
      totalRow.font = { bold: true };

      // Formatting
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (rowNumber > 1) {
            // Percentages
            if (colNumber === 4 || colNumber === 6) {
              cell.numFmt = '0.00%';
            }
            // Currency (Quotation Amount and Detail if amount-based)
            if (colNumber === 3) {
              cell.numFmt = '#,##0.00" ₱"';
            }
            if (colNumber === 5 && quoteToSOMode === "amount") {
              cell.numFmt = '#,##0.00" ₱"';
            }
            if (colNumber === 7 && quotationToSIMode === "amount") {
              cell.numFmt = '#,##0.00" ₱"';
            }
          }
        });
      });

      // Filename
      let filename = "TSM_Quotation_Performance";
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
            <h2 className="text-sm font-semibold text-gray-800">Quotations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">
                {quotationTypeActivity} · {quotationStatus}
              </span>{" "}
              activities
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
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs border-dashed">
              <Settings2 className="w-3.5 h-3.5" />
              Edit Computation
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
          </div>
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
                    <span className="block text-[9px] font-normal text-gray-400">({quotationStatus})</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quotation Amount
                    <span className="block text-[9px] font-normal text-gray-400">({quotationAmountField})</span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quote → SO
                    <span className="block text-[9px] font-normal text-gray-400">
                      {quoteToSOMode === "count" ? "(SO count ÷ Quote count)" : "(SO amount ÷ Quote amount)"}
                    </span>
                  </TableHead>
                  <TableHead className="text-gray-500 text-center">
                    Quotation → SI
                    <span className="block text-[9px] font-normal text-gray-400">
                      {quotationToSIMode === "count"
                        ? "(Delivered count ÷ Quote-Done count)"
                        : "(SI amount ÷ Quote amount)"}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent.map((stat) => {
                  const info = agentMap.get(stat.agentID);
                  const quoteToSOVal = getQuoteToSOVal(stat);
                  const quotationToSIVal = getQuotationToSIVal(stat);

                  return (
                    <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                      {/* Agent */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img src={info.picture} alt={info.name}
                              className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
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
                        <span className={`font-semibold ${colorClass(quoteToSOVal)}`}>
                          {quoteToSOVal.toFixed(2)}%
                        </span>
                        <span className="ml-1 text-gray-400 text-[10px]">
                          {quoteToSOMode === "count"
                            ? `(${stat.totalSOCount})`
                            : `(${fmt(stat.totalSOAmount)})`}
                        </span>
                      </TableCell>

                      {/* Quotation → SI */}
                      <TableCell className="text-center">
                        <span className={`font-semibold ${colorClass(quotationToSIVal)}`}>
                          {quotationToSIVal.toFixed(2)}%
                        </span>
                        <span className="ml-1 text-gray-400 text-[10px]">
                          {quotationToSIMode === "count"
                            ? `(${stat.totalDeliveredCount})`
                            : `(${fmt(stat.totalSIAmount)})`}
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
                  <TableCell className="text-center text-gray-800">
                    {totals.totalQuoteDoneCount}
                  </TableCell>
                  <TableCell className="text-center text-gray-700">
                    {fmt(totals.totalQuotationAmount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={colorClass(totals.quoteToSOVal)}>
                      {totals.quoteToSOVal.toFixed(2)}%
                    </span>
                    <span className="ml-1 text-gray-400 text-[10px]">
                      {quoteToSOMode === "count"
                        ? `(${totals.totalSOCount})`
                        : `(${fmt(totals.totalSOAmount)})`}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={colorClass(totals.quotationToSIVal)}>
                      {totals.quotationToSIVal.toFixed(2)}%
                    </span>
                    <span className="ml-1 text-gray-400 text-[10px]">
                      {quotationToSIMode === "count"
                        ? `(${totals.totalDeliveredCount})`
                        : `(${fmt(totals.totalSIAmount)})`}
                    </span>
                  </TableCell>
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
              <strong>Total Quotations:</strong> Count where{" "}
              <code>type_activity = "{quotationTypeActivity}"</code> AND <code>status = "{quotationStatus}"</code>.
            </p>
            <p>
              <strong>Quotation Amount:</strong> Sum of <code>{quotationAmountField}</code> from matching rows.
            </p>
            <p>
              <strong>Quote → SO %:</strong>{" "}
              {quoteToSOMode === "count"
                ? <>Count of <code>status = "{soStatus}"</code> ÷ Total Quote-Done count × 100%</>
                : <>Sum of <code>{soAmountField}</code> where <code>status = "{soStatus}"</code> ÷ Total Quotation Amount × 100%</>}
            </p>
            <p>
              <strong>Quotation → SI %:</strong>{" "}
              {quotationToSIMode === "count"
                ? <>Count of <code>type_activity = "{deliveredTypeActivity}"</code> ÷ Total Quote-Done count × 100% — <em>count-based.</em></>
                : <>Sum of <code>{siAmountField}</code> from Delivered rows ÷ Total Quotation Amount × 100% — <em>amount-based.</em></>}
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