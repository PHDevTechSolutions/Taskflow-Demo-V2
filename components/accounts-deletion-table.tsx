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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { AccountsActiveSearch } from "./accounts-active-search";
import { AccountsActiveFilter } from "./accounts-active-filter";
import { AccountsActivePagination } from "./accounts-active-pagination";

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
  industry: string;
  status?: string;
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
  onSaveAccountAction: (data: any) => Promise<void>;
  onRefreshAccountsAction: () => Promise<void>;
}

export function AccountsTable({
  posts = [],
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}: AccountsTableProps) {
  const [localPosts, setLocalPosts] = useState<Account[]>(posts);

  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(
    null
  );
  const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);


  /* =========================
     REVERT HANDLER
  ========================== */
  const handleRevertAccount = async () => {
    if (!selectedAccount) return;

    try {
      setIsReverting(true);

      const res = await fetch("/api/revert", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: [selectedAccount.id],
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to revert account");
      }

      // Remove from list since Active na
      setLocalPosts((prev) =>
        prev.filter((item) => item.id !== selectedAccount.id)
      );

      setSelectedAccount(null);
    } catch (error) {
      console.error("Revert failed:", error);
      alert("Failed to revert account. Please try again.");
    } finally {
      setIsReverting(false);
    }
  };

  /* =========================
     FILTER DATA (REMOVED ONLY)
  ========================== */
  const filteredData = useMemo(() => {
    let data = localPosts.filter((item) => item.status === "Removed");

    data = data.filter((item) => {
      const matchesSearch =
        !globalFilter ||
        Object.values(item).some(
          (val) =>
            val &&
            String(val).toLowerCase().includes(globalFilter.toLowerCase())
        );

      const matchesType =
        typeFilter === "all" || item.type_client === typeFilter;

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesIndustry =
        industryFilter === "all" || item.industry === industryFilter;

      return matchesSearch && matchesType && matchesStatus && matchesIndustry;
    });

    data.sort((a, b) => {
      if (alphabeticalFilter === "asc") {
        return a.company_name.localeCompare(b.company_name);
      }
      if (alphabeticalFilter === "desc") {
        return b.company_name.localeCompare(a.company_name);
      }
      if (dateCreatedFilter === "asc") {
        return (
          new Date(a.date_created).getTime() -
          new Date(b.date_created).getTime()
        );
      }
      if (dateCreatedFilter === "desc") {
        return (
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
        );
      }
      return 0;
    });

    return data;
  }, [
    localPosts,
    globalFilter,
    typeFilter,
    statusFilter,
    industryFilter,
    alphabeticalFilter,
    dateCreatedFilter,
  ]);

  /* =========================
     TABLE COLUMNS
  ========================== */
  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
      { accessorKey: "company_name", header: "Company Name" },
      { accessorKey: "contact_person", header: "Contact Person" },
      { accessorKey: "email_address", header: "Email Address" },
      { accessorKey: "address", header: "Address" },
      { accessorKey: "type_client", header: "Type of Client" },
      { accessorKey: "industry", header: "Industry" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <Badge
              className={status === "Removed" ? "animate-pulse bg-red-600 text-white" : ""}
              variant={status === "Removed" ? undefined : "default"}
            >
              {status === "Removed" ? "Waiting for approval of TSM" : status}
            </Badge>
          );
        },
      },

      {
        accessorKey: "date_created",
        header: "Date Created",
        cell: ({ getValue }) =>
          new Date(getValue() as string).toLocaleDateString(),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-green-700 border-green-300 hover:bg-green-50 cursor-pointer"
            onClick={() => {
              setSelectedAccount(row.original);
              setOpenDialog(true);
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Revert
          </Button>
        ),
      },

    ],
    []
  );

  useEffect(() => {
    if (!globalFilter) return;
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <AccountsActiveSearch
          globalFilter={globalFilter}
          setGlobalFilterAction={setGlobalFilter}
          isFiltering={isFiltering}
        />
        <AccountsActiveFilter
          typeFilter={typeFilter}
          setTypeFilterAction={setTypeFilter}
          dateCreatedFilter={dateCreatedFilter}
          setDateCreatedFilterAction={setDateCreatedFilter}
          alphabeticalFilter={alphabeticalFilter}
          setAlphabeticalFilterAction={setAlphabeticalFilter}
        />
      </div>

      {/* TABLE */}
      <div className="rounded-md border p-4">
        <Badge variant="outline" className="mb-2">
          Total: {filteredData.length}
        </Badge>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  No removed accounts.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                You are about to <strong>revert this account back to Active</strong>.
              </p>
              <p>This action is performed when:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The account was removed by mistake</li>
                <li>The client has resumed active engagement</li>
                <li>Audit or management review requires reactivation</li>
              </ul>
              <p className="text-red-600 font-medium">
                Please confirm to proceed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedAccount(null);
                setOpenDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={async () => {
                await handleRevertAccount();
                setOpenDialog(false);
              }}
              disabled={isReverting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isReverting ? "Reverting..." : "Confirm Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccountsActivePagination table={table} />
    </div>
  );
}
