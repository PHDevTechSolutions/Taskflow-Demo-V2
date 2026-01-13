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
} from "lucide-react";

import { NavFavorites } from "@/components/nav-favorites";
import { NavSecondary } from "@/components/nav-secondary";
import { NavWorkspaces } from "@/components/nav-workspaces";
import { TeamSwitcher } from "@/components/team-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";

const data = {
  teams: [
    {
      name: "Taskflow",
      plan: "Enterprise",
    },
  ],
  navSecondary: [
    { title: "Calendar", url: "/calendar", icon: CalendarDays },
    { title: "Settings", url: "/settings", icon: Settings },
  ],
  favorites: [
    { name: "Dashboard", url: "#", icon: LayoutDashboard, isActive: true },
    { name: "Sales Performance", url: "/sales-performance", icon: BarChart2 },
    { name: "Team Sales Performance", url: "/sales-performance/tsm", icon: BarChart2 }, // TSM
    { name: "My Team Sales Performance", url: "/sales-performance/manager", icon: BarChart2 }, // Manager
    { name: "Agent List", url: "/agent/tsm", icon: Users }, // TSM
    { name: "Team List", url: "/agent/manager", icon: Users }, // Manager
    { name: "National Call Ranking", url: "/national-call-ranking", icon: Phone },
  ],
  workspaces: [
    {
      name: "Customer Database",
      icon: Home,
      pages: [
        { name: "Active", url: "/companies/active", icon: BookOpen },
        { name: "Deletion", url: "/companies/remove", icon: Trash2 },
        { name: "Group Affiliate", url: "/companies/group", icon: Users },
        { name: "All", url: "/companies/all", icon: BookOpen }, // TSM
        { name: "Pending Transferred", url: "/companies/transfer", icon: BookOpen }, // TSM
        { name: "Account Deletion", url: "/companies/approval", icon: Trash2 }, // TSM
        { name: "All Clients", url: "/companies/all-clients", icon: BookOpen }, // Manager
      ],
    },
    {
      name: "Work Management",
      icon: Briefcase,
      pages: [
        { name: "Activity Planner", url: "/activity/planner", icon: Target },
        { name: "Team Activity Planner", url: "/activity/tsm/planner", icon: Target },
        { name: "Historical Data (TaskList)", url: "/activity/tasklist", icon: ClipboardList },
        { name: "Revised Quotations", url: "/activity/revised-quotation", icon: Compass },
        { name: "Daily Admin Task", url: "/activity/notes", icon: FileText },
        { name: "Client Coverage Guide", url: "/activity/ccg", icon: Compass },
      ],
    },
    {
      name: "Reports",
      icon: BarChart2,
      pages: [
        { name: "Quotation Summary", url: "/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/reports/so", icon: ShoppingCart },
        { name: "Pending Sales Order", url: "/reports/pending", icon: XCircle },
        { name: "Sales Invoice Summary", url: "/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/reports/ncs", icon: Leaf },
        { name: "FB Marketplace Summary", url: "/reports/fb", icon: ShoppingBag },

        // TSM
        { name: "Quotation", url: "/reports/tsm/quotation", icon: FileText },
        { name: "Sales Order", url: "/reports/tsm/so", icon: ShoppingCart },
        { name: "Sales Invoice", url: "/reports/tsm/si", icon: File },
        { name: "CSR Endorsement", url: "/reports/tsm/csr", icon: Phone },
        { name: "SPF", url: "/reports/tsm/spf", icon: ClipboardPenLine },
        { name: "New Client", url: "/reports/tsm/ncs", icon: Leaf },
        { name: "FB Marketplace", url: "/reports/tsm/fb", icon: ShoppingBag },

        // Manager
        { name: "Proposals", url: "/reports/manager/quotation", icon: FileText },
        { name: "Customer Orders", url: "/reports/manager/so", icon: ShoppingCart },
        { name: "Customer Invoice", url: "/reports/manager/si", icon: File },
        { name: "Customer Service Report", url: "/reports/manager/csr", icon: Phone },
        { name: "Customer SPF", url: "/reports/manager/spf", icon: ClipboardPenLine },
        { name: "New Leads", url: "/reports/manager/ncs", icon: Leaf },
        { name: "Facebook Marketplace", url: "/reports/manager/fb", icon: ShoppingBag },
      ],
    },
    {
      name: "Conversion Rates",
      icon: TrendingUp,
      pages: [
        { name: "Calls to Quote", url: "/conversion/calls-to-quote", icon: PhoneCall },
        { name: "Quote To SO", url: "/conversion/quote-to-so", icon: FileText },
        { name: "SO To SI", url: "/conversion/so-to-si", icon: CreditCard },
        { name: "Calls to SI", url: "/conversion/calls-to-si", icon: Rocket },

        // TSM
        { name: "Call to Quotes", url: "/conversion/tsm/calls-to-quote", icon: PhoneCall },
        { name: "Quotes To SO", url: "/conversion/tsm/quote-to-so", icon: FileText },
        { name: "SO's To SI", url: "/conversion/tsm/so-to-si", icon: CreditCard },
        { name: "Call to SI", url: "/conversion/tsm/calls-to-si", icon: Rocket },

        // Manager
        { name: "Calls to Quotes", url: "/conversion/manager/calls-to-quote", icon: PhoneCall },
        { name: "Quotes To SO's", url: "/conversion/manager/quote-to-so", icon: FileText },
        { name: "SO's To SI's", url: "/conversion/manager/so-to-si", icon: CreditCard },
        { name: "Calls to SI's", url: "/conversion/manager/calls-to-si", icon: Rocket },
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
    Role: "Admin",
    Position: "",
    Company: "Ecoshift Corporation",
    Status: "None",
    profilePicture: "",
    ReferenceID: "",
  });
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebarOpenSections");
    if (saved) {
      setOpenSections(JSON.parse(saved));
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sidebarOpenSections", JSON.stringify(openSections));
  }, [openSections]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  React.useEffect(() => {
    if (!userId) return;
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
      .catch((err) => console.error(err));
  }, [userId]);

  const handleToggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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

  const filteredWorkspaces = React.useMemo(() => {
    const role = userDetails.Role || "Admin";

    return data.workspaces.map((workspace) => {
      if (workspace.name === "Customer Database") {
        if (role === "Territory Sales Associate") {
          return {
            ...workspace,
            pages: workspace.pages.filter(
              (page) =>
                ![
                  "All",
                  "All Clients",
                  "Pending Accounts",
                  "Account Deletion",
                  "Pending Transferred",
                ].includes(page.name)
            ),
          };
        }
      }

      if (
        ["Reports", "Conversion Rates", "Customer Database", "Work Management"].includes(workspace.name)
      ) {
        if (role === "Territory Sales Manager") {
          return {
            ...workspace,
            pages: workspace.pages.filter((page) =>
              [
                "All",
                "Pending Accounts",
                "Account Deletion",
                "Pending Transferred",
                "Client Sales",
                "Quotation",
                "Sales Order",
                "Pending SO",
                "Sales Invoice",
                "CSR Endorsement",
                "SPF",
                "New Client",
                "FB Marketplace",
                "Call to Quotes",
                "Quotes To SO",
                "SO's To SI",
                "Call to SI",
                "Team Activity Planner",
                "Agent List",
              ].includes(page.name)
            ),
          };
        }

        if (role === "Territory Sales Associate") {
          return {
            ...workspace,
            pages: workspace.pages.filter(
              (page) =>
                page.url &&
                !page.url.startsWith("/reports/tsm") &&
                !page.url.startsWith("/reports/manager") &&
                !page.url.startsWith("/conversion/tsm") &&
                !page.url.startsWith("/conversion/manager") &&
                !page.url.startsWith("/activity/tsm") &&
                !page.url.startsWith("/agent/tsm")
            ),
          };
        }
      }

      if (
        ["Reports", "Conversion Rates", "Customer Database", "Work Management"].includes(workspace.name)
      ) {
        if (role === "Manager") {
          return {
            ...workspace,
            pages: workspace.pages.filter((page) =>
              [
                "All Clients",
                "Client Sales",
                "Proposals",
                "Customer Orders",
                "Customer Invoice",
                "Customer Service Report",
                "Customer SPF",
                "New Leads",
                "Facebook Marketplace",
                "Calls to Quotes",
                "Quotes To SO's",
                "SO's To SI's",
                "Calls to SI's",
                "Team Activity Planner",
                "Team List",
              ].includes(page.name)
            ),
          };
        }
      }

      return workspace;
    });
  }, [userDetails.Role]);

  const filteredFavorites = React.useMemo(() => {
    const role = userDetails.Role || "Admin";

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
          fav.name !== "Team List"
      );
    }

    return data.favorites;
  }, [userDetails.Role]);

  const favoritesWithId = React.useMemo(() => {
    return filteredFavorites.map((favorite) => ({
      ...favorite,
      url: withUserId(favorite.url),
    }));
  }, [filteredFavorites, withUserId]);

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

  const navSecondaryWithId = React.useMemo(
    () => data.navSecondary.map((item) => ({ ...item, url: withUserId(item.url) })),
    [withUserId]
  );

  return (
    <Sidebar className="border-r-0" {...props}>
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
