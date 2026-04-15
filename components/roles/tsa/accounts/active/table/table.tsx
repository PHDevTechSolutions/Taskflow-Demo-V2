"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Edit } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { AccountDialog } from "../../../activity/planner/dialog/active";
import { sileo } from "sileo";
import {
  Plus,
  Repeat,
  Archive,
  Users,
  Building2,
  Star,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import { AccountsActiveSearch } from "../search";
import { AccountsActiveFilter } from "../filter";
import { AccountsActivePagination } from "../pagination";
import { AccountsActiveDeleteDialog } from "../../../activity/planner/dialog/delete";
import { TransferDialog } from "../dialog/transfer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  industry: string;
  company_group: string;
  status?: string;
  next_available_date: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface AccountsTableProps {
  posts: Account[];
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  userDetails: UserDetails;
  onSaveAccountAction: (data: any, originalData?: Account) => void;
  onRefreshAccountsAction: () => Promise<void>;
}

// ─── Cluster config ───────────────────────────────────────────────────────────
const CLUSTER_CONFIG: Record<
  string,
  { color: string; bg: string; textColor: string }
> = {
  "top 50":    { color: "#f59e0b", bg: "#fef3c7", textColor: "#92400e" },
  "next 30":   { color: "#3b82f6", bg: "#dbeafe", textColor: "#1e40af" },
  "balance 20":{ color: "#8b5cf6", bg: "#ede9fe", textColor: "#5b21b6" },
  "new client":{ color: "#10b981", bg: "#d1fae5", textColor: "#065f46" },
  "tsa client":{ color: "#ef4444", bg: "#fee2e2", textColor: "#991b1b" },
  "csr client":{ color: "#f97316", bg: "#ffedd5", textColor: "#9a3412" },
};

function getClusterStyle(typeClient: string) {
  return (
    CLUSTER_CONFIG[typeClient?.toLowerCase()] ?? {
      color: "#6b7280",
      bg: "#f3f4f6",
      textColor: "#374151",
    }
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending:  "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-red-100 text-red-800 border-red-200",
};

function StatusBadge({ value }: { value: string }) {
  const key = value?.toLowerCase() ?? "";
  const cls = STATUS_STYLES[key] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[11px] font-semibold border ${cls}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-none"
        style={{
          background:
            key === "active"
              ? "#10b981"
              : key === "pending"
              ? "#f59e0b"
              : "#ef4444",
        }}
      />
      {value ?? "—"}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  children,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value?: number;
  accent: string;
  children?: React.ReactNode;
  trend?: { value: number; up: boolean };
}) {
  return (
    <div
      className="relative overflow-hidden rounded-none border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      {/* Faint background circle */}
      <div
        className="absolute -right-4 -top-4 h-20 w-20 rounded-none opacity-10"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            {label}
          </p>
          {value !== undefined && (
            <p className="text-3xl font-black" style={{ color: accent }}>
              {value.toLocaleString()}
            </p>
          )}
          {children && (
            <div className="mt-2 space-y-0.5 text-[12px] text-slate-600">
              {children}
            </div>
          )}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-none"
          style={{ background: accent + "1a" }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-[11px]">
          {trend.up ? (
            <ChevronUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <ChevronDown className="h-3 w-3 text-red-400" />
          )}
          <span className={trend.up ? "text-emerald-600" : "text-red-500"}>
            {trend.value}
          </span>
          <span className="text-slate-400">vs last month</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AccountsTable({
  posts = [],
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}: AccountsTableProps) {
  const [localPosts, setLocalPosts] = useState<Account[]>(posts);
  useEffect(() => setLocalPosts(posts), [posts]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
  const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [nextAvailableDateRange, setNextAvailableDateRange] = useState<DateRange | undefined>(undefined);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");
  const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);

  // ── Filtered + sorted data ────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
    const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];

    let data = localPosts.filter(
      (item) =>
        item.status &&
        item.type_client &&
        !excludedStatuses.includes(item.status.toLowerCase()) &&
        allowedTypes.includes(item.type_client.toLowerCase()),
    );

    data = data.filter((item) => {
      const matchesSearch =
        !globalFilter ||
        Object.values(item).some(
          (val) =>
            val != null &&
            String(val).toLowerCase().includes(globalFilter.toLowerCase()),
        );
      const matchesType =
        typeFilter === "all" ||
        item.type_client?.toLowerCase() === typeFilter.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        item.status?.toLowerCase() === statusFilter.toLowerCase();
      // Industry multi-select filter
      const matchesIndustry =
        industryFilter.length === 0 || industryFilter.includes(item.industry);
      // Region filter
      const matchesRegion =
        regionFilter === "all" || item.region === regionFilter;
      // Next available date range filter
      let matchesNextAvailableDate = true;
      if (nextAvailableDateRange?.from) {
        const itemDate = item.next_available_date ? new Date(item.next_available_date) : null;
        if (itemDate) {
          const fromDate = new Date(nextAvailableDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (nextAvailableDateRange.to) {
            const toDate = new Date(nextAvailableDateRange.to);
            toDate.setHours(23, 59, 59, 999);
            matchesNextAvailableDate = itemDate >= fromDate && itemDate <= toDate;
          } else {
            matchesNextAvailableDate = itemDate >= fromDate;
          }
        } else {
          matchesNextAvailableDate = false;
        }
      }
      return matchesSearch && matchesType && matchesStatus && matchesIndustry && matchesRegion && matchesNextAvailableDate;
    });

    data = data.sort((a, b) => {
      if (alphabeticalFilter === "asc") return a.company_name.localeCompare(b.company_name);
      if (alphabeticalFilter === "desc") return b.company_name.localeCompare(a.company_name);
      if (dateCreatedFilter === "asc")
        return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
      if (dateCreatedFilter === "desc")
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      return new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime();
    });

    return data;
  }, [localPosts, globalFilter, typeFilter, statusFilter, industryFilter, alphabeticalFilter, dateCreatedFilter, regionFilter, nextAvailableDateRange]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const count = (type: string) =>
      filteredData.filter((a) => a.type_client?.toLowerCase() === type).length;
    return {
      total: filteredData.length,
      top50: count("top 50"),
      next30: count("next 30"),
      balance20: count("balance 20"),
      tsa: count("tsa client"),
      csr: count("csr client"),
      newClient: count("new client"),
    };
  }, [filteredData]);

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={`Select ${row.original.company_name}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="cursor-pointer h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setEditingAccount(row.original);
                  setIsEditDialogOpen(true);
                }}
                className="cursor-pointer text-xs"
              >
                <Edit className="mr-2 h-3.5 w-3.5" /> Edit Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-semibold text-slate-800 text-[13px] uppercase leading-tight">
              {row.original.company_name}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{row.original.region}</p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }) => {
          const persons = tryParseJSON(row.original.contact_person) ??
            row.original.contact_person?.split(",").map((v) => v.trim()) ?? [];
          const numbers = tryParseJSON(row.original.contact_number) ??
            row.original.contact_number?.split(",").map((v) => v.trim()) ?? [];
          return (
            <div className="min-w-[160px] space-y-0.5">
              {persons.slice(0, 2).map((p: string, i: number) => (
                <div key={i}>
                  <p className="text-[12px] font-medium text-slate-700 uppercase">{p}</p>
                  {numbers[i] && (
                    <p className="text-[11px] text-slate-400 font-mono">{numbers[i]}</p>
                  )}
                </div>
              ))}
              {persons.length > 2 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-blue-500 cursor-pointer hover:underline">
                        +{persons.length - 2} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      {persons.slice(2).join(", ")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "email_address",
        header: "Email",
        cell: ({ row }) => {
          const emails = tryParseJSON(row.original.email_address) ??
            row.original.email_address?.split(",").map((v) => v.trim()) ?? [];
          return (
            <div className="min-w-[160px] space-y-0.5">
              {emails.slice(0, 1).map((e: string, i: number) => (
                <p key={i} className="text-[11px] text-slate-500 truncate max-w-[180px]">{e}</p>
              ))}
              {emails.length > 1 && (
                <span className="text-[10px] text-slate-400">+{emails.length - 1} more</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => (
          <p className="text-[12px] text-slate-500 max-w-[200px] line-clamp-2 leading-snug">
            {row.original.address}
          </p>
        ),
      },
      {
        accessorKey: "type_client",
        header: "Cluster",
        cell: ({ row }) => {
          const style = getClusterStyle(row.original.type_client);
          return (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-none text-[11px] font-bold uppercase tracking-wide border"
              style={{
                background: style.bg,
                color: style.textColor,
                borderColor: style.color + "40",
              }}
            >
              {row.original.type_client}
            </span>
          );
        },
      },
      {
        accessorKey: "next_available_date",
        header: "Next Call",
        cell: ({ row }) => {
          const dateValue = row.original.next_available_date;
          if (!dateValue || dateValue === "—") return <span className="text-[11px] text-slate-400">—</span>;
          try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return <span className="text-[11px] text-slate-400">—</span>;
            return (
              <p className="text-[11px] text-slate-500 uppercase font-medium">
                {format(date, "MMM dd, yyyy")}
              </p>
            );
          } catch {
            return <span className="text-[11px] text-slate-400">—</span>;
          }
        },
      },
      {
        accessorKey: "industry",
        header: "Industry",
        cell: ({ row }) => (
          <p className="text-[11px] text-slate-500 uppercase font-medium">
            {row.original.industry?.replace(/_/g, " ") ?? "—"}</p>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge value={row.original.status ?? "—"} />,
      },
    ],
    [],
  );

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!globalFilter) { setIsFiltering(false); return; }
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  // ── Table instance ────────────────────────────────────────────────────────
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedAccountIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  // ── Fetch agents ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user-transfer?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setAgents)
      .catch(console.error);
  }, [userDetails.referenceid]);

  // ── Bulk remove ───────────────────────────────────────────────────────────
  async function handleBulkRemove() {
    if (!selectedAccountIds.length || !removeRemarks.trim()) return;
    setLocalPosts((prev) =>
      prev.map((item) =>
        selectedAccountIds.includes(item.id) ? { ...item, status: "Removed" } : item,
      ),
    );
    try {
      const res = await fetch("/api/com-bulk-remove-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedAccountIds, status: "Removed", remarks: removeRemarks.trim() }),
      });
      if (!res.ok) throw new Error();
      sileo.info({
        title: "Archived",
        description: "Accounts archived. Pending TSM approval.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      await onRefreshAccountsAction();
      setRowSelection({});
      setRemoveRemarks("");
      setIsRemoveDialogOpen(false);
      table.setPageIndex(0);
    } catch {
      sileo.error({
        title: "Failed", description: "Failed to archive accounts.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }

  // ── Bulk transfer ─────────────────────────────────────────────────────────
  async function handleBulkTransfer(transferTo: string, accountIds: string[]) {
    if (!accountIds.length || !transferTo) return;
    setLocalPosts((prev) =>
      prev.map((item) =>
        accountIds.includes(item.id)
          ? { ...item, status: "Subject for Transfer", transfer_to: transferTo }
          : item,
      ),
    );
    try {
      const res = await fetch("/api/com-bulk-transfer-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: accountIds, status: "Subject for Transfer", transfer_to: transferTo }),
      });
      if (!res.ok) throw new Error();
      sileo.success({
        title: "Transfer Requested",
        description: "Pending TSM approval.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      await onRefreshAccountsAction();
      setRowSelection({});
      setIsTransferDialogOpen(false);
    } catch {
      sileo.error({
        title: "Failed", description: "Failed to transfer accounts.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }

  function tryParseJSON(jsonString: string) {
    try {
      const o = JSON.parse(jsonString);
      if (o && (Array.isArray(o) || typeof o === "object")) return o;
    } catch { }
    return null;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Accounts" value={stats.total} accent="#f59e0b" />

        <StatCard icon={Star} label="Premium Clusters" accent="#3b82f6">
          <div className="space-y-1">
            {[
              { label: "Top 50", value: stats.top50, color: "#f59e0b" },
              { label: "Next 30", value: stats.next30, color: "#3b82f6" },
              { label: "Balance 20", value: stats.balance20, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="font-bold text-[13px]" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard icon={Users} label="Client Types" accent="#10b981">
          <div className="space-y-1">
            {[
              { label: "New Client", value: stats.newClient, color: "#10b981" },
              { label: "TSA Client", value: stats.tsa, color: "#ef4444" },
              { label: "CSR Client", value: stats.csr, color: "#f97316" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="font-bold text-[13px]" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </StatCard>

      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left side: Add button + Search bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AccountDialog
            mode="create"
            userDetails={userDetails}
            onSaveAction={async (data) => {
              await onSaveAccountAction(data);
              setIsCreateDialogOpen(false);
            }}
            open={isCreateDialogOpen}
            onOpenChangeAction={setIsCreateDialogOpen}
          />
          <Button
            className="cursor-pointer rounded-none h-9 text-xs font-semibold"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
          </Button>
          <AccountsActiveSearch
            globalFilter={globalFilter}
            setGlobalFilterAction={setGlobalFilter}
            isFiltering={isFiltering}
          />
        </div>

        {/* Right side: Advanced Filter + Bulk actions */}
        <div className="flex items-center gap-2">
          <AccountsActiveFilter
            typeFilter={typeFilter}
            setTypeFilterAction={setTypeFilter}
            dateCreatedFilter={dateCreatedFilter}
            setDateCreatedFilterAction={setDateCreatedFilter}
            alphabeticalFilter={alphabeticalFilter}
            setAlphabeticalFilterAction={setAlphabeticalFilter}
            regionFilter={regionFilter}
            setRegionFilterAction={setRegionFilter}
            industryFilter={industryFilter}
            setIndustryFilterAction={setIndustryFilter}
            nextAvailableDateRange={nextAvailableDateRange}
            setNextAvailableDateRangeAction={setNextAvailableDateRange}
            posts={posts}
          />

          {selectedAccountIds.length > 0 && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedAccountIds.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-none h-8 text-xs"
                onClick={() => setIsTransferDialogOpen(true)}
              >
                <Repeat className="h-3.5 w-3.5 mr-1" /> Transfer
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="cursor-pointer rounded-none h-8 text-xs"
                onClick={() => setIsRemoveDialogOpen(true)}
              >
                <Archive className="h-3.5 w-3.5 mr-1" /> Archive
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-none border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Table header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Account Records
            </span>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono tabular-nums rounded-none">
            {filteredData.length.toLocaleString()} results
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-slate-50 border-b border-slate-100">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-400 py-3 px-4 whitespace-nowrap"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-16 text-slate-400 text-sm"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 opacity-20" />
                      <span>No accounts found.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-slate-50 ${
                      row.getIsSelected() ? "bg-blue-50 hover:bg-blue-50" : ""
                    } ${idx % 2 === 0 ? "" : "bg-slate-50/30"}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 px-4 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pending warning */}
        {filteredData.some((a) => a.status === "Pending") && (
          <div className="mx-4 mb-4 mt-2 flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-amber-500 mt-1.5" />
            <span>
              Accounts with <strong>Pending</strong> status require TSM approval before they can be used in activity creation.
            </span>
          </div>
        )}
      </div>

      <AccountsActivePagination table={table} />

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      {editingAccount && (
        <AccountDialog
          mode="edit"
          initialData={{
            id: editingAccount.id,
            company_name: editingAccount.company_name,
            contact_person:
              typeof editingAccount.contact_person === "string"
                ? tryParseJSON(editingAccount.contact_person) ??
                  editingAccount.contact_person.split(",").map((v) => v.trim())
                : editingAccount.contact_person || [""],
            contact_number:
              typeof editingAccount.contact_number === "string"
                ? tryParseJSON(editingAccount.contact_number) ??
                  editingAccount.contact_number.split(",").map((v) => v.trim())
                : editingAccount.contact_number || [""],
            email_address:
              typeof editingAccount.email_address === "string"
                ? tryParseJSON(editingAccount.email_address) ??
                  editingAccount.email_address.split(",").map((v) => v.trim())
                : editingAccount.email_address || [""],
            address: editingAccount.address,
            region: editingAccount.region,
            industry: editingAccount.industry,
            status: editingAccount.status ?? "Active",
            delivery_address: editingAccount.delivery_address,
            company_group: editingAccount.company_group,
            type_client: editingAccount.type_client,
            date_created: editingAccount.date_created,
          }}
          userDetails={userDetails}
          onSaveAction={(data) => {
            onSaveAccountAction(data, editingAccount);
            setEditingAccount(null);
            setIsEditDialogOpen(false);
          }}
          open={isEditDialogOpen}
          onOpenChangeAction={(open) => {
            if (!open) {
              setEditingAccount(null);
              setIsEditDialogOpen(false);
            }
          }}
        />
      )}

      <AccountsActiveDeleteDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={handleBulkRemove}
      />

      <TransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        agents={agents}
        selectedAccountIds={selectedAccountIds}
        onConfirmTransfer={handleBulkTransfer}
      />
    </div>
  );
}