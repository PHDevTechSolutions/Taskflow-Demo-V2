"use client";

import * as React from "react";
import {
  Bot,
  LayoutDashboard,
  Mail,
  CalendarDays,
  Settings,
  BarChart2,
  Phone,
  Home,
  BookOpen,
  Trash2,
  Users,
  Briefcase,
  Target,
  FileText,
  Compass,
  ShoppingCart,
  XCircle,
  File,
  Leaf,
  ShoppingBag,
  TrendingUp,
  PhoneCall,
  CreditCard,
  Rocket,
  ClipboardList,
  ClipboardPenLine,
  ShieldIcon,
} from "lucide-react";

import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton"

const data = {
  teams: [
    {
      name: "Taskflow",
      plan: "Enterprise",
    },
  ],
  navSecondary: [
    { title: "Security", url: "/general/security", icon: ShieldIcon },
    { title: "Calendar", url: "/general/calendar", icon: CalendarDays },
    { title: "Settings", url: "/general/settings", icon: Settings },
  ],
  favorites: [
    // TSA
    { name: "Dashboard", url: "/roles/tsa/dashboard", icon: LayoutDashboard, isActive: true },
    { name: "Sales Performance", url: "/roles/tsa/sales-performance", icon: BarChart2 },
    { name: "National Call Ranking", url: "/roles/tsa/national-call-ranking", icon: Phone },

    // TSM
    { name: "Team Sales Performance", url: "/roles/tsm/sales-performance/", icon: BarChart2 },
    { name: "Agent List", url: "/roles/tsm/agent", icon: Users },

    // Manager
    { name: "My Team Sales Performance", url: "/roles/manager/sales-performance", icon: BarChart2 },
    { name: "Team List", url: "/roles/manager/agent", icon: Users },

    // Admin
    { name: "Admin Dashboard", url: "/roles/admin/dashboard", icon: LayoutDashboard, isActive: true },
    { name: "Agent Sales Performance", url: "/roles/admin/sales-performance", icon: BarChart2 },
  ],

  workspaces: [
    {
      name: "Customer Database",
      icon: Home,
      pages: [
        { name: "Active", url: "/roles/tsa/companies/active", icon: BookOpen },
        { name: "Deletion", url: "/roles/tsa/companies/remove", icon: Trash2 },
        { name: "Group / Industry", url: "/roles/tsa/companies/group", icon: Users },

        // TSM
        { name: "All", url: "/roles/tsm/companies/all", icon: BookOpen },
        { name: "Pending Transferred", url: "/roles/tsm/companies/transfer", icon: BookOpen },
        { name: "Account Deletion", url: "/roles/tsm/companies/approval", icon: Trash2 },

        // Manager
        { name: "All Clients", url: "/roles/manager/companies/all", icon: BookOpen },

        // Admin
        { name: "Active", url: "/roles/admin/companies/active", icon: BookOpen },
        { name: "Deletion", url: "/roles/admin/companies/remove", icon: Trash2 },
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
        { name: "Revised Quotations", url: "/roles/tsa/activity/revised-quotation", icon: Compass },
        { name: "Daily Admin Task", url: "/roles/tsa/activity/notes", icon: FileText },
        { name: "Client Coverage Guide", url: "/roles/tsa/activity/ccg", icon: Compass },

        // TSM
        { name: "Follow Ups", url: "/roles/tsm/activity/planner", icon: CalendarDays },
        { name: "Decline Quotations", url: "/roles/tsm/activity/quotation", icon: XCircle },

        // Admin
        { name: "Activity Planner", url: "/roles/admin/activity/planner", icon: Target },
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

        // TSM
        { name: "Quotation", url: "/roles/tsm/reports/quotation", icon: FileText },
        { name: "Sales Order", url: "/roles/tsm/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice", url: "/roles/tsm/reports/si", icon: File },
        { name: "CSR Endorsement", url: "/roles/tsm/reports/csr", icon: Phone },
        { name: "SPF", url: "/roles/tsm/reports/spf", icon: ClipboardPenLine },
        { name: "New Client", url: "/roles/tsm/reports/ncs", icon: Leaf },
        { name: "FB Marketplace", url: "/roles/tsm/reports/fb", icon: ShoppingBag },

        // Manager
        { name: "Quotation Summary", url: "/roles/manager/reports/quotation", icon: FileText },
        { name: "SO Summary", url: "/roles/manager/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/manager/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/manager/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/roles/manager/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/roles/manager/reports/ncs", icon: Leaf },
        { name: "FB Marketplace", url: "/roles/manager/reports/fb", icon: ShoppingBag },

        // Admin
        { name: "Quotation Summary", url: "/roles/admin/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/roles/admin/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/admin/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/admin/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/roles/admin/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/roles/admin/reports/ncs", icon: Leaf },
        { name: "FB Marketplace Summary", url: "/roles/admin/reports/fb", icon: ShoppingBag },
      ],
    },
    {
      name: "Conversion Rates",
      icon: TrendingUp,
      pages: [
        { name: "Calls to Quote", url: "/roles/tsa/conversion/calls-to-quote", icon: PhoneCall },
        { name: "Quote To SO", url: "/roles/tsa/conversion/quote-to-so", icon: FileText },
        { name: "SO To SI", url: "/roles/tsa/conversion/so-to-si", icon: CreditCard },
        { name: "Calls to SI", url: "/roles/tsa/conversion/calls-to-si", icon: Rocket },

        // TSM
        { name: "Call to Quotes", url: "/roles/tsm/conversion/calls-to-quote", icon: PhoneCall },
        { name: "Quotes To SO", url: "/roles/tsm/conversion/quote-to-so", icon: FileText },
        { name: "SO's To SI", url: "/roles/tsm/conversion/so-to-si", icon: CreditCard },
        { name: "Call to SI", url: "/roles/tsm/conversion/calls-to-si", icon: Rocket },

        // Manager
        { name: "Calls to Quote", url: "/roles/manager/conversion/calls-to-quote", icon: PhoneCall },
        { name: "Quote To SO", url: "/roles/manager/conversion/quote-to-so", icon: FileText },
        { name: "SO To SI", url: "/roles/manager/conversion/so-to-si", icon: CreditCard },
        { name: "Calls to SI", url: "/roles/manager/conversion/calls-to-si", icon: Rocket },

        // Admin
        { name: "Calls to Quote", url: "/roles/admin/conversion/calls-to-quote", icon: PhoneCall },
        { name: "Quote To SO", url: "/roles/admin/conversion/quote-to-so", icon: FileText },
        { name: "SO To SI", url: "/roles/admin/conversion/so-to-si", icon: CreditCard },
        { name: "Calls to SI", url: "/roles/admin/conversion/calls-to-si", icon: Rocket },
      ],
    },
  ],
};

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState({
    Firstname: "Task",
    Lastname: "Flow",
    Email: "taskflow@ecoshiftcorp.com",
    Department: "ecoshiftcorp.com",
    Location: "Philippines",
    Role: null as string | null,
    Position: "",
    Company: "Ecoshift Corporation",
    Status: "None",
    profilePicture: "",
    ReferenceID: "",
  });
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);

  // Load openSections from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebarOpenSections");
    if (saved) {
      setOpenSections(JSON.parse(saved));
    }
  }, []);

  // Save openSections to localStorage on change
  React.useEffect(() => {
    localStorage.setItem("sidebarOpenSections", JSON.stringify(openSections));
  }, [openSections]);

  // Get userId from URL query param on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  // Fetch user details when userId changes
  React.useEffect(() => {
    if (!userId) return;

    setIsLoadingUser(true);

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        setUserDetails((prev) => ({
          ...prev,
          Firstname: data.Firstname || prev.Firstname,
          Lastname: data.Lastname || prev.Lastname,
          Email: data.Email || prev.Email,
          Department: data.Department || prev.Department,
          Location: data.Location || prev.Location,
          Role: data.Role || prev.Role,
          Position: data.Position || prev.Position,
          Company: data.Company || prev.Company,
          Status: data.Status || prev.Status,
          ReferenceID: data.ReferenceID || prev.ReferenceID,
          profilePicture: data.profilePicture || prev.profilePicture,
        }));
      })
      .catch((err) => {
        console.error("Failed to fetch user details:", err);
      })
      .finally(() => {
        setIsLoadingUser(false);
      });
  }, [userId]);

  // Toggle section open/close state
  const handleToggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Append userId query param to URLs
  const withUserId = React.useCallback(
    (url: string) => {
      if (!userId) return url;
      if (!url || url === "#") return url;
      return url.includes("?")
        ? `${url}&id=${encodeURIComponent(userId)}`
        : `${url}?id=${encodeURIComponent(userId)}`;
    },
    [userId]
  );

  // Filter workspaces based on role
  const filteredWorkspaces = React.useMemo(() => {
    const role = userDetails.Role;

    // ⛔ habang wala pang role → WALANG MENU
    if (!role) return [];

    const baseWorkspaces =
      role === "Manager"
        ? data.workspaces.filter((w) => w.name !== "Work Management")
        : data.workspaces;

    return baseWorkspaces.map((workspace) => {
      if (role === "Territory Sales Associate") {
        return {
          ...workspace,
          pages: workspace.pages.filter(
            (p) =>
              !p.url?.includes("/tsm") &&
              !p.url?.includes("/manager") &&
              !p.url?.includes("/admin")
          ),
        };
      }

      if (role === "Territory Sales Manager") {
        return {
          ...workspace,
          pages: workspace.pages.filter((p) => p.url?.includes("/tsm")),
        };
      }

      if (role === "Manager") {
        return {
          ...workspace,
          pages: workspace.pages.filter((p) => p.url?.includes("/manager")),
        };
      }

      if (role === "Super Admin") {
        return {
          ...workspace,
          pages: workspace.pages.filter((p) => p.url?.includes("/admin")),
        };
      }

      return { ...workspace, pages: [] };
    });
  }, [userDetails.Role]);

  // Filter favorites based on role
  const filteredFavorites = React.useMemo(() => {
    const role = userDetails.Role;

    if (role === "Territory Sales Manager") {
      return data.favorites.filter(
        (fav) =>
          fav.name === "Team Sales Performance" ||
          fav.name === "National Call Ranking" ||
          fav.name === "Agent List"
      );
    }

    if (role === "Manager") {
      return data.favorites.filter(
        (fav) =>
          fav.name === "My Team Sales Performance" ||
          fav.name === "National Call Ranking" ||
          fav.name === "Team List"
      );
    }

    if (role === "Territory Sales Associate") {
      return data.favorites.filter(
        (fav) =>
          fav.name !== "My Team Sales Performance" &&
          fav.name !== "Team Sales Performance" &&
          fav.name !== "Agent List" &&
          fav.name !== "Team List" &&
          fav.name !== "Admin Dashboard" &&
          fav.name !== "Agent Sales Performance"
      );
    }

    if (role === "Super Admin") {
      return data.favorites.filter(
        (fav) =>
          fav.name !== "My Team Sales Performance" &&
          fav.name !== "Team Sales Performance" &&
          fav.name !== "Agent List" &&
          fav.name !== "Team List" &&
          fav.name !== "Dashboard" &&
          fav.name !== "Sales Performance"
      );
    }

    return data.favorites;
  }, [userDetails.Role]);

  // Add userId query param to favorites URLs
  const favoritesWithId = React.useMemo(() => {
    return filteredFavorites.map((favorite) => ({
      ...favorite,
      url: withUserId(favorite.url),
    }));
  }, [filteredFavorites, withUserId]);

  // Add userId query param to workspaces URLs
  const workspacesWithId = React.useMemo(
    () =>
      filteredWorkspaces.map((workspace) => ({
        ...workspace,
        pages: workspace.pages.map((page) => ({
          ...page,
          url: withUserId(page.url),
        })),
      })),
    [filteredWorkspaces, withUserId]
  );

  // Add userId query param to secondary nav URLs
  const navSecondaryWithId = React.useMemo(
    () => data.navSecondary.map((item) => ({ ...item, url: withUserId(item.url) })),
    [withUserId]
  );

  if (isLoadingUser || !userDetails.Role) {
    return (
      <Sidebar className="border-r-0">
        <SidebarContent className="flex items-center justify-center text-sm text-muted-foreground">
          <div className="flex w-full max-w-xs flex-col gap-2 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>

      <SidebarContent>
        <NavFavorites favorites={favoritesWithId} />
        <NavWorkspaces
          workspaces={workspacesWithId}
          openSections={openSections}
          onToggleSection={handleToggle}
        />
        <NavSecondary items={navSecondaryWithId} className="mt-auto" />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
