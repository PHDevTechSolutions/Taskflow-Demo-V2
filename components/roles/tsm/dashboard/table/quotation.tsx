import React, { useMemo, useState, useEffect } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Info, Settings2, RotateCcw, Download, X, Users, Sliders, GitMerge, Palette,
} from "lucide-react";
import ExcelJS from "exceljs";

/* ─── Storage key ────────────────────────────────────────────────────────── */

const STORAGE_KEY = "quotation_computation_config";

/* ─── Config shape ───────────────────────────────────────────────────────── */

interface QuotationConfig {
  quotationTypeActivity: string;
  quotationStatus: string;
  quotationAmountField: "quotation_amount" | "so_amount" | "actual_sales";
  soStatus: string;
  soAmountField: "quotation_amount" | "so_amount" | "actual_sales";
  deliveredTypeActivity: string;
  siAmountField: "quotation_amount" | "so_amount" | "actual_sales";
  quoteToSOMode: "count" | "amount";
  quotationToSIMode: "count" | "amount";
  thresholdHigh: number;
  thresholdMid: number;
  hiddenAgents: string[];
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
  quotationToSIMode: "count",
  thresholdHigh: 70,
  thresholdMid: 40,
  hiddenAgents: [],
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
    className={`px-2.5 py-1 text-[11px] border rounded font-medium transition-colors ${
      active
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
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

/* ─── Section Header ─────────────────────────────────────────────────────── */

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b pb-1">
    {icon}
    <span>{title}</span>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function QuotationTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: QuotationCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [config,          setConfig]          = useState<QuotationConfig>(DEFAULT_CONFIG);

  useEffect(() => { setConfig(loadConfig()); }, []);

  /* ---- Draft state ---- */
  const [draft, setDraft] = useState<QuotationConfig>(DEFAULT_CONFIG);
  const set = <K extends keyof QuotationConfig>(k: K, v: QuotationConfig[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const openPanel = () => {
    setDraft({ ...config });
    setShowSettings(true);
  };

  const savePanel = () => {
    setConfig(draft);
    saveConfig(draft);
    setShowSettings(false);
  };

  const resetPanel = () => setDraft({ ...DEFAULT_CONFIG });

  const toggleAgent = (agentId: string, visible: boolean) => {
    setDraft((prev) => ({
      ...prev,
      hiddenAgents: visible
        ? prev.hiddenAgents.filter((id) => id !== agentId)
        : [...prev.hiddenAgents, agentId],
    }));
  };

  const {
    quotationTypeActivity, quotationStatus, quotationAmountField,
    soStatus, soAmountField,
    deliveredTypeActivity, siAmountField,
    quoteToSOMode, quotationToSIMode,
    thresholdHigh, thresholdMid,
    hiddenAgents,
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

  /* ── Stats per agent ── */
  const statsByAgent = useMemo(() => {
    type AgentStats = {
      agentID: string;
      totalQuoteDoneCount: number;
      totalQuotationAmount: number;
      totalSOCount: number;
      totalSOAmount: number;
      totalDeliveredCount: number;
      totalSIAmount: number;
    };

    const map = new Map<string, AgentStats>();

    history.forEach((item) => {
      const agentID = item.referenceid?.toLowerCase();
      if (!agentID) return;
      if (!map.has(agentID)) {
        map.set(agentID, { agentID, totalQuoteDoneCount: 0, totalQuotationAmount: 0, totalSOCount: 0, totalSOAmount: 0, totalDeliveredCount: 0, totalSIAmount: 0 });
      }
      const stat = map.get(agentID)!;
      if (item.type_activity === quotationTypeActivity && item.status === quotationStatus) {
        stat.totalQuoteDoneCount++;
        stat.totalQuotationAmount += getField(item, quotationAmountField);
      }
      if (item.status === soStatus) {
        stat.totalSOCount++;
        stat.totalSOAmount += getField(item, soAmountField);
      }
      if (item.type_activity === deliveredTypeActivity) {
        stat.totalDeliveredCount++;
        stat.totalSIAmount += getField(item, siAmountField);
      }
    });

    return Array.from(map.values());
  }, [history, quotationTypeActivity, quotationStatus, quotationAmountField, soStatus, soAmountField, deliveredTypeActivity, siAmountField]);

  /* ── Known agents for panel ── */
  const knownAgents = useMemo(
    () =>
      statsByAgent
        .filter((s) => agentMap.has(s.agentID))
        .map((s) => ({
          agentId: s.agentID,
          name: agentMap.get(s.agentID)!.name,
          picture: agentMap.get(s.agentID)!.picture,
        })),
    [statsByAgent, agentMap]
  );

  /* ── Visible stats ── */
  const visibleStats = useMemo(
    () => statsByAgent.filter((s) => agentMap.has(s.agentID) && !hiddenAgents.includes(s.agentID)),
    [statsByAgent, agentMap, hiddenAgents]
  );

  /* ── Conversion helpers ── */
  const getQuoteToSOVal = (stat: (typeof statsByAgent)[0]) =>
    quoteToSOMode === "count"
      ? pctVal(stat.totalSOCount, stat.totalQuoteDoneCount)
      : pctVal(stat.totalSOAmount, stat.totalQuotationAmount);

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
    const totalQuoteDoneCount  = visibleStats.reduce((s, a) => s + a.totalQuoteDoneCount, 0);
    const totalQuotationAmount = visibleStats.reduce((s, a) => s + a.totalQuotationAmount, 0);
    const totalSOCount         = visibleStats.reduce((s, a) => s + a.totalSOCount, 0);
    const totalSOAmount        = visibleStats.reduce((s, a) => s + a.totalSOAmount, 0);
    const totalDeliveredCount  = visibleStats.reduce((s, a) => s + a.totalDeliveredCount, 0);
    const totalSIAmount        = visibleStats.reduce((s, a) => s + a.totalSIAmount, 0);
    const quoteToSOVal = quoteToSOMode === "count"
      ? pctVal(totalSOCount, totalQuoteDoneCount)
      : pctVal(totalSOAmount, totalQuotationAmount);
    const quotationToSIVal = quotationToSIMode === "count"
      ? pctVal(totalDeliveredCount, totalQuoteDoneCount)
      : pctVal(totalSIAmount, totalQuotationAmount);
    return { totalQuoteDoneCount, totalQuotationAmount, totalSOCount, totalSOAmount, totalDeliveredCount, totalSIAmount, quoteToSOVal, quotationToSIVal };
  }, [visibleStats, quoteToSOMode, quotationToSIMode]);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (visibleStats.length === 0) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Quotation Performance");

      worksheet.columns = [
        { header: "Agent", key: "agent", width: 25 },
        { header: `Total Quotations (${quotationStatus})`, key: "totalQuotes", width: 20 },
        { header: `Quotation Amount (${quotationAmountField})`, key: "quoteAmount", width: 25 },
        { header: "Quote → SO (%)", key: "quoteToSO", width: 15 },
        { header: "Quote → SO (Detail)", key: "quoteToSODetail", width: 20 },
        { header: "Quotation → SI (%)", key: "quoteToSI", width: 15 },
        { header: "Quotation → SI (Detail)", key: "quoteToSIDetail", width: 20 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font      = { bold: true };
      headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      visibleStats.forEach((stat) => {
        const info = agentMap.get(stat.agentID)!;
        worksheet.addRow({
          agent:          info.name,
          totalQuotes:    stat.totalQuoteDoneCount,
          quoteAmount:    stat.totalQuotationAmount,
          quoteToSO:      getQuoteToSOVal(stat) / 100,
          quoteToSODetail: quoteToSOMode === "count" ? stat.totalSOCount : stat.totalSOAmount,
          quoteToSI:      getQuotationToSIVal(stat) / 100,
          quoteToSIDetail: quotationToSIMode === "count" ? stat.totalDeliveredCount : stat.totalSIAmount,
        });
      });

      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        totalQuotes:    totals.totalQuoteDoneCount,
        quoteAmount:    totals.totalQuotationAmount,
        quoteToSO:      totals.quoteToSOVal / 100,
        quoteToSODetail: quoteToSOMode === "count" ? totals.totalSOCount : totals.totalSOAmount,
        quoteToSI:      totals.quotationToSIVal / 100,
        quoteToSIDetail: quotationToSIMode === "count" ? totals.totalDeliveredCount : totals.totalSIAmount,
      });
      totalRow.font = { bold: true };

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (rowNumber > 1) {
            if (colNumber === 4 || colNumber === 6) cell.numFmt = "0.00%";
            if (colNumber === 3) cell.numFmt = '#,##0.00" ₱"';
            if (colNumber === 5 && quoteToSOMode === "amount") cell.numFmt = '#,##0.00" ₱"';
            if (colNumber === 7 && quotationToSIMode === "amount") cell.numFmt = '#,##0.00" ₱"';
          }
        });
      });

      let filename = "TSM_Quotation_Performance";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromStr = new Date(dateCreatedFilterRange.from).toISOString().split("T")[0];
        const toStr   = new Date(dateCreatedFilterRange.to).toISOString().split("T")[0];
        filename += `_${fromStr}_to_${toStr}`;
      }
      filename += ".xlsx";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = window.URL.createObjectURL(blob);
      const link   = document.createElement("a");
      link.href    = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  /* ── Render ── */
  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
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
              variant="outline" size="sm" onClick={exportToExcel}
              disabled={visibleStats.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
            <Button
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={openPanel}
              className={`flex items-center gap-1.5 text-xs ${
                showSettings
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 relative">
        {/* ── Settings Panel ── */}
        {showSettings && (
          <div className="absolute top-0 right-0 z-20 w-80 h-full min-h-96 bg-white border-l border-gray-200 shadow-xl rounded-r-xl flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">Edit Computation</span>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Quotation Row Definition */}
              <div className="space-y-3">
                <SectionHeader icon={<Sliders className="w-3 h-3" />} title="Quotation Row Definition" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">type_activity value</Label>
                  <Input
                    value={draft.quotationTypeActivity}
                    onChange={(e) => set("quotationTypeActivity", e.target.value)}
                    className="text-xs h-8 w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">status value</Label>
                  <Input
                    value={draft.quotationStatus}
                    onChange={(e) => set("quotationStatus", e.target.value)}
                    className="text-xs h-8 w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Amount field</Label>
                  <FieldToggle value={draft.quotationAmountField} onChange={(v) => set("quotationAmountField", v)} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Sales Order Row Definition */}
              <div className="space-y-3">
                <SectionHeader icon={<Sliders className="w-3 h-3" />} title="Sales Order Row Definition" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">status value</Label>
                  <Input
                    value={draft.soStatus}
                    onChange={(e) => set("soStatus", e.target.value)}
                    className="text-xs h-8 w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Amount field</Label>
                  <FieldToggle value={draft.soAmountField} onChange={(v) => set("soAmountField", v)} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Delivered Row Definition */}
              <div className="space-y-3">
                <SectionHeader icon={<Sliders className="w-3 h-3" />} title="Delivered Row Definition" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">type_activity value</Label>
                  <Input
                    value={draft.deliveredTypeActivity}
                    onChange={(e) => set("deliveredTypeActivity", e.target.value)}
                    className="text-xs h-8 w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">SI Amount field</Label>
                  <FieldToggle value={draft.siAmountField} onChange={(v) => set("siAmountField", v)} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Conversion Formulas */}
              <div className="space-y-3">
                <SectionHeader icon={<GitMerge className="w-3 h-3" />} title="Conversion Formulas" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Quote → SO %</Label>
                  <div className="flex flex-col gap-1">
                    <ToggleBtn active={draft.quoteToSOMode === "count"} onClick={() => set("quoteToSOMode", "count")}>
                      Count (SO ÷ Quote)
                    </ToggleBtn>
                    <ToggleBtn active={draft.quoteToSOMode === "amount"} onClick={() => set("quoteToSOMode", "amount")}>
                      Amount (SO amt ÷ Quote amt)
                    </ToggleBtn>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Quotation → SI %</Label>
                  <div className="flex flex-col gap-1">
                    <ToggleBtn active={draft.quotationToSIMode === "count"} onClick={() => set("quotationToSIMode", "count")}>
                      Count (Delivered ÷ Quote-Done)
                    </ToggleBtn>
                    <ToggleBtn active={draft.quotationToSIMode === "amount"} onClick={() => set("quotationToSIMode", "amount")}>
                      Amount (SI amt ÷ Quote amt)
                    </ToggleBtn>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Color Thresholds */}
              <div className="space-y-3">
                <SectionHeader icon={<Palette className="w-3 h-3" />} title="Color Thresholds" />
                <p className="text-[10px] text-gray-400">Green ≥ High · Amber ≥ Mid · Red below Mid</p>
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-green-600 font-semibold">High %</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={draft.thresholdHigh}
                      onChange={(e) => set("thresholdHigh", Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-20 text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-500 font-semibold">Mid %</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={draft.thresholdMid}
                      onChange={(e) => set("thresholdMid", Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-20 text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Agent Visibility */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={<Users className="w-3 h-3" />} title="Agent Visibility" />
                  <div className="flex gap-2">
                    <button className="text-[10px] text-slate-500 hover:underline" onClick={() => set("hiddenAgents", [])}>
                      Show All
                    </button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button className="text-[10px] text-red-400 hover:underline" onClick={() => set("hiddenAgents", knownAgents.map((a) => a.agentId))}>
                      Hide All
                    </button>
                  </div>
                </div>
                {knownAgents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No agents with data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {knownAgents.map((agent) => {
                      const isVisible = !draft.hiddenAgents.includes(agent.agentId);
                      return (
                        <div key={agent.agentId} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            {agent.picture ? (
                              <img src={agent.picture} alt={agent.name} className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                                {agent.name[0]}
                              </div>
                            )}
                            <Label htmlFor={`agent-${agent.agentId}`} className="text-xs text-gray-600 capitalize cursor-pointer select-none">
                              {agent.name}
                            </Label>
                          </div>
                          <Switch
                            id={`agent-${agent.agentId}`}
                            checked={isVisible}
                            onCheckedChange={(checked) => toggleAgent(agent.agentId, checked)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer */}
            <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                onClick={resetPanel}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="text-xs h-7 bg-slate-600 hover:bg-slate-700 text-white" onClick={savePanel}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {visibleStats.length === 0 ? (
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
                {visibleStats.map((stat) => {
                  const info            = agentMap.get(stat.agentID)!;
                  const quoteToSOVal    = getQuoteToSOVal(stat);
                  const quotationToSIVal = getQuotationToSIVal(stat);
                  return (
                    <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info.name[0]}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-gray-800">
                        {stat.totalQuoteDoneCount}
                      </TableCell>
                      <TableCell className="text-center text-gray-700">
                        {fmt(stat.totalQuotationAmount)}
                      </TableCell>
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

              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-gray-800">{totals.totalQuoteDoneCount}</TableCell>
                  <TableCell className="text-center text-gray-700">{fmt(totals.totalQuotationAmount)}</TableCell>
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

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details (Current Settings)</p>
            <p><strong>Total Quotations:</strong> Count where <code>type_activity = "{quotationTypeActivity}"</code> AND <code>status = "{quotationStatus}"</code>.</p>
            <p><strong>Quotation Amount:</strong> Sum of <code>{quotationAmountField}</code> from matching rows.</p>
            <p>
              <strong>Quote → SO %:</strong>{" "}
              {quoteToSOMode === "count"
                ? <>Count of <code>status = "{soStatus}"</code> ÷ Total Quote-Done count × 100%</>
                : <>Sum of <code>{soAmountField}</code> where <code>status = "{soStatus}"</code> ÷ Total Quotation Amount × 100%</>}
            </p>
            <p>
              <strong>Quotation → SI %:</strong>{" "}
              {quotationToSIMode === "count"
                ? <>Count of <code>type_activity = "{deliveredTypeActivity}"</code> ÷ Total Quote-Done count × 100%</>
                : <>Sum of <code>{siAmountField}</code> from Delivered rows ÷ Total Quotation Amount × 100%</>}
            </p>
            <p>
              <strong>Colors:</strong>{" "}
              <span className="text-green-700">Green ≥ {thresholdHigh}%</span> /{" "}
              <span className="text-amber-600">Amber ≥ {thresholdMid}%</span> /{" "}
              <span className="text-red-600">Red below</span>
            </p>
            {hiddenAgents.length > 0 && (
              <p>
                <strong>Hidden agents:</strong> {hiddenAgents.length} agent{hiddenAgents.length > 1 ? "s" : ""} excluded from table and totals.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}