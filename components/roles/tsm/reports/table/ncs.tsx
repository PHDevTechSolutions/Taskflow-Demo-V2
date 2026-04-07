"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationPrevious, PaginationNext,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NCS {
  id: number;
  quotation_amount?: number;
  quotation_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_client: string;
  type_activity?: string;
  status: string;
  referenceid: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface NCSProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const fmtPHP = (v: number) =>
  v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

/**
 * Normalise any date value to a plain YYYY-MM-DD string.
 * Works whether the input is already "YYYY-MM-DD", a full ISO string,
 * or a JS Date object.
 */
const toDateStr = (value: string | Date | undefined | null): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    // Use local date parts to avoid UTC-shift
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // String: take only first 10 chars (handles "2025-03-16" and "2025-03-16T...")
  return String(value).slice(0, 10);
};

/**
 * Extract the date portion of a date_created field.
 * Supabase may return "2025-03-16" or "2025-03-16T08:00:00+00:00".
 */
const recordDateStr = (dateCreated: string): string =>
  String(dateCreated).slice(0, 10);

// ─── Component ────────────────────────────────────────────────────────────────

export const NCSTable: React.FC<NCSProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
}) => {
  const [activities, setActivities] = useState<NCS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");

  // ─── Fetch activities ────────────────────────────────────────────────────

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/tsm/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);

    // Send plain date strings to the API — no time component needed
    const fromStr = toDateStr(dateCreatedFilterRange?.from);
    const toStr = toDateStr(dateCreatedFilterRange?.to);
    if (fromStr) url.searchParams.append("from", fromStr);
    if (toStr) url.searchParams.append("to", toStr);

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime subscription ───────────────────────────────────────────────

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const channel = supabase
      .channel(`ncs:${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` },
        ({ eventType, new: n, old: o }: any) => {
          setActivities((curr) => {
            if (eventType === "INSERT") return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
            if (eventType === "UPDATE") return curr.map((a) => (a.id === n.id ? n : a));
            return curr.filter((a) => a.id !== o.id);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ─── Fetch agents ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => {});
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, { name: string; picture: string }> = {};
    agents.forEach((a) => {
      if (a.ReferenceID)
        m[a.ReferenceID.toLowerCase()] = {
          name: `${a.Firstname} ${a.Lastname}`,
          picture: a.profilePicture || "",
        };
    });
    return m;
  }, [agents]);

  // ─── Filter + sort ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();

    // Normalise the filter range once — both are plain "YYYY-MM-DD" strings or null
    const fromStr = toDateStr(dateCreatedFilterRange?.from);
    const toStr = toDateStr(dateCreatedFilterRange?.to);

    return activities
      .filter((i) =>
        ["csr client", "tsa client", "new client"].includes(
          (i.type_client ?? "").toLowerCase()
        )
      )
      .filter((i) => i.type_activity?.toLowerCase() === "quotation preparation")
      .filter(
        (i) =>
          !s ||
          i.company_name?.toLowerCase().includes(s) ||
          i.quotation_number?.toLowerCase().includes(s) ||
          i.remarks?.toLowerCase().includes(s)
      )
      .filter((i) => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter((i) => {
        if (!fromStr && !toStr) return true;
        // Compare plain date strings — no time zone issues
        const d = recordDateStr(i.date_created);
        if (fromStr && d < fromStr) return false;
        if (toStr && d > toStr) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date_updated ?? b.date_created).getTime() -
          new Date(a.date_updated ?? a.date_created).getTime()
      );
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  // ─── Pagination ──────────────────────────────────────────────────────────

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  const total = useMemo(
    () => filtered.reduce((s, i) => s + (i.quotation_amount ?? 0), 0),
    [filtered]
  );
  const uniqueCount = useMemo(
    () => new Set(filtered.map((i) => i.quotation_number).filter(Boolean)).size,
    [filtered]
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("New Clients");

      // Add headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Quotation Number", key: "quotationNumber", width: 20 },
        { header: "Company", key: "company", width: 25 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Contact Number", key: "contactNumber", width: 15 },
        { header: "Type", key: "type", width: 15 }
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
        const info = agentMap[item.referenceid?.toLowerCase() ?? ""];
        const agentName = info?.name ?? "-";
        
        worksheet.addRow({
          agent: agentName,
          date: recordDateStr(item.date_created),
          amount: item.quotation_amount ?? 0,
          quotationNumber: item.quotation_number || "-",
          company: item.company_name || "-",
          contactPerson: item.contact_person || "-",
          contactNumber: item.contact_number || "-",
          type: item.type_client || "-"
        });
      });

      // Format amount column
      worksheet.getColumn('amount').numFmt = '#,##0.00" ₱"';

      // Generate filename with date range
      let filename = "New_Clients";
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

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search company, quotation no., remarks..."
          className="max-w-xs text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={selectedAgent} onValueChange={(v) => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs">
            <SelectValue placeholder="Filter by Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.ReferenceID} value={a.ReferenceID}>
                {a.Firstname} {a.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export button */}
        <button
          onClick={exportToExcel}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>Records: <span className="font-semibold text-gray-700">{filtered.length}</span></span>
          <span className="text-gray-200">|</span>
          <span>Unique Quotations: <span className="font-semibold text-gray-700">{uniqueCount}</span></span>
          <span className="text-gray-200">|</span>
          <span>Total: <span className="font-semibold text-gray-700">{fmtPHP(total)}</span></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No new client records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Date</TableHead>
                <TableHead className="text-gray-500 text-right">Amount</TableHead>
                <TableHead className="text-gray-500">Quotation No.</TableHead>
                <TableHead className="text-gray-500">Company</TableHead>
                <TableHead className="text-gray-500">Contact Person</TableHead>
                <TableHead className="text-gray-500">Contact No.</TableHead>
                <TableHead className="text-gray-500">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((item) => {
                const info = agentMap[item.referenceid?.toLowerCase() ?? ""];
                return (
                  <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {info?.picture ? (
                          <img
                            src={info.picture}
                            alt={info.name}
                            className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                            {info?.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="capitalize text-gray-700">{info?.name ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {recordDateStr(item.date_created)}
                    </TableCell>
                    <TableCell className="text-right text-gray-700">
                      {item.quotation_amount != null ? fmtPHP(item.quotation_amount) : "-"}
                    </TableCell>
                    <TableCell className="uppercase text-gray-700">
                      {item.quotation_number || "-"}
                    </TableCell>
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-600">{item.contact_person || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-500">{item.type_client || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell colSpan={2} className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-gray-800">{fmtPHP(total)}</TableCell>
                <TableCell colSpan={5} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center text-xs">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <div className="px-4 font-medium select-none text-gray-600">{page} / {pageCount}</div>
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
      )}
    </div>
  );
};