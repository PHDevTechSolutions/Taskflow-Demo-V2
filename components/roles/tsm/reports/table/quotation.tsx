"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { logExcelExport } from "@/lib/auditTrail";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ================= TYPES ================= */

interface Quotation {
  id: number;
  quotation_number?: string;
  quotation_amount?: number;
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
  HOT: { badge: "bg-red-50 text-red-600 border border-red-200", dot: "bg-red-500" },
  WARM: { badge: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-400" },
  COLD: { badge: "bg-blue-50 text-blue-500 border border-blue-200", dot: "bg-blue-400" },
  DONE: { badge: "bg-green-50 text-green-600 border border-green-200", dot: "bg-green-500" },
};

const PAGE_SIZE = 10;

/* ================= COMPONENT ================= */

export const QuotationTable: React.FC<QuotationProps> = ({
  referenceid,
  dateCreatedFilterRange,
  userDetails,
  setDateCreatedFilterRangeAction,
}) => {
  const searchParams = useSearchParams();
  const highlight = searchParams?.get("highlight");

  const [activities, setActivities] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Set search term if highlight is present
  useEffect(() => {
    if (highlight) {
      setSearchTerm(highlight);
    }
  }, [highlight]);

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  /* ---- Fetch activities ---- */
  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

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
    if (to) url.searchParams.append("to", to);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` },
        (payload) => {
          const newRecord = payload.new as Quotation;
          const oldRecord = payload.old as Quotation;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT": return curr.some(a => a.id === newRecord.id) ? curr : [...curr, newRecord];
              case "UPDATE": return curr.map(a => a.id === newRecord.id ? newRecord : a);
              case "DELETE": return curr.filter(a => a.id !== oldRecord.id);
              default: return curr;
            }
          });
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  /* ---- Fetch agents ---- */
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then(res => { if (!res.ok) throw new Error("Failed"); return res.json(); })
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

  /* ---- Sorted ---- */
  const sortedActivities = useMemo(() =>
    [...activities].sort((a, b) =>
      new Date(b.date_updated ?? b.date_created).getTime() -
      new Date(a.date_updated ?? a.date_created).getTime()
    ), [activities]);

  /* ---- Filtered ---- */
  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return sortedActivities
      .filter(item => item.type_activity?.toLowerCase() === "quotation preparation")
      .filter(item => {
        if (!search) return true;
        return (
          (item.company_name?.toLowerCase().includes(search) ?? false) ||
          (item.quotation_number?.toLowerCase().includes(search) ?? false) ||
          (item.remarks?.toLowerCase().includes(search) ?? false)
        );
      })
      .filter(item => {
        if (filterQuotationStatus !== "all") {
          return item.quotation_status?.toUpperCase() === filterQuotationStatus;
        }
        return true;
      })
      .filter(item => {
        if (filterPriority !== "all") {
          const priority = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
          return priority === filterPriority;
        }
        return true;
      })
      .filter(item => {
        if (selectedAgent !== "all") return item.referenceid === selectedAgent;
        return true;
      })
      .filter(item => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;

        const updatedDate = item.date_updated ? new Date(item.date_updated) : new Date(item.date_created);
        if (isNaN(updatedDate.getTime())) return false;

        const fromDate = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const toDate = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;

        const isSameDay = (d1: Date, d2: Date) =>
          d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

        if (fromDate && toDate && isSameDay(fromDate, toDate)) return isSameDay(updatedDate, fromDate);
        if (fromDate && updatedDate < fromDate) return false;
        if (toDate && updatedDate > toDate) return false;
        return true;
      });
  }, [sortedActivities, searchTerm, filterQuotationStatus, filterPriority, selectedAgent, dateCreatedFilterRange]);

  /* Reset page on filter change */
  useEffect(() => { setPage(1); }, [searchTerm, filterQuotationStatus, filterPriority, selectedAgent, dateCreatedFilterRange]);

  /* Reset quotation_status filter when priority changes */
  useEffect(() => { setFilterQuotationStatus("all"); }, [filterPriority]);

  /* ---- Totals ---- */
  const totalQuotationAmount = useMemo(() =>
    filteredActivities.reduce((acc, item) => acc + (item.quotation_amount ?? 0), 0),
    [filteredActivities]);

  const uniqueQuotationCount = useMemo(() => {
    const s = new Set<string>();
    filteredActivities.forEach(item => { if (item.quotation_number) s.add(item.quotation_number); });
    return s.size;
  }, [filteredActivities]);

  /* ---- Pagination ---- */
  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
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
      const worksheet = workbook.addWorksheet("Quotations");

      // Add headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Quotation Number", key: "quotationNumber", width: 20 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Status", key: "status", width: 20 },
        { header: "Company", key: "company", width: 25 },
        { header: "Contact Person", key: "contactPerson", width: 20 },
        { header: "Priority", key: "priority", width: 15 },
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
        const priority = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""] || "-";
        
        worksheet.addRow({
          agent: agentName,
          date: item.date_created ? new Date(item.date_created).toLocaleDateString() : "-",
          quotationNumber: item.quotation_number || "-",
          amount: item.quotation_amount ?? 0,
          status: item.quotation_status || "-",
          company: item.company_name || "-",
          contactPerson: item.contact_person || "-",
          priority: priority,
          remarks: item.remarks || "-"
        });
      });

      // Format amount column
      worksheet.getColumn('amount').numFmt = '#,##0.00" ₱"';

      // Generate filename with date range
      let filename = "Quotations";
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

  /* ---- Statuses filtered by selected priority ---- */
  const availableStatuses = useMemo(() => {
    if (filterPriority === "all") return ALL_STATUSES;
    return ALL_STATUSES.filter(s => PRIORITY_MAP[s] === filterPriority);
  }, [filterPriority]);

  /* ---- Priority summary counts ---- */
  const priorityCounts = useMemo(() => {
    const base = sortedActivities.filter(item => item.type_activity?.toLowerCase() === "quotation preparation");
    const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, DONE: 0 };
    base.forEach(item => {
      const p = PRIORITY_MAP[item.quotation_status?.toUpperCase() ?? ""];
      if (p) counts[p]++;
    });
    return counts;
  }, [sortedActivities]);

  return (
    <div className="space-y-4">

      {/* ── Priority pills ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "HOT", "WARM", "COLD", "DONE"] as const).map((p) => {
          const isActive = filterPriority === p;
          const style = p !== "all" ? PRIORITY_STYLES[p] : null;
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
              {p !== "all" && (
                <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />
              )}
              {p === "all" ? "All" : p}
              {p !== "all" && (
                <span className="ml-0.5 text-[10px] font-semibold opacity-70">
                  {priorityCounts[p]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <Input
          type="text"
          placeholder="Search company, quotation no., remarks..."
          className="max-w-xs text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Quotation status */}
        <Select
          value={filterQuotationStatus}
          onValueChange={(v) => setFilterQuotationStatus(v)}
        >
          <SelectTrigger className="w-[240px] text-xs">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {availableStatuses.map((s) => {
              const priority = PRIORITY_MAP[s];
              const style = PRIORITY_STYLES[priority];
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

        {/* Agent filter */}
        <Select
          value={selectedAgent}
          onValueChange={(v) => { setSelectedAgent(v); setPage(1); }}
        >
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
            Records: <span className="font-semibold text-gray-700">{filteredActivities.length}</span>
          </span>
          <span className="text-gray-200">|</span>
          <span>
            Unique Quotations: <span className="font-semibold text-gray-700">{uniqueQuotationCount}</span>
          </span>
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
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedActivities.map((item) => {
                const agentInfo = agentMap[item.referenceid?.toLowerCase() ?? ""];
                const quotationStatus = item.quotation_status?.toUpperCase() ?? "";
                const priority = PRIORITY_MAP[quotationStatus];
                const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;
                const isHighlighted = highlight === item.quotation_number;

                return (
                  <TableRow key={item.id} className={`text-xs hover:bg-gray-50/50 font-mono ${isHighlighted ? "bg-yellow-100/50 hover:bg-yellow-100/70 border-l-4 border-l-yellow-500" : ""}`}>
                    {/* Agent */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agentInfo?.profilePicture ? (
                          <img src={agentInfo.profilePicture} alt={agentInfo.name} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                            {agentInfo?.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="capitalize text-gray-700">{agentInfo?.name ?? "-"}</span>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {new Date(item.date_created).toLocaleDateString()}
                    </TableCell>

                    {/* Quotation No. */}
                    <TableCell className="uppercase text-gray-700">{item.quotation_number || "-"}</TableCell>

                    {/* Amount */}
                    <TableCell className="text-right text-gray-700">
                      {item.quotation_amount != null
                        ? item.quotation_amount.toLocaleString(undefined, { style: "currency", currency: "PHP" })
                        : "-"}
                    </TableCell>

                    {/* Quotation Status */}
                    <TableCell className="uppercase text-gray-900 font-bold text-[10px]">
                      {item.quotation_status || "-"}
                    </TableCell>

                    {/* Company */}
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>

                    {/* Contact */}
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>

                    {/* Priority badge */}
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

                    {/* Remarks */}
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
                <TableCell colSpan={5} />
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