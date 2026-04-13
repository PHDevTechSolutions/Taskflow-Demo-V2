"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import ExcelJS from "exceljs";
import JSZip from "jszip";

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

    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    url.searchParams.append("type_activity", "delivered / closed transaction");

    fetch(url.toString())
      .then(async (r: Response) => { if (!r.ok) throw new Error("Failed to fetch activities"); return r.json(); })
      .then((d: { activities: SI[] }) => setActivities(d.activities || []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Fetch SO records ────────────────────────────────────────────────────────
  const fetchSORecords = useCallback(() => {
    if (!referenceid) { setSORecords([]); return; }

    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    url.searchParams.append("type_activity", "sales order preparation");

    fetch(url.toString())
      .then(async (r: Response) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { activities: SORecord[] }) => setSORecords(d.activities || []))
      .catch(() => setSORecords([]));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    fetchSORecords();
    if (!referenceid) return;

    const ch = supabase.channel(`si:${referenceid}`)
      // @ts-expect-error - Supabase realtime types issue
      .on("postgres_changes" as "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload: { new: SI; old: SI; eventType: "INSERT" | "UPDATE" | "DELETE" }) => {
          const n = payload.new, o = payload.old;
          setActivities((c: SI[]) => {
            if (payload.eventType === "INSERT") {
              if (n.type_activity?.toLowerCase() !== "delivered / closed transaction") return c;
              return c.some((a: SI) => a.id === n.id) ? c : [...c, n];
            }
            if (payload.eventType === "UPDATE") return c.map((a: SI) => a.id === n.id ? n : a);
            if (payload.eventType === "DELETE") return c.filter((a: SI) => a.id !== o.id);
            return c;
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities, fetchSORecords]);

  // ─── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r: Response) => r.json())
      .then((data: Agent[]) => setAgents(data))
      .catch(() => { });
  }, [userDetails.referenceid]);

  // ─── Agent lookup maps ───────────────────────────────────────────────────────
  const agentMap = useMemo(() => {
    const m: Record<string, Agent & { name: string }> = {};
    agents.forEach((a: Agent) => {
      if (a.ReferenceID)
        m[a.ReferenceID.toLowerCase()] = { ...a, name: `${a.Firstname} ${a.Lastname}` };
    });
    return m;
  }, [agents]);

  const tsmAgents = useMemo(
    () => agents.filter((a: Agent) => a.Role === "Territory Sales Manager"),
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

    tsmAgents.forEach((tsm: Agent) => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      summaryMap.set(tsmId, { tsmId, tsmName: `${tsm.Firstname} ${tsm.Lastname}`, soCount: 0, deliveredCount: 0, totalSIAmount: 0 });
    });

    // Count SO per TSM
    soRecords.forEach((so: SORecord) => {
      const agent = agentMap[so.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? so.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;
      summaryMap.get(tsmId)!.soCount += 1;
    });

    // Count Delivered / Closed Transaction per TSM directly from activities
    activities.forEach((si: SI) => {
      const agent = agentMap[si.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? si.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;
      const row = summaryMap.get(tsmId)!;
      row.deliveredCount += 1;
      row.totalSIAmount += si.actual_sales ?? 0;
    });

    return Array.from(summaryMap.values()).sort((a: { soCount: number }, b: { soCount: number }) => b.soCount - a.soCount);
  }, [activities, soRecords, agentMap, tsmAgents]);

  // ─── Expanded TSA details ────────────────────────────────────────────────────
  const expandedTsaGroups = useMemo(() => {
    if (!expandedTsmId) return [];

    const rowsForTsm = activities.filter((item: SI) => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      return derivedTsmId === expandedTsmId;
    });

    const byTsa = new Map<string, { tsaName: string; rows: SI[] }>();
    rowsForTsm.forEach((row: SI) => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown TSA";
      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    return Array.from(byTsa.values()).sort((a: { rows: SI[] }, b: { rows: SI[] }) => b.rows.length - a.rows.length);
  }, [expandedTsmId, activities, agentMap]);

  // ─── Filtered rows for detail table ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    const fromStr = dateCreatedFilterRange?.from ? toPlainDate(dateCreatedFilterRange.from) : null;
    const toStr = dateCreatedFilterRange?.to ? toPlainDate(dateCreatedFilterRange.to) : null;

    return activities
      .filter((i: SI) => !s || i.company_name?.toLowerCase().includes(s) || i.dr_number?.toLowerCase().includes(s) || i.remarks?.toLowerCase().includes(s))
      .filter((i: SI) => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter((i: SI) => {
        if (!fromStr && !toStr) return true;
        const d = recordDateStr(i.delivery_date) ?? recordDateStr(i.date_created);
        if (!d) return false;
        if (fromStr && d < fromStr) return false;
        if (toStr && d > toStr) return false;
        return true;
      })
      .sort((a: SI, b: SI) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  /* ---- Helper: Create TSM Summary Workbook ---- */
  const createTsmSummaryWorkbook = async (filterTsmId?: string): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Invoice Summary");

    worksheet.columns = [
      { header: "TSM", key: "tsm", width: 25 },
      { header: "Total SO", key: "soCount", width: 15 },
      { header: "Total SI / Delivered", key: "deliveredCount", width: 20 },
      { header: "Total SI Amount", key: "totalSIAmount", width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Filter by specific TSM if provided
    const filteredSummary = filterTsmId
      ? tsmSummary.filter((item: { tsmId: string; tsmName: string; soCount: number; deliveredCount: number; totalSIAmount: number }) => item.tsmId === filterTsmId.toLowerCase())
      : tsmSummary;

    filteredSummary.forEach((item: { tsmId: string; tsmName: string; soCount: number; deliveredCount: number; totalSIAmount: number }) => {
      worksheet.addRow({
        tsm: item.tsmName,
        soCount: item.soCount,
        deliveredCount: item.deliveredCount,
        totalSIAmount: item.totalSIAmount
      });
    });

    const totalsRow = {
      tsm: "TOTAL",
      soCount: filteredSummary.reduce((sum: number, t: { soCount: number }) => sum + t.soCount, 0),
      deliveredCount: filteredSummary.reduce((sum: number, t: { deliveredCount: number }) => sum + t.deliveredCount, 0),
      totalSIAmount: filteredSummary.reduce((sum: number, t: { totalSIAmount: number }) => sum + t.totalSIAmount, 0)
    };

    const totalsRowIndex = worksheet.addRow(totalsRow);
    totalsRowIndex.font = { bold: true };

    worksheet.getColumn('totalSIAmount').numFmt = '#,##0.00" ₱"';

    return workbook;
  };

  /* ---- Helper: Create Agent Summary Workbook (All Agents in One File) ---- */
  const createAgentSummaryWorkbook = async (filterTsmId?: string): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Agent Summary");

    worksheet.columns = [
      { header: "Agent Name", key: "agentName", width: 25 },
      { header: "Date", key: "date", width: 15 },
      { header: "Delivery Date", key: "deliveryDate", width: 15 },
      { header: "SI Date", key: "siDate", width: 15 },
      { header: "SI Amount", key: "siAmount", width: 18 },
      { header: "DR Number", key: "drNumber", width: 20 },
      { header: "Company", key: "company", width: 25 },
      { header: "Contact Person", key: "contactPerson", width: 20 },
      { header: "Contact Number", key: "contactNumber", width: 18 },
      { header: "Payment Terms", key: "paymentTerms", width: 15 },
      { header: "Duration", key: "duration", width: 15 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Filter activities by TSM if provided
    const filteredActivities = filterTsmId
      ? activities.filter((item: SI) => {
          const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
          const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
          return derivedTsmId === filterTsmId.toLowerCase();
        })
      : activities;

    const byTsa = new Map<string, { tsaName: string; rows: SI[] }>();
    filteredActivities.forEach((row: SI) => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown Agent";

      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    const sortedAgents = Array.from(byTsa.entries()).sort((a: [string, { tsaName: string; rows: SI[] }], b: [string, { tsaName: string; rows: SI[] }]) => b[1].rows.length - a[1].rows.length);

    sortedAgents.forEach(([_, { tsaName, rows }]: [string, { tsaName: string; rows: SI[] }]) => {
      rows.forEach((row: SI) => {
        const duration = computeDuration(row.start_date, row.end_date);
        worksheet.addRow({
          agentName: tsaName,
          date: new Date(row.date_created).toLocaleDateString(),
          deliveryDate: recordDateStr(row.delivery_date) ?? "-",
          siDate: recordDateStr(row.si_date) ?? "-",
          siAmount: row.actual_sales ?? 0,
          drNumber: row.dr_number || "-",
          company: row.company_name || "-",
          contactPerson: row.contact_person || "-",
          contactNumber: row.contact_number || "-",
          paymentTerms: row.payment_terms || "-",
          duration: duration,
          remarks: row.remarks || "-",
        });
      });
    });

    worksheet.getColumn('siAmount').numFmt = '#,##0.00" ₱"';

    return workbook;
  };

  /* ---- Excel Export to ZIP (2 Files Only) ---- */
  const exportToExcel = async () => {
    if (tsmSummary.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const zip = new JSZip();
      const folderName = "sales_invoice_reports";
      const zipFolder = zip.folder(folderName);
      if (!zipFolder) throw new Error("Failed to create ZIP folder");

      // If a specific TSM is expanded, export only that TSM's data
      const filterTsmId = expandedTsmId || undefined;

      const tsmWorkbook = await createTsmSummaryWorkbook(filterTsmId);
      const tsmBuffer = await tsmWorkbook.xlsx.writeBuffer();
      zipFolder.file("01_TSM_Summary.xlsx", tsmBuffer);

      const agentWorkbook = await createAgentSummaryWorkbook(filterTsmId);
      const agentBuffer = await agentWorkbook.xlsx.writeBuffer();
      zipFolder.file("02_Agent_Summary.xlsx", agentBuffer);

      let zipFilename = "Sales_Invoice_Reports";
      if (expandedTsmId) {
        const tsmName = tsmSummary.find(t => t.tsmId === expandedTsmId)?.tsmName || "Selected_TSM";
        zipFilename += `_${tsmName.replace(/\s+/g, '_')}`;
      }
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromDate = new Date(dateCreatedFilterRange.from).toLocaleDateString().replace(/\//g, '-');
        const toDate = new Date(dateCreatedFilterRange.to).toLocaleDateString().replace(/\//g, '-');
        zipFilename += `_${fromDate}_to_${toDate}`;
      }
      zipFilename += ".zip";

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export data to Excel ZIP");
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
            title={expandedTsmId ? "Export selected TSM team data only" : "Export all TSM data"}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download size={14} />
            {expandedTsmId ? "Export Selected TSM" : "Export All"}
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
            {tsmSummary.map((item: { tsmId: string; tsmName: string; soCount: number; deliveredCount: number; totalSIAmount: number }) => {
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
                {tsmSummary.reduce((s: number, i: { soCount: number }) => s + i.soCount, 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {tsmSummary.reduce((s: number, i: { deliveredCount: number }) => s + i.deliveredCount, 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-gray-800">
                {fmt(tsmSummary.reduce((s: number, i: { totalSIAmount: number }) => s + i.totalSIAmount, 0))}
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
          expandedTsaGroups.map((group: { tsaName: string; rows: SI[] }) => (
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
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
                    {group.rows.map((row: SI) => {
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
                        {fmt(group.rows.reduce((s: number, r: SI) => s + (r.actual_sales ?? 0), 0))}
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