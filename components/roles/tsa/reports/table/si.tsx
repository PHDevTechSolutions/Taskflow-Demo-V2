"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
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
      .filter((i) => inDateRange(i.delivery_date || i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.delivery_date || b.date_created).getTime() - new Date(a.delivery_date || a.date_created).getTime());
  }, [activities, searchTerm, filterStatus, dateCreatedFilterRange]);

  const totalSales  = useMemo(() => filteredActivities.reduce((a, i) => a + (i.actual_sales ?? 0), 0), [filteredActivities]);
  const pageCount   = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginated   = useMemo(() => filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredActivities, page]);

  useEffect(() => { setPage(1); }, [searchTerm, filterStatus, dateCreatedFilterRange]);

  const hasActiveFilter = filterStatus !== "all" || !!searchTerm;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Search + filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search company, DR number, remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors
            ${showFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
        >
          <SlidersHorizontal size={12} /> Filters
        </button>
        {filteredActivities.length > 0 && (
          <span className="text-[11px] text-slate-500 font-mono ml-auto">
            {filteredActivities.length} records · Total: <strong className="text-slate-700">{fmt(totalSales)}</strong>
          </span>
        )}
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[180px] text-xs border-slate-200">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilter && (
            <button
              onClick={() => { setFilterStatus("all"); setSearchTerm(""); }}
              className="h-8 px-3 text-[11px] font-semibold text-red-500 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-40 text-xs text-slate-400">Loading...</div>
      ) : error ? (
        <div className="flex justify-center items-center h-40 text-xs text-red-500">{error}</div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
          <span className="text-3xl">🧾</span>
          <p className="text-sm font-medium">No SI records found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                {["Delivery Date", "SI Date", "SI Amount", "SO Number", "DR Number", "Company", "Contact Person", "Contact No.", "Remarks", "Payment Terms"].map((h) => (
                  <TableHead key={h} className="text-[11px] text-slate-500 font-semibold">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((item) => (
                <TableRow key={item.id} className="text-xs hover:bg-slate-50/60 font-mono">
                  <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(item.delivery_date)}</TableCell>
                  <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(item.si_date)}</TableCell>
                  <TableCell className="text-left text-slate-700">{item.actual_sales != null ? fmt(item.actual_sales) : "—"}</TableCell>
                  <TableCell className="uppercase text-slate-600">{item.so_number || "—"}</TableCell>
                  <TableCell className="uppercase text-slate-600">{item.dr_number || "—"}</TableCell>
                  <TableCell className="text-slate-700">{item.company_name || "—"}</TableCell>
                  <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                  <TableCell className="text-slate-500">{item.contact_number || "—"}</TableCell>
                  <TableCell className="capitalize text-slate-500">{item.remarks || "—"}</TableCell>
                  <TableCell className="text-slate-500">{item.payment_terms || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-slate-50 font-semibold text-xs border-t border-slate-200">
                <TableCell colSpan={2} className="text-slate-500">Total ({filteredActivities.length})</TableCell>
                <TableCell className="text-left text-slate-800">{fmt(totalSales)}</TableCell>
                <TableCell colSpan={6} />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
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
      )}
    </div>
  );
};