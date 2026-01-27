"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender, } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, } from "@/components/ui/dialog";

import { AccountsActiveSearch } from "../../active/search";
import { AccountsActivePagination } from "../../active/pagination";
import { type DateRange } from "react-day-picker";

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
  status?: string;
  industry?: string;
}

interface GroupedAccounts {
  industry: string;
  accounts: Account[];
}

interface AccountsTableProps {
  posts: Account[];
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  groupedPosts?: GroupedAccounts[];
}

const ALLOWED_STATUSES = ["Active", "Inactive", "Non-Buying"];

export function AccountsTable({
  posts = [],
  groupedPosts,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}: AccountsTableProps) {
  const [localPosts, setLocalPosts] = useState<Account[]>([]);

  useEffect(() => {
    // Filter posts by allowed statuses on every update
    const filteredPosts = posts.filter(
      (post) => post.status && ALLOWED_STATUSES.includes(post.status)
    );
    setLocalPosts(filteredPosts);
  }, [posts]);

  // Dialog state for showing company names in group
  const [selectedGroup, setSelectedGroup] = useState<GroupedAccounts | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openGroupDialog = (group: GroupedAccounts) => {
    setSelectedGroup(group);
    setIsDialogOpen(true);
  };

  // Search filter
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    if (!globalFilter) {
      setIsFiltering(false);
      return;
    }
    setIsFiltering(true);
    const timeout = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(timeout);
  }, [globalFilter]);

  // Group posts by company_group if groupedPosts not provided
  const computedGroupedPosts = useMemo<GroupedAccounts[]>(() => {
    if (groupedPosts && groupedPosts.length > 0) return groupedPosts;

    const map = new Map<string, Account[]>();
    localPosts.forEach((acc) => {
      const group = acc.industry ?? "Ungrouped";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(acc);
    });

    return Array.from(map.entries()).map(([industry, accounts]) => ({
      industry,
      accounts,
    }));
  }, [localPosts, groupedPosts]);

  // Apply globalFilter and dateCreatedFilterRange on groups (accounts inside each group)
  const filteredGroupedPosts = useMemo(() => {
    return computedGroupedPosts
      .map(({ industry, accounts }) => {
        let filteredAccounts = accounts;

        if (globalFilter.trim()) {
          const gf = globalFilter.toLowerCase();
          filteredAccounts = filteredAccounts.filter((acc) =>
            Object.values(acc).some(
              (val) =>
                val != null &&
                String(val).toLowerCase().includes(gf)
            )
          );
        }

        if (
          dateCreatedFilterRange &&
          dateCreatedFilterRange.from &&
          dateCreatedFilterRange.to
        ) {
          const fromTime = dateCreatedFilterRange.from.setHours(0, 0, 0, 0);
          const toTime = dateCreatedFilterRange.to.setHours(23, 59, 59, 999);
          filteredAccounts = filteredAccounts.filter((acc) => {
            const createdDate = new Date(acc.date_created).getTime();
            return createdDate >= fromTime && createdDate <= toTime;
          });
        }

        return { industry, accounts: filteredAccounts };
      })
      .filter((group) => group.accounts.length > 0);
  }, [computedGroupedPosts, globalFilter, dateCreatedFilterRange]);

  // Define react-table columns for groups
  const columns = useMemo<ColumnDef<GroupedAccounts>[]>(
    () => [
      {
        accessorKey: "industry",
        header: "Industry",
        cell: (info) => (
          <button
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={() => openGroupDialog(info.row.original)}
          >
            {String(info.getValue())}
          </button>
        ),
      },
      {
        accessorFn: (row) => row.accounts.length,
        id: "number_of_companies",
        header: "Number of Companies",
        cell: (info) => info.getValue(),
      },
      {
        id: "action",
        header: "Action",
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => openGroupDialog(info.row.original)}
          >
            View Companies
          </Button>
        ),
      },
    ],
    []
  );

  // Setup react-table instance
  const table = useReactTable({
    data: filteredGroupedPosts,
    columns,
    getRowId: (row) => row.industry,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-2">
        <AccountsActiveSearch
          globalFilter={globalFilter}
          setGlobalFilterAction={setGlobalFilter}
          isFiltering={isFiltering}
        />
        {/* Add your date range picker component here */}
      </div>

      <div className="rounded-md border p-4 space-y-2">
        <Badge
          className="h-5 min-w-5 rounded-full px-2 font-mono tabular-nums"
          variant="outline"
        >
          Total Industry: {filteredGroupedPosts.length}
        </Badge>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  No groups found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <AccountsActivePagination table={table} />

        {/* Dialog showing companies in selected group */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xs">
                Companies in Industry: {selectedGroup?.industry}
              </DialogTitle>
              <DialogClose />
            </DialogHeader>

            <div className="mt-4 max-h-80 overflow-auto">
              {selectedGroup?.accounts.length ? (
                <ul className="list-disc pl-5 space-y-1">
                  {selectedGroup.accounts.map((acc) => (
                    <li key={acc.id}>{acc.company_name}</li>
                  ))}
                </ul>
              ) : (
                <p>No companies found in this industry.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
