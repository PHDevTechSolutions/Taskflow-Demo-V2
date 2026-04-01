"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext,
} from "@/components/ui/pagination";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";

/* ================= TYPES ================= */

interface Quotation {
  id: number;
  quotation_number?: string;
  quotation_amount?: number;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  type_activity: string;
  status: string;
  quotation_status?: string;
}

interface QuotationProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

/* ================= PRIORITY MAP ================= */

const PRIORITY_MAP: Record<string, "HOT" | "WARM" | "COLD" | "DONE"> = {
  "PENDING CLIENT APPROVAL": "WARM",
  "FOR BIDDING": "WARM",
  "NEGO": "WARM",
  "ORDER COMPLETE": "DONE",
  "CONVERT TO SO": "HOT",
  "LOSS PRICE IS TOO HIGH": "COLD",
  "LEAD TIME ISSUE": "COLD",
  "OUT OF STOCK": "COLD",
  "INSUFFICIENT STOCK": "COLD",
  "LOST BID": "COLD",
  "CANVASS ONLY": "COLD",
  "DID NOT MEET THE SPECS": "COLD",
  "DECLINE / DISAPPROVED": "COLD",
};

const ALL_STATUSES = [
  "PENDING CLIENT APPROVAL",
  "FOR BIDDING",
  "NEGO",
  "ORDER COMPLETE",
  "CONVERT TO SO",
  "LOSS PRICE IS TOO HIGH",
  "LEAD TIME ISSUE",
  "OUT OF STOCK",
  "INSUFFICIENT STOCK",
  "LOST BID",
  "CANVASS ONLY",
  "DID NOT MEET THE SPECS",
  "DECLINE / DISAPPROVED",
];

type Priority = "all" | "HOT" | "WARM" | "COLD" | "DONE";

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  HOT:  { badge: "bg-red-50 text-red-700 border-red-100",       dot: "bg-red-500"   },
  WARM: { badge: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-400" },
  COLD: { badge: "bg-blue-50 text-blue-700 border-blue-100",    dot: "bg-blue-400"  },
  DONE: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
};

const PAGE_SIZE = 10;

/* ================= COMPONENT ================= */

export const QuotationTable: React.FC<QuotationProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  /* ---- Fetch activities ---- */
  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString()
      : null;

    const to = dateCreatedFilterRange?.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999)).toISOString()
      : null;

    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  /* ---- Realtime subscription ---- */
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Quotation;
          const oldRecord = payload.old as Quotation;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT": return curr.some(a => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE": return curr.map(a => a.id === newRecord.id ? newRecord : a);
              case "DELETE": return curr.filter(a => a.id !== oldRecord.id);
              default: return curr;
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  /* ---- Base list ---- */
  const baseActivities = useMemo(() =>
    [...activities]
      .filter(item => item.type_activity?.toLowerCase() === "quotation preparation")
      .sort((a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      ),
    [activities]
  );

  /* ---- Filtered activities ---- */
  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return baseActivities
      .filter(item => {
        if (!search) return true;
        return (
          (item.company_name?.toLowerCase().includes(search) ?? false) ||
          (item.quotation_number?.toLowerCase().includes(search) ?? false) ||
          (item.remarks?.toLowerCase().includes(search) ?? false)
        );
      })
      .filter(item => {
        if (filterQuotationStatus !== "all") {
          return item.quotation_status?.toUpperCase() === filterQuotationStatus;
        }
        return true;
      })
      .filter(item => {
        if (filterPriority !== "all") {
          const priority = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
          return priority === filterPriority;
        }
        return true;
      })
      .filter(item => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;

        const itemDate = new Date(item.date_created);
        if (isNaN(itemDate.getTime())) return false;

        const fromDate = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const toDate = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;

        const isSameDay = (d1: Date, d2: Date) =>
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();

        if (fromDate && toDate && isSameDay(fromDate, toDate)) return isSameDay(itemDate, fromDate);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
  }, [baseActivities, searchTerm, filterQuotationStatus, filterPriority, dateCreatedFilterRange]);

  /* ---- Reset page on filter change ---- */
  useEffect(() => { setPage(1); }, [searchTerm, filterQuotationStatus, filterPriority, dateCreatedFilterRange]);

  /* ---- Reset quotation status filter when priority changes ---- */
  useEffect(() => { setFilterQuotationStatus("all"); }, [filterPriority]);

  /* ---- Priority summary counts ---- */
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, DONE: 0 };
    baseActivities.forEach(item => {
      const p = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
      if (p) counts[p]++;
    });
    return counts;
  }, [baseActivities]);

  /* ---- Totals ---- */
  const totalQuotationAmount = useMemo(() =>
    filteredActivities.reduce((acc, item) => acc + (item.quotation_amount ?? 0), 0),
    [filteredActivities]
  );

  const uniqueQuotationCount = useMemo(() => {
    const s = new Set<string>();
    filteredActivities.forEach(item => { if (item.quotation_number) s.add(item.quotation_number); });
    return s.size;
  }, [filteredActivities]);

  /* ---- Statuses filtered by selected priority ---- */
  const availableStatuses = useMemo(() => {
    if (filterPriority === "all") return ALL_STATUSES;
    return ALL_STATUSES.filter(s => PRIORITY_MAP[s] === filterPriority);
  }, [filterPriority]);

  /* ---- Pagination ---- */
  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (filteredActivities.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Quotation Report");

      // Add headers
      worksheet.columns = [
        { header: "Date Created", key: "dateCreated", width: 15 },
        { header: "Status", key: "status", width: 25 },
        { header: "Quotation No.", key: "quotationNo", width: 20 },
        { header: "Amount", key: "amount", width: 18 },
        { header: "Company", key: "company", width: 30 },
        { header: "Contact", key: "contact", width: 20 },
        { header: "Priority", key: "priority", width: 12 },
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
      filteredActivities.forEach((item) => {
        const quotationStatus = item.quotation_status?.toUpperCase() ?? "";
        const priority = PRIORITY_MAP[quotationStatus] || "-";

        worksheet.addRow({
          dateCreated: new Date(item.date_created).toLocaleDateString(),
          status: item.quotation_status || "-",
          quotationNo: item.quotation_number || "-",
          amount: item.quotation_amount ?? 0,
          company: item.company_name || "-",
          contact: item.contact_number || "-",
          priority: priority,
          remarks: item.remarks || "-"
        });
      });

      // Add totals row
      const totalsRow = worksheet.addRow({
        dateCreated: "TOTAL",
        amount: totalQuotationAmount
      });
      totalsRow.font = { bold: true };

      // Format currency column
      const amountCol = worksheet.getColumn('amount');
      if (amountCol && amountCol.number > 0) {
        amountCol.numFmt = '#,##0.00" ₱"';
      }

      // Generate filename with date range
      let filename = "Quotation_Report";
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

  /* ================= RENDER ================= */

  if (!loading && !error && baseActivities.length === 0) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="bg-red-50 border border-red-100 p-6 text-center shadow-sm">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">No Data Found</p>
          <p className="text-[10px] text-red-400 uppercase font-bold">Please check your date range or try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Priority pills ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "HOT", "WARM", "COLD", "DONE"] as const).map((p) => {
          const isActive = filterPriority === p;
          const style = p !== "all" ? PRIORITY_STYLES[p] : null;
          return (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-widest border transition-all shadow-sm
                ${isActive
                  ? p === "all"
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : style?.badge + " ring-1 ring-zinc-900 ring-offset-0"
                  : p === "all"
                    ? "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                }`}
            >
              {p !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />}
              {p === "all" ? "All Records" : p}
              {p !== "all" && (
                <span className="ml-1 px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded-none border border-zinc-200">
                  {priorityCounts[p]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Input
            type="text"
            placeholder="Search company, quotation no., remarks..."
            className="max-w-xs h-9 text-xs bg-white border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-400 transition-all font-mono"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search quotations"
          />

          <Select value={filterQuotationStatus} onValueChange={setFilterQuotationStatus}>
            <SelectTrigger className="w-[240px] h-9 text-[10px] font-bold uppercase tracking-widest bg-white border-zinc-200 rounded-none shadow-sm">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Statuses</SelectItem>
              {availableStatuses.map((s) => {
                const priority = PRIORITY_MAP[s];
                const style = PRIORITY_STYLES[priority];
                return (
                  <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style?.dot}`} />
                      {s}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/*
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-white rounded-none hover:bg-zinc-800 transition-all shrink-0 shadow-sm active:scale-95"
        >
          <Download size={14} />
          Export Excel
        </button>*/}
      </div>

      {/* ── Summary bar ── */}
      {filteredActivities.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 border border-indigo-100/50">
          <span className="text-xs">📊</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            <span>Records: <span className="text-indigo-900 font-mono">{filteredActivities.length}</span></span>
            <span className="text-indigo-200">|</span>
            <span>Unique Quotations: <span className="text-indigo-900 font-mono">{uniqueQuotationCount}</span></span>
            <span className="text-indigo-200">|</span>
            <span>
              Total Amount:{" "}
              <span className="text-indigo-900 font-mono underline underline-offset-2">
                {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-none border border-zinc-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-xs text-zinc-400 font-mono">
            Loading records...
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-40 text-xs text-red-500 font-bold uppercase tracking-wider">{error}</div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-xs text-zinc-400 font-bold uppercase tracking-widest italic">
            No quotation records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
                  {[
                    "Date Created", "Status", "Quotation No.", "Amount", 
                    "Company", "Contact", "Priority", "Remarks"
                  ].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2.5">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedActivities.map((item) => {
                  const quotationStatus = item.quotation_status?.toUpperCase() ?? "";
                  const priority = PRIORITY_MAP[quotationStatus];
                  const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;

                  return (
                    <TableRow key={item.id} className="text-xs hover:bg-zinc-50/50 transition-colors border-b border-zinc-100 last:border-0">
                      <TableCell className="text-zinc-500 whitespace-nowrap px-3 font-mono text-[11px]">
                        {new Date(item.date_created).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-3">
                        <span className="inline-block px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-tighter bg-zinc-100 text-zinc-600 border border-zinc-200">
                          {item.quotation_status || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="uppercase text-zinc-700 px-3 font-bold font-mono">
                        {item.quotation_number || "-"}
                      </TableCell>
                      <TableCell className="text-right text-zinc-900 px-3 font-bold">
                        {item.quotation_amount != null
                          ? item.quotation_amount.toLocaleString(undefined, { style: "currency", currency: "PHP" })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-zinc-800 px-3 font-bold">{item.company_name || "-"}</TableCell>
                      <TableCell className="text-zinc-500 px-3 font-mono text-[11px]">{item.contact_number || "-"}</TableCell>
                      <TableCell className="px-3">
                        {priority && priorityStyle ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[10px] font-bold uppercase tracking-tighter shadow-sm border ${priorityStyle.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                            {priority}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-zinc-500 px-3 truncate max-w-[200px]" title={item.remarks || ""}>
                        {item.remarks || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow className="bg-zinc-50/50 font-bold text-[11px] border-t border-zinc-200">
                  <TableCell colSpan={3} className="text-zinc-500 px-3 uppercase tracking-wider">Total</TableCell>
                  <TableCell className="text-right text-zinc-900 px-3">
                    {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center py-4 border-t border-zinc-100 bg-zinc-50/30">
          <Pagination>
            <PaginationContent className="flex items-center gap-4 justify-center text-xs">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
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
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
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
