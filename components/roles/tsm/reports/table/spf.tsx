"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SPF { id: number; so_amount?: number; so_number?: string; remarks?: string; date_created: string; date_updated?: string; company_name?: string; contact_number?: string; contact_person: string; call_type: string; status: string; referenceid: string; }
interface UserDetails { referenceid: string; tsm: string; manager: string; firstname: string; lastname: string; profilePicture: string; }
interface SPFProps { referenceid: string; target_quota?: string; dateCreatedFilterRange: any; setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>; userDetails: UserDetails; }

const PAGE_SIZE = 10;
const fmtPHP = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];

// Label map for cleaner display
const SPF_LABEL: Record<string, string> = {
  "spf - special project": "Special Project",
  "spf - local": "Local",
  "spf - foreign": "Foreign",
};

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

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const ch = supabase.channel(`spf:${referenceid}`).on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `tsm=eq.${referenceid}` }, ({ eventType, new: n, old: o }: any) => {
      setActivities(c => eventType === "INSERT" ? (c.some(a => a.id === n.id) ? c : [...c, n]) : eventType === "UPDATE" ? c.map(a => a.id === n.id ? n : a) : c.filter(a => a.id !== o.id));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`).then(r => r.json()).then(setAgents).catch(() => { });
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, { name: string; picture: string }> = {};
    agents.forEach(a => { if (a.ReferenceID) m[a.ReferenceID.toLowerCase()] = { name: `${a.Firstname} ${a.Lastname}`, picture: a.profilePicture || "" }; });
    return m;
  }, [agents]);

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter(i => SPF_TYPES.includes(i.call_type?.toLowerCase() ?? ""))
      .filter(i => filterType === "all" || i.call_type?.toLowerCase() === filterType)
      .filter(i => !s || (i.company_name?.toLowerCase().includes(s) || i.so_number?.toLowerCase().includes(s) || i.remarks?.toLowerCase().includes(s)))
      .filter(i => selectedAgent === "all" || i.referenceid === selectedAgent)
      .filter(i => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return true;
        const d = new Date(i.date_created); if (isNaN(d.getTime())) return false;
        const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;
        if (from && to && isSameDay(from, to)) return isSameDay(d, from);
        if (from && d < from) return false; if (to && d > to) return false; return true;
      })
      .sort((a, b) => new Date(b.date_updated ?? b.date_created).getTime() - new Date(a.date_updated ?? a.date_created).getTime());
  }, [activities, searchTerm, filterType, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, filterType, selectedAgent, dateCreatedFilterRange]);
  const total = useMemo(() => filtered.reduce((s, i) => s + (i.so_amount ?? 0), 0), [filtered]);
  const uniqueCount = useMemo(() => new Set(filtered.map(i => i.so_number).filter(Boolean)).size, [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search company, SO no., remarks..." className="max-w-xs text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {/* SPF Type filter */}
        <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] text-xs"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {SPF_TYPES.map(t => <SelectItem key={t} value={t}>{SPF_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedAgent} onValueChange={v => { setSelectedAgent(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] text-xs"><SelectValue placeholder="Filter by Agent" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Agents</SelectItem>{agents.map(a => <SelectItem className="capitalize" key={a.ReferenceID} value={a.ReferenceID}>{a.Firstname} {a.Lastname}</SelectItem>)}</SelectContent>
        </Select>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(item => {
                      const info = agentMap[item.referenceid?.toLowerCase() ?? ""];
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter><TableRow className="bg-gray-50 text-xs font-semibold font-mono"><TableCell colSpan={2} className="text-gray-500">Total</TableCell><TableCell className="text-right text-gray-800">{fmtPHP(total)}</TableCell><TableCell colSpan={5} /></TableRow></TableFooter>
                </Table>
              </div>
            )}
      {pageCount > 1 && (<Pagination><PaginationContent className="flex items-center space-x-4 justify-center text-xs"><PaginationItem><PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem><div className="px-4 font-medium select-none text-gray-600">{page} / {pageCount}</div><PaginationItem><PaginationNext href="#" onClick={e => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }} aria-disabled={page === pageCount} className={page === pageCount ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination>)}
    </div>
  );
};