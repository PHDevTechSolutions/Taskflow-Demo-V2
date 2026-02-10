"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SPF {
  id: number;
  so_amount?: number;
  so_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  account_reference_number?: string;
  company_name?: string;
  contact_number?: string;
  contact_person: string;
  call_type: string;
  status: string;
  referenceid: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface SPFProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

const PAGE_SIZE = 10;

export const SPFTable: React.FC<SPFProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  userDetails,
  setDateCreatedFilterRangeAction,
}) => {
  // Removed companies state
  // const [companies, setCompanies] = useState<Company[]>([]);
  const [activities, setActivities] = useState<SPF[]>([]);
  // Removed loadingCompanies and errorCompanies states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination state
  const [page, setPage] = useState(1);

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  // Removed useEffect fetching companies
  // Fetch activities
  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL("/api/reports/tsm/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // Real-time subscription using Supabase
  useEffect(() => {
    fetchActivities();

    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:tsm=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `tsm=eq.${referenceid}`,
        },
        (payload) => {
          const newRecord = payload.new as SPF;
          const oldRecord = payload.old as SPF;

          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                if (!curr.some((a) => a.id === newRecord.id)) {
                  return [...curr, newRecord];
                }
                return curr;
              case "UPDATE":
                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
              case "DELETE":
                return curr.filter((a) => a.id !== oldRecord.id);
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  // Remove merge with companies — activities now used directly
  const mergedActivities = useMemo(() => {
    return activities.sort(
      (a, b) =>
        new Date(b.date_updated ?? b.date_created).getTime() -
        new Date(a.date_updated ?? a.date_created).getTime()
    );
  }, [activities]);

  // Filter logic
  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return mergedActivities
      .filter((item) =>
        ["spf - special project", "spf - local", "spf - foreign"].includes(
          item.call_type?.toLowerCase() ?? ""
        )
      )
      .filter((item) => {
        if (!search) return true;
        return (
          (item.company_name?.toLowerCase().includes(search) ?? false) ||
          (item.so_number?.toLowerCase().includes(search) ?? false) ||
          (item.remarks?.toLowerCase().includes(search) ?? false)
        );
      })
      .filter((item) => {
        if (filterStatus !== "all" && item.status !== filterStatus) return false;
        return true;
      })
      .filter((item) => {
        if (selectedAgent === "all") return true;
        return item.referenceid === selectedAgent;
      })
      .filter((item) => {
        if (
          !dateCreatedFilterRange ||
          (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)
        ) {
          return true;
        }

        const updatedDate = item.date_created
          ? new Date(item.date_created)
          : new Date(item.date_created);

        if (isNaN(updatedDate.getTime())) return false;

        const fromDate = dateCreatedFilterRange.from
          ? new Date(dateCreatedFilterRange.from)
          : null;
        const toDate = dateCreatedFilterRange.to
          ? new Date(dateCreatedFilterRange.to)
          : null;

        const isSameDay = (d1: Date, d2: Date) =>
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();

        if (fromDate && toDate && isSameDay(fromDate, toDate)) {
          return isSameDay(updatedDate, fromDate);
        }

        if (fromDate && updatedDate < fromDate) return false;
        if (toDate && updatedDate > toDate) return false;

        return true;
      });
  }, [mergedActivities, searchTerm, filterStatus, dateCreatedFilterRange, selectedAgent]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus, dateCreatedFilterRange, selectedAgent]);

  // Calculate totals for footer (for filteredActivities, not paginated subset)
  const totalQuotationAmount = useMemo(() => {
    return filteredActivities.reduce((acc, item) => acc + (item.so_amount ?? 0), 0);
  }, [filteredActivities]);

  // Count unique SO Number (non-null)
  const uniqueQuotationCount = useMemo(() => {
    const uniqueSet = new Set<string>();
    filteredActivities.forEach((item) => {
      if (item.so_number) uniqueSet.add(item.so_number);
    });
    return uniqueSet.size;
  }, [filteredActivities]);

  // Pagination logic
  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus, dateCreatedFilterRange]);

  const agentMap = useMemo(() => {
    const map: Record<string, { name: string; profilePicture: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
        map[agent.ReferenceID.toLowerCase()] = {
          name: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture || "",
        };
      }
    });
    return map;
  }, [agents]);

  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch agents");

        const data = await response.json();
        setAgents(data);
      } catch (err) {
        console.error("Error fetching agents:", err);
        setError("Failed to load agents.");
      }
    };

    fetchAgents();
  }, [userDetails.referenceid]);

  return (
    <>
      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search company or remarks..."
          className="max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Select
          value={selectedAgent}
          onValueChange={(value) => {
            setSelectedAgent(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px] text-xs">
            <SelectValue placeholder="Filter by Agent" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>

            {agents.map((agent) => (
              <SelectItem className="capitalize" key={agent.ReferenceID} value={agent.ReferenceID}>
                {agent.Firstname} {agent.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <div>
              <AlertTitle>No Data Found or No Network Connection</AlertTitle>
              <AlertDescription className="text-xs">
                Please check your internet connection or try again later.
              </AlertDescription>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CheckCircle2Icon className="h-6 w-6 text-green-600" />
            <div>
              <AlertTitle className="text-black">Create New Data</AlertTitle>
              <AlertDescription className="text-xs">
                You can start by adding new entries to populate your database.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* No Data Alert */}
      {!loading && !error && filteredActivities.length === 0 && (
        <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
          <AlertCircleIcon className="h-6 w-6 text-red-600" />
          <div>
            <AlertTitle>No Data Found</AlertTitle>
            <AlertDescription>Please check your filters or try again later.</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Total info */}
      {filteredActivities.length > 0 && (
        <div className="mb-2 text-xs font-bold">
          Total Activities: {filteredActivities.length} | Unique SO Number: {uniqueQuotationCount}
        </div>
      )}

      {/* Table */}
      {filteredActivities.length > 0 && (
        <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2 font-mono">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="w-[120px] text-xs">Date Created</TableHead>
                <TableHead className="text-xs text-right">SO Amount</TableHead>
                <TableHead className="text-xs">SO Number</TableHead>
                <TableHead className="text-xs">Company Name</TableHead>
                <TableHead className="text-xs">Contact Person</TableHead>
                <TableHead className="text-xs">Contact Number</TableHead>
                <TableHead className="text-xs">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivities.map((item) => {
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                    <TableCell className="flex items-center gap-2 capitalize">
                      {agentMap[item.referenceid?.toLowerCase() ?? ""]?.profilePicture ? (
                        <img
                          src={agentMap[item.referenceid?.toLowerCase()]!.profilePicture}
                          alt={agentMap[item.referenceid?.toLowerCase()]!.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          N/A
                        </div>
                      )}
                      <span>{agentMap[item.referenceid?.toLowerCase()]?.name || "-"}</span>
                    </TableCell>
                    <TableCell>{new Date(item.date_created).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {item.so_amount !== undefined && item.so_amount !== null
                        ? item.so_amount.toLocaleString(undefined, {
                          style: "currency",
                          currency: "PHP",
                        })
                        : "-"}
                    </TableCell>
                    <TableCell className="uppercase">{item.so_number || "-"}</TableCell>
                    <TableCell>{item.company_name}</TableCell>
                    <TableCell>{item.contact_person}</TableCell>
                    <TableCell>{item.contact_number}</TableCell>
                    <TableCell className="capitalize">{item.call_type || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <TableRow className="bg-muted font-semibold text-xs">
                <TableCell colSpan={1} className="text-right pr-4">
                  Totals:
                </TableCell>
                <TableCell className="text-right">
                  {totalQuotationAmount.toLocaleString(undefined, {
                    style: "currency",
                    currency: "PHP",
                  })}
                </TableCell>
                <TableCell colSpan={6}></TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center mt-4 text-xs">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {/* Current page / total pages */}
            <div className="px-4 font-medium select-none">
              {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
            </div>

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < pageCount) setPage(page + 1);
                }}
                aria-disabled={page === pageCount}
                className={page === pageCount ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
};
