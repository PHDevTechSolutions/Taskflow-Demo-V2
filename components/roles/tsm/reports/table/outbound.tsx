"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, PhoneCall, Download } from "lucide-react";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

interface Outbound {
  id: number;
  referenceid?: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  type_activity: string;
  source: string;
  call_status: string;
  call_type: string;
  remarks: string;
  status: string;
  start_date: string;
  end_date: string;
  date_updated: string;
  date_created: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface OutboundTableProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

/* ================= CONSTANTS ================= */

const CALL_STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  REACHED:       { badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  "NOT REACHED": { badge: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-400"     },
  CALLBACK:      { badge: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-400"   },
  "BUSY":        { badge: "bg-slate-100 text-slate-600 border border-slate-200",      dot: "bg-slate-400"   },
};

// Which statuses count as "successful" vs "unsuccessful"
const SUCCESSFUL_STATUSES   = new Set(["REACHED"]);
const UNSUCCESSFUL_STATUSES = new Set(["NOT REACHED", "BUSY"]);
// CALLBACK is intentionally neutral — it appears in "All" and its own pill but not in either bucket

type OutcomeFilter = "all" | "successful" | "unsuccessful";

const PAGE_SIZE = 10;

/* ================= COMPONENT ================= */

export const OutboundTable: React.FC<OutboundTableProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
}) => {
  const [activities,        setActivities]        = useState<Outbound[]>([]);
  const [agents,            setAgents]            = useState<any[]>([]);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState<string | null>(null);

  const [searchTerm,        setSearchTerm]        = useState("");
  const [outcomeFilter,     setOutcomeFilter]     = useState<OutcomeFilter>("all");
  const [filterCallStatus,  setFilterCallStatus]  = useState("all");
  const [filterStatus,      setFilterStatus]      = useState("all");
  const [selectedAgent,     setSelectedAgent]     = useState("all");
  const [page,              setPage]              = useState(1);

  /* ---- Fetch activities ---- */
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString()
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString()
      : null;

    const url = new URL("/api/reports/tsm/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (from) url.searchParams.append("from", from);
    if (to)   url.searchParams.append("to", to);

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
      .channel(`public:history:tsm=eq.${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Outbound;
          const oldRecord = payload.old as Outbound;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT": return curr.some((a) => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE": return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
              case "DELETE": return curr.filter((a) => a.id !== oldRecord.id);
              default:       return curr;
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  /* ---- Fetch agents ---- */
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then(setAgents)
      .catch(() => setError("Failed to load agents."));
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const map: Record<string, { name: string; profilePicture: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID) {
        map[agent.ReferenceID.toLowerCase()] = {
          name: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture || "",
        };
      }
    });
    return map;
  }, [agents]);

  /* ---- Base: only Outbound Calls, sorted newest first ---- */
  const outboundActivities = useMemo(
    () =>
      [...activities]
        .filter((a) => a.type_activity?.toLowerCase() === "outbound calls")
        .sort(
          (a, b) =>
            new Date(b.date_updated ?? b.date_created).getTime() -
            new Date(a.date_updated ?? a.date_created).getTime()
        ),
    [activities]
  );

  /* ---- Outcome summary counts (before any sub-filters) ---- */
  const outcomeCounts = useMemo(() => {
    let successful = 0, unsuccessful = 0;
    outboundActivities.forEach((a) => {
      const cs = a.call_status?.toUpperCase() ?? "";
      if (SUCCESSFUL_STATUSES.has(cs))   successful++;
      if (UNSUCCESSFUL_STATUSES.has(cs)) unsuccessful++;
    });
    return { all: outboundActivities.length, successful, unsuccessful };
  }, [outboundActivities]);

  /* ---- Filter options derived from base data ---- */
  const callStatusOptions = useMemo(
    () => Array.from(new Set(outboundActivities.map((a) => a.call_status).filter(Boolean))).sort(),
    [outboundActivities]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(outboundActivities.map((a) => a.status).filter(Boolean))).sort(),
    [outboundActivities]
  );

  /* ---- Call-status pill counts (unfiltered) ---- */
  const callStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    outboundActivities.forEach((a) => {
      const k = a.call_status ?? "Unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [outboundActivities]);

  /* ---- Filtered ---- */
  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();

    return outboundActivities.filter((item) => {
      const cs = item.call_status?.toUpperCase() ?? "";

      // Outcome filter (Successful / Unsuccessful)
      if (outcomeFilter === "successful"   && !SUCCESSFUL_STATUSES.has(cs))   return false;
      if (outcomeFilter === "unsuccessful" && !UNSUCCESSFUL_STATUSES.has(cs)) return false;

      // Individual call status pill (only active if outcomeFilter === "all")
      if (outcomeFilter === "all" && filterCallStatus !== "all" && item.call_status !== filterCallStatus) return false;

      if (filterStatus  !== "all" && item.status      !== filterStatus) return false;
      if (selectedAgent !== "all" && item.referenceid?.toLowerCase() !== selectedAgent.toLowerCase()) return false;

      if (s) {
        const agentName = agentMap[item.referenceid?.toLowerCase() ?? ""]?.name ?? "";
        const haystack = [
          item.company_name,
          item.contact_person,
          item.contact_number,
          item.source,
          item.call_type,
          item.remarks,
          agentName,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }

      if (dateCreatedFilterRange?.from || dateCreatedFilterRange?.to) {
        const d = item.date_updated ? new Date(item.date_updated) : new Date(item.date_created);
        if (isNaN(d.getTime())) return false;

        const isSameDay = (d1: Date, d2: Date) =>
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth()    === d2.getMonth()    &&
          d1.getDate()     === d2.getDate();

        const fromDate = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const toDate   = dateCreatedFilterRange.to   ? new Date(dateCreatedFilterRange.to)   : null;

        if (fromDate && toDate && isSameDay(fromDate, toDate)) return isSameDay(d, fromDate);
        if (fromDate && d < fromDate) return false;
        if (toDate   && d > toDate)   return false;
      }

      return true;
    });
  }, [outboundActivities, searchTerm, outcomeFilter, filterCallStatus, filterStatus, selectedAgent, dateCreatedFilterRange, agentMap]);

  /* Reset page on filter change */
  useEffect(() => {
    setPage(1);
  }, [searchTerm, outcomeFilter, filterCallStatus, filterStatus, selectedAgent, dateCreatedFilterRange]);

  /* When outcome filter changes, reset individual call status pill */
  useEffect(() => {
    if (outcomeFilter !== "all") setFilterCallStatus("all");
  }, [outcomeFilter]);

  /* ---- Pagination ---- */
  const pageCount           = Math.ceil(filteredActivities.length / PAGE_SIZE);
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
      const worksheet = workbook.addWorksheet("Outbound Calls");

      // Add headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Company", key: "company", width: 25 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Contact Number", key: "contactNumber", width: 15 },
        { header: "Source", key: "source", width: 15 },
        { header: "Call Type", key: "callType", width: 15 },
        { header: "Call Status", key: "callStatus", width: 15 },
        { header: "Status", key: "status", width: 15 },
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
      filteredActivities.forEach((item) => {
        const agentInfo = agentMap[item.referenceid?.toLowerCase() ?? ""];
        const agentName = agentInfo?.name ?? "-";
        
        worksheet.addRow({
          agent: agentName,
          date: item.date_created ? new Date(item.date_created).toLocaleDateString() : "-",
          company: item.company_name || "-",
          contactPerson: item.contact_person || "-",
          contactNumber: item.contact_number || "-",
          source: item.source || "-",
          callType: item.call_type || "-",
          callStatus: item.call_status || "-",
          status: item.status || "-",
          remarks: item.remarks || "-"
        });
      });

      // Generate filename with date range
      let filename = "Outbound_Calls";
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

  return (
    <div className="space-y-4">

      {/* ── Outcome toggle: All / Successful / Unsuccessful ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* All */}
        <button
          onClick={() => setOutcomeFilter("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all
            ${outcomeFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
        >
          <PhoneCall size={13} />
          All Calls
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold
            ${outcomeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
            {outcomeCounts.all}
          </span>
        </button>
      </div>

      {/* ── Individual call-status pills (only shown when outcomeFilter === "all") ── */}
      {outcomeFilter === "all" && (
        <div className="flex flex-wrap gap-2">
          {(["all", ...callStatusOptions] as string[]).map((cs) => {
            const isActive = filterCallStatus === cs;
            const style    = CALL_STATUS_STYLES[cs.toUpperCase()];
            return (
              <button
                key={cs}
                onClick={() => setFilterCallStatus(cs)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${isActive
                    ? cs === "all"
                      ? "bg-gray-800 text-white border-gray-800"
                      : (style?.badge ?? "bg-gray-200 text-gray-700 border-gray-300") + " ring-2 ring-offset-1 ring-current"
                    : cs === "all"
                      ? "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
              >
                {cs !== "all" && style && (
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                )}
                {cs === "all" ? "All" : cs}
                {cs !== "all" && (
                  <span className="ml-0.5 text-[10px] font-semibold opacity-70">
                    {callStatusCounts[cs] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <Input
          type="text"
          placeholder="Search company, contact, remarks, agent..."
          className="max-w-xs text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent filter */}
        <Select
          value={selectedAgent}
          onValueChange={(v) => { setSelectedAgent(v); setPage(1); }}
        >
          <SelectTrigger className="w-[200px] text-xs">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem
                key={agent.ReferenceID}
                value={agent.ReferenceID.toLowerCase()}
                className="capitalize text-xs"
              >
                {agent.Firstname} {agent.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export button */}
        <button
          onClick={exportToExcel}
          disabled={filteredActivities.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {/* ── Summary bar ── */}
      {filteredActivities.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>
            Records:{" "}
            <span className="font-semibold text-gray-700">{filteredActivities.length}</span>
          </span>
          {outcomeFilter !== "all" && (
            <span className={`font-semibold ${outcomeFilter === "successful" ? "text-emerald-600" : "text-red-500"}`}>
              {outcomeFilter === "successful" ? "✓ Successful calls only" : "✗ Unsuccessful calls only"}
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">
          Loading...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">
          {error}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No outbound call records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Date</TableHead>
                <TableHead className="text-gray-500">Company</TableHead>
                <TableHead className="text-gray-500">Contact Person</TableHead>
                <TableHead className="text-gray-500">Contact No.</TableHead>
                <TableHead className="text-gray-500">Source</TableHead>
                <TableHead className="text-gray-500">Call Type</TableHead>
                <TableHead className="text-gray-500">Call Status</TableHead>
                <TableHead className="text-gray-500">Status</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedActivities.map((item) => {
                const agentInfo = agentMap[item.referenceid?.toLowerCase() ?? ""];
                const csKey     = item.call_status?.toUpperCase() ?? "";
                const csStyle   = CALL_STATUS_STYLES[csKey];

                return (
                  <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">

                    {/* Agent */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agentInfo?.profilePicture ? (
                          <img
                            src={agentInfo.profilePicture}
                            alt={agentInfo.name}
                            className="w-6 h-6 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                            {agentInfo?.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="capitalize text-gray-700">
                          {agentInfo?.name ?? "-"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {new Date(item.date_created).toLocaleDateString()}
                    </TableCell>

                    {/* Company */}
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>

                    {/* Contact Person */}
                    <TableCell className="text-gray-700 capitalize">{item.contact_person || "-"}</TableCell>

                    {/* Contact Number */}
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>

                    {/* Source */}
                    <TableCell className="text-gray-500 capitalize">{item.source || "-"}</TableCell>

                    {/* Call Type */}
                    <TableCell className="text-gray-500 capitalize">{item.call_type || "-"}</TableCell>

                    {/* Call Status badge */}
                    <TableCell>
                      {csStyle ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${csStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${csStyle.dot}`} />
                          {item.call_status}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">{item.call_status || "-"}</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-gray-600 capitalize text-[10px] font-semibold">
                      {item.status || "-"}
                    </TableCell>

                    {/* Remarks */}
                    <TableCell className="capitalize italic text-gray-500 max-w-[200px] truncate">
                      {item.remarks || "-"}
                    </TableCell>

                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center mt-2 text-xs">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <div className="px-4 font-medium select-none text-gray-600">
              {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
            </div>
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