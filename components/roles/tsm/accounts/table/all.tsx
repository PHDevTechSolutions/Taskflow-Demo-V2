"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DownloadCloud, History, Users, ChevronLeft,
  ChevronRight, X, Search, Layers, Terminal,
} from "lucide-react";

/* ─────────────────────── Types ─────────────────────── */

interface Account {
  id: string;
  tsm: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  industry: string;
  status?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilepicture: string;
}

interface AccountsTableProps {
  posts: Account[];
  userDetails: UserDetails;
}

interface HistoryRecord {
  id?: string;
  company_name?: string;
  type_activity?: string;
  remarks?: string;
  date_created?: string;
  status?: string;
  [key: string]: any;
}

/* ─────────────────────── Design Tokens ─────────────────────── */

const TYPE_META: Record<string, { pill: string; dot: string; hex: string }> = {
  "Top 50":     { pill: "bg-amber-100 text-amber-700",     dot: "bg-amber-400",   hex: "#f59e0b" },
  "Next 30":    { pill: "bg-sky-100 text-sky-700",         dot: "bg-sky-400",     hex: "#38bdf8" },
  "Balance 20": { pill: "bg-violet-100 text-violet-700",   dot: "bg-violet-400",  hex: "#a78bfa" },
  "CSR Client": { pill: "bg-teal-100 text-teal-700",       dot: "bg-teal-400",    hex: "#2dd4bf" },
  "New Client": { pill: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", hex: "#34d399" },
  "TSA Client": { pill: "bg-rose-100 text-rose-700",       dot: "bg-rose-400",    hex: "#fb7185" },
};

const TYPE_ORDER = ["Top 50", "Next 30", "Balance 20", "CSR Client", "New Client", "TSA Client"];
const ITEMS_PER_PAGE = 20;

const typeMeta = (t: string) =>
  TYPE_META[t] ?? { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-300", hex: "#94a3b8" };

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d ?? "—"; }
};

/* ─────────────────────── Shared Atoms ─────────────────────── */

const Pill = ({ type }: { type: string }) => {
  const m = typeMeta(type);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {type}
    </span>
  );
};

const SegmentBar = ({ counts, total }: { counts: Record<string, number>; total: number }) => (
  <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-100">
    {TYPE_ORDER.filter((t) => counts[t]).map((t) => (
      <div key={t} title={`${t}: ${counts[t]}`}
        style={{ width: `${(counts[t] / total) * 100}%`, background: typeMeta(t).hex }}
        className="h-full" />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   DOWNLOAD CONSOLE  — dark terminal-style animated dialog
═══════════════════════════════════════════════════════════ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DownloadConsoleProps {
  open: boolean;
  onClose: () => void;
  rows: Account[];
  agentMap: Record<string, string>;
}

function DownloadConsole({ open, onClose, rows, agentMap }: DownloadConsoleProps) {
  const [lines, setLines] = useState<{ text: string; color: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  /* Reset + kick off animation each time the dialog opens */
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
      push('  ✓ ["Agent","Company","Contact","Phone","Email","Address","Delivery","Region","Type","Industry","Status","Created"]', "text-emerald-400");
      await sleep(180);
      push("> Processing rows…", "text-slate-500");
      await sleep(100);

      const csvLines: string[] = [
        ["Agent","Company","Contact","Phone","Email","Address","Delivery","Region","Type","Industry","Status","Created"]
          .map((h) => `"${h}"`).join(","),
      ];

      /* Log ~25 evenly-spaced sample lines so the console feels alive */
      const logEvery = Math.max(1, Math.floor(rows.length / 25));

      for (let i = 0; i < rows.length; i++) {
        if (cancelledRef.current) return;

        const a = rows[i];
        csvLines.push(
          [agentMap[a.referenceid?.toLowerCase() ?? ""] ?? "-",
           a.company_name, a.contact_person, a.contact_number,
           a.email_address, a.address, a.delivery_address, a.region,
           a.type_client, a.industry, a.status ?? "-", fmtDate(a.date_created)]
            .map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(",")
        );

        if (i % logEvery === 0) {
          const pct = Math.round(((i + 1) / rows.length) * 100);
          setProgress(pct);
          push(
            `  [${String(i + 1).padStart(5, "0")}/${rows.length}] ${(a.company_name ?? "—").slice(0, 48)}`,
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

      /* Trigger real download */
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const fname = `accounts-${new Date().toISOString().split("T")[0]}.csv`;
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      push(`> ✓ Download triggered → ${fname}`, "text-emerald-400");
      await sleep(80);
      push(`> ${rows.length} rows exported. Done.`, "text-emerald-300");
      setDone(true);
    };

    run();
    return () => { cancelledRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Auto-scroll to bottom as lines appear */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117] flex flex-col max-h-[68vh]">

        {/* ── Terminal header bar ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            {/* Traffic lights */}
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <Terminal size={12} className="text-green-400 ml-2" />
            <DialogTitle className="text-green-400 text-[11px] font-bold font-mono tracking-widest uppercase">
              export-console
            </DialogTitle>
            <DialogDescription className="sr-only">CSV download progress</DialogDescription>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress bar */}
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

        {/* ── Console output ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-0.5 min-h-[220px]">
          {lines.map((l, i) => (
            <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${l.color}`}>
              {l.text}
            </div>
          ))}

          {/* Blinking cursor while running */}
          {!done && (
            <div className="text-green-400 mt-0.5 animate-pulse select-none">█</div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Footer close button (only when done) ── */}
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

/* ─────────────────────── History Dialog ─────────────────────── */
/* (unchanged from original) */

function CompanyHistoryDialog({
  companyName, open, onClose,
  tsmReferenceId, cachedActivities, onActivitiesLoaded,
}: {
  companyName: string | null;
  open: boolean;
  onClose: () => void;
  tsmReferenceId: string;
  cachedActivities: HistoryRecord[] | null;
  onActivitiesLoaded: (a: HistoryRecord[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !tsmReferenceId || cachedActivities !== null) return;
    setLoading(true);
    fetch(`/api/reports/tsm/fetch?referenceid=${encodeURIComponent(tsmReferenceId)}`)
      .then((r) => r.ok ? r.json() : { activities: [] })
      .then((d) => onActivitiesLoaded(d.activities ?? []))
      .catch(() => onActivitiesLoaded([]))
      .finally(() => setLoading(false));
  }, [open, tsmReferenceId, cachedActivities, onActivitiesLoaded]);

  const records = useMemo(() => {
    if (!cachedActivities || !companyName) return [];
    return cachedActivities.filter(
      (r) => (r.company_name ?? "").toLowerCase() === companyName.toLowerCase()
    );
  }, [cachedActivities, companyName]);

  const grouped = useMemo(() =>
    records.reduce<Record<string, number>>((acc, r) => {
      const k = r.type_activity ?? "Other";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}), [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return records;
    return records.filter((r) =>
      (r.type_activity ?? "").toLowerCase().includes(q) ||
      (r.remarks ?? "").toLowerCase().includes(q) ||
      (r.status ?? "").toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[82vh] flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-white">
        <div className="px-6 py-5 bg-gradient-to-br from-slate-900 to-slate-700 flex items-start justify-between shrink-0">
          <div>
            <DialogTitle className="text-white text-sm font-bold tracking-wide">Activity History</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-0.5 font-medium">{companyName}</DialogDescription>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
            <X size={13} />
          </button>
        </div>

        {!loading && records.length > 0 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 shrink-0">
            <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">{records.length} total</span>
            {Object.entries(grouped).map(([type, count]) => (
              <span key={type} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-medium shadow-sm">
                {type} · <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="px-6 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Search activity, remarks, status…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Fetching activity history…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <History size={20} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium">No records found</p>
            </div>
          ) : filtered.map((r, i) => (
            <div key={r.id ?? i} className="flex gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all duration-150">
              <div className="shrink-0 pt-0.5">
                <span className="inline-block px-2 py-1 rounded-lg bg-slate-800 text-white text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                  {r.type_activity ?? "—"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 leading-snug">
                  {r.remarks ? r.remarks : <span className="text-slate-400 italic">No remarks</span>}
                </p>
                {r.status && <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{r.status}</span>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{fmtDate(r.date_created ?? "")}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Main Component ─────────────────────── */

export function AccountsTable({ posts = [], userDetails }: AccountsTableProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [mergedAgents, setMergedAgents] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTypeClient, setFilterTypeClient] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [historyCompany, setHistoryCompany] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tsmActivitiesCache, setTsmActivitiesCache] = useState<HistoryRecord[] | null>(null);

  // ── NEW: download console state ──
  const [downloadOpen, setDownloadOpen] = useState(false);

  /* ── Fetch agents ── */
  useEffect(() => {
    if (!userDetails.referenceid) return;
    setTsmActivitiesCache(null);
    fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setAgents)
      .catch(() => {});
  }, [userDetails.referenceid]);

  const agentMap = useMemo(() => {
    const m: Record<string, string> = {};
    agents.forEach((a) => {
      if (a.ReferenceID) m[a.ReferenceID.toLowerCase()] = `${a.Firstname} ${a.Lastname}`;
    });
    return m;
  }, [agents]);

  /* ── Derived ── */
  const activePosts = useMemo(() => posts.filter((p) => p.status === "Active"), [posts]);

  const groupedByAgent = useMemo(() => {
    const g: Record<string, Account[]> = {};
    activePosts.forEach((p) => {
      const name = agentMap[p.referenceid?.toLowerCase() ?? ""] ?? "Unassigned";
      if (!g[name]) g[name] = [];
      g[name].push(p);
    });
    return g;
  }, [activePosts, agentMap]);

  const totalTypeCounts = useMemo(() => {
    const t: Record<string, number> = {};
    activePosts.forEach((a) => { t[a.type_client] = (t[a.type_client] ?? 0) + 1; });
    return t;
  }, [activePosts]);

  const getMergedAccounts = useCallback(
    (name: string) => (mergedAgents[name] ?? [name]).flatMap((n) => groupedByAgent[n] ?? []),
    [mergedAgents, groupedByAgent]
  );

  const tableAccounts = useMemo(
    () => !selectedAgent ? activePosts : getMergedAccounts(selectedAgent),
    [selectedAgent, activePosts, getMergedAccounts]
  );

  const typeClientOptions = useMemo(() => {
    const s = new Set<string>();
    activePosts.forEach((a) => s.add(a.type_client));
    return TYPE_ORDER.filter((t) => s.has(t)).concat(Array.from(s).filter((t) => !TYPE_ORDER.includes(t)));
  }, [activePosts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tableAccounts.filter((a) => {
      const ms = a.company_name.toLowerCase().includes(q) || a.contact_person.toLowerCase().includes(q);
      const mt = filterTypeClient ? a.type_client === filterTypeClient : true;
      return ms && mt;
    });
  }, [tableAccounts, searchQuery, filterTypeClient]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [filteredAccounts.length, selectedAgent]);

  const visibleAgentCards = useMemo(() => {
    const kids = new Set<string>();
    Object.entries(mergedAgents).forEach(([, children]) =>
      children.slice(1).forEach((c) => kids.add(c))
    );
    return Object.keys(groupedByAgent).filter((n) => !kids.has(n));
  }, [groupedByAgent, mergedAgents]);

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <>
      {/* ── Download Console (NEW) ── */}
      <DownloadConsole
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        rows={filteredAccounts}
        agentMap={agentMap}
      />

      <CompanyHistoryDialog
        companyName={historyCompany}
        open={historyOpen}
        onClose={() => { setHistoryOpen(false); setHistoryCompany(null); }}
        tsmReferenceId={userDetails.referenceid}
        cachedActivities={tsmActivitiesCache}
        onActivitiesLoaded={(a) => setTsmActivitiesCache(a)}
      />

      <div className="flex gap-4 bg-[#F7F7F5] p-4" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* ─── LEFT SIDEBAR ─── */}
        <div className="w-56 shrink-0 space-y-2.5">

          {/* All Accounts summary card */}
          <button
            onClick={() => setSelectedAgent(null)}
            className={`w-full text-left p-4 rounded-2xl transition-all duration-200 ${
              selectedAgent === null
                ? "bg-slate-900 shadow-lg shadow-slate-900/20"
                : "bg-white hover:shadow-md shadow-sm border border-slate-100"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                selectedAgent === null ? "bg-white/10" : "bg-slate-100"
              }`}>
                <Users size={14} className={selectedAgent === null ? "text-white" : "text-slate-500"} />
              </div>
              <span className={`text-2xl font-black tabular-nums ${
                selectedAgent === null ? "text-white" : "text-slate-900"
              }`}>
                {activePosts.length}
              </span>
            </div>

            <p className={`text-[11px] font-semibold mb-2.5 ${
              selectedAgent === null ? "text-slate-400" : "text-slate-500"
            }`}>
              All Active Accounts
            </p>

            <div className="space-y-1.5">
              {TYPE_ORDER.filter((t) => totalTypeCounts[t]).map((type) => {
                const m = typeMeta(type);
                const count = totalTypeCounts[type] ?? 0;
                const pct = activePosts.length ? Math.round((count / activePosts.length) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
                    <span className={`text-[10px] flex-1 ${
                      selectedAgent === null ? "text-slate-500" : "text-slate-500"
                    }`}>{type}</span>
                    <span className={`text-[10px] font-bold tabular-nums ${
                      selectedAgent === null ? "text-slate-300" : "text-slate-700"
                    }`}>{count}</span>
                    <span className={`text-[9px] tabular-nums w-7 text-right ${
                      selectedAgent === null ? "text-slate-600" : "text-slate-400"
                    }`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </button>

          {/* Per-agent cards */}
          {visibleAgentCards.map((agentName) => {
            const mergedList = mergedAgents[agentName] ?? [agentName];
            const isMerged = mergedList.length > 1;
            const allAcc = getMergedAccounts(agentName);
            const isActive = selectedAgent === agentName;
            const typeCounts = allAcc.reduce<Record<string, number>>((acc, a) => {
              acc[a.type_client] = (acc[a.type_client] ?? 0) + 1;
              return acc;
            }, {});
            const pics = mergedList
              .map((n) => agents.find((ag) => `${ag.Firstname} ${ag.Lastname}` === n)?.profilePicture)
              .filter(Boolean) as string[];

            return (
              <div
                key={agentName}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", agentName)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const dragged = e.dataTransfer.getData("text/plain");
                  if (!dragged || dragged === agentName) return;
                  setMergedAgents((prev) => {
                    const next = { ...prev };
                    next[agentName] = Array.from(new Set([
                      ...(next[agentName] ?? [agentName]),
                      ...(next[dragged] ?? [dragged]),
                    ]));
                    delete next[dragged];
                    return next;
                  });
                  if (selectedAgent === dragged || selectedAgent === agentName) setSelectedAgent(agentName);
                }}
                onClick={() => setSelectedAgent(agentName)}
                className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-200 group ${
                  isActive
                    ? "bg-white shadow-lg shadow-slate-200/80 border border-slate-200 ring-2 ring-slate-900/5"
                    : "bg-white shadow-sm border border-slate-100 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isMerged ? (
                      <div className="flex -space-x-1.5">
                        {pics.slice(0, 3).map((pic, i) => (
                          <img key={i} src={pic} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-white" />
                        ))}
                        {pics.length > 3 && (
                          <span className="w-6 h-6 rounded-full bg-slate-200 ring-2 ring-white text-[8px] font-black text-slate-600 flex items-center justify-center">
                            +{pics.length - 3}
                          </span>
                        )}
                      </div>
                    ) : pics[0] ? (
                      <img src={pics[0]} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-slate-100" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <span className="text-[9px] font-black text-slate-600">{agentName.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[80px]">
                      {isMerged ? `${mergedList.length} agents` : agentName.split(" ")[0]}
                    </span>
                  </div>
                  <span className="text-base font-black tabular-nums text-slate-900">{allAcc.length}</span>
                </div>

                <SegmentBar counts={typeCounts} total={allAcc.length} />

                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                  {TYPE_ORDER.filter((t) => typeCounts[t]).map((t) => (
                    <span key={t} className="text-[9px] text-slate-500">
                      <b className="text-slate-700">{typeCounts[t]}</b> {t}
                    </span>
                  ))}
                </div>

                {isMerged && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1 items-center">
                    {mergedList.map((n) => (
                      <span key={n} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">
                        {n.split(" ")[0]}
                      </span>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMergedAgents((prev) => { const n = { ...prev }; delete n[agentName]; return n; });
                        if (selectedAgent === agentName) setSelectedAgent(null);
                      }}
                      className="ml-auto text-[9px] text-rose-500 hover:text-rose-700 font-semibold transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}

                <div className="hidden group-hover:flex absolute inset-x-0 bottom-2 justify-center pointer-events-none">
                  <span className="flex items-center gap-1 text-[9px] text-slate-400 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-slate-200">
                    <Layers size={9} /> drag to merge
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── MAIN TABLE PANEL ─── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-0">

          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedAgent ?? "All Active Accounts"}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filteredAccounts.length} records
                  {filterTypeClient && (
                    <> · <span className="font-semibold text-slate-500">{filterTypeClient}</span></>
                  )}
                </p>
              </div>

              {/* ── Export button now opens the animated console ── */}
              <button
                onClick={() => { if (filteredAccounts.length) setDownloadOpen(true); }}
                disabled={!filteredAccounts.length}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors shadow-sm"
              >
                <DownloadCloud size={12} />
                Export CSV
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-slate-400 transition-colors">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by company or contact…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                )}
              </div>
              <select
                value={filterTypeClient}
                onChange={(e) => setFilterTypeClient(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-600 outline-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="">All Types</option>
                {typeClientOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50 border-b border-slate-100">
                  {["Company", "Contact", "Phone", "Email", "Region", "Type", "Industry", "Created", ""].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 px-4 first:pl-5 whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <Users size={18} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">No accounts found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedAccounts.map((account, idx) => (
                  <TableRow
                    key={account.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${
                      idx % 2 !== 0 ? "bg-slate-50/30" : ""
                    }`}
                  >
                    <TableCell className="py-3 px-4 pl-5 font-semibold text-xs text-slate-900 max-w-[150px]">
                      <span className="truncate block">{account.company_name}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-slate-600 capitalize max-w-[110px]">
                      <span className="truncate block">{account.contact_person}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {account.contact_number}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-slate-500 max-w-[130px]">
                      <span className="truncate block">{account.email_address}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {account.region}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Pill type={account.type_client} />
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-slate-500 max-w-[110px]">
                      <span className="truncate block">{account.industry}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                      {fmtDate(account.date_created)}
                    </TableCell>
                    <TableCell className="py-3 px-4 pr-5">
                      <button
                        onClick={() => {
                          setHistoryCompany(account.company_name);
                          setHistoryOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-semibold transition-all whitespace-nowrap"
                      >
                        <History size={11} />
                        History
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <p className="text-[11px] text-slate-400 tabular-nums">
              Showing{" "}
              <span className="font-semibold text-slate-600">
                {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-600">{filteredAccounts.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft size={13} className="text-slate-600" />
              </button>
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight size={13} className="text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}