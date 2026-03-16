"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Terminal, X, Search, History } from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────── */

interface Account {
  id: string;
  tsm: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address?: string;
  delivery_address?: string;
  region: string;
  industry: string;
  status?: string;
}

interface Activity {
  id?: string;
  company_name?: string;
  type_activity?: string;
  remarks?: string;
  status?: string;
  date_created?: string;
}

interface UserDetails {
  referenceid: string;
  firstname: string;
  lastname: string;
  tsm: string;
  manager: string;
  profilepicture: string;
}

interface AccountsTableProps {
  posts: Account[];
  userDetails: UserDetails;
}

const ITEMS_PER_PAGE = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (s: string) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString();
};

/* ─── Stat Card ───────────────────────────────────────────────────── */

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div
      className="relative flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${accent}, transparent 70%)` }}
      />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
    </div>
  );
}

/* ─── Terminal Export Dialog ──────────────────────────────────────── */

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  rows: Account[];
  agentMap: Record<string, string>;
}

function ExportDialog({ open, onClose, rows, agentMap }: ExportDialogProps) {
  const [lines, setLines] = useState<{ text: string; color: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    setLines([]);
    setProgress(0);
    setDone(false);
    cancelledRef.current = false;

    const push = (text: string, color = "text-green-400") => {
      if (cancelledRef.current) return;
      setLines((l) => [...l, { text, color }]);
    };

    const run = async () => {
      push("> Initializing export…", "text-slate-500");
      await sleep(250);
      push(`> Total records queued: ${rows.length}`, "text-cyan-400");
      await sleep(180);
      push("> Building CSV headers…", "text-slate-500");
      await sleep(120);
      push('  ✓ ["Agent","Company","Contact","Phone","Email","Region","Type","Industry","Status","Created"]', "text-emerald-400");
      await sleep(180);
      push("> Processing rows…", "text-slate-500");
      await sleep(100);

      const headers = ["Agent", "Company", "Contact", "Phone", "Email", "Address", "Delivery", "Region", "Type", "Industry", "Status", "Created"];
      const csvLines: string[] = [headers.map((h) => `"${h}"`).join(",")];
      const logEvery = Math.max(1, Math.floor(rows.length / 25));

      for (let i = 0; i < rows.length; i++) {
        if (cancelledRef.current) return;
        const a = rows[i];
        csvLines.push(
          [
            agentMap[a.referenceid?.toLowerCase() ?? ""] ?? "-",
            a.company_name, a.contact_person, a.contact_number,
            a.email_address, a.address ?? "", a.delivery_address ?? "",
            a.region, a.type_client, a.industry,
            a.status ?? "-", fmtDate(a.date_created),
          ].map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(",")
        );
        if (i % logEvery === 0) {
          const pct = Math.round(((i + 1) / rows.length) * 100);
          setProgress(pct);
          push(
            `  [${String(i + 1).padStart(5, "0")}/${rows.length}] ${(a.company_name ?? "—").slice(0, 52)}`,
            "text-slate-300"
          );
          await sleep(28);
        }
      }

      if (cancelledRef.current) return;
      setProgress(100);
      push(`> Serialized ${rows.length} rows.`, "text-slate-500");
      await sleep(150);
      push("> Writing Blob…", "text-slate-500");
      await sleep(120);

      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fname = `accounts-${new Date().toISOString().split("T")[0]}.csv`;
      link.href = url;
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      push(`> ✓ Download triggered → ${fname}`, "text-emerald-400");
      await sleep(80);
      push(`> ${rows.length} rows exported. Done.`, "text-emerald-300");
      setDone(true);
    };

    run();
    return () => { cancelledRef.current = true; };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { cancelledRef.current = true; onClose(); } }}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117] flex flex-col max-h-[68vh]">

        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <Terminal size={12} className="text-green-400 ml-2" />
            <DialogTitle className="text-green-400 text-[11px] font-bold font-mono tracking-widest uppercase">
              export-console
            </DialogTitle>
            <DialogDescription className="sr-only">CSV export progress console</DialogDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-28 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 tabular-nums w-8 text-right">{progress}%</span>
            </div>
            {done && (
              <button
                onClick={onClose}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Console output */}
        <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-0.5 min-h-[220px]">
          {lines.map((l, i) => (
            <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${l.color}`}>
              {l.text}
            </div>
          ))}
          {!done && (
            <div className="text-green-400 mt-0.5 animate-pulse select-none">█</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {done && (
          <div className="px-4 py-3 bg-[#161b22] border-t border-white/5 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-bold font-mono tracking-wide transition-colors"
            >
              ✓ Close Console
            </button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

/* ─── Activity History Dialog ─────────────────────────────────────── */

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  companyName: string | null;
  loading: boolean;
  records: Activity[];
}

function HistoryDialog({ open, onClose, companyName, loading, records }: HistoryDialogProps) {
  const [search, setSearch] = useState("");

  useEffect(() => { if (!open) setSearch(""); }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        (r.type_activity ?? "").toLowerCase().includes(q) ||
        (r.remarks ?? "").toLowerCase().includes(q) ||
        (r.status ?? "").toLowerCase().includes(q)
    );
  }, [search, records]);

  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    records.forEach((r) => {
      const t = r.type_activity ?? "Other";
      g[t] = (g[t] ?? 0) + 1;
    });
    return g;
  }, [records]);

  const typeStyles: Record<string, string> = {
    Call: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    Email: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    Meeting: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    Demo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    Proposal: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  };
  const getTypeStyle = (type?: string) =>
    typeStyles[type ?? ""] ?? "bg-slate-700/60 text-slate-300 border-slate-600/30";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[82vh] flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117]">

        {/* Header */}
        <div className="px-6 py-5 bg-[#161b22] border-b border-white/5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="ml-1">
              <DialogTitle className="text-white text-[11px] font-bold font-mono tracking-widest uppercase">
                activity_history
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-[10px] mt-0.5 font-mono">
                {companyName}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5"
          >
            <X size={12} />
          </button>
        </div>

        {/* Summary pills */}
        {!loading && records.length > 0 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-white/5 bg-[#161b22]/50 shrink-0">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold font-mono border border-white/10">
              {records.length} records
            </span>
            {Object.entries(grouped).map(([type, count]) => (
              <span
                key={type}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium border ${getTypeStyle(type)}`}
              >
                {type} · <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search activity, remarks, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-300 placeholder-slate-600 font-mono"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-400 transition-colors">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Records list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Fetching records…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <History size={20} className="text-slate-600" />
              </div>
              <p className="text-xs text-slate-600 font-mono">no records found</p>
            </div>
          ) : (
            filtered.map((r, i) => (
              <div
                key={r.id ?? i}
                className="flex gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all duration-150 group"
              >
                {/* Badge */}
                <div className="shrink-0 pt-0.5">
                  <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide whitespace-nowrap border font-mono ${getTypeStyle(r.type_activity)}`}>
                    {r.type_activity ?? "—"}
                  </span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-snug font-mono uppercase">
                    {r.remarks
                      ? r.remarks
                      : <span className="text-slate-600 italic">no remarks</span>}
                  </p>
                  {r.status && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      status: {r.status}
                    </span>
                  )}
                </div>
                {/* Date */}
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap font-mono group-hover:text-slate-500 transition-colors">
                    {fmtDate(r.date_created ?? "")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */

export function AccountsTable({ posts, userDetails }: AccountsTableProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  /* History */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCompany, setHistoryCompany] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* Export */
  const [exportOpen, setExportOpen] = useState(false);

  /* ─── Fetch users ─── */
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => r.json())
      .then((d) => setAgents(d ?? []))
      .catch(() => setAgents([]));
  }, [userDetails.referenceid]);

  /* ─── Agent map ─── */
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => {
      if (a.ReferenceID)
        map[a.ReferenceID.toLowerCase()] = `${a.Firstname} ${a.Lastname}`;
    });
    return map;
  }, [agents]);

  /* ─── Active accounts ─── */
  const activeAccounts = useMemo(
    () => posts.filter((a) => a.status?.toLowerCase() === "active"),
    [posts]
  );

  /* ─── Unique owners ─── */
  const ownerOptions = useMemo(() => {
    const ids = [...new Set(
      activeAccounts.map((a) => a.referenceid?.toLowerCase()).filter(Boolean)
    )];
    return ids.map((id) => ({ value: id, label: agentMap[id] ?? id }));
  }, [activeAccounts, agentMap]);

  /* ─── type_client counts ─── */
  const typeClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeAccounts.forEach((a) => {
      const t = a.type_client ?? "Unknown";
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [activeAccounts]);

  /* ─── Filtered accounts ─── */
  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase();
    return activeAccounts.filter((a) => {
      const matchSearch =
        a.company_name.toLowerCase().includes(q) ||
        a.contact_person.toLowerCase().includes(q) ||
        a.email_address.toLowerCase().includes(q);
      const matchOwner =
        ownerFilter === "all" || a.referenceid?.toLowerCase() === ownerFilter;
      return matchSearch && matchOwner;
    });
  }, [search, ownerFilter, activeAccounts]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  useEffect(() => setCurrentPage(1), [search, ownerFilter]);

  /* ─── Fetch history ─── */
  const openHistory = async (companyName: string) => {
    setHistoryCompany(companyName);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/reports/tsm/fetch?referenceid=${encodeURIComponent(userDetails.referenceid)}`
      );
      const data = await res.json();
      const records = (data.activities ?? data ?? []).filter(
        (a: any) => (a.company_name ?? "").toLowerCase() === companyName.toLowerCase()
      );
      setActivities(records);
    } catch {
      setActivities([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  /* ─── Accent colors ─── */
  const accentColors = [
    "#6366f1", "#f59e0b", "#10b981", "#ef4444",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  ];

  /* ──────────────────────────────────────── */

  return (
    <>
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={filteredAccounts}
        agentMap={agentMap}
      />

      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        companyName={historyCompany}
        loading={loadingHistory}
        records={activities}
      />

      <div className="space-y-5">

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatCard label="Total Accounts" value={activeAccounts.length} accent="#1e293b" />
          {typeClientCounts.map(([type, count], i) => (
            <StatCard key={type} label={type} value={count} accent={accentColors[i % accentColors.length]} />
          ))}
        </div>

        {/* ── TABLE CARD ── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3 bg-gray-50/60">
            <h2 className="text-sm font-semibold text-gray-700 mr-auto">
              Company Accounts
              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 border border-indigo-100">
                {filteredAccounts.length}
              </span>
            </h2>

            {/* Owner filter */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
            >
              <option value="all">All Owners</option>
              {ownerOptions.map((o) => (
                <option className="capitalize" key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search company, contact, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded-lg pl-8 pr-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
              />
            </div>

            {/* Export — terminal style button */}
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#161b22] px-3 py-1.5 text-xs font-bold font-mono text-black hover:text-white border border-green-500/20 transition-colors shadow-sm"
            >
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="overflow-auto p-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-100">
                  {["Owner", "Actions", "Company", "Contact", "Phone", "Email", "Region", "Type", "Industry", "Date"].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-14 text-sm text-gray-400">
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAccounts.map((account) => (
                    <TableRow key={account.id} className="hover:bg-indigo-50/20 transition-colors group">

                      <TableCell className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {agentMap[account.referenceid?.toLowerCase()] ?? (
                          <span className="text-gray-300 italic text-[11px]">Unassigned</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <button
                          onClick={() => openHistory(account.company_name)}
                          className="flex items-center gap-1 text-[11px] font-mono font-semibold text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap"
                        >
                          <History size={11} />
                          history
                        </button>
                      </TableCell>

                      <TableCell className="font-semibold text-gray-800 whitespace-nowrap text-sm">
                        {account.company_name}
                      </TableCell>

                      <TableCell className="text-gray-500 whitespace-nowrap text-xs">
                        {account.contact_person}
                      </TableCell>

                      <TableCell className="text-gray-500 whitespace-nowrap text-xs">
                        {account.contact_number}
                      </TableCell>

                      <TableCell className="text-gray-500 text-xs">
                        {account.email_address}
                      </TableCell>

                      <TableCell className="text-gray-500 whitespace-nowrap text-xs">
                        {account.region}
                      </TableCell>

                      <TableCell>
                        <span className="inline-block rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 whitespace-nowrap uppercase tracking-wide">
                          {account.type_client}
                        </span>
                      </TableCell>

                      <TableCell className="text-gray-500 whitespace-nowrap text-xs">
                        {account.industry}
                      </TableCell>

                      <TableCell className="text-gray-400 text-[11px] whitespace-nowrap tabular-nums">
                        {fmtDate(account.date_created)}
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-gray-700">
                {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700">{filteredAccounts.length}</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ← Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                return page <= totalPages ? (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-2.5 py-1 transition-colors font-medium shadow-sm ${page === currentPage
                      ? "bg-indigo-600 text-white"
                      : "border hover:bg-white"
                      }`}
                  >
                    {page}
                  </button>
                ) : null;
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Next →
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}