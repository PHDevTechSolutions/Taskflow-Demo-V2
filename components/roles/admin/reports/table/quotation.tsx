"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  tsm?: string;
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
  HOT: { badge: "bg-red-50 text-red-600 border border-red-200", dot: "bg-red-500" },
  WARM: { badge: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-400" },
  COLD: { badge: "bg-blue-50 text-blue-500 border border-blue-200", dot: "bg-blue-400" },
  DONE: { badge: "bg-green-50 text-green-600 border border-green-200", dot: "bg-green-500" },
};

/* ================= DURATION HELPER ================= */

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return "—";
  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/* ================= DATE HELPER ================= */

function toPlainDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [expandedTsmId, setExpandedTsmId] = useState<string | null>(null);

  // ─── Fetch activities ────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }

    setLoading(true);
    setError(null);

    const url = new URL("/api/reports/admin/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);

    if (dateCreatedFilterRange?.from) {
      url.searchParams.append("from", toPlainDate(dateCreatedFilterRange.from));
    }
    if (dateCreatedFilterRange?.to) {
      url.searchParams.append("to", toPlainDate(dateCreatedFilterRange.to));
    }

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
      .channel(`public:history`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Quotation;
          const oldRecord = payload.old as Quotation;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
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
    fetch(`/api/fetch-all-users-admin`)
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then((data) => setAgents(data || []))
      .catch(() => setError("Failed to load agents."));
  }, [userDetails.referenceid]);

  // ─── Agent lookup maps ───────────────────────────────────────────────────────
  const agentMap = useMemo(() => {
    const map: Record<string, Agent & { name: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID) {
        map[agent.ReferenceID.toLowerCase()] = {
          ...agent,
          name: `${agent.Firstname} ${agent.Lastname}`,
        };
      }
    });
    return map;
  }, [agents]);

  const tsmAgents = useMemo(
    () => agents.filter((a) => a.Role === "Territory Sales Manager"),
    [agents]
  );

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      ),
    [activities]
  );

  // ─── TSM Summary (UPDATED: per-status counts) ────────────────────────────────
  const tsmSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      tsmId: string;
      tsmName: string;
      quoteCount: number;
      quotationAmount: number;
      statusCounts: Record<string, number>;
    }>();

    // Initialize from official TSM list
    tsmAgents.forEach((tsm) => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      summaryMap.set(tsmId, {
        tsmId,
        tsmName: `${tsm.Firstname} ${tsm.Lastname}`,
        quoteCount: 0,
        quotationAmount: 0,
        statusCounts: Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])),
      });
    });

    sortedActivities.forEach((item) => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const tsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      if (!tsmId) return;
      if (!summaryMap.has(tsmId)) return;

      const row = summaryMap.get(tsmId)!;
      row.quoteCount += 1;
      row.quotationAmount += item.quotation_amount ?? 0;

      const statusKey = item.quotation_status?.toUpperCase() ?? "";
      const matchedStatus = ALL_STATUSES.find((s) => s === statusKey);
      if (matchedStatus) {
        row.statusCounts[matchedStatus] += 1;
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.quoteCount - a.quoteCount);
  }, [sortedActivities, agentMap, tsmAgents]);

  const expandedTsaGroups = useMemo(() => {
    if (!expandedTsmId) return [];

    const rowsForTsm = sortedActivities.filter((item) => {
      const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
      const derivedTsmId = (agent?.TSM ?? item.tsm ?? "").toLowerCase();
      return derivedTsmId === expandedTsmId;
    });

    const byTsa = new Map<string, { tsaName: string; rows: Quotation[] }>();
    rowsForTsm.forEach((row) => {
      const tsaId = (row.referenceid || "unknown").toLowerCase();
      const tsaAgent = agentMap[tsaId];
      const tsaName = tsaAgent?.name || row.referenceid || "Unknown TSA";
      if (!byTsa.has(tsaId)) byTsa.set(tsaId, { tsaName, rows: [] });
      byTsa.get(tsaId)!.rows.push(row);
    });

    return Array.from(byTsa.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [expandedTsmId, sortedActivities, agentMap]);

  /* ================= RENDER ================= */

  return (
    <div className="space-y-4">
      {/* ── TSM Summary Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : tsmSummary.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">
          No quotation records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border p-4 border-gray-100 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">TSM</TableHead>
                <TableHead className="text-gray-500 text-right">Quote Count</TableHead>
                <TableHead className="text-gray-500 text-right">Quotation Amount</TableHead>
                <TableHead className="text-gray-500 text-right">Pending Client Approval</TableHead>
                <TableHead className="text-gray-500 text-right">For Bidding</TableHead>
                <TableHead className="text-gray-500 text-right">Nego</TableHead>
                <TableHead className="text-gray-500 text-right">Order Complete</TableHead>
                <TableHead className="text-gray-500 text-right">Convert to SO</TableHead>
                <TableHead className="text-gray-500 text-right">Loss Price is Too High</TableHead>
                <TableHead className="text-gray-500 text-right">Lead Time Issue</TableHead>
                <TableHead className="text-gray-500 text-right">Out of Stock</TableHead>
                <TableHead className="text-gray-500 text-right">Insufficient Stock</TableHead>
                <TableHead className="text-gray-500 text-right">Lost Bid</TableHead>
                <TableHead className="text-gray-500 text-right">Canvass Only</TableHead>
                <TableHead className="text-gray-500 text-right">Did Not Meet the Specs</TableHead>
                <TableHead className="text-gray-500 text-right">Decline / Disapproved</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tsmSummary.map((item) => {
                const isExpanded = expandedTsmId === item.tsmId;
                return (
                  <React.Fragment key={item.tsmId}>
                    <TableRow
                      className={`text-xs font-mono cursor-pointer ${isExpanded ? "bg-blue-50/70" : "hover:bg-gray-50/60"}`}
                      onClick={() => setExpandedTsmId(isExpanded ? null : item.tsmId)}
                    >
                      <TableCell className="font-semibold text-gray-700 uppercase">{item.tsmName}</TableCell>
                      <TableCell className="text-right">{item.quoteCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {item.quotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                      </TableCell>
                      {/* Per-status counts — same order as ALL_STATUSES / TableHeader */}
                      {ALL_STATUSES.map((status) => {
                        const count = item.statusCounts[status] ?? 0;
                        const priority = PRIORITY_MAP[status];
                        const colorClass =
                          priority === "HOT" ? "text-red-600 font-semibold" :
                            priority === "WARM" ? "text-amber-600 font-semibold" :
                              priority === "DONE" ? "text-green-600 font-semibold" :
                                priority === "COLD" ? "text-blue-500 font-semibold" :
                                  "text-gray-700";
                        return (
                          <TableCell
                            key={status}
                            className={`text-right ${count > 0 ? colorClass : "text-gray-300"}`}
                          >
                            {count > 0 ? count : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
            <tfoot>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  {tsmSummary.reduce((sum, t) => sum + t.quoteCount, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {tsmSummary.reduce((sum, t) => sum + t.quotationAmount, 0).toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                {ALL_STATUSES.map((status) => (
                  <TableCell key={status} className="text-right">
                    {tsmSummary.reduce((sum, t) => sum + (t.statusCounts[status] ?? 0), 0) || "—"}
                  </TableCell>
                ))}
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {/* ── Expanded TSA Details ── */}
      {expandedTsmId && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
            TSA Details
          </p>

          {expandedTsaGroups.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">No TSA quotation records under this TSM.</div>
          ) : (
            expandedTsaGroups.map((group) => (
              <div key={group.tsaName} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700">
                    {group.tsaName} <span className="text-gray-400 font-normal">({group.rows.length} quotations)</span>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-[11px]">
                        <TableHead className="text-gray-500">Date</TableHead>
                        <TableHead className="text-gray-500">Quotation Number</TableHead>
                        <TableHead className="text-gray-500 text-right">Quotation Amount</TableHead>
                        <TableHead className="text-gray-500">Quotation Status</TableHead>
                        <TableHead className="text-gray-500">Company Name</TableHead>
                        <TableHead className="text-gray-500">Contact Number</TableHead>
                        <TableHead className="text-gray-500">Priority</TableHead>
                        <TableHead className="text-gray-500">Duration</TableHead>
                        <TableHead className="text-gray-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => {
                        const quotationStatus = row.quotation_status?.toUpperCase() ?? "";
                        const priority = PRIORITY_MAP[quotationStatus];
                        const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;
                        const duration = computeDuration(row.start_date, row.end_date);

                        return (
                          <TableRow key={row.id} className="text-xs font-mono hover:bg-gray-50/60">
                            <TableCell className="whitespace-nowrap">
                              {new Date(row.date_created).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{row.quotation_number || "-"}</TableCell>
                            <TableCell className="text-right">
                              {(row.quotation_amount ?? 0).toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                            </TableCell>
                            <TableCell className="uppercase font-semibold">{row.quotation_status || "-"}</TableCell>
                            <TableCell>{row.company_name || "-"}</TableCell>
                            <TableCell>{row.contact_number || "-"}</TableCell>
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
                            <TableCell className="whitespace-nowrap">{duration}</TableCell>
                            <TableCell className="italic text-gray-500">{row.remarks || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
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