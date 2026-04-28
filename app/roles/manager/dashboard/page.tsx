"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCcw, Loader2 } from "lucide-react";
import { sileo } from "sileo";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// --- Types ---

interface Activity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

interface ClientSegments {
  top50: number;
  next30: number;
  balance20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  outbound: number;
}

interface Denominators {
  total: number;
  top50: number;
  next30: number;
  bal20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  daily: number;
  weekly: number;
  monthly: number;
}

interface TsmEntry {
  referenceid: string;
  firstname: string;
  lastname: string;
}

// --- Helpers ---

const formatHoursToHMS = (hours: number): string => {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

type TimeByActivity = Record<string, number>;

const computeTimeByActivity = (activities: any[]): TimeByActivity =>
  activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;
    const start = new Date(act.start_date).getTime();
    const end = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;
    acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
    return acc;
  }, {} as TimeByActivity);

const isOutboundTouchbase = (a: any): boolean =>
  a.source === "Outbound - Touchbase" && a.call_status === "Successful";

const getFixedCount = (refId: string, date: Date): number => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const feb2026: Record<string, number> = {
    "RT-NCR-815758": 11, "MF-PH-840897": 7, "AB-NCR-288130": 11,
    "AS-NCR-146592": 4, "MP-CDO-613398": 4, "JG-NCR-713768": 1, "JM-CBU-702043": 3,
  };
  const marchOnwards: Record<string, number> = {
    "RT-NCR-815758": 12, "MF-PH-840897": 5, "AB-NCR-288130": 11,
    "AS-NCR-146592": 4, "MP-CDO-613398": 4, "JG-NCR-713768": 1, "JM-CBU-702043": 2,
  };
  if (year === 2026 && month === 2) return feb2026[refId] ?? 0;
  if (year > 2026 || (year === 2026 && month >= 3)) return marchOnwards[refId] ?? 0;
  return 0;
};

// --- Sub-components ---

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
    <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
    <span className="text-[11px] font-bold text-gray-800">{value}</span>
  </div>
);

const SectionCard = ({
  title, badge, children, accent,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) => (
  <li className={`bg-white border border-gray-200 shadow-sm overflow-hidden${accent ? ` border-l-4 ${accent}` : ""}`}>
    <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">{title}</span>
      {badge}
    </div>
    <div className="p-3">{children}</div>
  </li>
);

// --- Coverage Dialog ---

function CoverageDialog({
  coverageDialogSource,
  setCoverageDialogSource,
  coveredAccounts,
  uncoveredAccounts,
}: {
  coverageDialogSource: "covered" | "uncovered" | null;
  setCoverageDialogSource: (v: "covered" | "uncovered" | null) => void;
  coveredAccounts: Activity[];
  uncoveredAccounts: Activity[];
}) {
  const isCovered = coverageDialogSource === "covered";
  const isUncovered = coverageDialogSource === "uncovered";
  const dialogOpen = isCovered || isUncovered;
  const list = isCovered ? coveredAccounts : uncoveredAccounts;

  const typeLabel = (normalized: string): string => {
    const map: Record<string, string> = {
      top50: "Top 50", next30: "Next 30", balance20: "Balance 20",
      csrclient: "CSR Client", newclient: "New Client", tsaclient: "TSA Client",
    };
    return map[normalized] ?? normalized;
  };

  const typeColors: Record<string, string> = {
    top50: "bg-amber-100 text-amber-700 border-amber-200",
    next30: "bg-blue-100 text-blue-700 border-blue-200",
    balance20: "bg-violet-100 text-violet-700 border-violet-200",
    newclient: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tsaclient: "bg-rose-100 text-rose-700 border-rose-200",
    csrclient: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const pillColor = (t: string) => typeColors[t] ?? "bg-indigo-50 text-indigo-600 border-indigo-200";

  return (
    <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setCoverageDialogSource(null); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
              {isCovered ? "Covered Accounts" : "Not Reached Accounts"}
              <span className="ml-2 text-gray-400 font-normal">{list.length}</span>
            </DialogTitle>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setCoverageDialogSource("covered")}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isCovered ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                With Activity · {coveredAccounts.length}
              </button>
              <button
                onClick={() => setCoverageDialogSource("uncovered")}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isUncovered ? "bg-amber-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                No Activity · {uncoveredAccounts.length}
              </button>
            </div>
          </div>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
            {isCovered ? "No accounts reached this month." : "All accounts have been reached this month."}
          </p>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[55%]">Company</th>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[45%]">Type</th>
                </tr>
              </thead>
              <tbody>
                {list.map((acc, i) => (
                  <tr key={`${acc.account_reference_number}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                      <span className="block" title={acc.company_name || "—"}>{acc.company_name || "—"}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${pillColor(acc.type_client ?? "")}`}>
                        {typeLabel(acc.type_client ?? "—")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
