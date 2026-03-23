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

/* ================= TYPES ================= */

interface Quotation {
  id: number;
  quotation_number?: string;
  quotation_amount?: number;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  start_date?: string;
  end_date?: string;
  account_reference_number?: string;
  company_name?: string;
  contact_number?: string;
  type_activity: string;
  status: string;
  referenceid: string;
  quotation_status: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface QuotationProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
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
  HOT:  { badge: "bg-red-50 text-red-600 border border-red-200",      dot: "bg-red-500"   },
  WARM: { badge: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-400" },
  COLD: { badge: "bg-blue-50 text-blue-500 border border-blue-200",    dot: "bg-blue-400"  },
  DONE: { badge: "bg-green-50 text-green-600 border border-green-200", dot: "bg-green-500" },
};

const PAGE_SIZE = 10;

/* ================= DURATION HELPER ================= */

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const startMs = new Date(start).getTime();
  const endMs   = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return "—";
  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  const hours        = Math.floor(totalMinutes / 60);
  const minutes      = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/* ================= DATE HELPER ================= */

// date_created is a DATE column — always send plain "YYYY-MM-DD" to the API.
// Sending ISO timestamps (with time + timezone) causes timezone-based
// off-by-one mismatches against a DATE column in PostgREST.
function toPlainDate(value: Date | string): string {
  const d     = typeof value === "string" ? new Date(value) : value;
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ================= COMPONENT ================= */

export const QuotationTable: React.FC<QuotationProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Quotation[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [searchTerm, setSearchTerm]                       = useState("");
  const [filterPriority, setFilterPriority]               = useState<Priority>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");
  const [page, setPage]                                   = useState(1);

  const [agents, setAgents]               = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  // ─── Fetch activities ────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }

    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);

    // FIX 1: plain YYYY-MM-DD — date_created is DATE, not TIMESTAMPTZ.
    // Old code sent ISO timestamps → timezone shifts caused off-by-one issues.
    if (dateCreatedFilterRange?.from) {
      url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    }
    if (dateCreatedFilterRange?.to) {
      url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    }

    // FIX 2: push type_activity filter to the DB level.
    // Old: API fetched ALL types → client filtered → 10–50x excess rows fetched
    //      → sequential batch loop timed out on wide ranges (e.g. March 1–23)
    //      → "Failed to fetch activities" error.
    // New: DB returns only quotation rows → far fewer batches → no timeout.
    url.searchParams.append("type_activity", "quotation preparation");

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
      .channel(`public:history:manager=eq.${referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Quotation;
          const oldRecord = payload.old as Quotation;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                // Only add if it's a quotation preparation record
                if (newRecord.type_activity?.toLowerCase() !== "quotation preparation") return curr;
                return curr.some((a) => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE":
                return curr.map((a) => a.id === newRecord.id ? newRecord : a);
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
      .catch(() => setError("Failed to load agents."));
  }, [userDetails.referenceid]);

  // ─── Agent lookup map ────────────────────────────────────────────────────────
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

  // ─── Sort: newest date_created first ─────────────────────────────────────────
  const sortedActivities = useMemo(
    () => [...activities].sort(
      (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    ),
    [activities]
  );

  // ─── Filter — no type_activity check needed, API already scoped it ───────────
  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return sortedActivities
      .filter((item) => {
        if (!search) return true;
        return (
          (item.company_name?.toLowerCase().includes(search)     ?? false) ||
          (item.quotation_number?.toLowerCase().includes(search) ?? false) ||
          (item.remarks?.toLowerCase().includes(search)          ?? false)
        );
      })
      .filter((item) => {
        if (filterQuotationStatus !== "all") {
          return item.quotation_status?.toUpperCase() === filterQuotationStatus;
        }
        return true;
      })
      .filter((item) => {
        if (filterPriority !== "all") {
          const priority = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
          return priority === filterPriority;
        }
        return true;
      })
      .filter((item) => {
        if (selectedAgent !== "all") return item.referenceid === selectedAgent;
        return true;
      });
  }, [sortedActivities, searchTerm, filterQuotationStatus, filterPriority, selectedAgent]);

  useEffect(() => { setPage(1); },
    [searchTerm, filterQuotationStatus, filterPriority, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setFilterQuotationStatus("all"); }, [filterPriority]);

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const totalQuotationAmount = useMemo(
    () => filteredActivities.reduce((acc, item) => acc + (item.quotation_amount ?? 0), 0),
    [filteredActivities]
  );

  const uniqueQuotationCount = useMemo(() => {
    const s = new Set<string>();
    filteredActivities.forEach((item) => { if (item.quotation_number) s.add(item.quotation_number); });
    return s.size;
  }, [filteredActivities]);

  // ─── Pagination ──────────────────────────────────────────────────────────────
  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  const availableStatuses = useMemo(() => {
    if (filterPriority === "all") return ALL_STATUSES;
    return ALL_STATUSES.filter((s) => PRIORITY_MAP[s] === filterPriority);
  }, [filterPriority]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, DONE: 0 };
    sortedActivities.forEach((item) => {
      const p = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
      if (p) counts[p]++;
    });
    return counts;
  }, [sortedActivities]);

  /* ================= RENDER ================= */

  return (
    <div className="space-y-4">

      {/* ── Priority pills ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "HOT", "WARM", "COLD", "DONE"] as const).map((p) => {
          const isActive = filterPriority === p;
          const style    = p !== "all" ? PRIORITY_STYLES[p] : null;
          return (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${isActive
                  ? p === "all"
                    ? "bg-gray-800 text-white border-gray-800"
                    : style?.badge + " ring-2 ring-offset-1 ring-current"
                  : p === "all"
                    ? "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
            >
              {p !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />}
              {p === "all" ? "All" : p}
              {p !== "all" && (
                <span className="ml-0.5 text-[10px] font-semibold opacity-70">{priorityCounts[p]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Search company, quotation no., remarks..."
          className="max-w-xs text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Select value={filterQuotationStatus} onValueChange={(v) => setFilterQuotationStatus(v)}>
          <SelectTrigger className="w-[240px] text-xs">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {availableStatuses.map((s) => {
              const priority = PRIORITY_MAP[s];
              const style    = PRIORITY_STYLES[priority];
              return (
                <SelectItem key={s} value={s} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style?.dot}`} />
                    {s}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select value={selectedAgent} onValueChange={(v) => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs">
            <SelectValue placeholder="Filter by Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem className="capitalize" key={agent.ReferenceID} value={agent.ReferenceID}>
                {agent.Firstname} {agent.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Summary bar ── */}
      {filteredActivities.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-mono">
          <span>Records: <span className="font-semibold text-gray-700">{filteredActivities.length}</span></span>
          <span className="text-gray-200">|</span>
          <span>Unique Quotations: <span className="font-semibold text-gray-700">{uniqueQuotationCount}</span></span>
          <span className="text-gray-200">|</span>
          <span>
            Total Amount:{" "}
            <span className="font-semibold text-gray-700">
              {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
            </span>
          </span>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No quotation records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Date</TableHead>
                <TableHead className="text-gray-500">Quotation No.</TableHead>
                <TableHead className="text-gray-500 text-right">Amount</TableHead>
                <TableHead className="text-gray-500">Status</TableHead>
                <TableHead className="text-gray-500">Company</TableHead>
                <TableHead className="text-gray-500">Contact</TableHead>
                <TableHead className="text-gray-500">Priority</TableHead>
                <TableHead className="text-gray-500 whitespace-nowrap">Duration</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedActivities.map((item) => {
                const agentInfo       = agentMap[item.referenceid?.toLowerCase() ?? ""];
                const quotationStatus = item.quotation_status?.toUpperCase() ?? "";
                const priority        = PRIORITY_MAP[quotationStatus];
                const priorityStyle   = priority ? PRIORITY_STYLES[priority] : null;
                const duration        = computeDuration(item.start_date, item.end_date);

                return (
                  <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agentInfo?.profilePicture ? (
                          <img src={agentInfo.profilePicture} alt={agentInfo.name}
                            className="w-6 h-6 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                            {agentInfo?.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="capitalize text-gray-700">{agentInfo?.name ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {new Date(item.date_created).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="uppercase text-gray-700">{item.quotation_number || "-"}</TableCell>
                    <TableCell className="text-right text-gray-700">
                      {item.quotation_amount != null
                        ? item.quotation_amount.toLocaleString(undefined, { style: "currency", currency: "PHP" })
                        : "-"}
                    </TableCell>
                    <TableCell className="uppercase text-gray-900 font-bold text-[10px]">
                      {item.quotation_status || "-"}
                    </TableCell>
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>
                    <TableCell>
                      {priority && priorityStyle ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                          {priority}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {duration === "—" ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">
                          {duration}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize italic text-gray-500">{item.remarks || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            <tfoot>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell colSpan={3} className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-gray-800">
                  {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell colSpan={6} />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center mt-2 text-xs">
            <PaginationItem>
              <PaginationPrevious href="#"
                onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <div className="px-4 font-medium select-none text-gray-600">
              {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
            </div>
            <PaginationItem>
              <PaginationNext href="#"
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