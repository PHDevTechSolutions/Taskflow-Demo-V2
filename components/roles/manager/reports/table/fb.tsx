"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FB {
  id: number;
  actual_sales?: number;
  quotation_amount?: number;
  quotation_number?: string;
  remarks?: string;
  date_created: string;
  contact_number?: string;
  contact_person: string;
  source: string;
  referenceid: string;
  tsm?: string;
  company_name?: string;
  activity_reference_number?: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  Role: string;
  TSM?: string;
}

interface UserDetails { referenceid: string; tsm: string; manager: string; firstname: string; lastname: string; profilePicture: string; }
interface FBProps { referenceid: string; dateCreatedFilterRange: any; userDetails: UserDetails; }

const fmtPHP = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "PHP" });

export const FBTable: React.FC<FBProps> = ({ referenceid, dateCreatedFilterRange, userDetails }) => {
  const [activities, setActivities] = useState<FB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTsm, setSelectedTsm] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");

  const fetchActivities = useCallback(() => {
    if (!referenceid) return setActivities([]);
    setLoading(true); setError(null);
    const url = new URL("/api/reports/manager/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", new Date(dateCreatedFilterRange.from).toISOString());
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", new Date(dateCreatedFilterRange.to).toISOString());
    fetch(url.toString())
      .then(r => r.ok ? r.json() : Promise.reject("Failed to fetch activities"))
      .then(d => setActivities(d.activities || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const ch = supabase.channel(`fb:${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `manager=eq.${referenceid}` },
        (payload) => {
          const n = payload.new as FB, o = payload.old as FB;
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

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then(r => r.json())
      .then(setAgents)
      .catch(() => { });
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const map: Record<string, Agent & { name: string }> = {};
    agents.forEach(a => { if (a.ReferenceID) map[a.ReferenceID.toLowerCase()] = { ...a, name: `${a.Firstname} ${a.Lastname}` }; });
    return map;
  }, [agents]);

  const tsmSummary = useMemo(() => {
    const tsmAgents = agents.filter(a => a.Role === "Territory Sales Manager");
    return tsmAgents.map(tsm => {
      const tsmId = tsm.ReferenceID.toLowerCase();
      const fbCompanies = Array.from(new Set(
        activities.filter(a => {
          const agent = agentMap[a.referenceid.toLowerCase()]?.TSM ?? a.tsm ?? "";
          return agent.toLowerCase() === tsmId && a.source === "Facebook Marketplace" && a.company_name;
        }).map(a => a.company_name!)
      ));
      const totalSales = activities.filter(a => {
        const agent = agentMap[a.referenceid.toLowerCase()]?.TSM ?? a.tsm ?? "";
        return agent.toLowerCase() === tsmId && a.source === "Facebook Marketplace";
      }).reduce((sum, a) => sum + (a.actual_sales ?? 0), 0);

      return { tsmId, tsmName: `${tsm.Firstname} ${tsm.Lastname}`, totalSales, accountCount: fbCompanies.length, fbCompanies };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [agents, activities, agentMap]);

  const selectedCompanies = useMemo(() => {
    if (!selectedTsm) return [];
    return activities
      .filter(a => {
        const tsmId = (agentMap[a.referenceid.toLowerCase()]?.TSM ?? a.tsm ?? "").toLowerCase();
        return tsmId === selectedTsm && a.source === "Facebook Marketplace" && a.company_name?.toLowerCase().includes(companySearch.toLowerCase());
      })
      .map(a => ({
        company: a.company_name!,
        agent: agentMap[a.referenceid.toLowerCase()]?.name ?? a.referenceid,
        contact: a.contact_person,
        remarks: a.remarks
      }));
  }, [selectedTsm, companySearch, activities, agentMap]);

  return (
    <div className="space-y-4">
      {loading && <div className="py-10 text-xs text-gray-400 text-center">Loading...</div>}
      {error && <div className="py-10 text-xs text-red-500 text-center">{error}</div>}

      {/* TSM Summary View */}
      {!selectedTsm && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white p-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">TSM</TableHead>
                <TableHead className="text-gray-500 text-right">Total Sales</TableHead>
                <TableHead className="text-gray-500 text-right">FB Marketplace Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tsmSummary.map(item => (
                <TableRow
                  key={item.tsmId}
                  className="text-xs font-mono hover:bg-gray-50/60 cursor-pointer"
                  onClick={() => setSelectedTsm(item.tsmId)}
                >
                  <TableCell className="font-semibold text-gray-700 uppercase">{item.tsmName}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">{fmtPHP(item.totalSales)}</TableCell>
                  <TableCell className="text-right text-gray-700">{item.accountCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                <TableCell className="text-gray-500">Total</TableCell>
                <TableCell className="text-right text-green-600">
                  {fmtPHP(tsmSummary.reduce((sum, tsm) => sum + tsm.totalSales, 0))}
                </TableCell>
                <TableCell className="text-right text-gray-700">
                  {tsmSummary.reduce((sum, tsm) => sum + tsm.accountCount, 0)}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {/* Companies View */}
      {selectedTsm && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs"
              onClick={() => { setSelectedTsm(null); setCompanySearch(""); }}
            >
              &larr; Back
            </button>
            <Input
              placeholder="Search company..."
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              className="text-xs w-60"
            />
          </div>
          <Table className="mt-2">
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px]">
                <TableHead className="text-gray-500">Agent</TableHead>
                <TableHead className="text-gray-500">Company Name</TableHead>
                <TableHead className="text-gray-500">Contact Person</TableHead>
                <TableHead className="text-gray-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedCompanies.length === 0 ? (
                <TableRow>
                  <TableCell className="text-gray-400 text-xs text-center py-2" colSpan={3}>
                    No companies found.
                  </TableCell>
                </TableRow>
              ) : selectedCompanies.map((c, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-gray-700 text-xs">{c.agent}</TableCell>
                  <TableCell className="text-gray-700 text-xs">{c.company}</TableCell>
                  <TableCell className="text-gray-700 text-xs capitalize">{c.contact}</TableCell>
                  <TableCell className="text-gray-700 text-xs capitalize">{c.remarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};