"use client";

import * as React from "react";
import {
  Bot, LayoutDashboard, Mail, CalendarDays, Settings, BarChart2, Phone, Home,
  BookOpen, Trash2, Users, Briefcase, Target, FileText, Compass, ShoppingCart,
  XCircle, File, Leaf, ShoppingBag, TrendingUp, PhoneCall, GitGraph, CreditCard,
  Rocket, ClipboardList, ClipboardPenLine, ShieldIcon,
} from "lucide-react";
import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Role config: display label + pill color per role ─────────────────────────

const roleConfig: Record<string, { label: string; className: string }> = {
  "Territory Sales Associate": {
    label: "TSA",
    className:
      "bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-800",
  },
  "Territory Sales Manager": {
    label: "TSM",
    className:
      "bg-violet-500/10 text-violet-600 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-800",
  },
  Manager: {
    label: "Manager",
    className:
      "bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-800",
  },
  "Super Admin": {
    label: "Super Admin",
    className:
      "bg-rose-500/10 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-800",
  },
  Staff: {
    label: "CSR",
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800",
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const data = {
  teams: [{ name: "Taskflow", plan: "Enterprise" }],
  navSecondary: [
    { title: "Security", url: "/general/security", icon: ShieldIcon },
    { title: "Calendar", url: "/general/calendar", icon: CalendarDays },
    { title: "Settings", url: "/general/settings", icon: Settings },
  ],
  favorites: [
    { name: "Dashboard", url: "/roles/tsa/dashboard", icon: LayoutDashboard },
    { name: "Sales Performance", url: "/roles/tsa/sales-performance", icon: BarChart2 },
    { name: "National Call Ranking", url: "/roles/tsa/national-call-ranking", icon: Phone },

    { name: "Team Sales Performance", url: "/roles/tsm/sales-performance", icon: BarChart2 },
    { name: "Agent List", url: "/roles/tsm/agent", icon: Users },

    { name: "My Team Sales Performance", url: "/roles/manager/sales-performance", icon: BarChart2 },
    { name: "Team List", url: "/roles/manager/agent", icon: Users },

    { name: "Sales Performance", url: "/roles/admin/sales-performance", icon: BarChart2 },
    { name: "Employee List", url: "/roles/admin/employee-list", icon: Users },
  ],
  workspaces: [
    {
      name: "Customer Database",
      icon: Home,
      pages: [
        { name: "Active", url: "/roles/tsa/companies/active", icon: BookOpen },
        { name: "Deletion", url: "/roles/tsa/companies/remove", icon: Trash2 },
        { name: "Group / Industry", url: "/roles/tsa/companies/group", icon: Users },
        { name: "All", url: "/roles/tsm/companies/all", icon: BookOpen },
        { name: "All Clients", url: "/roles/manager/companies/all", icon: BookOpen },
        { name: "Active", url: "/roles/admin/companies/active", icon: BookOpen },
        { name: "Group / Industry", url: "/roles/admin/companies/group", icon: Users },
        { name: "Pending Transferred", url: "/roles/admin/companies/transfer", icon: BookOpen },
        { name: "Account Approval", url: "/roles/admin/companies/approval", icon: Trash2 },
      ],
    },
    {
      name: "Work Management",
      icon: Briefcase,
      pages: [
        { name: "Activity Planner", url: "/roles/tsa/activity/planner", icon: Target },
        { name: "Historical Data (TaskList)", url: "/roles/tsa/activity/tasklist", icon: ClipboardList },
        { name: "Quotations", url: "/roles/tsa/activity/revised-quotation", icon: Compass },
        { name: "SPF Request", url: "/roles/tsa/activity/spf", icon: Mail },
        { name: "Daily Admin Task", url: "/roles/tsa/activity/notes", icon: FileText },
        { name: "Daily Activity Logs", url: "/roles/tsa/activity/ccg", icon: Compass },
        { name: "Engr. Services", url: "/roles/tsa/activity/engineering", icon: Briefcase },

        { name: "Activity Planner", url: "/roles/tsm/activity/planner", icon: Target },
        { name: "Approved Quotations", url: "/roles/tsm/activity/quotation/approved", icon: CalendarDays },
        { name: "Decline Quotations", url: "/roles/tsm/activity/quotation/declined", icon: XCircle },
        { name: "Daily Activity Logs", url: "/roles/tsm/activity/ccg", icon: Compass },

        { name: "Pending Approval", url: "/roles/manager/activity/quotation/pending-quotation", icon: CalendarDays },
        { name: "Approval Quotations", url: "/roles/manager/activity/quotation/approval-quotation", icon: CalendarDays },
        { name: "Decline Quotations", url: "/roles/manager/activity/quotation/declined-quotation", icon: XCircle },
        { name: "Daily Activity Logs", url: "/roles/manager/activity/ccg", icon: Compass },

        { name: "Quotation List", url: "/roles/csr/activity/quotation/quotation-list", icon: Compass },
         
        { name: "Pending Approval", url: "/roles/admin/activity/quotation/pending-quotation", icon: CalendarDays },
        { name: "Approval Quotations", url: "/roles/admin/activity/quotation/approval-quotation", icon: CalendarDays },
        { name: "Historical Data (TaskList)", url: "/roles/admin/activity/tasklist", icon: ClipboardList },
        { name: "Revised Quotations", url: "/roles/admin/activity/revised-quotation", icon: Compass },
        { name: "Client Coverage Guide", url: "/roles/admin/activity/ccg", icon: Compass },
      ],
    },
    {
      name: "Reports",
      icon: BarChart2,
      pages: [
        { name: "Quotation Summary", url: "/roles/tsa/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/roles/tsa/reports/so", icon: ShoppingCart },
        { name: "Pending Sales Order", url: "/roles/tsa/reports/pending", icon: XCircle },
        { name: "Sales Invoice Summary", url: "/roles/tsa/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/tsa/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/roles/tsa/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/roles/tsa/reports/ncs", icon: Leaf },
        { name: "FB Marketplace Summary", url: "/roles/tsa/reports/fb", icon: ShoppingBag },

        { name: "Outbound", url: "/roles/tsm/reports/ob", icon: PhoneCall },
        { name: "Quotation", url: "/roles/tsm/reports/quotation", icon: FileText },
        { name: "Sales Order", url: "/roles/tsm/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice", url: "/roles/tsm/reports/si", icon: File },
        { name: "CSR Endorsement", url: "/roles/tsm/reports/csr", icon: Phone },
        { name: "SPF", url: "/roles/tsm/reports/spf", icon: ClipboardPenLine },
        { name: "New Client", url: "/roles/tsm/reports/ncs", icon: Leaf },
        { name: "FB Marketplace", url: "/roles/tsm/reports/fb", icon: ShoppingBag },

        { name: "Quotation Summary", url: "/roles/manager/reports/quotation", icon: FileText },
        { name: "SO Summary", url: "/roles/manager/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/manager/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/manager/reports/csr", icon: Phone },
        { name: "FB Marketplace", url: "/roles/manager/reports/fb", icon: ShoppingBag },

        { name: "Quotation Summary", url: "/roles/admin/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/roles/admin/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/admin/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/admin/reports/csr", icon: Phone },
        { name: "FB Marketplace Summary", url: "/roles/admin/reports/fb", icon: ShoppingBag },
      ],
    },
  ],
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <Sidebar className="border-r-0">
      {/* Header */}
      <SidebarHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3 space-y-5">
        {/* Role badge */}
        <Skeleton className="h-5 w-16 rounded-full ml-1" />

        {/* Favorites section */}
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-14 ml-1 mb-3 opacity-60" />
          {[80, 110, 95].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className={`h-3 rounded`} style={{ width: w }} />
            </div>
          ))}
        </div>

        {/* Workspace sections */}
        {[0, 1].map((g) => (
          <div key={g} className="space-y-1">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="ml-6 space-y-1 pl-2 border-l border-border/40">
              {[70, 100, 85, 90].map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3 w-3 rounded shrink-0" />
                  <Skeleton className="h-2.5 rounded" style={{ width: w }} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Bottom secondary nav */}
        <div className="mt-auto pt-4 space-y-1 border-t border-border/50">
          {[3].map((_, i) =>
            [0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-2.5 px-2 py-1.5">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

// ─── Role badge pill ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role];
  if (!config) return null;

  return (
    <div className="px-4 pb-1 pt-0.5">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5",
          "text-[10px] font-semibold tracking-widest uppercase leading-none",
          "transition-colors select-none",
          config.className
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState({
    Role: null as string | null,
  });
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);

  // Persist sidebar open/close state
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebarOpenSections");
    if (saved) setOpenSections(JSON.parse(saved));
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sidebarOpenSections", JSON.stringify(openSections));
  }, [openSections]);

  // Get user ID from URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  // Fetch user role
  React.useEffect(() => {
    if (!userId) return;
    setIsLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => setUserDetails({ Role: data.Role }))
      .finally(() => setIsLoadingUser(false));
  }, [userId]);

  // Append ?id= to all nav URLs
  const withUserId = React.useCallback(
    (url: string) => {
      if (!userId || !url || url === "#") return url;
      return url.includes("?") ? `${url}&id=${userId}` : `${url}?id=${userId}`;
    },
    [userId]
  );

  // Filter workspaces by role
  const filteredWorkspaces = React.useMemo(() => {
    if (!userDetails.Role) return [];
    const role = userDetails.Role;

    return data.workspaces
      .map((workspace) => ({
        ...workspace,
        pages: workspace.pages.filter((p) => {
          if (role === "Staff") return p.url?.includes("/csr");
          if (role === "Territory Sales Associate") return p.url?.includes("/tsa");
          if (role === "Territory Sales Manager") return p.url?.includes("/tsm");
          if (role === "Manager") return p.url?.includes("/manager");
          if (role === "Super Admin") return p.url?.includes("/admin");
          return false;
        }),
      }))
      .filter((w) => w.pages.length > 0);
  }, [userDetails.Role]);

  // Filter favorites by role
  const filteredFavorites = React.useMemo(() => {
    if (!userDetails.Role) return [];
    const role = userDetails.Role;

    return data.favorites.filter((fav) => {
      if (role === "Staff") return fav.url?.includes("/csr");
      if (role === "Territory Sales Associate") return fav.url?.includes("/tsa");
      if (role === "Territory Sales Manager") return fav.url?.includes("/tsm");
      if (role === "Manager") return fav.url?.includes("/manager");
      if (role === "Super Admin") return fav.url?.includes("/admin");
      return false;
    });
  }, [userDetails.Role]);

  if (isLoadingUser || !userDetails.Role) {
    return <SidebarSkeleton />;
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>

      <SidebarContent>
        {/* Role indicator pill — shown right below the header */}
        <RoleBadge role={userDetails.Role} />

        <NavFavorites
          favorites={filteredFavorites.map((f) => ({ ...f, url: withUserId(f.url) }))}
        />

        <NavWorkspaces
          workspaces={filteredWorkspaces.map((w) => ({
            ...w,
            pages: w.pages.map((p) => ({ ...p, url: withUserId(p.url) })),
          }))}
          openSections={openSections}
          onToggleSection={(section) =>
            setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
          }
        />

        <NavSecondary
          items={data.navSecondary.map((i) => ({ ...i, url: withUserId(i.url) }))}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}