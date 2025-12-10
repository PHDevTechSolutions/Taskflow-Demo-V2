"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { type DateRange } from "react-day-picker";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Company {
  account_reference_number: string;
  company_name: string;
  contact_number?: string;
  type_client?: string;
  contact_person?: string;
}

interface Activity {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  status: string;
  date_updated: string;
  date_created: string;
}

interface HistoryRecord {
  activity_reference_number: string;
  so_number: string;
  so_amount: string;
}

interface NewTaskProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
}

const PAGE_SIZE = 10;

export const PendingTable: React.FC<NewTaskProps> = ({
  referenceid,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch companies
  useEffect(() => {
    if (!referenceid) {
      setCompanies([]);
      return;
    }
    setLoadingCompanies(true);
    setErrorCompanies(null);

    fetch(`/api/com-fetch-companies`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch company data");
        return res.json();
      })
      .then((data) => {
        setCompanies(data.data || []);
      })
      .catch((err) => {
        setErrorCompanies(err.message || "Error fetching company data");
      })
      .finally(() => {
        setLoadingCompanies(false);
      });
  }, [referenceid]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!referenceid) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    setErrorActivities(null);

    try {
      const res = await fetch(
        `/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to fetch activities");
      }

      const json = await res.json();
      setActivities(json.data || []);
    } catch (error: any) {
      setErrorActivities(error.message || "Error fetching activities");
    } finally {
      setLoadingActivities(false);
    }
  }, [referenceid]);

  // Fetch history, accepts activity refs as parameter
  const fetchHistory = useCallback(
    async (activityRefs: string[]) => {
      if (!referenceid) {
        setHistory([]);
        return;
      }
      if (activityRefs.length === 0) {
        setHistory([]);
        return;
      }
      setLoadingHistory(true);
      setErrorHistory(null);

      try {
        const queryParams = activityRefs
          .map((ref) => `activity_reference_numbers=${encodeURIComponent(ref)}`)
          .join("&");

        const res = await fetch(`/api/act-fetch-so-pending?${queryParams}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.message || "Failed to fetch history data");
        }

        const json = await res.json();
        setHistory(json.data || []);
      } catch (error: any) {
        setErrorHistory(error.message || "Error fetching history data");
      } finally {
        setLoadingHistory(false);
      }
    },
    [referenceid]
  );

  // Effect to fetch activities + subscribe to real-time updates
  useEffect(() => {
    fetchActivities();

    if (!referenceid) return;

    const channel = supabase
      .channel(`public:activity:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity",
          filter: `referenceid=eq.${referenceid}`,
        },
        (payload) => {
          const newRecord = payload.new as Activity;
          const oldRecord = payload.old as Activity;

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

  // Effect to fetch history when activities change
  useEffect(() => {
    const activityRefs = activities
      .map((a) => a.activity_reference_number)
      .filter(Boolean);
    fetchHistory(activityRefs);
  }, [activities, fetchHistory]);

  // Date range filter helper
  const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
    if (!range) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const { from, to } = range;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const allowedStatuses = ["SO-Done"];

  const mergedData = useMemo(() => {
    const historyMap = new Map<string, HistoryRecord[]>();
    history.forEach((h) => {
      const key = h.activity_reference_number?.trim();
      if (!historyMap.has(key)) {
        historyMap.set(key, []);
      }
      historyMap.get(key)?.push(h);
    });

    // Calculate cutoff date 15 days ago from today
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - 15); // 15 days ago

    return activities
      .filter((a) => allowedStatuses.includes(a.status))
      // Filter for date_created older than 15 days ago
      .filter((a) => {
        const createdDate = new Date(a.date_created);
        return !isNaN(createdDate.getTime()) && createdDate <= cutoffDate;
      })
      .map((activity) => {
        const company = companies.find(
          (c) => c.account_reference_number === activity.account_reference_number
        );

        const key = activity.activity_reference_number?.trim();
        const historyRecords = historyMap.get(key) || [];

        const latestHistory = historyRecords[0];

        return {
          ...activity,
          company_name: company?.company_name ?? "Unknown Company",
          contact_number: company?.contact_number ?? "-",
          type_client: company?.type_client ?? "",
          contact_person: company?.contact_person ?? "",
          so_number: latestHistory?.so_number ?? "-",
          so_amount: latestHistory?.so_amount ?? "-",
        };
      })
      .sort(
        (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
      );
  }, [activities, companies, history]);

  // Apply search filtering (search all fields including so_number & so_amount)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return mergedData;

    const lowerSearch = searchTerm.toLowerCase();

    return mergedData.filter((item) =>
      [
        item.company_name,
        item.contact_person,
        item.contact_number,
        item.status,
        item.type_client,
        item.so_number,
        item.so_amount,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(lowerSearch))
    );
  }, [mergedData, searchTerm]);

  // Pagination logic
  const pageCount = Math.ceil(filteredData.length / PAGE_SIZE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  // Update loading and error to include history
  const isLoading = loadingCompanies || loadingActivities || loadingHistory;
  const error = errorCompanies || errorActivities || errorHistory;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
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
            <AlertTitle className="text-black">Add New Data</AlertTitle>
            <AlertDescription className="text-xs">
              You can start by adding new entries to populate your database.
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <div>
      {/* Top bar with total + search */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search company, quotation number or remarks..."
          className="input input-bordered input-sm flex-grow max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search quotations"
        />
      </div>

      <div className="overflow-auto custom-scrollbar rounded-md border p-4 space-y-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Company Name</TableHead>
              <TableHead className="text-xs">Contact Person</TableHead>
              <TableHead className="text-xs">Contact Number</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Date Created</TableHead>
              <TableHead className="text-xs">SO Number</TableHead>
              <TableHead className="text-xs">SO Amount</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-xs py-6">
                  No matching records found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => {
                let badgeColor: "default" | "secondary" | "destructive" | "outline" = "default";

                if (item.status === "SO-Done") {
                  badgeColor = "secondary";
                }

                return (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell>{item.company_name}</TableCell>
                    <TableCell>{item.contact_person}</TableCell>
                    <TableCell>{item.contact_number}</TableCell>
                    <TableCell>
                      <Badge variant={badgeColor} className="text-[8px]">
                        {item.status.replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(item.date_created).toLocaleDateString()}</TableCell>

                    <TableCell>{item.so_number}</TableCell>
                    <TableCell>{item.so_amount}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <Pagination>
          <PaginationContent className="flex items-center space-x-4 justify-center mt-4 text-xs">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              >
                Previous
              </PaginationPrevious>
            </PaginationItem>

            <div className="px-4 font-medium select-none">
              {pageCount === 0 ? "0 / 0" : `${currentPage} / ${pageCount}`}
            </div>

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < pageCount) setCurrentPage(currentPage + 1);
                }}
                aria-disabled={currentPage === pageCount}
                className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
              >
                Next
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
