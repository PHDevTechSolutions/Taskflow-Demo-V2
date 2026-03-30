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
  if (loading) return <div className="flex justify-center items-center h-40 text-xs text-slate-400">Loading...</div>;
  if (error)   return <div className="flex justify-center items-center h-40 text-xs text-red-500">{error}</div>;
  if (empty)   return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
      <span className="text-3xl">{emptyIcon}</span>
      <p className="text-sm font-medium">{emptyText}</p>
    </div>
  );
  return <div className="rounded-xl border border-slate-200 overflow-hidden">{children}</div>;
}

function PaginationBar({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <Pagination>
      <PaginationContent className="flex items-center gap-4 justify-center text-xs">
        <PaginationItem>
          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
            aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-40" : ""} />
        </PaginationItem>
        <span className="text-slate-500 font-medium select-none">{page} / {pageCount}</span>
        <PaginationItem>
          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
            aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-40" : ""} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
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
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
        {children && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors
              ${showFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
          >
            <SlidersHorizontal size={12} /> Filters
          </button>
        )}
        {count > 0 && (
          <span className="text-[11px] text-slate-500 font-mono ml-auto">
            {count} records{total != null ? ` · Total: ${fmt(total)}` : ""}
          </span>
        )}
      </div>
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {children}
          {hasActiveFilter && (
            <button onClick={onClear} className="h-8 px-3 text-[11px] font-semibold text-red-500 border border-red-200 hover:border-red-400 rounded-lg transition-colors">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NCSTable
// ═══════════════════════════════════════════════════════════════════════════════

interface NCS {
  id: number; quotation_amount?: number; quotation_number?: string; remarks?: string;
  date_created: string; company_name?: string; contact_number?: string;
  contact_person?: string; type_client?: string; type_activity?: string; status: string;
}

export const NCSTable: React.FC<{ referenceid: string; target_quota?: string; dateCreatedFilterRange: any; setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>; }> = ({
  referenceid, dateCreatedFilterRange,
}) => {
  const [activities, setActivities] = useState<NCS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [searchTerm, setSearchTerm]     = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [showFilters, setShowFilters]   = useState(false);
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

  const NCS_CLIENT_TYPES = ["csr client", "tsa client", "new client"];

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => NCS_CLIENT_TYPES.includes(i.type_client?.toLowerCase() ?? ""))
      .filter((i) => i.type_activity?.toLowerCase() === "quotation preparation")
      .filter((i) => filterClient === "all" || i.type_client?.toLowerCase() === filterClient)
      .filter((i) => !s || [i.company_name, i.quotation_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => inDateRange(i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, filterClient, dateCreatedFilterRange]);

  const total     = useMemo(() => filtered.reduce((a, i) => a + (i.quotation_amount ?? 0), 0), [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [searchTerm, filterClient, dateCreatedFilterRange]);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("NCS Report");

      // Add headers
      worksheet.columns = [
        { header: "Date Created", key: "dateCreated", width: 15 },
        { header: "Quotation No.", key: "quotationNo", width: 20 },
        { header: "Amount", key: "amount", width: 18 },
        { header: "Company", key: "company", width: 30 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Contact No.", key: "contactNo", width: 20 },
        { header: "Client Type", key: "clientType", width: 20 }
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
        worksheet.addRow({
          dateCreated: fmtDate(item.date_created),
          quotationNo: item.quotation_number || "—",
          amount: item.quotation_amount ?? 0,
          company: item.company_name || "—",
          contactPerson: item.contact_person || "—",
          contactNo: item.contact_number || "—",
          clientType: item.type_client || "—"
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
      let filename = "NCS_Report";
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
      <div className="flex items-center justify-between gap-2">
        <SearchFilterBar
          searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search company, quotation number, remarks..."
          showFilters={showFilters} setShowFilters={setShowFilters}
          count={filtered.length} total={total}
          hasActiveFilter={filterClient !== "all" || !!searchTerm}
          onClear={() => { setFilterClient("all"); setSearchTerm(""); }}
        >
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-8 w-[180px] text-xs border-slate-200"><SelectValue placeholder="All Client Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Client Types</SelectItem>
              {NCS_CLIENT_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </SearchFilterBar>
        
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shrink-0"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      <TableShell loading={loading} error={error} empty={filtered.length === 0} emptyIcon="🤝" emptyText="No NCS records found">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {["Date Created", "Quotation No.", "Amount", "Company", "Contact Person", "Contact No.", "Client Type"].map((h) => (
                <TableHead key={h} className="text-[11px] text-slate-500 font-semibold">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item) => (
              <TableRow key={item.id} className="text-xs hover:bg-slate-50/60 font-mono">
                <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(item.date_created)}</TableCell>
                <TableCell className="uppercase text-slate-600">{item.quotation_number || "—"}</TableCell>
                <TableCell className="text-right text-slate-700">{item.quotation_amount != null ? fmt(item.quotation_amount) : "—"}</TableCell>
                <TableCell className="text-slate-700">{item.company_name || "—"}</TableCell>
                <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                <TableCell className="text-slate-500">{item.contact_number || "—"}</TableCell>
                <TableCell className="capitalize text-slate-500">{item.type_client || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="bg-slate-50 font-semibold text-xs border-t border-slate-200">
              <TableCell colSpan={2} className="text-slate-500">Total ({filtered.length})</TableCell>
              <TableCell className="text-right text-slate-800">{fmt(total)}</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          </tfoot>
        </Table>
      </TableShell>
      <PaginationBar page={page} pageCount={pageCount} setPage={setPage} />
    </div>
  );
};