"use client";

import React, { useEffect, useState, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { NewTask } from "@/components/roles/tsa/activity/planner/new-task/new";
import { Progress } from "@/components/roles/tsa/activity/planner/progress/progress";
import { Scheduled } from "@/components/roles/tsa/activity/planner/scheduled/scheduled";
import { Completed } from "@/components/roles/tsa/activity/planner/completed/completed";
import { Delivered } from "@/components/roles/tsa/activity/planner/delivered/delivered";
import { Done } from "@/components/roles/tsa/activity/planner/done/done";
import { Overdue } from "@/components/roles/tsa/activity/planner/overdue/overdue";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  PlusCircle, Loader2, Calendar, CheckCircle, ClipboardCheck,
  AlertCircle, ChevronDown, ChevronRight, Bell, CheckCircle2,
  XCircle, Eye, Download, Trash2, PackageCheck, Clock,
} from "lucide-react";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Account {
  id: string; referenceid: string; company_name: string; type_client: string;
  date_created: string; date_updated: string; contact_person: string;
  contact_number: string; email_address: string; address: string;
  delivery_address: string; region: string; industry: string;
  status?: string; company_group?: string;
}

interface SupervisorDetails {
  firstname: string; lastname: string; email: string;
  profilePicture: string; signatureImage: string; contact: string;
}

interface UserDetails {
  referenceid: string; tsm: string; manager: string; target_quota: string;
  firstname: string; lastname: string; email: string; contact: string;
  tsmname: string; managername: string; signature: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
}

interface QuotationNotification {
  id: number;
  activity_reference_number: string;
  company_name: string;
  quotation_number?: string;
  quotation_amount?: number;
  tsm_approved_status: string;
  tsm_approval_date?: string;
  manager_approval_date?: string;
  tsm_remarks?: string;
  manager_remarks?: string;
  date_updated?: string;
  date_created: string;
}

interface SPFNotification {
  id: number;
  spf_number: string;
  company_name: string;
  activity_reference_number: string;
  date_created: string;
  date_updated?: string;
  status: string;
  referenceid: string;
}

const REVISED_QUOTATION_ROUTE = "/roles/tsa/activity/revised-quotation";
const COLLAPSE_KEY = "activity_planner_collapsible_state";

// ─── Clear Cache Dialog ───────────────────────────────────────────────────────

function ClearCacheDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white border border-gray-200 shadow-xl rounded-none p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">Clear Cache</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          This will clear all browser cache, local storage, and service workers. The page will reload automatically.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 rounded-none text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="flex-1 h-8 rounded-none text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { onClose(); onConfirm(); }}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Now
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">
          Press <kbd className="px-1 py-0.5 border border-gray-300 rounded text-[9px] font-mono">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

// ─── Notification Dropdown ────────────────────────────────────────────────────

function NotificationDropdown({ referenceid, userId }: { referenceid: string; userId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<(QuotationNotification | SPFNotification)[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);
  const READ_KEY = `notif_read_${referenceid}`;

  useEffect(() => {
    if (!referenceid) return;
    try {
      const saved = localStorage.getItem(READ_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch { localStorage.removeItem(READ_KEY); }
  }, [referenceid]);

  const playSound = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/alert-notification.mp3");
        audioRef.current.volume = 0.6;
        audioRef.current.load();
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => console.error("Failed to play notification sound:", err));
    } catch (err) { console.error("Error in playSound:", err); }
  };

  const fetchNotifications = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    try {
      const [quotationRes, spfRes] = await Promise.all([
        fetch(`/api/activity/tsa/quotation/fetch?referenceid=${referenceid}`),
        fetch(`/api/activity/tsa/spf/notifications?referenceid=${referenceid}`)
      ]);

      let filteredQuotations: QuotationNotification[] = [];
      if (quotationRes.ok) {
        const d = await quotationRes.json();
        filteredQuotations = (d.activities || []).filter(
          (a: QuotationNotification) => a.tsm_approved_status === "Approved" || a.tsm_approved_status === "Decline"
        );
      }

      let spfNotifications: SPFNotification[] = [];
      if (spfRes.ok) {
        const d = await spfRes.json();
        spfNotifications = d.notifications || [];
      }

      const all = [...filteredQuotations, ...spfNotifications].sort((a, b) => {
        const dateA = new Date((a as any).manager_approval_date ?? (a as any).tsm_approval_date ?? (a as any).date_updated ?? (a as any).date_created).getTime();
        const dateB = new Date((b as any).manager_approval_date ?? (b as any).tsm_approval_date ?? (b as any).date_updated ?? (b as any).date_created).getTime();
        return dateB - dateA;
      });

      const newIds = new Set<number>(all.map((n) => n.id));
      if (!isFirstLoad.current) {
        if ([...newIds].some((id) => !prevIdsRef.current.has(id))) playSound();
      }
      prevIdsRef.current = newIds;
      isFirstLoad.current = false;
      setNotifications(all);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length > 0) {
      const allIds = new Set(notifications.map((n) => n.id));
      setReadIds(allIds);
      try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(allIds))); } catch { }
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return null;
    return `₱${parseFloat(String(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const buildUrl = (notif: QuotationNotification, action?: "preview" | "download") => {
    const params: Record<string, string> = { id: userId, highlight: notif.quotation_number || notif.activity_reference_number, openEdit: notif.activity_reference_number };
    if (action) params.action = action;
    return `${REVISED_QUOTATION_ROUTE}?${new URLSearchParams(params).toString()}`;
  };

  const handleNotifClick = (notif: QuotationNotification) => {
    setOpen(false);
    router.push(`${REVISED_QUOTATION_ROUTE}?${new URLSearchParams({ id: userId, highlight: notif.quotation_number || notif.activity_reference_number }).toString()}`);
  };

  const handleSPFNotifClick = (notif: SPFNotification) => {
    setOpen(false);
    router.push(`/roles/tsa/activity/spf?${new URLSearchParams({ id: userId, highlight: notif.spf_number }).toString()}`);
  };

  const handleViewPdf = (e: React.MouseEvent, notif: QuotationNotification) => { e.stopPropagation(); setOpen(false); router.push(buildUrl(notif, "preview")); };
  const handleDownloadPdf = (e: React.MouseEvent, notif: QuotationNotification) => { e.stopPropagation(); setOpen(false); router.push(buildUrl(notif, "download")); };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors focus:outline-none">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] max-h-[520px] overflow-y-auto rounded-none p-0">
        <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b flex items-center justify-between">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {notifications.length > 0 && <Badge variant="secondary" className="text-xs rounded-sm">{notifications.length} total</Badge>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground text-xs gap-1">
            <Bell className="w-6 h-6 opacity-30" /><span>No notifications</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => {
              const isQuotation = "quotation_number" in notif;
              const isSPF = "spf_number" in notif;
              const isUnread = !readIds.has(notif.id);

              if (isQuotation) {
                const q = notif as QuotationNotification;
                const isApproved = q.tsm_approved_status === "Approved";
                const approvedByManager = !!q.manager_approval_date;
                return (
                  <div key={q.id} className={`px-4 py-3 text-xs flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent ${isUnread ? "bg-muted/40" : "bg-background"}`} onClick={() => handleNotifClick(q)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-tight flex-1">{q.company_name}</span>
                      <span className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-semibold ${isApproved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {isApproved ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {q.tsm_approved_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                      {q.quotation_number && <span className="uppercase font-mono">{q.quotation_number}</span>}
                      {formatAmount(q.quotation_amount) && <span className="font-semibold text-foreground">{formatAmount(q.quotation_amount)}</span>}
                    </div>
                    {q.tsm_approval_date && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-green-600" />
                        <span><span className="font-medium text-foreground">TSM {isApproved ? "Approved" : "Declined"}:</span> {formatDate(q.tsm_approval_date)}</span>
                      </div>
                    )}
                    {approvedByManager && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-blue-600" />
                        <span><span className="font-medium text-foreground">{isApproved ? "Approved" : "Declined"} by Manager:</span> {formatDate(q.manager_approval_date)}</span>
                      </div>
                    )}
                    {q.tsm_remarks && <p className="text-muted-foreground italic">TSM: &ldquo;{q.tsm_remarks}&rdquo;</p>}
                    {q.manager_remarks && <p className="text-muted-foreground italic">Manager: &ldquo;{q.manager_remarks}&rdquo;</p>}
                    {isApproved && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] rounded-none flex items-center gap-1 cursor-pointer" onClick={(e) => handleViewPdf(e, q)}>
                          <Eye className="w-3 h-3" /> View PDF
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] rounded-none flex items-center gap-1 cursor-pointer" onClick={(e) => handleDownloadPdf(e, q)}>
                          <Download className="w-3 h-3" /> Download PDF
                        </Button>
                      </div>
                    )}
                    {isUnread && <div className="flex justify-end mt-0.5"><span className="w-2 h-2 rounded-full bg-blue-500" /></div>}
                  </div>
                );
              } else if (isSPF) {
                const s = notif as SPFNotification;
                return (
                  <div key={s.id} className={`px-4 py-3 text-xs flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent ${isUnread ? "bg-muted/40" : "bg-background"}`} onClick={() => handleSPFNotifClick(s)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-tight flex-1">{s.company_name}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3" /> SPF Approved
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                      {s.spf_number && <span className="uppercase font-mono">{s.spf_number}</span>}
                      <span className="font-medium text-foreground">Ready For Quotation</span>
                    </div>
                    {s.date_updated && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-blue-600" />
                        <span><span className="font-medium text-foreground">Approved By Procurement:</span> {formatDate(s.date_updated)}</span>
                      </div>
                    )}
                    {isUnread && <div className="flex justify-end mt-0.5"><span className="w-2 h-2 rounded-full bg-blue-500" /></div>}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Collapsible Card ─────────────────────────────────────────────────────────

function PlannerCard({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  countColor = "text-red-600",
  className = "",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  countColor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`rounded-none transition-all duration-300 ${className}`}>
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
            <span className={`text-xs font-bold ${countColor}`}>({count})</span>
          </div>
          <span className="text-xs rounded-sm border p-1">
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 p-0"
          }`}
      >
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "", target_quota: "",
    firstname: "", lastname: "", email: "", contact: "",
    tsmname: "", managername: "", signature: "",
    managerDetails: null, tsmDetails: null,
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>(undefined);

  const [collapseState, setCollapseState] = useState({
    inProgress: true, scheduled: true, delivered: true,
    completed: true, done: true, overdue: true,
  });

  const [progressCount, setProgressCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const [clearCacheOpen, setClearCacheOpen] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  // ── Alt + Ctrl + C shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); setClearCacheOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      const idbWithList = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
      if (typeof idbWithList.databases === "function") {
        const dbs = await idbWithList.databases();
        await Promise.all(
          dbs.map((db) => db.name).filter((n): n is string => Boolean(n)).map(
            (name) => new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
          )
        );
      }
      sileo.success({ title: "Cache Cleared", description: "Browser cache and local app storage were cleared. Reloading...", duration: 2000, position: "top-right" });
      setTimeout(() => window.location.reload(), 300);
    } catch {
      sileo.error({ title: "Failed", description: "Unable to fully clear browser cache.", duration: 3000, position: "top-right" });
    }
  }, []);

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const fetchUserData = useCallback(async () => {
    if (!userId) { setLoadingUser(false); return; }
    setError(null); setLoadingUser(true);
    try {
      const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error("Failed to fetch user data");
      const data = await response.json();
      setUserDetails({
        referenceid: data.ReferenceID || "",
        tsm: data.TSM || "",
        manager: data.Manager || "",
        target_quota: data.TargetQuota || "",
        firstname: data.Firstname || "",
        lastname: data.Lastname || "",
        email: data.Email || "",
        contact: data.ContactNumber || "",
        tsmname: data.TSMName || "",
        managername: data.ManagerName || "",
        signature: data.signatureImage || "",
        managerDetails: data.managerDetails || null,
        tsmDetails: data.tsmDetails || null,
      });
    } catch (err) {
      console.error("User fetch error:", err);
      sileo.error({ title: "Connection Error", description: "Unable to retrieve user details. Please check your connection.", duration: 4000, position: "top-center", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setLoadingUser(false);
    }
  }, [userId]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  const refreshAccounts = useCallback(async () => {
    if (!userDetails.referenceid) return;
    try {
      const response = await fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setPosts(data.data || []);
    } catch (err) {
      console.error("Refresh accounts error:", err);
      sileo.error({ title: "Sync Error", description: "Failed to refresh account data.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  }, [userDetails.referenceid]);

  const handleSaveAccount = useCallback(async (data: Account & UserDetails) => {
    const payload = {
      ...data,
      contactperson: Array.isArray(data.contact_person) ? data.contact_person : typeof data.contact_person === "string" ? data.contact_person.split(",").map((v) => v.trim()) : [],
      contactnumber: Array.isArray(data.contact_number) ? data.contact_number : typeof data.contact_number === "string" ? data.contact_number.split(",").map((v) => v.trim()) : [],
      emailaddress: Array.isArray(data.email_address) ? data.email_address : typeof data.email_address === "string" ? data.email_address.split(",").map((v) => v.trim()) : [],
    };
    try {
      const isEdit = Boolean(payload.id);
      const response = await fetch(isEdit ? "/api/com-edit-account" : "/api/com-save-account", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save account");
      sileo.success({ title: "Success", description: `Account ${isEdit ? "updated" : "created"} successfully!`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      await refreshAccounts();
    } catch (err) {
      console.error("Save account error:", err);
      sileo.error({ title: "Failed", description: "Failed to save account.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  }, [refreshAccounts]);

  const toggleCollapse = useCallback((key: keyof typeof collapseState) => {
    setCollapseState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved) {
      try { setCollapseState((prev) => ({ ...prev, ...JSON.parse(saved) })); }
      catch { localStorage.removeItem(COLLAPSE_KEY); }
    }
  }, []);

  // ── Shared props builder ──────────────────────────────────────────────────
  const sharedProps = {
    referenceid: userDetails.referenceid,
    firstname: userDetails.firstname,
    lastname: userDetails.lastname,
    email: userDetails.email,
    contact: userDetails.contact,
    tsmname: userDetails.tsmname,
    managername: userDetails.managername,
    target_quota: userDetails.target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
    managerDetails: userDetails.managerDetails ?? null,
    tsmDetails: userDetails.tsmDetails ?? null,
    signature: userDetails.signature,
  };

  return (
    <>
      <ClearCacheDialog open={clearCacheOpen} onClose={() => setClearCacheOpen(false)} onConfirm={handleClearCache} />

      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                      Activity Planners
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2 px-3">
              {userDetails.referenceid && (
                <NotificationDropdown referenceid={userDetails.referenceid} userId={userId ?? ""} />
              )}
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingUser ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                  <p className="text-xs text-zinc-500 animate-pulse font-mono uppercase tracking-widest">
                    Synchronizing Data...
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* ── New Task (full width) ── */}
                <Card className="rounded-none">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PlusCircle className="w-5 h-5" /><span>New Task</span>
                    </CardTitle>
                    <CardDescription>
                      Manage your latest Endorsed Tickets and Outbound Calls efficiently. Stay updated with pending tasks and streamline your workflow.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NewTask
                      referenceid={userDetails.referenceid}
                      userDetails={userDetails}
                      onSaveAccountAction={handleSaveAccount}
                      onRefreshAccountsAction={refreshAccounts}
                    />
                  </CardContent>
                </Card>

                {/* ── In Progress ── */}
                <PlannerCard
                  title="In Progress"
                  icon={<Loader2 className="w-4 h-4" />}
                  count={progressCount}
                  isOpen={collapseState.inProgress}
                  onToggle={() => toggleCollapse("inProgress")}
                >
                  <Progress {...sharedProps} onCountChange={setProgressCount} />
                </PlannerCard>

                {/* ── Scheduled ── */}
                <PlannerCard
                  title="Scheduled"
                  icon={<Calendar className="w-4 h-4" />}
                  count={scheduledCount}
                  isOpen={collapseState.scheduled}
                  onToggle={() => toggleCollapse("scheduled")}
                >
                  <Scheduled {...sharedProps} tsm={userDetails.tsm} onCountChange={setScheduledCount} />
                </PlannerCard>

                {/* ── Completed ── */}
                <PlannerCard
                  title="Completed"
                  icon={<CheckCircle className="w-4 h-4" />}
                  count={completedCount}
                  isOpen={collapseState.completed}
                  onToggle={() => toggleCollapse("completed")}
                >
                  <Completed {...sharedProps} onCountChange={setCompletedCount} />
                </PlannerCard>

                {/* ── Delivered ── 
                <PlannerCard
                  title="Delivered"
                  icon={<PackageCheck className="w-4 h-4" />}
                  count={deliveredCount}
                  isOpen={collapseState.delivered}
                  onToggle={() => toggleCollapse("delivered")}
                >
                  <Delivered {...sharedProps} onCountChange={setDeliveredCount} />
                </PlannerCard>*/}


                {/* ── Pending Task ── 
                <PlannerCard
                  title="Pending Task"
                  icon={<Clock className="w-4 h-4" />}
                  count={doneCount}
                  isOpen={collapseState.done}
                  onToggle={() => toggleCollapse("done")}
                >
                  <Done {...sharedProps} onCountChange={setDoneCount} />
                </PlannerCard>*/}


                {/* ── Overdue (full width, red border) ── */}
                <PlannerCard
                  title="Overdue"
                  icon={<AlertCircle className="w-4 h-4" />}
                  count={overdueCount}
                  isOpen={collapseState.overdue}
                  onToggle={() => toggleCollapse("overdue")}
                  className="border-3 border-red-400 shadow-lg"
                  countColor="text-red-600"
                >
                  <Overdue {...sharedProps} tsm={userDetails.tsm} onCountChange={setOverdueCount} />
                </PlannerCard>

              </div>
            )}
          </main>
        </SidebarInset>

        <SidebarRight
          dateCreatedFilterRange={dateCreatedFilterRange}
          setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
        />
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}