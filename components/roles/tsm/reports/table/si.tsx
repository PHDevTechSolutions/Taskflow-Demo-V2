"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import ExcelJS from "exceljs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SI {
  id: number;
  actual_sales?: number;
  dr_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  contact_person: string;
  type_activity: string;
  status: string;
  delivery_date: string;
  si_date: string;
  payment_terms: string;
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

interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const fmt = (v: number) =>
  v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

/**
 * Normalise any date value to a plain YYYY-MM-DD string using LOCAL date parts
 * so timezone offsets never shift the date by a day.
 */
const toDateStr = (value: string | Date | undefined | null): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
};

/**
 * Extract YYYY-MM-DD from a record's date field (handles both "YYYY-MM-DD"
 * and full ISO strings). Returns null for invalid / epoch dates.
 */
const recordDateStr = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  // Treat the Unix epoch as "no date"
  if (s === "1970-01-01") return null;
  return s;
};

/** Display-safe formatter that shows "-" for missing/epoch dates. */
const displayDate = (value: string | null | undefined): string => {
  const s = recordDateStr(value);
  return s ?? "-";
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SITable: React.FC<SIProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
}) => {
  const [activities, setActivities] = useState<SI[]>([]);
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
      .channel(`si:${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as SI;
          const o = payload.old as SI;
          setActivities((curr) => {
            if (payload.eventType === "INSERT") return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
            if (payload.eventType === "UPDATE") return curr.map((a) => (a.id === n.id ? n : a));
            if (payload.eventType === "DELETE") return curr.filter((a) => a.id !== o.id);
            return curr;
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

    // Normalise range once — plain "YYYY-MM-DD" strings or null
    const fromStr = toDateStr(dateCreatedFilterRange?.from);
    const toStr = toDateStr(dateCreatedFilterRange?.to);

    return activities
      .filter((i) => i.type_activity?.toLowerCase() === "delivered / closed transaction")
      .filter(
        (i) =>
          !s ||
          i.company_name?.toLowerCase().includes(s) ||
          i.dr_number?.toLowerCase().includes(s) ||
          i.remarks?.toLowerCase().includes(s)
      )
      .filter((i) => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter((i) => {
        if (!fromStr && !toStr) return true;

        const dateToCheck = recordDateStr(i.date_created);
        if (!dateToCheck) return false;

        if (fromStr && dateToCheck < fromStr) return false;
        if (toStr && dateToCheck > toStr) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
      );
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  // ─── Pagination ──────────────────────────────────────────────────────────

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  const totalSIAmount = useMemo(
    () => filtered.reduce((s, i) => s + (i.actual_sales ?? 0), 0),
    [filtered]
  );
  const uniqueDRCount = useMemo(
    () => new Set(filtered.map((i) => i.dr_number).filter(Boolean)).size,
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
      const worksheet = workbook.addWorksheet("Sales Invoices");

      // Add headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 20 },
        { header: "Delivery Date", key: "deliveryDate", width: 15 },
        { header: "SI Date", key: "siDate", width: 15 },
        { header: "SI Amount", key: "siAmount", width: 15 },
        { header: "DR Number", key: "drNumber", width: 20 },
        { header: "Company", key: "company", width: 25 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Contact Number", key: "contactNumber", width: 15 },
        { header: "Payment Terms", key: "paymentTerms", width: 20 },
        { header: "Remarks", key: "remarks", width: 30 }
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
          deliveryDate: displayDate(item.delivery_date),
          siDate: displayDate(item.si_date),
          siAmount: item.actual_sales ?? 0,
          drNumber: item.dr_number || "-",
          company: item.company_name || "-",
          contactPerson: item.contact_person || "-",
          contactNumber: item.contact_number || "-",
          paymentTerms: item.payment_terms || "-",
          remarks: item.remarks || "-"
        });
      });

      // Format amount column
      worksheet.getColumn('siAmount').numFmt = '#,##0.00" ₱"';

      // Generate filename with date range
      let filename = "Sales_Invoices";
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
          placeholder="Search company, DR no., remarks..."
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
              <SelectItem className="capitalize" key={a.ReferenceID} value={a.ReferenceID}>
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
          <span>Unique DR: <span className="font-semibold text-gray-700">{uniqueDRCount}</span></span>
          <span className="text-gray-200">|</span>
          <span>Total: <span className="font-semibold text-gray-700">{fmt(totalSIAmount)}</span></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No sales invoice records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Delivery Date</TableHead>
                <TableHead className="text-gray-500">SI Date</TableHead>
                <TableHead className="text-gray-500 text-right">SI Amount</TableHead>
                <TableHead className="text-gray-500">DR Number</TableHead>
                <TableHead className="text-gray-500">Company</TableHead>
                <TableHead className="text-gray-500">Contact Person</TableHead>
                <TableHead className="text-gray-500">Contact No.</TableHead>
                <TableHead className="text-gray-500">Payment Terms</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
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
                      {displayDate(item.delivery_date)}
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {displayDate(item.si_date)}
                    </TableCell>
                    <TableCell className="text-right text-gray-700">
                      {item.actual_sales != null ? fmt(item.actual_sales) : "-"}
                    </TableCell>
                    <TableCell className="uppercase text-gray-700">{item.dr_number || "-"}</TableCell>
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-600">{item.contact_person || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.payment_terms || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-500">{item.remarks || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell colSpan={3} className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-gray-800">{fmt(totalSIAmount)}</TableCell>
                <TableCell colSpan={6} />
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
