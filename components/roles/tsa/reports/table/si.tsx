"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SI {
  id: number;
  actual_sales?: number;
  dr_number?: string;
  remarks?: string;
  date_created: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_activity: string;
  status: string;
  delivery_date?: string;
  si_date?: string;
  so_number?: string;
  payment_terms?: string;
}

interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const fmtDate = (dateStr?: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime()) return "—";
  return d.toLocaleDateString();
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const inDateRange = (dateStr: string | null | undefined, range: any): boolean => {
  if (!range?.from && !range?.to) return true;
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = range.from ? new Date(range.from) : null;
  const to   = range.to   ? new Date(range.to)   : null;
  if (from && to && isSameDay(from, to)) return isSameDay(date, from);
  if (from && date < from) return false;
  if (to   && date > to)   return false;
  return true;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SITable: React.FC<SIProps> = ({ referenceid, dateCreatedFilterRange }) => {
  const [activities, setActivities] = useState<SI[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [searchTerm,   setSearchTerm]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString() : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999)).toISOString() : null;
    if (from && to) { url.searchParams.append("from", from); url.searchParams.append("to", to); }

    fetch(url.toString())
      .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch"); return res.json(); })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const channel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` }, (payload) => {
        const n = payload.new as SI;
        const o = payload.old as SI;
        setActivities((curr) => {
          switch (payload.eventType) {
            case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
            case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
            case "DELETE": return curr.filter((a) => a.id !== o.id);
            default: return curr;
          }
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const statusOptions = useMemo(() =>
    Array.from(new Set(activities.map((a) => a.status).filter(Boolean))).sort(),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_activity?.toLowerCase() === "delivered / closed transaction")
      .filter((i) => !s || [i.company_name, i.dr_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => filterStatus === "all" || i.status === filterStatus)
      .filter((i) => inDateRange(i.delivery_date, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, filterStatus, dateCreatedFilterRange]);

  const totalSales  = useMemo(() => filteredActivities.reduce((a, i) => a + (i.actual_sales ?? 0), 0), [filteredActivities]);
  const pageCount   = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginated   = useMemo(() => filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredActivities, page]);

  useEffect(() => { setPage(1); }, [searchTerm, filterStatus, dateCreatedFilterRange]);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (filteredActivities.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Invoice Report");

      // Add headers
      worksheet.columns = [
        { header: "Delivery Date", key: "deliveryDate", width: 15 },
        { header: "SI Date", key: "siDate", width: 15 },
        { header: "SI Amount", key: "amount", width: 18 },
        { header: "SO Number", key: "soNumber", width: 20 },
        { header: "DR Number", key: "drNumber", width: 20 },
        { header: "Company", key: "company", width: 30 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Contact No.", key: "contactNo", width: 20 },
        { header: "Remarks", key: "remarks", width: 40 },
        { header: "Payment Terms", key: "paymentTerms", width: 20 }
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows
      filteredActivities.forEach((item) => {
        worksheet.addRow({
          deliveryDate: fmtDate(item.delivery_date),
          siDate: fmtDate(item.si_date),
          amount: item.actual_sales ?? 0,
          soNumber: item.so_number || "—",
          drNumber: item.dr_number || "—",
          company: item.company_name || "—",
          contactPerson: item.contact_person || "—",
          contactNo: item.contact_number || "—",
          remarks: item.remarks || "—",
          paymentTerms: item.payment_terms || "—"
        });
      });

      // Add totals row
      const totalsRow = worksheet.addRow({
        deliveryDate: "TOTAL",
        amount: totalSales
      });
      totalsRow.font = { bold: true };

      // Format currency column
      const amountCol = worksheet.getColumn('amount');
      if (amountCol && amountCol.number > 0) {
        amountCol.numFmt = '#,##0.00" ₱"';
      }

      // Generate filename with date range
      let filename = "Sales_Invoice_Report";
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

  const hasActiveFilter = filterStatus !== "all" || !!searchTerm;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Search + filter toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search company, DR number, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-white border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-400 transition-all font-mono"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-none border transition-all shadow-sm
              ${showFilters ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"}`}
          >
            <SlidersHorizontal size={12} /> Filters
          </button>
          {filteredActivities.length > 0 && (
            <div className="bg-white px-3 py-1.5 border border-zinc-200 shadow-sm flex items-center gap-3 ml-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-r border-zinc-100 pr-3">
                {filteredActivities.length} records
              </span>
              <span className="text-[11px] font-mono font-bold text-zinc-700">
                Total: {fmt(totalSales)}
              </span>
            </div>
          )}
        </div>
        
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

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center bg-zinc-50/50 p-3 border border-zinc-200 shadow-sm border-t-0 -mt-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[180px] text-[10px] font-bold uppercase tracking-widest bg-white border-zinc-200 rounded-none shadow-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Statuses</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilter && (
            <button
              onClick={() => { setFilterStatus("all"); setSearchTerm(""); }}
              className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest text-red-600 border border-red-100 hover:bg-red-50 rounded-none transition-all"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-none border border-zinc-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-xs text-zinc-400 font-mono">
            <Search className="w-4 h-4 animate-spin mr-2" /> Loading records...
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-40 text-xs text-red-500 font-bold uppercase tracking-wider">{error}</div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-300">
            <span className="text-3xl grayscale opacity-30">🧾</span>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No SI records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
                  {[
                    "Delivery Date", "SI Date", "SI Amount", "SO Number", 
                    "DR Number", "Company", "Contact Person", "Contact No.", 
                    "Remarks", "Payment Terms"
                  ].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2.5">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item) => (
                  <TableRow key={item.id} className="text-xs hover:bg-zinc-50/50 transition-colors border-b border-zinc-100 last:border-0">
                    <TableCell className="text-zinc-500 whitespace-nowrap px-3 font-mono text-[11px]">{fmtDate(item.delivery_date)}</TableCell>
                    <TableCell className="text-zinc-500 whitespace-nowrap px-3 font-mono text-[11px]">{fmtDate(item.si_date)}</TableCell>
                    <TableCell className="text-left text-zinc-900 px-3 font-bold">{item.actual_sales != null ? fmt(item.actual_sales) : "—"}</TableCell>
                    <TableCell className="uppercase text-zinc-600 px-3 font-bold font-mono">{item.so_number || "—"}</TableCell>
                    <TableCell className="uppercase text-zinc-600 px-3 font-bold font-mono">{item.dr_number || "—"}</TableCell>
                    <TableCell className="text-zinc-800 px-3 font-bold">{item.company_name || "—"}</TableCell>
                    <TableCell className="text-zinc-600 px-3 capitalize font-medium">{item.contact_person || "—"}</TableCell>
                    <TableCell className="text-zinc-500 px-3 font-mono text-[11px]">{item.contact_number || "—"}</TableCell>
                    <TableCell className="capitalize text-zinc-500 px-3 truncate max-w-[200px]" title={item.remarks || ""}>
                      {item.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-zinc-500 px-3 font-medium">{item.payment_terms || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <TableRow className="bg-zinc-50/50 font-bold text-[11px] border-t border-zinc-200">
                  <TableCell colSpan={2} className="text-zinc-500 px-3 uppercase tracking-wider">Total ({filteredActivities.length})</TableCell>
                  <TableCell className="text-left text-zinc-900 px-3">{fmt(totalSales)}</TableCell>
                  <TableCell colSpan={6} />
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center py-4 border-t border-zinc-100 bg-zinc-50/30">
          <Pagination>
            <PaginationContent className="flex items-center gap-4 justify-center text-xs">
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                  aria-disabled={page === 1} 
                  className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    page === 1 ? "pointer-events-none opacity-30" : "hover:bg-zinc-100 border-zinc-200 shadow-sm"
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
                    page === pageCount ? "pointer-events-none opacity-30" : "hover:bg-zinc-100 border-zinc-200 shadow-sm"
                  }`} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
