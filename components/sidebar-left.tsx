"use client";

import * as React from "react";
import {
  Bot,
  LayoutDashboard,
  Mail,
  CalendarDays,
  Settings,
  Building,
  BarChart2,
  Phone,
  Home,
  BookOpen,
  PlusCircle,
  Slash,
  Clock,
  Trash2,
  Repeat,
  Users,
  Briefcase,
  Target,
  Edit2,
  FileText,
  MessageSquare,
  Compass,
  DollarSign,
  ShoppingCart,
  XCircle ,
  File,
  Leaf,
  ShoppingBag,
  TrendingUp,
  PhoneCall,
  CreditCard,
  Rocket,
  ClipboardList,
  ClipboardPenLine,
  UserCheck
} from "lucide-react";

import { NavFavorites } from "@/components/nav-favorites";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavWorkspaces } from "@/components/nav-workspaces";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// Dummy getMenuItems function - replace or import your actual function
function getMenuItems(userId: string | null) {
  return [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Ask AI", url: "#", icon: Bot },
    { title: "Inbox", url: "#", icon: Mail, badge: "5" },
  ];
}

const data = {
  teams: [
    {
      name: "Taskflow",
      plan: "Enterprise",
    },
  ],
  navMain: [
    { title: "Dashboard", url: "#", icon: LayoutDashboard, isActive: true },
  ],
  navSecondary: [
    { title: "Calendar", url: "/calendar", icon: CalendarDays },
    { title: "Settings", url: "/settings", icon: Settings },
  ],
  favorites: [
    { name: "Sales Performance", url: "/sales-performance", icon: BarChart2 },
    { name: "National Call Ranking", url: "/national-call-ranking", icon: Phone },
  ],
  workspaces: [
    {
      name: "Customer Database",
      icon: Home,
      pages: [
        { name: "All", url: "/companies/all", icon: BookOpen }, // For TSM and Manager
        { name: "Pending Transferred", url: "/companies/transfer", icon: BookOpen },
        { name: "Active", url: "/companies/active", icon: BookOpen },
        { name: "Deletion", url: "/companies/remove", icon: Trash2 },
        { name: "Group Affiliate", url: "/companies/group", icon: Users },
        { name: "Account Deletion", url: "/companies/approval", icon: Trash2 },
      ],
    },
    {
      name: "Work Management",
      icon: Briefcase,
      pages: [
        { name: "Activity Planner", url: "/activity/planner", icon: Target },
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
        { name: "Account Sales Summary", url: "/reports/am", icon: DollarSign },
        { name: "Quotation Summary", url: "/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/reports/so", icon: ShoppingCart },
        { name: "Pending Sales Order", url: "/reports/pending", icon: XCircle  },
        { name: "Sales Invoice Summary", url: "/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/reports/ncs", icon: Leaf },
        { name: "FB Marketplace Summary", url: "/reports/fb", icon: ShoppingBag },
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
      ],
    },
  ],
};

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
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

  const menuItems = React.useMemo(() => getMenuItems(userId), [userId]);

  const filteredMenuItems = React.useMemo(() => {
    const role = userDetails.Role || "Admin";
    const allowed: Record<string, string[]> = {
      Admin: menuItems.map((m) => m.title),
      "Super Admin": menuItems.map((m) => m.title),
      Manager: [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "My Team",
        "Work Management",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Special Access": [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "My Team",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Territory Sales Manager": [
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "Work Management",
        "My Team",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
      "Territory Sales Associate": [
        "Dashboard",
        "Session Logs",
        "Sales Performance",
        "Conversion Rates",
        "Customer Database",
        "National",
        "Work Management",
        "Reports",
        "Help Center",
        "What is Taskflow?",
      ],
    };
    return menuItems.filter((item) => allowed[role]?.includes(item.title));
  }, [menuItems, userDetails]);

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

  // Filter pages in Customer Database workspace for TSM and Manager roles
  const filteredWorkspaces = React.useMemo(() => {
    const role = userDetails.Role || "Admin";

    return data.workspaces.map((workspace) => {
      if (workspace.name === "Customer Database") {
        if (role === "Territory Sales Associate") {
          return {
            ...workspace,
            pages: workspace.pages.filter(
              (page) =>
                !["All", "Pending Accounts", "Account Deletion", "Pending Transferred"].includes(page.name)
            ),
          };
        } else if (role === "Territory Sales Manager") {
          return {
            ...workspace,
            pages: workspace.pages.filter((page) =>
              ["All", "Pending Accounts", "Account Deletion", "Pending Transferred"].includes(page.name)
            ),
          };
        }
      }
      return workspace;
    });
  }, [userDetails.Role]);

  const favoritesWithId = React.useMemo(
    () =>
      data.favorites.map((favorite) => ({
        ...favorite,
        url: withUserId(favorite.url),
      })),
    [data.favorites, withUserId]
  );

  // Append userId to URLs in filtered workspaces
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

  const navMainWithId = React.useMemo(
    () => filteredMenuItems.map((item) => ({ ...item, url: withUserId(item.url || "#") })),
    [filteredMenuItems, withUserId]
  );

  const navSecondaryWithId = React.useMemo(
    () => data.navSecondary.map((item) => ({ ...item, url: withUserId(item.url) })),
    [withUserId]
  );

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={navMainWithId} />
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
