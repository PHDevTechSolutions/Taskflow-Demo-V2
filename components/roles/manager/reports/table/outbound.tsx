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
import { PhoneCall, AlertTriangle, RefreshCw } from "lucide-react";

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
  start_date?: string;
  end_date?: string;
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
  BUSY:          { badge: "bg-slate-100 text-slate-600 border border-slate-200",      dot: "bg-slate-400"   },
};

const SUCCESSFUL_STATUSES   = new Set(["REACHED"]);
const UNSUCCESSFUL_STATUSES = new Set(["NOT REACHED", "BUSY"]);

type OutcomeFilter = "all" | "successful" | "unsuccessful";

const PAGE_SIZE = 10;

/* ================= HELPERS ================= */

/**
 * Plain "YYYY-MM-DD" from any Date or string.
 * date_created is a DATE column — NEVER send ISO timestamps to the API.
 * Sending "2025-03-01T00:00:00.000Z" against a DATE column causes PostgREST
 * to silently mishandle timezone offsets and miss boundary records.
 */
function toPlainDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/**
 * Duration between start_date and end_date → "2h 30m 15s" or "—".
 */
function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const startMs = new Date(start).getTime();
  const endMs   = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return "—";
  const totalSeconds = Math.floor((endMs - startMs) / 1_000);
  const h = Math.floor(totalSeconds / 3_600);
  const m = Math.floor((totalSeconds % 3_600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* ================= ERROR DISPLAY ================= */

interface FetchError {
  message: string;       // short user-facing message
  detail:  string;       // technical detail for debugging
  status?: number;       // HTTP status code if available
  range?:  string;       // the date range that was requested
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: FetchError;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-red-700">{error.message}</p>
          {error.status && (
            <p className="text-[11px] text-red-400 font-mono mt-0.5">
              HTTP {error.status}
            </p>
          )}
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-100 transition-colors flex-shrink-0"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      </div>

      {/* Expandable detail */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-red-400 hover:text-red-600 underline underline-offset-2"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        {expanded && (
          <pre className="mt-2 p-2 rounded-md bg-white border border-red-100 text-[10px] font-mono text-red-700 whitespace-pre-wrap break-all">
            {[
              error.range  && `Range   : ${error.range}`,
              error.status && `Status  : HTTP ${error.status}`,
              `Detail  : ${error.detail}`,
            ]
              .filter(Boolean)
              .join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENT ================= */

export const OutboundTable: React.FC<OutboundTableProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
}) => {
  const [activities,       setActivities]       = useState<Outbound[]>([]);
  const [agents,           setAgents]           = useState<any[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [fetchError,       setFetchError]       = useState<FetchError | null>(null);

  const [searchTerm,       setSearchTerm]       = useState("");
  const [outcomeFilter,    setOutcomeFilter]    = useState<OutcomeFilter>("all");
  const [filterCallStatus, setFilterCallStatus] = useState("all");
  const [filterStatus,     setFilterStatus]     = useState("all");
  const [selectedAgent,    setSelectedAgent]    = useState("all");
  const [page,             setPage]             = useState(1);

  // ─── Fetch activities ────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }

    setLoading(true);
    setFetchError(null);

    const fromStr = dateCreatedFilterRange?.from
      ? toPlainDate(dateCreatedFilterRange.from)
      : null;
    const toStr = dateCreatedFilterRange?.to
      ? toPlainDate(dateCreatedFilterRange.to)
      : null;

    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);

    // FIX 1: plain YYYY-MM-DD strings — date_created is a DATE column.
    // Sending ISO timestamps (with time+timezone) causes silent off-by-one
    // mismatches in PostgREST when comparing against a plain DATE column.
    if (fromStr) url.searchParams.append("from", fromStr);
    if (toStr)   url.searchParams.append("to",   toStr);

    // FIX 2: push type_activity filter to DB level.
    // Without this the API fetches ALL activity types — on a wide range like
    // March 1–23 that could be 30k+ rows → 30+ parallel Supabase connections
    // → connection pool saturated → 500 error.
    // With this filter only outbound rows are fetched — far fewer batches.
    url.searchParams.append("type_activity", "outbound calls");

    fetch(url.toString())
      .then(async (res) => {
        // Capture the raw body regardless of status so we can show it
        const text = await res.text();
        let body: any;
        try { body = JSON.parse(text); } catch { body = text; }

        if (!res.ok) {
          // Build a rich error object with as much detail as possible
          const apiMessage =
            typeof body === "object" && body !== null
              ? (body.message ?? body.error ?? JSON.stringify(body))
              : String(text).slice(0, 300);

          throw {
            message: "Failed to fetch activities",
            detail:  apiMessage,
            status:  res.status,
            range:   fromStr && toStr ? `${fromStr} → ${toStr}` : fromStr ?? toStr ?? "default (current month)",
          } satisfies FetchError;
        }

        return body;
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err: FetchError | Error) => {
        // Handle both our rich FetchError and plain JS Error objects
        if ("detail" in err) {
          setFetchError(err as FetchError);
        } else {
          setFetchError({
            message: (err as Error).message ?? "Unknown error",
            detail:  (err as Error).stack ?? "No additional detail",
            range:   fromStr && toStr ? `${fromStr} → ${toStr}` : undefined,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ─── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:outbound:${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Outbound;
          const oldRecord = payload.old as Outbound;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                if (newRecord.type_activity?.toLowerCase() !== "outbound calls") return curr;
                return curr.some((a) => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE":
                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
              case "DELETE":
                return curr.filter((a) => a.id !== oldRecord.id);
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ─── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user-manager?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then(setAgents)
      .catch(() =>
        setFetchError({
          message: "Failed to load agents",
          detail:  "Could not fetch agent list from /api/fetch-all-user-manager",
        })
      );
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const map: Record<string, { name: string; profilePicture: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID)
        map[agent.ReferenceID.toLowerCase()] = {
          name: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture || "",
        };
    });
    return map;
  }, [agents]);

  // ─── Base: sorted newest first — no type_activity filter (API scoped it) ─────
  const outboundActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
      ),
    [activities]
  );

  // ─── Counts ──────────────────────────────────────────────────────────────────
  const outcomeCounts = useMemo(() => {
    let successful = 0, unsuccessful = 0;
    outboundActivities.forEach((a) => {
      const cs = a.call_status?.toUpperCase() ?? "";
      if (SUCCESSFUL_STATUSES.has(cs))   successful++;
      if (UNSUCCESSFUL_STATUSES.has(cs)) unsuccessful++;
    });
    return { all: outboundActivities.length, successful, unsuccessful };
  }, [outboundActivities]);

  const callStatusOptions = useMemo(
    () => Array.from(new Set(outboundActivities.map((a) => a.call_status).filter(Boolean))).sort(),
    [outboundActivities]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(outboundActivities.map((a) => a.status).filter(Boolean))).sort(),
    [outboundActivities]
  );
  const callStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    outboundActivities.forEach((a) => {
      const k = a.call_status ?? "Unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [outboundActivities]);

  // ─── Filter — no client-side date re-filter; API already scoped by date ──────
  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return outboundActivities.filter((item) => {
      const cs = item.call_status?.toUpperCase() ?? "";
      if (outcomeFilter === "successful"   && !SUCCESSFUL_STATUSES.has(cs))   return false;
      if (outcomeFilter === "unsuccessful" && !UNSUCCESSFUL_STATUSES.has(cs)) return false;
      if (outcomeFilter === "all" && filterCallStatus !== "all" && item.call_status !== filterCallStatus) return false;
      if (filterStatus  !== "all" && item.status !== filterStatus) return false;
      if (selectedAgent !== "all" && item.referenceid?.toLowerCase() !== selectedAgent.toLowerCase()) return false;
      if (s) {
        const agentName = agentMap[item.referenceid?.toLowerCase() ?? ""]?.name ?? "";
        const haystack  = [item.company_name, item.contact_person, item.contact_number,
          item.source, item.call_type, item.remarks, agentName].join(" ").toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [outboundActivities, searchTerm, outcomeFilter, filterCallStatus, filterStatus, selectedAgent, agentMap]);

  useEffect(() => { setPage(1); },
    [searchTerm, outcomeFilter, filterCallStatus, filterStatus, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => {
    if (outcomeFilter !== "all") setFilterCallStatus("all");
  }, [outcomeFilter]);

  const pageCount           = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  /* ================= RENDER ================= */

  return (
    <div className="space-y-4">

      {/* ── Outcome toggle ── */}
      <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── Call-status pills ── */}
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
                {cs !== "all" && style && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
                {cs === "all" ? "All" : cs}
                {cs !== "all" && (
                  <span className="ml-0.5 text-[10px] font-semibold opacity-70">{callStatusCounts[cs] ?? 0}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Search company, contact, remarks, agent..."
          className="max-w-xs text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedAgent} onValueChange={(v) => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs"><SelectValue placeholder="All Agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.ReferenceID} value={agent.ReferenceID.toLowerCase()} className="capitalize text-xs">
                {agent.Firstname} {agent.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Summary bar ── */}
      {filteredActivities.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>Records: <span className="font-semibold text-gray-700">{filteredActivities.length}</span></span>
          {outcomeFilter !== "all" && (
            <span className={`font-semibold ${outcomeFilter === "successful" ? "text-emerald-600" : "text-red-500"}`}>
              {outcomeFilter === "successful" ? "✓ Successful calls only" : "✗ Unsuccessful calls only"}
            </span>
          )}
        </div>
      )}

      {/* ── Table / States ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : fetchError ? (
        <ErrorPanel error={fetchError} onRetry={fetchActivities} />
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
                <TableHead className="text-gray-500 whitespace-nowrap">Duration</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivities.map((item) => {
                const agentInfo = agentMap[item.referenceid?.toLowerCase() ?? ""];
                const csKey     = item.call_status?.toUpperCase() ?? "";
                const csStyle   = CALL_STATUS_STYLES[csKey];
                const duration  = computeDuration(item.start_date, item.end_date);

                return (
                  <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">
                    {/* Agent */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agentInfo?.profilePicture ? (
                          <img src={agentInfo.profilePicture} alt={agentInfo.name} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">{agentInfo?.name?.[0] ?? "?"}</div>
                        )}
                        <span className="capitalize text-gray-700">{agentInfo?.name ?? "-"}</span>
                      </div>
                    </TableCell>
                    {/* Date */}
                    <TableCell className="text-gray-500 whitespace-nowrap">{new Date(item.date_created).toLocaleDateString()}</TableCell>
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
                    {/* Call Status */}
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
                    <TableCell className="text-gray-600 capitalize text-[10px] font-semibold">{item.status || "-"}</TableCell>
                    {/* Duration */}
                    <TableCell className="whitespace-nowrap">
                      {duration === "—" ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{duration}</span>
                      )}
                    </TableCell>
                    {/* Remarks */}
                    <TableCell className="capitalize italic text-gray-500 max-w-[200px] truncate">{item.remarks || "-"}</TableCell>
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
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
            <div className="px-4 font-medium select-none text-gray-600">{pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}</div>
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }} aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};