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
}
interface UserDetails { referenceid: string; tsm: string; manager: string; firstname: string; lastname: string; profilePicture: string; }
interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

const PAGE_SIZE = 10;
const fmt = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const formatDate = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime()) return "-";
  return d.toLocaleDateString();
};

/* ================= COMPONENT ================= */
export const SITable: React.FC<SIProps> = ({ referenceid, dateCreatedFilterRange, userDetails }) => {
  const [activities, setActivities] = useState<SI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");

  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true); setError(null);
    const url = new URL("/api/reports/tsm/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", dateCreatedFilterRange.from);
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", dateCreatedFilterRange.to);
    fetch(url.toString()).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(d => setActivities(d.activities || []))
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const channel = supabase.channel(`si:tsm=eq.${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` }, (payload) => {
        const n = payload.new as SI, o = payload.old as SI;
        setActivities(curr => {
          if (payload.eventType === "INSERT") return curr.some(a => a.id === n.id) ? curr : [...curr, n];
          if (payload.eventType === "UPDATE") return curr.map(a => a.id === n.id ? n : a);
          if (payload.eventType === "DELETE") return curr.filter(a => a.id !== o.id);
          return curr;
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`).then(r => r.json()).then(setAgents).catch(() => {});
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, { name: string; picture: string }> = {};
    agents.forEach(a => { if (a.ReferenceID) m[a.ReferenceID.toLowerCase()] = { name: `${a.Firstname} ${a.Lastname}`, picture: a.profilePicture || "" }; });
    return m;
  }, [agents]);

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter(i => i.type_activity?.toLowerCase() === "delivered / closed transaction")
      .filter(i => !s || (i.company_name?.toLowerCase().includes(s) || i.dr_number?.toLowerCase().includes(s) || i.remarks?.toLowerCase().includes(s)))
      .filter(i => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter(i => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;
        const d = i.delivery_date ? new Date(i.delivery_date) : new Date();
        if (isNaN(d.getTime())) return false;
        const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;
        if (from && to && isSameDay(from, to)) return isSameDay(d, from);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_updated ?? b.date_created).getTime() - new Date(a.date_updated ?? a.date_created).getTime());
  }, [activities, searchTerm, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedAgent, dateCreatedFilterRange]);

  const totalSIAmount = useMemo(() => filtered.reduce((s, i) => s + (i.actual_sales ?? 0), 0), [filtered]);
  const uniqueDRCount = useMemo(() => new Set(filtered.map(i => i.dr_number).filter(Boolean)).size, [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search company, DR no., remarks..." className="max-w-xs text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select value={selectedAgent} onValueChange={v => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs"><SelectValue placeholder="Filter by Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map(a => <SelectItem className="capitalize" key={a.ReferenceID} value={a.ReferenceID}>{a.Firstname} {a.Lastname}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>Records: <span className="font-semibold text-gray-700">{filtered.length}</span></span>
          <span className="text-gray-200">|</span>
          <span>Unique DR: <span className="font-semibold text-gray-700">{uniqueDRCount}</span></span>
          <span className="text-gray-200">|</span>
          <span>Total: <span className="font-semibold text-gray-700">{fmt(totalSIAmount)}</span></span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-xs text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-gray-400 italic">No sales invoice records found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Delivery Date</TableHead>
                <TableHead className="text-gray-500">SI Date</TableHead>
                <TableHead className="text-gray-500 text-right">SI Amount</TableHead>
                <TableHead className="text-gray-500">DR Number</TableHead>
                <TableHead className="text-gray-500">Company</TableHead>
                <TableHead className="text-gray-500">Contact Person</TableHead>
                <TableHead className="text-gray-500">Contact No.</TableHead>
                <TableHead className="text-gray-500">Payment Terms</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(item => {
                const info = agentMap[item.referenceid?.toLowerCase() ?? ""];
                return (
                  <TableRow key={item.id} className="text-xs hover:bg-gray-50/50 font-mono">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {info?.picture ? <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{info?.name?.[0] ?? "?"}</div>}
                        <span className="capitalize text-gray-700">{info?.name ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">{formatDate(item.delivery_date)}</TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">{formatDate(item.si_date)}</TableCell>
                    <TableCell className="text-right text-gray-700">{item.actual_sales != null ? fmt(item.actual_sales) : "-"}</TableCell>
                    <TableCell className="uppercase text-gray-700">{item.dr_number || "-"}</TableCell>
                    <TableCell className="text-gray-700">{item.company_name || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-600">{item.contact_person || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.contact_number || "-"}</TableCell>
                    <TableCell className="text-gray-500">{item.payment_terms || "-"}</TableCell>
                    <TableCell className="capitalize text-gray-500">{item.remarks || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell colSpan={3} className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-gray-800">{fmt(totalSIAmount)}</TableCell>
                <TableCell colSpan={6} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center text-xs">
            <PaginationItem><PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
            <div className="px-4 font-medium select-none text-gray-600">{page} / {pageCount}</div>
            <PaginationItem><PaginationNext href="#" onClick={e => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }} aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};