/**
 * Shared helpers for all TSA report table components.
 */

import {
  LineChart, Line, XAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, YAxis, Legend,
} from "recharts";
import React from "react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationPrevious, PaginationNext,
} from "@/components/ui/pagination";

// ─── Chart config (shared) ────────────────────────────────────────────────────

export const defaultChartConfig: ChartConfig = {
  count:  { label: "Count",  color: "#185FA5" },
  amount: { label: "Amount", color: "#1D9E75" },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

export const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth()    === d2.getMonth()    &&
  d1.getDate()     === d2.getDate();

/**
 * Returns true when dateStr falls within the given range.
 * Uses plain YYYY-MM-DD string comparison to avoid timezone shifts.
 */
export const inDateRange = (
  dateStr: string,
  range: { from?: string | Date; to?: string | Date } | null | undefined,
): boolean => {
  if (!range?.from && !range?.to) return true;

  // Normalise to YYYY-MM-DD
  const toDateKey = (v: string | Date) => {
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
  };

  const d    = String(dateStr).slice(0, 10);
  const from = range.from ? toDateKey(range.from) : null;
  const to   = range.to   ? toDateKey(range.to)   : null;

  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
};

// ─── Chart data builder ───────────────────────────────────────────────────────

export const buildChartData = (
  items: { date_created: string; amount: number }[],
): { date: string; count: number; amount: number }[] => {
  const map: Record<string, { count: number; amount: number }> = {};

  items.forEach(({ date_created, amount }) => {
    const d = new Date(date_created).toLocaleDateString(undefined, {
      month: "short", day: "numeric",
    });
    if (!map[d]) map[d] = { count: 0, amount: 0 };
    map[d].count  += 1;
    map[d].amount += amount;
  });

  return Object.entries(map)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// ─── Currency helpers ─────────────────────────────────────────────────────────

export const php = (v?: number | null): string =>
  v == null
    ? "—"
    : v.toLocaleString("en-PH", { style: "currency", currency: "PHP" });

const compactPHP = (v: number): string => {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `₱${(v / 1_000).toFixed(0)}K`;
  return `₱${v}`;
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const ReportTooltip = ({
  active, payload, label, amountLabel,
}: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 text-xs shadow-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-6 items-center mb-0.5">
          <span className="text-gray-500 flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: entry.color }}
            />
            {entry.name === "amount" ? (amountLabel ?? "Amount") : "Count"}
          </span>
          <span className="font-semibold text-gray-800 tabular-nums">
            {entry.name === "amount"
              ? php(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Legend dot ───────────────────────────────────────────────────────────────

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
    <span
      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
      style={{ background: color }}
    />
    {label}
  </span>
);

// ─── Shared chart card ────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  /** Total record count */
  count: number;
  /** Total amount (optional — pass 0 to hide) */
  totalAmount?: number;
  data: { date: string; count: number; amount: number }[];
  amountLabel?: string;
  /** Color for the amount line (defaults to teal) */
  amountColor?: string;
  /** Callback for the drill-down button (optional) */
  onDrillDown?: () => void;
}

export const ReportChartCard: React.FC<ChartCardProps> = ({
  title,
  count,
  totalAmount,
  data,
  amountLabel = "Amount",
  amountColor = "#1D9E75",
  onDrillDown,
}) => {
  const countColor  = "#185FA5";
  const dateRange   = data.length >= 2
    ? `${data[0].date} → ${data[data.length - 1].date}`
    : data.length === 1 ? data[0].date : null;

  const cfg: ChartConfig = {
    count:  { label: "Count",       color: countColor  },
    amount: { label: amountLabel,   color: amountColor },
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col w-full max-w-2xl p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
          {title}
        </p>

        {/* Metric row */}
        <div className="flex items-baseline gap-3 flex-wrap">
          {totalAmount != null && totalAmount > 0 && (
            <span className="text-[22px] font-medium text-gray-900 tabular-nums">
              {compactPHP(totalAmount)}
            </span>
          )}
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ background: "#EAF3DE", color: "#27500A" }}
          >
            {count} record{count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Chart body ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-2 flex-1">
        {/* Legend */}
        <div className="flex gap-4 mb-3">
          <LegendItem color={countColor}  label="Count"       />
          <LegendItem color={amountColor} label={amountLabel} />
        </div>

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-[11px] text-gray-300">
            No data for this period
          </div>
        ) : (
          <ChartContainer config={cfg} className="h-[180px] w-full">
            <LineChart
              data={data}
              margin={{ left: 4, right: 4, top: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickMargin={6}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="cnt"
                orientation="left"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={28}
              />
              <YAxis
                yAxisId="amt"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={40}
                tickFormatter={(v) => compactPHP(v)}
              />
              <Tooltip
                content={<ReportTooltip amountLabel={amountLabel} />}
                cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
              />
              <Line
                yAxisId="cnt"
                type="monotone"
                dataKey="count"
                stroke={countColor}
                strokeWidth={2}
                dot={{ r: 3, fill: countColor, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="amt"
                type="monotone"
                dataKey="amount"
                stroke={amountColor}
                strokeWidth={2}
                dot={{ r: 3, fill: amountColor, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 tabular-nums">
          {dateRange ?? "—"}
        </span>
        {onDrillDown && (
          <button
            onClick={onDrillDown}
            className="text-[11px] text-blue-600 hover:underline bg-transparent border-none p-0 cursor-pointer"
          >
            Drill down →
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Shared pagination ────────────────────────────────────────────────────────

interface PagerProps {
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
}

export const Pager: React.FC<PagerProps> = ({ page, pageCount, setPage }) => (
  <Pagination>
    <PaginationContent className="flex items-center space-x-4 justify-center mt-4 text-xs">
      <PaginationItem>
        <PaginationPrevious
          href="#"
          onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
          aria-disabled={page === 1}
          className={page === 1 ? "pointer-events-none opacity-50" : ""}
        />
      </PaginationItem>
      <span className="font-medium select-none tabular-nums text-gray-600">
        {page} / {pageCount}
      </span>
      <PaginationItem>
        <PaginationNext
          href="#"
          onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
          aria-disabled={page === pageCount}
          className={page === pageCount ? "pointer-events-none opacity-50" : ""}
        />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
);