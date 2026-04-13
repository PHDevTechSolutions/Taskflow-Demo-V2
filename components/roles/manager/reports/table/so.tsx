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
import JSZip from "jszip";

/* ================= TYPES ================= */
interface SO {
  id: number;
  so_number?: string;
  so_amount?: number;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  account_reference_number?: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_activity: string;
  status: string;
  referenceid: string;
  call_type: string;
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

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface SOProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

/* ================= HELPERS ================= */
const PAGE_SIZE = 10;
const fmt = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

function toPlainDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ================= COMPONENT ================= */
export const SOTable: React.FC<SOProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
}) => {
  const [activities, setActivities] = useState<SO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [expandedTsmId, setExpandedTsmId] = useState<string | null>(null);

  // ─── Fetch SO activities ─────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    url.searchParams.append("type_activity", "sales order preparation");

    if (dateCreatedFilterRange?.from)
      url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to)
      url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const channel = supabase
      .channel(`so:manager=eq.${referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as SO;
          const o = payload.old as SO;
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

  // ─── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => { });
  }, [userDetails.referenceid]);

  // ─── Agent lookup maps ───────────────────────────────────────────────────────
  const agentMap = useMemo(() => {
    const m: Record<string, Agent & { name: string }> = {};
    agents.forEach((a) => {
      if (a.ReferenceID)
        m[a.ReferenceID.toLowerCase()] = { ...a, name: `${a.Firstname} ${a.Lastname}` };
    });
    return m;
  }, [agents]);

  const tsmAgents = useMemo(
    () => agents.filter((a) => a.Role === "Territory Sales Manager"),
    [agents]
  );

  // ─── Filtered SO rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_activity?.toLowerCase() === "sales order preparation")
      .filter((i) =>
        !s ||
        i.company_name?.toLowerCase().includes(s) ||
        i.activity_reference_number?.toLowerCase().includes(s) ||
        i.so_number?.toLowerCase().includes(s) ||
        i.remarks?.toLowerCase().includes(s)
      )
      .filter((i) => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter((i) => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;
        const d = new Date(i.date_updated ?? i.date_created);
        if (isNaN(d.getTime())) return false;
        const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;
        if (from && to && isSameDay(from, to)) return isSameDay(d, from);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date_updated ?? b.date_created).getTime() -
          new Date(a.date_updated ?? a.date_created).getTime()
      );
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  // ─── TSM Summary ─────────────────────────────────────────────────────────────
  const tsmSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      tsmId: string;
      tsmName: string;
      soCount: number;
      totalSOAmount: number;
      regularSO: number;
      willingToWait: number;
      spfSpecial: number;
      spfLocal: number;
      spfForeign: number;
      promo: number;
      fbMarketplace: number;
      internalOrder: number;
    }>();

    // Initialize from official TSM list
    tsmAgents.forEach((tsm) => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      summaryMap.set(tsmId, {
        tsmId,
        tsmName: `${tsm.Firstname} ${tsm.Lastname}`,
        soCount: 0,
        totalSOAmount: 0,
        regularSO: 0,
        willingToWait: 0,
        spfSpecial: 0,
        spfLocal: 0,
        spfForeign: 0,
        promo: 0,
        fbMarketplace: 0,
        internalOrder: 0,
      });
    });

    // Count SO rows per TSM (use filtered data to match table)
    filtered.forEach((item) => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;

      const row = summaryMap.get(tsmId)!;
      row.soCount += 1;
      row.totalSOAmount += item.so_amount ?? 0;

      const ct = (item.call_type ?? "").toLowerCase().trim();
      if (ct === "regular so") row.regularSO++;
      else if (ct === "willing to wait") row.willingToWait++;
      else if (ct === "spf - special project") row.spfSpecial++;
      else if (ct === "spf - local") row.spfLocal++;
      else if (ct === "spf - foreign") row.spfForeign++;
      else if (ct === "promo") row.promo++;
      else if (ct === "fb marketplace") row.fbMarketplace++;
      else if (ct === "internal order") row.internalOrder++;
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.soCount - a.soCount);
  }, [activities, agentMap, tsmAgents]);

  // ─── Expanded TSA details under selected TSM ─────────────────────────────────
  const expandedTsaGroups = useMemo(() => {
    if (!expandedTsmId) return [];

    const rowsForTsm = filtered.filter((item) => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      return derivedTsmId === expandedTsmId;
    });

    const byTsa = new Map<string, { tsaName: string; rows: SO[] }>();
    rowsForTsm.forEach((row) => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown TSA";
      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    return Array.from(byTsa.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [expandedTsmId, filtered, agentMap]);

  const callTypeKeys = [
    "regularSO", "willingToWait", "spfSpecial",
    "spfLocal", "spfForeign", "promo",
    "fbMarketplace", "internalOrder",
  ] as const;

  /* ---- Helper: Create TSM Summary Workbook ---- */
  const createTsmSummaryWorkbook = async (filterTsmId?: string): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Order Summary");

    worksheet.columns = [
      { header: "TSM", key: "tsm", width: 25 },
      { header: "SO Count", key: "soCount", width: 12 },
      { header: "Total SO Amount", key: "totalSOAmount", width: 18 },
      { header: "Regular SO", key: "regularSO", width: 15 },
      { header: "Willing to Wait", key: "willingToWait", width: 15 },
      { header: "SPF - Special Project", key: "spfSpecial", width: 20 },
      { header: "SPF - Local", key: "spfLocal", width: 15 },
      { header: "SPF - Foreign", key: "spfForeign", width: 15 },
      { header: "Promo", key: "promo", width: 12 },
      { header: "FB Marketplace", key: "fbMarketplace", width: 15 },
      { header: "Internal Order", key: "internalOrder", width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Filter by specific TSM if provided
    const filteredSummary = filterTsmId
      ? tsmSummary.filter((item) => item.tsmId === filterTsmId.toLowerCase())
      : tsmSummary;

    filteredSummary.forEach((item) => {
      worksheet.addRow({
        tsm: item.tsmName,
        soCount: item.soCount,
        totalSOAmount: item.totalSOAmount,
        regularSO: item.regularSO,
        willingToWait: item.willingToWait,
        spfSpecial: item.spfSpecial,
        spfLocal: item.spfLocal,
        spfForeign: item.spfForeign,
        promo: item.promo,
        fbMarketplace: item.fbMarketplace,
        internalOrder: item.internalOrder
      });
    });

    const totalsRow = {
      tsm: "TOTAL",
      soCount: filteredSummary.reduce((sum, t) => sum + t.soCount, 0),
      totalSOAmount: filteredSummary.reduce((sum, t) => sum + t.totalSOAmount, 0),
      regularSO: filteredSummary.reduce((sum, t) => sum + t.regularSO, 0),
      willingToWait: filteredSummary.reduce((sum, t) => sum + t.willingToWait, 0),
      spfSpecial: filteredSummary.reduce((sum, t) => sum + t.spfSpecial, 0),
      spfLocal: filteredSummary.reduce((sum, t) => sum + t.spfLocal, 0),
      spfForeign: filteredSummary.reduce((sum, t) => sum + t.spfForeign, 0),
      promo: filteredSummary.reduce((sum, t) => sum + t.promo, 0),
      fbMarketplace: filteredSummary.reduce((sum, t) => sum + t.fbMarketplace, 0),
      internalOrder: filteredSummary.reduce((sum, t) => sum + t.internalOrder, 0)
    };
    
    const totalsRowIndex = worksheet.addRow(totalsRow);
    totalsRowIndex.font = { bold: true };

    const amountCol = worksheet.getColumn('totalSOAmount');
    if (amountCol && amountCol.number > 0) {
      amountCol.numFmt = '#,##0.00" ₱"';
    }

    return workbook;
  };

  /* ---- Helper: Create Agent Summary Workbook (All Agents in One File) ---- */
  const createAgentSummaryWorkbook = async (filterTsmId?: string): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Agent Summary");

    worksheet.columns = [
      { header: "Agent Name", key: "agentName", width: 25 },
      { header: "Date", key: "date", width: 15 },
      { header: "SO Number", key: "soNumber", width: 20 },
      { header: "SO Amount", key: "soAmount", width: 18 },
      { header: "Company", key: "company", width: 25 },
      { header: "Contact Person", key: "contactPerson", width: 20 },
      { header: "Contact Number", key: "contactNumber", width: 18 },
      { header: "Call Type", key: "callType", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Filter activities by TSM if provided
    const filteredActivities = filterTsmId
      ? filtered.filter((item) => {
          const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
          const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
          return derivedTsmId === filterTsmId.toLowerCase();
        })
      : filtered;

    const byTsa = new Map<string, { tsaName: string; rows: SO[] }>();
    filteredActivities.forEach((row) => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown Agent";

      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    const sortedAgents = Array.from(byTsa.entries()).sort((a, b) => b[1].rows.length - a[1].rows.length);

    sortedAgents.forEach(([_, { tsaName, rows }]) => {
      rows.forEach((row) => {
        worksheet.addRow({
          agentName: tsaName,
          date: new Date(row.date_created).toLocaleDateString(),
          soNumber: row.activity_reference_number || row.so_number || "-",
          soAmount: row.so_amount ?? 0,
          company: row.company_name || "-",
          contactPerson: row.contact_person || "-",
          contactNumber: row.contact_number || "-",
          callType: row.call_type || "-",
          status: row.status || "-",
          remarks: row.remarks || "-",
        });
      });
    });

    const amountCol = worksheet.getColumn('soAmount');
    if (amountCol && amountCol.number > 0) {
      amountCol.numFmt = '#,##0.00" ₱"';
    }

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
      const folderName = "sales_order_reports";
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

      let zipFilename = "Sales_Order_Reports";
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
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">No data available</div>
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
                  <TableHead className="text-gray-500 text-left">SO Count</TableHead>
                  <TableHead className="text-gray-500 text-right">Total SO Amount</TableHead>
                  <TableHead className="text-gray-500 text-left">Regular SO</TableHead>
                  <TableHead className="text-gray-500 text-left">Willing to Wait</TableHead>
                  <TableHead className="text-gray-500 text-left">SPF - Special Project</TableHead>
                  <TableHead className="text-gray-500 text-left">SPF - Local</TableHead>
                  <TableHead className="text-gray-500 text-left">SPF - Foreign</TableHead>
                  <TableHead className="text-gray-500 text-left">Promo</TableHead>
                  <TableHead className="text-gray-500 text-left">FB Marketplace</TableHead>
                  <TableHead className="text-gray-500 text-left">Internal Order</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {tsmSummary.map((item) => {
                  const isExpanded = expandedTsmId === item.tsmId;
                  return (
                    <TableRow
                      key={item.tsmId}
                      className={`text-xs font-mono cursor-pointer ${isExpanded ? "bg-blue-50/70" : "hover:bg-gray-50/60"}`}
                      onClick={() => setExpandedTsmId(isExpanded ? null : item.tsmId)}
                    >
                      <TableCell className="font-semibold text-gray-700 uppercase">{item.tsmName}</TableCell>
                      <TableCell className="text-left">{item.soCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-gray-700 font-semibold">{fmt(item.totalSOAmount)}</TableCell>
                      {callTypeKeys.map((key) => (
                        <TableCell key={key} className="text-left">
                          {item[key] > 0
                            ? <span className="font-semibold text-gray-700">{item[key]}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-500">Total</TableCell>
                  <TableCell className="text-left text-gray-700">
                    {tsmSummary.reduce((s, i) => s + i.soCount, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-gray-800">
                    {fmt(tsmSummary.reduce((s, i) => s + i.totalSOAmount, 0))}
                  </TableCell>
                  {callTypeKeys.map((key) => (
                    <TableCell key={key} className="text-left text-gray-700">
                      {tsmSummary.reduce((s, i) => s + i[key], 0).toLocaleString()}
                    </TableCell>
                  ))}
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
          <div className="flex flex-wrap justify-end gap-3">
            <Input
              placeholder="Search company, SO no., remarks..."
              className="max-w-xs text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {expandedTsaGroups.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">No TSA SO records under this TSM.</div>
          ) : (
            expandedTsaGroups.map((group) => (
              <div key={group.tsaName} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 uppercase">
                    {group.tsaName}{" "}
                    <span className="text-gray-400 font-normal">({group.rows.length} sales orders)</span>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-[11px]">
                        <TableHead className="text-gray-500">Date</TableHead>
                        <TableHead className="text-gray-500">SO Number</TableHead>
                        <TableHead className="text-gray-500 text-right">SO Amount</TableHead>
                        <TableHead className="text-gray-500">Company</TableHead>
                        <TableHead className="text-gray-500">Contact Person</TableHead>
                        <TableHead className="text-gray-500">Contact No.</TableHead>
                        <TableHead className="text-gray-500">Call Type</TableHead>
                        <TableHead className="text-gray-500">Status</TableHead>
                        <TableHead className="text-gray-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => (
                        <TableRow key={row.id} className="text-xs font-mono hover:bg-gray-50/60">
                          <TableCell className="whitespace-nowrap text-gray-500">
                            {new Date(row.date_created).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{row.activity_reference_number || row.so_number || "-"}</TableCell>
                          <TableCell className="text-right text-gray-700">
                            {row.so_amount != null ? fmt(row.so_amount) : "-"}
                          </TableCell>
                          <TableCell className="text-gray-700">{row.company_name || "-"}</TableCell>
                          <TableCell className="capitalize text-gray-600">{row.contact_person || "-"}</TableCell>
                          <TableCell className="text-gray-500">{row.contact_number || "-"}</TableCell>
                          <TableCell className="text-gray-600">{row.call_type || "-"}</TableCell>
                          <TableCell>
                            {row.status ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                ${row.status.toUpperCase() === "SO-DONE"
                                  ? "bg-green-50 text-green-600 border border-green-200"
                                  : "bg-gray-50 text-gray-500 border border-gray-200"
                                }`}>
                                {row.status}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="italic text-gray-500">{row.remarks || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                        <TableCell colSpan={2} className="text-gray-500">Subtotal</TableCell>
                        <TableCell className="text-right text-gray-800">
                          {fmt(group.rows.reduce((s, r) => s + (r.so_amount ?? 0), 0))}
                        </TableCell>
                        <TableCell colSpan={6} />
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