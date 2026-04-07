"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import ExcelJS from "exceljs";
import { logExcelExport } from "@/lib/auditTrail";

/* ================= TYPES ================= */
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
  start_date?: string;
  end_date?: string;
  tsm?: string;
  activity_reference_number?: string;
}

interface SORecord {
  id: number;
  so_number?: string;
  type_activity: string;
  status: string;
  referenceid: string;
  tsm?: string;
  activity_reference_number?: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  Role: string;
  TSM?: string;
  profilePicture?: string;
}

interface UserDetails { referenceid: string; tsm: string; manager: string; firstname: string; lastname: string; profilePicture: string; }
interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

/* ================= HELPERS ================= */
const PAGE_SIZE = 10;
const fmt = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return "—";
  const m = Math.floor((e - s) / 60_000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function toPlainDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const recordDateStr = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return s === "1970-01-01" ? null : s;
};
const displayDate = (v: string | null | undefined) => recordDateStr(v) ?? "-";

/* ================= COMPONENT ================= */
export const SITable: React.FC<SIProps> = ({ referenceid, dateCreatedFilterRange, userDetails }) => {
  const [activities, setActivities] = useState<SI[]>([]);
  const [soRecords, setSORecords] = useState<SORecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [expandedTsmId, setExpandedTsmId] = useState<string | null>(null);

  // ─── Fetch SI (Delivered) activities ─────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true); setError(null);

    const url = new URL("/api/reports/admin/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    url.searchParams.append("type_activity", "delivered / closed transaction");

    fetch(url.toString())
      .then(async r => { if (!r.ok) throw new Error("Failed to fetch activities"); return r.json(); })
      .then(d => setActivities(d.activities || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Fetch SO records ────────────────────────────────────────────────────────
  const fetchSORecords = useCallback(() => {
    if (!referenceid) { setSORecords([]); return; }

    const url = new URL("/api/reports/admin/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    url.searchParams.append("type_activity", "sales order preparation");

    fetch(url.toString())
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setSORecords(d.activities || []))
      .catch(() => setSORecords([]));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    fetchSORecords();
    if (!referenceid) return;

    const ch = supabase.channel(`si`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history" },
        (payload) => {
          const n = payload.new as SI, o = payload.old as SI;
          setActivities(c => {
            if (payload.eventType === "INSERT") {
              if (n.type_activity?.toLowerCase() !== "delivered / closed transaction") return c;
              return c.some(a => a.id === n.id) ? c : [...c, n];
            }
            if (payload.eventType === "UPDATE") return c.map(a => a.id === n.id ? n : a);
            if (payload.eventType === "DELETE") return c.filter(a => a.id !== o.id);
            return c;
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities, fetchSORecords]);

  // ─── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-users-admin`)
      .then(r => r.json())
      .then(setAgents)
      .catch(() => { });
  }, [userDetails.referenceid]);

  // ─── Agent lookup maps ───────────────────────────────────────────────────────
  const agentMap = useMemo(() => {
    const m: Record<string, Agent & { name: string }> = {};
    agents.forEach(a => {
      if (a.ReferenceID)
        m[a.ReferenceID.toLowerCase()] = { ...a, name: `${a.Firstname} ${a.Lastname}` };
    });
    return m;
  }, [agents]);

  const tsmAgents = useMemo(
    () => agents.filter(a => a.Role === "Territory Sales Manager"),
    [agents]
  );

  // ─── TSM Summary ─────────────────────────────────────────────────────────────
  // soCount        = SO records per TSM
  // deliveredCount = Delivered / Closed Transaction rows per TSM (directly from activities)
  // totalSIAmount  = sum of actual_sales per TSM
  const tsmSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      tsmId: string;
      tsmName: string;
      soCount: number;
      deliveredCount: number;
      totalSIAmount: number;
    }>();

    tsmAgents.forEach(tsm => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      summaryMap.set(tsmId, { tsmId, tsmName: `${tsm.Firstname} ${tsm.Lastname}`, soCount: 0, deliveredCount: 0, totalSIAmount: 0 });
    });

    // Count SO per TSM
    soRecords.forEach(so => {
      const agent = agentMap[so.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? so.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;
      summaryMap.get(tsmId)!.soCount += 1;
    });

    // Count Delivered / Closed Transaction per TSM directly from activities
    activities.forEach(si => {
      const agent = agentMap[si.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? si.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;
      const row = summaryMap.get(tsmId)!;
      row.deliveredCount += 1;
      row.totalSIAmount += si.actual_sales ?? 0;
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.soCount - a.soCount);
  }, [activities, soRecords, agentMap, tsmAgents]);

  // ─── Expanded TSA details ────────────────────────────────────────────────────
  const expandedTsaGroups = useMemo(() => {
    if (!expandedTsmId) return [];

    const rowsForTsm = activities.filter(item => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      return derivedTsmId === expandedTsmId;
    });

    const byTsa = new Map<string, { tsaName: string; rows: SI[] }>();
    rowsForTsm.forEach(row => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown TSA";
      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    return Array.from(byTsa.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [expandedTsmId, activities, agentMap]);

  // ─── Filtered rows for detail table ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    const fromStr = dateCreatedFilterRange?.from ? toPlainDate(dateCreatedFilterRange.from) : null;
    const toStr = dateCreatedFilterRange?.to ? toPlainDate(dateCreatedFilterRange.to) : null;

    return activities
      .filter(i => !s || i.company_name?.toLowerCase().includes(s) || i.dr_number?.toLowerCase().includes(s) || i.remarks?.toLowerCase().includes(s))
      .filter(i => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter(i => {
        if (!fromStr && !toStr) return true;
        const d = recordDateStr(i.delivery_date) ?? recordDateStr(i.date_created);
        if (!d) return false;
        if (fromStr && d < fromStr) return false;
        if (toStr && d > toStr) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (tsmSummary.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Invoice Summary");

      // Add headers
      worksheet.columns = [
        { header: "TSM", key: "tsm", width: 25 },
        { header: "Total SO", key: "soCount", width: 15 },
        { header: "Total SI / Delivered", key: "deliveredCount", width: 20 },
        { header: "Total SI Amount", key: "totalSIAmount", width: 18 }
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows
      tsmSummary.forEach((item) => {
        worksheet.addRow({
          tsm: item.tsmName,
          soCount: item.soCount,
          deliveredCount: item.deliveredCount,
          totalSIAmount: item.totalSIAmount
        });
      });

      // Add totals row
      const totalsRow = {
        tsm: "TOTAL",
        soCount: tsmSummary.reduce((sum, t) => sum + t.soCount, 0),
        deliveredCount: tsmSummary.reduce((sum, t) => sum + t.deliveredCount, 0),
        totalSIAmount: tsmSummary.reduce((sum, t) => sum + t.totalSIAmount, 0)
      };
      
      const totalsRowIndex = worksheet.addRow(totalsRow);
      totalsRowIndex.font = { bold: true };

      // Format currency column
      const amountCol = worksheet.getColumn('totalSIAmount');
      if (amountCol && amountCol.number > 0) {
        amountCol.numFmt = '#,##0.00" ₱"';
      }

      // Generate filename with date range
      let filename = "Admin_Sales_Invoice_Summary";
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

      // Log audit trail for Excel export
      await logExcelExport(
        userDetails.referenceid,
        "Admin Sales Invoice Summary Report",
        tsmSummary.length,
        dateCreatedFilterRange?.from && dateCreatedFilterRange?.to
          ? `Date range: ${new Date(dateCreatedFilterRange.from).toLocaleDateString()} - ${new Date(dateCreatedFilterRange.to).toLocaleDateString()}`
          : undefined
      );

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export data to Excel");
    }
  };

  /* ================= RENDER ================= */
  return (
    <div className="space-y-4">

      {/* ── TSM Summary Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : tsmSummary.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">No SI records found.</div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white p-4">
            <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">TSM</TableHead>
                <TableHead className="text-gray-500 text-right">Total SO</TableHead>
                <TableHead className="text-gray-500 text-right">Total SI / Delivered</TableHead>
                <TableHead className="text-gray-500 text-right">Total SI Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tsmSummary.map(item => {
                const isExpanded = expandedTsmId === item.tsmId;
                return (
                  <TableRow
                    key={item.tsmId}
                    className={`text-xs font-mono cursor-pointer ${isExpanded ? "bg-blue-50/70" : "hover:bg-gray-50/60"}`}
                    onClick={() => setExpandedTsmId(isExpanded ? null : item.tsmId)}
                  >
                    <TableCell className="font-semibold text-gray-700 uppercase">{item.tsmName}</TableCell>
                    <TableCell className="text-right text-gray-700">
                      {item.soCount > 0 ? item.soCount.toLocaleString() : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      {item.deliveredCount > 0 ? item.deliveredCount.toLocaleString() : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-gray-700 font-semibold">{fmt(item.totalSIAmount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-gray-700">
                  {tsmSummary.reduce((s, i) => s + i.soCount, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {tsmSummary.reduce((s, i) => s + i.deliveredCount, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-gray-800">
                  {fmt(tsmSummary.reduce((s, i) => s + i.totalSIAmount, 0))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          </div>
        </>
      )}

      {/* ── Expanded TSA Details ── */}
      {expandedTsmId && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">TSA Details</p>
          {expandedTsaGroups.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">No TSA SI records under this TSM.</div>
          ) : (
            expandedTsaGroups.map(group => (
              <div key={group.tsaName} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 uppercase">
                    {group.tsaName}{" "}
                    <span className="text-gray-400 font-normal">({group.rows.length} deliveries)</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Input
                      placeholder="Search company, DR no., remarks..."
                      className="max-w-xs text-xs"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-[11px]">
                        <TableHead className="text-gray-500">Delivery Date</TableHead>
                        <TableHead className="text-gray-500">SI Date</TableHead>
                        <TableHead className="text-gray-500 text-right">SI Amount</TableHead>
                        <TableHead className="text-gray-500">DR Number</TableHead>
                        <TableHead className="text-gray-500">Company</TableHead>
                        <TableHead className="text-gray-500">Contact Person</TableHead>
                        <TableHead className="text-gray-500">Contact No.</TableHead>
                        <TableHead className="text-gray-500">Payment Terms</TableHead>
                        <TableHead className="text-gray-500">Duration</TableHead>
                        <TableHead className="text-gray-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map(row => {
                        const dur = computeDuration(row.start_date, row.end_date);
                        return (
                          <TableRow key={row.id} className="text-xs font-mono hover:bg-gray-50/60">
                            <TableCell className="text-gray-500 whitespace-nowrap">{displayDate(row.delivery_date)}</TableCell>
                            <TableCell className="text-gray-500 whitespace-nowrap">{displayDate(row.si_date)}</TableCell>
                            <TableCell className="text-right text-gray-700">{row.actual_sales != null ? fmt(row.actual_sales) : "-"}</TableCell>
                            <TableCell className="uppercase text-gray-700">{row.dr_number || "-"}</TableCell>
                            <TableCell className="text-gray-700">{row.company_name || "-"}</TableCell>
                            <TableCell className="capitalize text-gray-600">{row.contact_person || "-"}</TableCell>
                            <TableCell className="text-gray-500">{row.contact_number || "-"}</TableCell>
                            <TableCell className="text-gray-500">{row.payment_terms || "-"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {dur === "—"
                                ? <span className="text-gray-300">—</span>
                                : <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{dur}</span>
                              }
                            </TableCell>
                            <TableCell className="capitalize text-gray-500">{row.remarks || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                        <TableCell colSpan={2} className="text-gray-500">Subtotal</TableCell>
                        <TableCell className="text-right text-gray-800">
                          {fmt(group.rows.reduce((s, r) => s + (r.actual_sales ?? 0), 0))}
                        </TableCell>
                        <TableCell colSpan={7} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};