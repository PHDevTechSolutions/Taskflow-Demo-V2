"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSR {
  id: number;
  quotation_amount?: number;
  ticket_reference_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_client?: string;
  status: string;
}

interface CSRProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

interface GroupedTicket {
  ticket: string;
  latest: CSR;
  total: number;
  count: number;
  items: CSR[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime()
    ? "—" : d.toLocaleDateString();
};

const fmtDateTime = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
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

// ─── Entries Dialog ───────────────────────────────────────────────────────────

function EntriesDialog({
  open,
  onClose,
  group,
}: {
  open: boolean;
  onClose: () => void;
  group: GroupedTicket | null;
}) {
  if (!group) return null;

  const sorted = [...group.items].sort(
    (a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            🎫 {group.ticket}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {group.count} {group.count === 1 ? "entry" : "entries"} ·{" "}
            {group.latest.company_name || "—"} · Total:{" "}
            <span className="font-semibold text-slate-700">{fmt(group.total)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                {["#", "Date Created", "Amount", "Status", "Contact Person", "Remarks"].map((h) => (
                  <TableHead key={h} className="text-[11px] text-slate-500 font-semibold">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item, idx) => (
                <TableRow key={item.id} className="text-xs hover:bg-slate-50/60 font-mono">
                  <TableCell className="text-slate-400 w-8">{idx + 1}</TableCell>
                  <TableCell className="text-slate-500 whitespace-nowrap">
                    {fmtDateTime(item.date_created)}
                  </TableCell>
                  <TableCell className="text-slate-700 font-semibold">
                    {item.quotation_amount != null ? fmt(item.quotation_amount) : "—"}
                  </TableCell>
                  <TableCell>
                    {item.status ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {item.status}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                  <TableCell className="capitalize text-slate-500">{item.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-slate-50 font-semibold text-xs border-t border-slate-200">
                <TableCell colSpan={2} className="text-slate-500">
                  Total ({group.count} {group.count === 1 ? "entry" : "entries"})
                </TableCell>
                <TableCell className="text-slate-800">{fmt(group.total)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Table Shell ──────────────────────────────────────────────────────────────

function TableShell({ children, loading, error, empty }: {
  children: React.ReactNode;
  loading: boolean;
  error: string | null;
  empty: boolean;
}) {
  if (loading) return (
    <div className="flex justify-center items-center h-40 text-xs text-slate-400">Loading...</div>
  );
  if (error) return (
    <div className="flex justify-center items-center h-40 text-xs text-red-500">{error}</div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
      <span className="text-3xl">🎫</span>
      <p className="text-sm font-medium">No CSR records found</p>
    </div>
  );
  return <div className="rounded-xl border border-slate-200 overflow-hidden">{children}</div>;
}

function PaginationBar({ page, pageCount, setPage }: {
  page: number; pageCount: number; setPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <Pagination>
      <PaginationContent className="flex items-center gap-4 justify-center text-xs">
        <PaginationItem>
          <PaginationPrevious href="#"
            onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
            aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-40" : ""} />
        </PaginationItem>
        <span className="text-slate-500 font-medium select-none">{page} / {pageCount}</span>
        <PaginationItem>
          <PaginationNext href="#"
            onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
            aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-40" : ""} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const CSRTable: React.FC<CSRProps> = ({ referenceid, dateCreatedFilterRange }) => {
  const [activities, setActivities] = useState<CSR[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage]             = useState(1);

  const [selectedGroup, setSelectedGroup] = useState<GroupedTicket | null>(null);
  const [dialogOpen, setDialogOpen]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", dateCreatedFilterRange.from);
    if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   dateCreatedFilterRange.to);

    fetch(url.toString())
      .then(async (r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => setActivities(d.activities || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const ch = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as CSR;
          const o = payload.old as CSR;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
              case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
              case "DELETE": return curr.filter((a) => a.id !== o.id);
              default: return curr;
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_client?.toLowerCase() === "csr client")
      .filter((i) =>
        !s || [i.company_name, i.ticket_reference_number, i.remarks].some((v) => v?.toLowerCase().includes(s))
      )
      .filter((i) => inDateRange(i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, dateCreatedFilterRange]);

  const grouped = useMemo((): GroupedTicket[] => {
    const map = new Map<string, CSR[]>();
    filtered.forEach((i) => {
      const key = i.ticket_reference_number ?? "UNKNOWN";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });

    return Array.from(map.entries()).map(([ticket, items]) => {
      const latest = items.reduce((prev, curr) =>
        new Date(curr.date_updated ?? curr.date_created).getTime() >
        new Date(prev.date_updated ?? prev.date_created).getTime()
          ? curr : prev
      );
      return {
        ticket,
        latest,
        total: items.reduce((a, i) => a + (i.quotation_amount ?? 0), 0),
        count: items.length,
        items,
      };
    });
  }, [filtered]);

  const grandTotal = useMemo(() => grouped.reduce((a, g) => a + g.total, 0), [grouped]);
  const pageCount  = Math.ceil(grouped.length / PAGE_SIZE);
  const paginated  = useMemo(() => grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [grouped, page]);

  useEffect(() => { setPage(1); }, [searchTerm, dateCreatedFilterRange]);

  const openDialog = (group: GroupedTicket) => {
    setSelectedGroup(group);
    setDialogOpen(true);
  };

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (grouped.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("CSR Report");

      // Add headers
      worksheet.columns = [
        { header: "Date Created", key: "dateCreated", width: 15 },
        { header: "Ticket No.", key: "ticketNo", width: 20 },
        { header: "Total Amount", key: "amount", width: 18 },
        { header: "Entries", key: "entries", width: 12 },
        { header: "Company", key: "company", width: 30 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
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
      grouped.forEach((group) => {
        worksheet.addRow({
          dateCreated: fmtDate(group.latest.date_created),
          ticketNo: group.ticket || "—",
          amount: group.total,
          entries: group.count,
          company: group.latest.company_name || "—",
          contactPerson: group.latest.contact_person || "—",
          contactNo: group.latest.contact_number || "—",
          remarks: group.latest.remarks || "—"
        });
      });

      // Add totals row
      const totalsRow = worksheet.addRow({
        dateCreated: "TOTAL",
        amount: grandTotal
      });
      totalsRow.font = { bold: true };

      // Format currency column
      const amountCol = worksheet.getColumn('amount');
      if (amountCol && amountCol.number > 0) {
        amountCol.numFmt = '#,##0.00" ₱"';
      }

      // Generate filename with date range
      let filename = "CSR_Report";
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search company, ticket number, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
          {grouped.length > 0 && (
            <span className="text-[11px] text-slate-500 font-mono ml-auto">
              {grouped.length} tickets · Total:{" "}
              <strong className="text-slate-700">{fmt(grandTotal)}</strong>
            </span>
          )}
        </div>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shrink-0"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {/* Hint */}
      {grouped.length > 0 && (
        <p className="text-[11px] text-slate-400 italic">
          💡 Click the <span className="font-semibold text-indigo-500">entries</span> badge to view all records under a ticket.
        </p>
      )}

      {/* Table */}
      <TableShell loading={loading} error={error} empty={grouped.length === 0}>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {["Date Created", "Ticket No.", "Total Amount", "Entries", "Company", "Contact Person", "Contact No.", "Remarks"].map((h) => (
                <TableHead key={h} className="text-[11px] text-slate-500 font-semibold">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((group) => {
              const { ticket, latest, total: rowTotal, count } = group;
              return (
                <TableRow key={latest.id} className="text-xs hover:bg-slate-50/60 font-mono">
                  <TableCell className="text-slate-500 whitespace-nowrap">
                    {fmtDate(latest.date_created)}
                  </TableCell>
                  <TableCell className="uppercase text-slate-600">{ticket || "—"}</TableCell>
                  <TableCell className="text-slate-700">{fmt(rowTotal)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => openDialog(group)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400 transition-all cursor-pointer"
                      title="Click to view all entries"
                    >
                      {count} {count === 1 ? "entry" : "entries"} ↗
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-700">{latest.company_name || "—"}</TableCell>
                  <TableCell className="text-slate-600">{latest.contact_person || "—"}</TableCell>
                  <TableCell className="text-slate-500">{latest.contact_number || "—"}</TableCell>
                  <TableCell className="capitalize text-slate-500">{latest.remarks || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <tfoot>
            <TableRow className="bg-slate-50 font-semibold text-xs border-t border-slate-200">
              <TableCell colSpan={2} className="text-slate-500">
                Total ({grouped.length} tickets)
              </TableCell>
              <TableCell className="text-slate-800">{fmt(grandTotal)}</TableCell>
              <TableCell colSpan={5} />
            </TableRow>
          </tfoot>
        </Table>
      </TableShell>

      <PaginationBar page={page} pageCount={pageCount} setPage={setPage} />

      {/* Entries Dialog */}
      <EntriesDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        group={selectedGroup}
      />
    </div>
  );
};