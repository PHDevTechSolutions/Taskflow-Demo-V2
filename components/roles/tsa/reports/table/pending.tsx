"use client";
// ─── SOTable ──────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const inDateRange = (dateStr: string, range: any): boolean => {
  if (!range?.from && !range?.to) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = range.from ? new Date(range.from) : null;
  const to   = range.to   ? new Date(range.to)   : null;
  if (from && to && isSameDay(from, to)) return isSameDay(date, from);
  if (from && date < from) return false;
  if (to   && date > to)   return false;
  return true;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime() ? "—" : d.toLocaleDateString();
};

// shared realtime handler factory
function makeRealtimeHandler<T extends { id: number }>(setActivities: React.Dispatch<React.SetStateAction<T[]>>) {
  return (payload: any) => {
    const n = payload.new as T;
    const o = payload.old as T;
    setActivities((curr) => {
      switch (payload.eventType) {
        case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
        case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
        case "DELETE": return curr.filter((a) => a.id !== o.id);
        default: return curr;
      }
    });
  };
}

function TableShell({ children, loading, error, empty, emptyIcon, emptyText }: {
  children: React.ReactNode;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyIcon: string;
  emptyText: string;
}) {
  if (loading) return (
    <div className="flex justify-center items-center h-40 text-xs text-zinc-400 font-mono">
      <Search className="w-4 h-4 animate-spin mr-2" /> Loading records...
    </div>
  );
  if (error) return (
    <div className="flex justify-center items-center h-40 text-xs text-red-500 font-bold uppercase tracking-wider">{error}</div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-300">
      <span className="text-3xl grayscale opacity-30">{emptyIcon}</span>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{emptyText}</p>
    </div>
  );
  return <div className="rounded-none border border-zinc-200 bg-white overflow-hidden shadow-sm">{children}</div>;
}

function PaginationBar({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center py-4 border-t border-zinc-100 bg-zinc-50/30">
      <Pagination>
        <PaginationContent className="flex items-center gap-4 justify-center text-xs">
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
              aria-disabled={page === 1} 
              className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${
                page === 1 ? "pointer-events-none opacity-30" : "hover:bg-zinc-100 border-zinc-200"
              }`} 
            />
          </PaginationItem>
          <span className="text-zinc-500 font-mono text-[11px] font-bold select-none bg-white px-3 py-1 border border-zinc-200 shadow-sm">
            {page} / {pageCount}
          </span>
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
              aria-disabled={page === pageCount} 
              className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${
                page === pageCount ? "pointer-events-none opacity-30" : "hover:bg-zinc-100 border-zinc-200"
              }`} 
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function SearchFilterBar({
  searchTerm, setSearchTerm, placeholder,
  showFilters, setShowFilters,
  count, total, children, hasActiveFilter, onClear,
}: {
  searchTerm: string; setSearchTerm: (v: string) => void; placeholder: string;
  showFilters: boolean; setShowFilters: (v: boolean) => void;
  count: number; total?: number; children?: React.ReactNode;
  hasActiveFilter: boolean; onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-white border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-400 transition-all font-mono"
          />
        </div>
        {children && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-none border transition-all shadow-sm
              ${showFilters ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"}`}
          >
            <SlidersHorizontal size={12} /> Filters
          </button>
        )}
        {count > 0 && (
          <div className="bg-white px-3 py-1.5 border border-zinc-200 shadow-sm flex items-center gap-3 ml-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-r border-zinc-100 pr-3">
              {count} records
            </span>
            {total != null && (
              <span className="text-[11px] font-mono font-bold text-zinc-700">
                Total: {fmt(total)}
              </span>
            )}
          </div>
        )}
      </div>
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-zinc-100 mt-2">
          {children}
          {hasActiveFilter && (
            <button 
              onClick={onClear} 
              className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-red-600 border border-red-100 hover:bg-red-50 rounded-none transition-all"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PendingTable
// ═══════════════════════════════════════════════════════════════════════════════

interface Pending {
  id: number; quotation_number?: string; quotation_amount?: number; remarks?: string;
  date_created: string; company_name?: string; contact_number?: string;
  quotation_status?: string; type_activity: string; status: string;
}

export const PendingTable: React.FC<{ referenceid: string; target_quota?: string; dateCreatedFilterRange: any; setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>; }> = ({
  referenceid, dateCreatedFilterRange,
}) => {
  const [activities, setActivities] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true); setError(null);
    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from).toISOString() : null;
    const to   = dateCreatedFilterRange?.to   ? new Date(new Date(dateCreatedFilterRange.to).setHours(23,59,59,999)).toISOString() : null;
    if (from && to) { url.searchParams.append("from", from); url.searchParams.append("to", to); }
    fetch(url.toString()).then(async (r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => setActivities(d.activities || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const ch = supabase.channel(`public:history:referenceid=eq.${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` }, makeRealtimeHandler(setActivities)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.quotation_status?.toLowerCase() === "convert to so")
      .filter((i) => !s || [i.company_name, i.quotation_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => {
        const d = new Date(i.date_created);
        return !isNaN(d.getTime()) && (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) >= 15;
      })
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, now]);

  const total     = useMemo(() => filtered.reduce((a, i) => a + (i.quotation_amount ?? 0), 0), [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [searchTerm, dateCreatedFilterRange]);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pending SO Report");

      // Add headers
      worksheet.columns = [
        { header: "Date Created", key: "dateCreated", width: 15 },
        { header: "Days Pending", key: "daysPending", width: 15 },
        { header: "Quotation No.", key: "quotationNo", width: 20 },
        { header: "Amount", key: "amount", width: 18 },
        { header: "Company", key: "company", width: 30 },
        { header: "Contact No.", key: "contactNo", width: 20 },
        { header: "Remarks", key: "remarks", width: 40 }
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows
      filtered.forEach((item) => {
        const daysPending = Math.floor((now.getTime() - new Date(item.date_created).getTime()) / (1000 * 60 * 60 * 24));
        worksheet.addRow({
          dateCreated: fmtDate(item.date_created),
          daysPending: `${daysPending}d`,
          quotationNo: item.quotation_number || "—",
          amount: item.quotation_amount ?? 0,
          company: item.company_name || "—",
          contactNo: item.contact_number || "—",
          remarks: item.remarks || "—"
        });
      });

      // Add totals row
      const totalsRow = worksheet.addRow({
        dateCreated: "TOTAL",
        amount: total
      });
      totalsRow.font = { bold: true };

      // Format currency column
      const amountCol = worksheet.getColumn('amount');
      if (amountCol && amountCol.number > 0) {
        amountCol.numFmt = '#,##0.00" ₱"';
      }

      // Generate filename with date range
      let filename = "Pending_SO_Report";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromDate = new Date(dateCreatedFilterRange.from).toLocaleDateString().replace(/\//g, '-');
        const toDate = new Date(dateCreatedFilterRange.to).toLocaleDateString().replace(/\//g, '-');
        filename += `_${fromDate}_to_${toDate}`;
      }
      filename += ".xlsx";

      // Create buffer and download
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

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export data to Excel");
    }
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-center gap-2 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 font-bold uppercase tracking-wider shadow-sm">
        <span>⏳</span> Showing quotations with status <strong>Convert to SO</strong> pending for 15+ days.
      </div>

      <div className="flex items-center justify-between gap-2">
        <SearchFilterBar
          searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search company, quotation number, remarks..."
          showFilters={showFilters} setShowFilters={setShowFilters}
          count={filtered.length} total={total}
          hasActiveFilter={!!searchTerm} onClear={() => setSearchTerm("")}
        />
        
        {/** ── Export Excel button ── 
        * <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-white rounded-none hover:bg-zinc-800 transition-all shrink-0 shadow-sm active:scale-95"
        >
          <Download size={14} />
          Export Excel
        </button>
        */}
      </div>

      <TableShell loading={loading} error={error} empty={filtered.length === 0} emptyIcon="✅" emptyText="No pending SO records (15+ days)">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
              {["Date Created", "Days Pending", "Quotation No.", "Amount", "Company", "Contact No.", "Remarks"].map((h) => (
                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2.5">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item) => {
              const daysPending = Math.floor((now.getTime() - new Date(item.date_created).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <TableRow key={item.id} className="text-xs hover:bg-zinc-50/50 transition-colors border-b border-zinc-100 last:border-0">
                  <TableCell className="text-zinc-500 whitespace-nowrap px-3 font-mono text-[11px]">{fmtDate(item.date_created)}</TableCell>
                  <TableCell className="px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-tighter ${daysPending >= 30 ? "bg-red-100 text-red-600 border border-red-200" : "bg-amber-100 text-amber-700 border border-amber-200"}`}>
                      {daysPending}d
                    </span>
                  </TableCell>
                  <TableCell className="uppercase text-zinc-600 px-3 font-bold">{item.quotation_number || "—"}</TableCell>
                  <TableCell className="text-right text-zinc-700 px-3 font-bold">{item.quotation_amount != null ? fmt(item.quotation_amount) : "—"}</TableCell>
                  <TableCell className="text-zinc-800 px-3 font-bold">{item.company_name || "—"}</TableCell>
                  <TableCell className="text-zinc-500 px-3 font-mono text-[11px]">{item.contact_number || "—"}</TableCell>
                  <TableCell className="capitalize text-zinc-500 px-3 truncate max-w-[200px]" title={item.remarks || ""}>{item.remarks || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <tfoot>
            <TableRow className="bg-zinc-50/50 font-bold text-[11px] border-t border-zinc-200">
              <TableCell colSpan={3} className="text-zinc-500 px-3 uppercase tracking-wider">Total ({filtered.length})</TableCell>
              <TableCell className="text-right text-zinc-900 px-3">{fmt(total)}</TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </tfoot>
        </Table>
      </TableShell>
      <PaginationBar page={page} pageCount={pageCount} setPage={setPage} />
    </div>
  );
};