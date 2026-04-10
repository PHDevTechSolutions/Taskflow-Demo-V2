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

interface CSR {
  id: number;
  quotation_number?: string;
  quotation_amount?: number;
  quotation_status?: string;
  ticket_reference_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  contact_person: string;
  type_client: string;
  type_activity: string;
  status: string;
  source: string;
  referenceid: string;
  start_date?: string;
  end_date?: string;
  tsm?: string;
}

interface EndorsedTicketRow {
  ticket_reference_number: string;
  company_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  tsm: string | null;
  date_created: string | null;
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

interface CSRProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

/* ================= HELPERS ================= */

const PAGE_SIZE = 10;
const fmtPHP = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const QUOTATION_STATUSES = [
  "Pending Client Approval",
  "For Bidding",
  "Nego",
  "Order Complete",
  "Convert to SO",
  "Loss Price is Too High",
  "Lead Time Issue",
  "Out of Stock",
  "Insufficient Stock",
  "Lost Bid",
  "Canvass Only",
  "Did Not Meet the Specs",
  "Decline / Disapproved",
] as const;

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return "—";
  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

function toPlainDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ================= COMPONENT ================= */

export const CSRTable: React.FC<CSRProps> = ({ referenceid, dateCreatedFilterRange, userDetails }) => {
  const [activities, setActivities] = useState<CSR[]>([]);
  const [endorsedTicketRows, setEndorsedTicketRows] = useState<EndorsedTicketRow[]>([]);
  // endorsedTicketCountsByTsm: keyed by lowercased tsm ReferenceID → unique ticket count
  // This comes directly from the endorsed-ticket table via the API.
  const [endorsedTicketCountsByTsm, setEndorsedTicketCountsByTsm] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [expandedTsmId, setExpandedTsmId] = useState<string | null>(null);
  // Modal for ticket count drill-down
  const [ticketModal, setTicketModal] = useState<{ tsmId: string; tsmName: string } | null>(null);
  const [ticketModalSearch, setTicketModalSearch] = useState("");

  // ─── Fetch activities ────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true); setError(null);

    const url = new URL("/api/reports/manager/fetch-endorse", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));

    fetch(url.toString())
      .then(async r => {
        const json = await r.json().catch(() => ({ message: `HTTP ${r.status} — non-JSON response` }));
        if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
        return json;
      })
      .then(d => {
        setActivities(d.activities || []);
        // Store the TSM ticket counts from endorsed-ticket (returned by API)
        setEndorsedTicketCountsByTsm(d.endorsedTicketCountsByTsm || {});
        // Store the raw endorsed-ticket rows for drill-down
        setEndorsedTicketRows(d.endorsedTicketRows || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const ch = supabase.channel(`csr:${referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as CSR, o = payload.old as CSR;
          setActivities(c => {
            if (payload.eventType === "INSERT") return c.some(a => a.id === n.id) ? c : [...c, n];
            if (payload.eventType === "UPDATE") return c.map(a => a.id === n.id ? n : a);
            if (payload.eventType === "DELETE") return c.filter(a => a.id !== o.id);
            return c;
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  // ─── Fetch agents ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then(r => r.json())
      .then(setAgents)
      .catch(() => { });
  }, [userDetails.referenceid]);

  // ─── Agent lookup map ─────────────────────────────────────────────────────────
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

  // ─── Base filtered activities (Quotation Preparation only) ───────────────────
  const baseActivities = useMemo(() =>
    activities
      .filter(i => i.source === "CSR Endorsement")
      .filter(i => i.type_activity === "Quotation Preparation")
      .filter(i => !!i.ticket_reference_number),
    [activities]
  );

  // ─── TSM Summary ──────────────────────────────────────────────────────────────
  // ticketCount → from endorsedTicketCountsByTsm (endorsed-ticket table, no history involved)
  // quoteDoneCount → from history (status === "Quote-Done"), unchanged
  const tsmSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      tsmId: string;
      tsmName: string;
      ticketCount: number;
      quoteDoneCount: number;
      statusCounts: Record<string, number>;
      totalAmount: number;
    }>();

    tsmAgents.forEach(tsm => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      summaryMap.set(tsmId, {
        tsmId,
        tsmName: `${tsm.Firstname} ${tsm.Lastname}`,
        // ← directly from endorsed-ticket table via API, no history derivation
        ticketCount: endorsedTicketCountsByTsm[tsmId] ?? 0,
        quoteDoneCount: 0,
        statusCounts: Object.fromEntries(QUOTATION_STATUSES.map(s => [s, 0])),
        totalAmount: 0,
      });
    });

    baseActivities.forEach(row => {
      const agent = agentMap[row.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? row.tsm ?? "").toLowerCase();
      if (!tsmId || !summaryMap.has(tsmId)) return;
      const entry = summaryMap.get(tsmId)!;

      if (row.status === "Quote-Done") entry.quoteDoneCount += 1;

      const qs = row.quotation_status ?? "";
      if (qs && qs in entry.statusCounts) entry.statusCounts[qs] += 1;

      entry.totalAmount += row.quotation_amount ?? 0;
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.quoteDoneCount - a.quoteDoneCount);
  }, [baseActivities, agentMap, tsmAgents, endorsedTicketCountsByTsm]);

  // ─── Expanded TSA details ─────────────────────────────────────────────────────
  const expandedTsaGroups = useMemo(() => {
    if (!expandedTsmId) return [];

    const rowsForTsm = baseActivities.filter(row => {
      const agent = agentMap[row.referenceid?.toLowerCase() ?? ""];
      const derivedTsmId = (agent?.TSM ?? row.tsm ?? "").toLowerCase();
      return derivedTsmId === expandedTsmId;
    });

    const byTsa = new Map<string, { tsaName: string; tsaPicture: string; rows: CSR[] }>();
    rowsForTsm.forEach(row => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown TSA";
      const tsaPicture = tsaAgent?.profilePicture || "";
      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, tsaPicture, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    return Array.from(byTsa.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [expandedTsmId, baseActivities, agentMap]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange, expandedTsmId]);

  /* ---- Helper: Create TSM Summary Workbook ---- */
  const createTsmSummaryWorkbook = async (): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("CSR Summary");

    worksheet.columns = [
      { header: "TSM", key: "tsm", width: 25 },
      { header: "Tickets Endorsed", key: "ticketCount", width: 18 },
      { header: "Quote Done", key: "quoteDoneCount", width: 15 },
      ...QUOTATION_STATUSES.map(status => ({ header: status, key: status, width: 20 }))
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    tsmSummary.forEach((item) => {
      const rowData: any = {
        tsm: item.tsmName,
        ticketCount: item.ticketCount,
        quoteDoneCount: item.quoteDoneCount
      };
      
      QUOTATION_STATUSES.forEach(status => {
        rowData[status] = item.statusCounts[status] ?? 0;
      });
      
      worksheet.addRow(rowData);
    });

    const totalsRow: any = {
      tsm: "TOTAL",
      ticketCount: tsmSummary.reduce((sum, t) => sum + t.ticketCount, 0),
      quoteDoneCount: tsmSummary.reduce((sum, t) => sum + t.quoteDoneCount, 0)
    };
    
    QUOTATION_STATUSES.forEach(status => {
      totalsRow[status] = tsmSummary.reduce((sum, t) => sum + (t.statusCounts[status] ?? 0), 0);
    });
    
    const totalsRowIndex = worksheet.addRow(totalsRow);
    totalsRowIndex.font = { bold: true };

    return workbook;
  };

  /* ---- Helper: Create Agent Summary Workbook (All Agents in One File) ---- */
  const createAgentSummaryWorkbook = async (): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Agent Summary");

    worksheet.columns = [
      { header: "Agent Name", key: "agentName", width: 25 },
      { header: "Date", key: "date", width: 15 },
      { header: "Ticket Number", key: "ticketNumber", width: 20 },
      { header: "Company", key: "company", width: 25 },
      { header: "Quotation Number", key: "quotationNumber", width: 20 },
      { header: "Quotation Amount", key: "quotationAmount", width: 18 },
      { header: "Quotation Status", key: "quotationStatus", width: 20 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const byTsa = new Map<string, { tsaName: string; rows: CSR[] }>();
    activities.forEach((row) => {
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
          ticketNumber: row.ticket_reference_number || "-",
          company: row.company_name || "-",
          quotationNumber: row.quotation_number || "-",
          quotationAmount: row.quotation_amount ?? 0,
          quotationStatus: row.quotation_status || "-",
          remarks: row.remarks || "-",
        });
      });
    });

    const amountCol = worksheet.getColumn('quotationAmount');
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
      const folderName = "csr_reports";
      const zipFolder = zip.folder(folderName);
      if (!zipFolder) throw new Error("Failed to create ZIP folder");

      const tsmWorkbook = await createTsmSummaryWorkbook();
      const tsmBuffer = await tsmWorkbook.xlsx.writeBuffer();
      zipFolder.file("01_TSM_Summary.xlsx", tsmBuffer);

      const agentWorkbook = await createAgentSummaryWorkbook();
      const agentBuffer = await agentWorkbook.xlsx.writeBuffer();
      zipFolder.file("02_Agent_Summary.xlsx", agentBuffer);

      let zipFilename = "CSR_Reports";
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

  const total = useMemo(() =>
    expandedTsaGroups.flatMap(g => g.rows).reduce((s, i) => s + (i.quotation_amount ?? 0), 0),
    [expandedTsaGroups]
  );

  // ─── Modal rows for ticket drill-down ────────────────────────────────────────
  const ticketModalRows = useMemo(() => {
    if (!ticketModal) return [];
    const s = ticketModalSearch.toLowerCase();
    return endorsedTicketRows
      .filter(r => (r.tsm ?? "").toLowerCase() === ticketModal.tsmId)
      .filter(r =>
        !s ||
        r.company_name?.toLowerCase().includes(s) ||
        r.ticket_reference_number?.toLowerCase().includes(s) ||
        r.contact_person?.toLowerCase().includes(s) ||
        r.contact_number?.toLowerCase().includes(s)
      );
  }, [ticketModal, ticketModalSearch, endorsedTicketRows]);

  /* ================= RENDER ================= */
  return (
    <div className="space-y-4">

      {/* ── TSM Summary Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Failed to load data</p>
          <p className="text-xs text-red-500 font-mono break-all">{error}</p>
          <button
            onClick={fetchActivities}
            className="text-[11px] font-semibold text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      ) : tsmSummary.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No CSR quotation records found.
        </div>
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
                <TableHead className="text-gray-500 whitespace-nowrap">TSM</TableHead>
                <TableHead className="text-gray-500 text-right whitespace-nowrap">Tickets Endorsed</TableHead>
                <TableHead className="text-gray-500 text-right whitespace-nowrap">Quote Done</TableHead>
                {QUOTATION_STATUSES.map(s => (
                  <TableHead key={s} className="text-gray-500 text-right whitespace-nowrap">{s}</TableHead>
                ))}
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
                    <TableCell className="font-semibold text-gray-700 uppercase whitespace-nowrap">
                      {item.tsmName}
                    </TableCell>

                    <TableCell
                      className="text-right text-emerald-600 font-semibold cursor-pointer hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        setTicketModal({ tsmId: item.tsmId, tsmName: item.tsmName });
                        setTicketModalSearch("");
                      }}
                    >
                      {item.ticketCount > 0
                        ? item.ticketCount.toLocaleString()
                        : <span className="text-gray-300">—</span>}
                    </TableCell>

                    <TableCell className="text-right text-blue-600 font-semibold">
                      {item.quoteDoneCount > 0
                        ? item.quoteDoneCount.toLocaleString()
                        : <span className="text-gray-300">—</span>}
                    </TableCell>

                    {QUOTATION_STATUSES.map(s => (
                      <TableCell key={s} className="text-right text-gray-700">
                        {item.statusCounts[s] > 0
                          ? item.statusCounts[s].toLocaleString()
                          : <span className="text-gray-300">—</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell className="text-gray-500">Total</TableCell>

                <TableCell className="text-right text-emerald-600">
                  {tsmSummary.reduce((s, i) => s + i.ticketCount, 0).toLocaleString()}
                </TableCell>

                <TableCell className="text-right text-blue-600">
                  {tsmSummary.reduce((s, i) => s + i.quoteDoneCount, 0).toLocaleString()}
                </TableCell>

                {QUOTATION_STATUSES.map(s => (
                  <TableCell key={s} className="text-right text-gray-700">
                    {tsmSummary.reduce((sum, i) => sum + i.statusCounts[s], 0).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
          </div>
        </>
      )}

      {/* ── Ticket Drill-down Modal ── */}
      {ticketModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setTicketModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div>
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Endorsed Tickets — {ticketModal.tsmName}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {ticketModalRows.length} ticket{ticketModalRows.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setTicketModal(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-semibold leading-none"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b">
              <Input
                placeholder="Search company, ticket no., contact..."
                className="text-xs"
                value={ticketModalSearch}
                onChange={e => setTicketModalSearch(e.target.value)}
              />
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 text-[11px] sticky top-0">
                    <TableHead className="text-gray-500 whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-gray-500 whitespace-nowrap">Ticket Ref No.</TableHead>
                    <TableHead className="text-gray-500">Company</TableHead>
                    <TableHead className="text-gray-500 whitespace-nowrap">Contact Person</TableHead>
                    <TableHead className="text-gray-500 whitespace-nowrap">Contact No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketModalRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-gray-400 italic py-8">
                        No tickets found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ticketModalRows.map((row, i) => (
                      <TableRow key={`${row.ticket_reference_number}-${i}`} className="text-xs font-mono hover:bg-gray-50/60">
                        <TableCell className="text-gray-500 whitespace-nowrap">
                          {row.date_created ? new Date(row.date_created).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="uppercase text-gray-700 whitespace-nowrap font-semibold">
                          {row.ticket_reference_number || "-"}
                        </TableCell>
                        <TableCell className="text-gray-700">{row.company_name || "-"}</TableCell>
                        <TableCell className="capitalize text-gray-600">{row.contact_person || "-"}</TableCell>
                        <TableCell className="text-gray-500">{row.contact_number || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded TSA Details ── */}
      {expandedTsmId && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">TSA Details</p>
          {expandedTsaGroups.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">No CSR records under this TSM.</div>
          ) : (
            expandedTsaGroups.map(group => (
              <div key={group.tsaName} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    {group.tsaPicture
                      ? <img src={group.tsaPicture} alt={group.tsaName} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" />
                      : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">{group.tsaName[0]}</div>
                    }
                    <p className="text-xs font-semibold text-gray-700 uppercase">
                      {group.tsaName}{" "}
                      <span className="text-gray-400 font-normal">({group.rows.length} records)</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 mt-2">
                    <Input
                      placeholder="Search company, ticket no., remarks..."
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
                        <TableHead className="text-gray-500 whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Ticket Ref No.</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Quotation No.</TableHead>
                        <TableHead className="text-gray-500 text-right whitespace-nowrap">Amount</TableHead>
                        <TableHead className="text-gray-500">Company</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Contact Person</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Contact No.</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Duration</TableHead>
                        <TableHead className="text-gray-500">Status</TableHead>
                        <TableHead className="text-gray-500 whitespace-nowrap">Quotation Status</TableHead>
                        <TableHead className="text-gray-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {group.rows
                        .filter(row => {
                          const s = searchTerm.toLowerCase();
                          return (
                            !s ||
                            row.company_name?.toLowerCase().includes(s) ||
                            row.ticket_reference_number?.toLowerCase().includes(s) ||
                            row.remarks?.toLowerCase().includes(s)
                          );
                        })
                        .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
                        .map(row => {
                          const duration = computeDuration(row.start_date, row.end_date);
                          return (
                            <TableRow key={row.id} className="text-xs font-mono hover:bg-gray-50/60">
                              <TableCell className="text-gray-500 whitespace-nowrap">
                                {new Date(row.date_created).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="uppercase text-gray-700 whitespace-nowrap">
                                {row.ticket_reference_number || "-"}
                              </TableCell>
                              <TableCell className="text-gray-700">
                                {row.quotation_number || "-"}
                              </TableCell>
                              <TableCell className="text-right text-gray-700">
                                {row.quotation_amount != null ? fmtPHP(row.quotation_amount) : "-"}
                              </TableCell>
                              <TableCell className="text-gray-700">{row.company_name || "-"}</TableCell>
                              <TableCell className="capitalize text-gray-600">{row.contact_person || "-"}</TableCell>
                              <TableCell className="text-gray-500">{row.contact_number || "-"}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {duration === "—"
                                  ? <span className="text-gray-300">—</span>
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{duration}</span>
                                }
                              </TableCell>
                              <TableCell className="text-gray-500">{row.status || "-"}</TableCell>
                              <TableCell className="text-gray-500">{row.quotation_status || "-"}</TableCell>
                              <TableCell className="capitalize text-gray-500">{row.remarks || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>

                    <TableFooter>
                      <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                        <TableCell colSpan={3} className="text-gray-500">Subtotal</TableCell>
                        <TableCell className="text-right text-gray-800">
                          {fmtPHP(group.rows.reduce((s, r) => s + (r.quotation_amount ?? 0), 0))}
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