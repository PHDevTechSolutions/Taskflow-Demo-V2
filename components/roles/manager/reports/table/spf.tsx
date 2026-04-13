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

interface SPF { id: number; so_amount?: number; so_number?: string; remarks?: string; date_created: string; date_updated?: string; company_name?: string; contact_number?: string; contact_person: string; call_type: string; status: string; referenceid: string; start_date?: string; end_date?: string; }
interface UserDetails { referenceid: string; tsm: string; manager: string; firstname: string; lastname: string; profilePicture: string; }
interface SPFProps { referenceid: string; target_quota?: string; dateCreatedFilterRange: any; setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>; userDetails: UserDetails; }

const PAGE_SIZE = 10;
const fmtPHP = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];
const SPF_LABEL: Record<string, string> = { "spf - special project": "Special Project", "spf - local": "Local", "spf - foreign": "Foreign" };

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

export const SPFTable: React.FC<SPFProps> = ({ referenceid, dateCreatedFilterRange, userDetails }) => {
  const [activities, setActivities] = useState<SPF[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true); setError(null);
    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    // Plain YYYY-MM-DD — date_created is DATE, not TIMESTAMPTZ
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toPlainDate(dateCreatedFilterRange.to));
    fetch(url.toString())
      .then(async r => { if (!r.ok) throw new Error("Failed to fetch activities"); return r.json(); })
      .then(d => setActivities(d.activities || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const ch = supabase.channel(`spf:${referenceid}`).on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` }, ({ eventType, new: n, old: o }: any) => {
      setActivities(c => eventType === "INSERT" ? (c.some(a => a.id === n.id) ? c : [...c, n]) : eventType === "UPDATE" ? c.map(a => a.id === n.id ? n : a) : c.filter(a => a.id !== o.id));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user-manager?id=${encodeURIComponent(userDetails.referenceid)}`).then(r => r.json()).then(setAgents).catch(() => {});
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, { name: string; picture: string }> = {};
    agents.forEach(a => { if (a.ReferenceID) m[a.ReferenceID.toLowerCase()] = { name: `${a.Firstname} ${a.Lastname}`, picture: a.profilePicture || "" }; });
    return m;
  }, [agents]);

  // No client-side date re-filter — API already scoped by date
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter(i => SPF_TYPES.includes(i.call_type?.toLowerCase() ?? ""))
      .filter(i => filterType === "all" || i.call_type?.toLowerCase() === filterType)
      .filter(i => !s || i.company_name?.toLowerCase().includes(s) || i.so_number?.toLowerCase().includes(s) || i.remarks?.toLowerCase().includes(s))
      .filter(i => selectedAgent === "all" || i.referenceid === selectedAgent)
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, filterType, selectedAgent]);

  useEffect(() => { setPage(1); }, [searchTerm, filterType, selectedAgent, dateCreatedFilterRange]);

  // ─── Summary by Type for TSM Summary ─────────────────────────────────────────
  const summaryByType = useMemo(() => {
    const result = {
      "spf - special project": { count: 0, totalAmount: 0 },
      "spf - local": { count: 0, totalAmount: 0 },
      "spf - foreign": { count: 0, totalAmount: 0 }
    };
    filtered.forEach(i => {
      const type = i.call_type?.toLowerCase();
      if (type && result[type as keyof typeof result]) {
        result[type as keyof typeof result].count += 1;
        result[type as keyof typeof result].totalAmount += i.so_amount ?? 0;
      }
    });
    return result;
  }, [filtered]);

  /* ---- Helper: Create TSM Summary Workbook ---- */
  const createTsmSummaryWorkbook = async (): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("SPF Summary");

    worksheet.columns = [
      { header: "SPF Type", key: "type", width: 25 },
      { header: "Count", key: "count", width: 12 },
      { header: "Total Amount", key: "totalAmount", width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    SPF_TYPES.forEach(type => {
      const data = summaryByType[type as keyof typeof summaryByType];
      worksheet.addRow({
        type: SPF_LABEL[type] || type,
        count: data.count,
        totalAmount: data.totalAmount
      });
    });

    const totalsRow = {
      type: "TOTAL",
      count: Object.values(summaryByType).reduce((s, i) => s + i.count, 0),
      totalAmount: Object.values(summaryByType).reduce((s, i) => s + i.totalAmount, 0)
    };
    
    const totalsRowIndex = worksheet.addRow(totalsRow);
    totalsRowIndex.font = { bold: true };

    const amountCol = worksheet.getColumn('totalAmount');
    if (amountCol && amountCol.number > 0) {
      amountCol.numFmt = '#,##0.00" ₱"';
    }

    return workbook;
  };

  /* ---- Helper: Create Agent Summary Workbook ---- */
  const createAgentSummaryWorkbook = async (): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Agent Summary");

    worksheet.columns = [
      { header: "Agent Name", key: "agentName", width: 25 },
      { header: "Date", key: "date", width: 15 },
      { header: "SO Number", key: "soNumber", width: 20 },
      { header: "SO Amount", key: "soAmount", width: 18 },
      { header: "Company", key: "company", width: 25 },
      { header: "Type", key: "type", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Remarks", key: "remarks", width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    filtered.forEach((row) => {
      const info = agentMap[row.referenceid?.toLowerCase() ?? ""];
      worksheet.addRow({
        agentName: info?.name || row.referenceid || "Unknown Agent",
        date: new Date(row.date_created).toLocaleDateString(),
        soNumber: row.so_number || "-",
        soAmount: row.so_amount ?? 0,
        company: row.company_name || "-",
        type: SPF_LABEL[row.call_type?.toLowerCase() ?? ""] || row.call_type || "-",
        status: row.status || "-",
        remarks: row.remarks || "-"
      });
    });

    const amountCol = worksheet.getColumn('soAmount');
    if (amountCol && amountCol.number > 0) {
      amountCol.numFmt = '#,##0.00" ₱"';
    }

    return workbook;
  };

  /* ---- Excel Export to ZIP ---- */
  const exportToExcel = async () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    try {
      const zip = new JSZip();
      const folderName = "spf_reports";
      const zipFolder = zip.folder(folderName);
      if (!zipFolder) throw new Error("Failed to create ZIP folder");

      const tsmWorkbook = await createTsmSummaryWorkbook();
      const tsmBuffer = await tsmWorkbook.xlsx.writeBuffer();
      zipFolder.file("01_TSM_Summary.xlsx", tsmBuffer);

      const agentWorkbook = await createAgentSummaryWorkbook();
      const agentBuffer = await agentWorkbook.xlsx.writeBuffer();
      zipFolder.file("02_Agent_Summary.xlsx", agentBuffer);

      let zipFilename = "SPF_Reports";
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

  const total = useMemo(() => filtered.reduce((s, i) => s + (i.so_amount ?? 0), 0), [filtered]);
  const uniqueCount = useMemo(() => new Set(filtered.map(i => i.so_number).filter(Boolean)).size, [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search company, SO no., remarks..." className="max-w-xs text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] text-xs"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{SPF_TYPES.map(t => <SelectItem key={t} value={t}>{SPF_LABEL[t]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedAgent} onValueChange={v => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs"><SelectValue placeholder="Filter by Agent" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Agents</SelectItem>{agents.map(a => <SelectItem className="capitalize" key={a.ReferenceID} value={a.ReferenceID}>{a.Firstname} {a.Lastname}</SelectItem>)}</SelectContent>
        </Select>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>Records: <span className="font-semibold text-gray-700">{filtered.length}</span></span>
          <span className="text-gray-200">|</span>
          <span>Unique SO: <span className="font-semibold text-gray-700">{uniqueCount}</span></span>
          <span className="text-gray-200">|</span>
          <span>Total: <span className="font-semibold text-gray-700">{fmtPHP(total)}</span></span>
        </div>
      )}
      {loading ? <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
        : error ? <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
        : filtered.length === 0 ? <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">No SPF records found.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-gray-500">Agent</TableHead>
                  <TableHead className="text-gray-500">Date</TableHead>
                  <TableHead className="text-gray-500 text-right">SO Amount</TableHead>
                  <TableHead className="text-gray-500">SO Number</TableHead>
                  <TableHead className="text-gray-500">Company</TableHead>
                  <TableHead className="text-gray-500">Contact Person</TableHead>
                  <TableHead className="text-gray-500">Contact No.</TableHead>
                  <TableHead className="text-gray-500">Type</TableHead>
                  <TableHead className="text-gray-500 whitespace-nowrap">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(item => {
                  const info = agentMap[item.referenceid?.toLowerCase() ?? ""];
                  const dur  = computeDuration(item.start_date, item.end_date);
                  return (
                    <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">
                      <TableCell><div className="flex items-center gap-2">{info?.picture ? <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{info?.name?.[0] ?? "?"}</div>}<span className="capitalize text-gray-700">{info?.name ?? "-"}</span></div></TableCell>
                      <TableCell className="text-gray-500 whitespace-nowrap">{new Date(item.date_created).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right text-gray-700">{item.so_amount != null ? fmtPHP(item.so_amount) : "-"}</TableCell>
                      <TableCell className="uppercase text-gray-700">{item.so_number || "-"}</TableCell>
                      <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>
                      <TableCell className="capitalize text-gray-600">{item.contact_person || "-"}</TableCell>
                      <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>
                      <TableCell className="capitalize text-gray-500">{SPF_LABEL[item.call_type?.toLowerCase()] ?? item.call_type ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{dur === "—" ? <span className="text-gray-300">—</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{dur}</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter><TableRow className="bg-gray-50 text-xs font-semibold font-mono"><TableCell colSpan={2} className="text-gray-500">Total</TableCell><TableCell className="text-right text-gray-800">{fmtPHP(total)}</TableCell><TableCell colSpan={6} /></TableRow></TableFooter>
            </Table>
          </div>
        )}
      {pageCount > 1 && (<Pagination><PaginationContent className="flex items-center space-x-4 justify-center text-xs"><PaginationItem><PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem><div className="px-4 font-medium select-none text-gray-600">{page} / {pageCount}</div><PaginationItem><PaginationNext href="#" onClick={e => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }} aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination>)}
    </div>
  );
};