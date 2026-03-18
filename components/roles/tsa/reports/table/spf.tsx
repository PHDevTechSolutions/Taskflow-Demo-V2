"use client";
// ─── SOTable ──────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
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
// SPFTable
// ═══════════════════════════════════════════════════════════════════════════════

interface SPF {
  id: number; so_amount?: number; so_number?: string; remarks?: string;
  date_created: string; company_name?: string; contact_number?: string;
  contact_person?: string; call_type?: string; status: string;
}

export const SPFTable: React.FC<{ referenceid: string; target_quota?: string; dateCreatedFilterRange: any; setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>; }> = ({
  referenceid, dateCreatedFilterRange,
}) => {
  const [activities, setActivities] = useState<SPF[]>([]);
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

  const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => SPF_TYPES.includes(i.call_type?.toLowerCase() ?? ""))
      .filter((i) => !s || [i.company_name, i.so_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => inDateRange(i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, dateCreatedFilterRange]);

  const total     = useMemo(() => filtered.reduce((a, i) => a + (i.so_amount ?? 0), 0), [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [searchTerm, dateCreatedFilterRange]);

  return (
    <div className="space-y-4">
      <SearchFilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search company, SO number, remarks..."
        showFilters={showFilters} setShowFilters={setShowFilters}
        count={filtered.length} total={total}
        hasActiveFilter={!!searchTerm} onClear={() => setSearchTerm("")}
      />

      <TableShell loading={loading} error={error} empty={filtered.length === 0} emptyIcon="📑" emptyText="No SPF records found">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {["Date Created", "SO Number", "SO Amount", "Company", "Contact Person", "Contact No.", "Type"].map((h) => (
                <TableHead key={h} className="text-[11px] text-slate-500 font-semibold">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item) => (
              <TableRow key={item.id} className="text-xs hover:bg-slate-50/60 font-mono">
                <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(item.date_created)}</TableCell>
                <TableCell className="uppercase text-slate-600">{item.so_number || "—"}</TableCell>
                <TableCell className="text-right text-slate-700">{item.so_amount != null ? fmt(item.so_amount) : "—"}</TableCell>
                <TableCell className="text-slate-700">{item.company_name || "—"}</TableCell>
                <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                <TableCell className="text-slate-500">{item.contact_number || "—"}</TableCell>
                <TableCell className="capitalize text-slate-500">{item.call_type || "—"}</TableCell>
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