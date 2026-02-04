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

interface SI {
  id: number;
  actual_sales?: number;
  dr_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  account_reference_number?: string;
  company_name?: string;
  contact_person?: string;
  contact_number?: string;
  type_activity: string;
  status: string;
  delivery_date: string;
  si_date: string;
  payment_terms: string;
  referenceid: string;
  so_number: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
  profilePicture: string;
}

interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

const PAGE_SIZE = 10;

export const SITable: React.FC<SIProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  userDetails,
  setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<SI[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination state
  const [page, setPage] = useState(1);

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  // Fetch activities
  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    setErrorActivities(null);

    fetch(`/api/act-fetch-manager-history?referenceid=${encodeURIComponent(referenceid)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [referenceid]);

  // Real-time subscription using Supabase
  useEffect(() => {
    fetchActivities();

    if (!referenceid) return;

    const channel = supabase
      .channel(`public:history:manager=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `manager=eq.${referenceid}`,
        },
        (payload) => {
          const newRecord = payload.new as SI;
          const oldRecord = payload.old as SI;

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

  // Filter logic
  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return activities
      .filter(
        (item) =>
          item.type_activity?.toLowerCase() === "delivered / closed transaction"
      )
      .filter((item) => {
        if (!search) return true;
        return (
          (item.company_name?.toLowerCase().includes(search) ?? false) ||
          (item.dr_number?.toLowerCase().includes(search) ?? false) ||
          (item.remarks?.toLowerCase().includes(search) ?? false)
        );
      })
      .filter((item) => (filterStatus === "all" ? true : item.status === filterStatus))
      .filter((item) => (selectedAgent === "all" ? true : item.referenceid === selectedAgent))
      .filter((item) => {
        if (
          !dateCreatedFilterRange ||
          (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)
        ) {
          return true;
        }

        const updatedDate = new Date(item.delivery_date);
        if (isNaN(updatedDate.getTime())) return false;

        const fromDate = dateCreatedFilterRange.from
          ? new Date(dateCreatedFilterRange.from)
          : null;
        const toDate = dateCreatedFilterRange.to
          ? new Date(dateCreatedFilterRange.to)
          : null;

        if (fromDate && toDate) {
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
        }

        if (fromDate && updatedDate < fromDate) return false;
        if (toDate && updatedDate > toDate) return false;

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date_updated ?? b.date_created).getTime() -
          new Date(a.date_updated ?? a.date_created).getTime()
      );
  }, [activities, searchTerm, filterStatus, selectedAgent, dateCreatedFilterRange]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus, dateCreatedFilterRange, selectedAgent]);

  // Calculate totals for footer (for filteredActivities, not paginated subset)
  const totalQuotationAmount = useMemo(() => {
    return filteredActivities.reduce((acc, item) => acc + (item.actual_sales ?? 0), 0);
  }, [filteredActivities]);

  // Count unique DR Number (non-null)
  const uniqueQuotationCount = useMemo(() => {
    const uniqueSet = new Set<string>();
    filteredActivities.forEach((item) => {
      if (item.dr_number) uniqueSet.add(item.dr_number);
    });
    return uniqueSet.size;
  }, [filteredActivities]);

  // Pagination logic
  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  // Loading & Error flags
  const isLoading = loadingActivities;
  const error = errorActivities;

  // Agent map for name + profile pic
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

  // Fetch agents on userDetails.referenceid change
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-manager-all-user?id=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch agents");

        const data = await response.json();
        setAgents(data);
      } catch (err) {
        console.error("Error fetching agents:", err);
        setErrorActivities("Failed to load agents.");
      }
    };

    fetchAgents();
  }, [userDetails.referenceid]);

  return (
    <>
      {/* Search and Agent filter */}
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
              <SelectItem
                className="capitalize"
                key={agent.ReferenceID}
                value={agent.ReferenceID}
              >
                {agent.Firstname} {agent.Lastname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <Spinner className="size-8" />
        </div>
      )}

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
      {!isLoading && !error && filteredActivities.length === 0 && (
        <Alert
          variant="destructive"
          className="flex items-center space-x-3 p-4 text-xs"
        >
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
          Total Activities: {filteredActivities.length} | Unique DR Number:{" "}
          {uniqueQuotationCount}
        </div>
      )}

      {/* Table */}
      {filteredActivities.length > 0 && (
        <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2 font-mono">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="w-[120px] text-xs">Delivery Date</TableHead>
                <TableHead className="text-xs">SI Date</TableHead>
                <TableHead className="text-xs text-right">SI Amount</TableHead>
                <TableHead className="text-xs">DR Number</TableHead>
                <TableHead className="text-xs">SO Number</TableHead>
                <TableHead className="text-xs">Company Name</TableHead>
                <TableHead className="text-xs">Contact Person</TableHead>
                <TableHead className="text-xs">Contact Number</TableHead>
                <TableHead className="text-xs">Remarks</TableHead>
                <TableHead className="text-xs">Payment Terms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivities.map((item) => {
                const agentData = agentMap[item.referenceid?.toLowerCase() ?? ""];

                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                    <TableCell className="flex items-center gap-2 capitalize">
                      {agentData?.profilePicture ? (
                        <img
                          src={agentData.profilePicture}
                          alt={agentData.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          N/A
                        </div>
                      )}
                      <span>{agentData?.name || "-"}</span>
                    </TableCell>
                    <TableCell>{new Date(item.delivery_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(item.si_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {item.actual_sales !== undefined && item.actual_sales !== null
                        ? item.actual_sales.toLocaleString(undefined, {
                            style: "currency",
                            currency: "PHP",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="uppercase">{item.dr_number || "-"}</TableCell>
                    <TableCell className="uppercase">{item.so_number}</TableCell>
                    <TableCell>{item.company_name}</TableCell>
                    <TableCell>{item.contact_person}</TableCell>
                    <TableCell>{item.contact_number}</TableCell>
                    <TableCell className="capitalize">{item.remarks || "-"}</TableCell>
                    <TableCell>{item.payment_terms}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <TableRow className="bg-muted font-semibold text-xs">
                <TableCell colSpan={3} className="text-right pr-4">
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
