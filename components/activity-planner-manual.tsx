"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/utils/supabase";
import { DoneDialog } from "./activity-done-dialog";
import { CreateActivityDialog } from "./activity-create-dialog";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Company {
  id: string;
  account_reference_number: string;
  company_name: string;
  contact_number?: string;
  type_client?: string;
  email_address: string;
  contact_person: string;
  address: string;
  status: string;
}

interface Manual {
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

interface ManualProps {
  tsm: string;
  manager: string;
  referenceid: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  target_quota?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
}

export const Manual: React.FC<ManualProps> = ({
  tsm,
  manager,
  referenceid,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  target_quota,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activities, setActivities] = useState<Manual[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const [addingAccount, setAddingAccount] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // For activities right side search and pagination
  const [activitySearchTerm, setActivitySearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loadingAllCompanies, setLoadingAllCompanies] = useState(false);
  const [errorAllCompanies, setErrorAllCompanies] = useState<string | null>(null);

  // Fetch all companies (for right side activities)
  useEffect(() => {
    setLoadingAllCompanies(true);
    setErrorAllCompanies(null);

    fetch(`/api/com-fetch-companies`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch all companies");
        return res.json();
      })
      .then((data) => {
        setAllCompanies(data.data || []);
      })
      .catch((err) => {
        setErrorAllCompanies(err.message || "Error fetching all companies");
      })
      .finally(() => {
        setLoadingAllCompanies(false);
      });
  }, []);


  // Fetch companies
  useEffect(() => {
    if (!referenceid) {
      setCompanies([]);
      return;
    }
    setLoadingCompanies(true);
    setErrorCompanies(null);

    fetch(`/api/com-fetch-account?referenceid=${encodeURIComponent(referenceid)}`, {
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
      const res = await fetch(`/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

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

  // Subscribe realtime changes
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
          const newRecord = payload.new as Manual;
          const oldRecord = payload.old as Manual;

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

  const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
    if (!range) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const { from, to } = range;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const allowedStatuses = ["On-Progress", "Assisted", "Quote-Done", "SO-Done"];

  // Merged data with company info and filtered by status and date range
  const mergedData = activities
    .filter((a) => allowedStatuses.includes(a.status))
    .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
    .map((activity) => {
      const company = allCompanies.find(
        (c) => c.account_reference_number === activity.account_reference_number
      );
      return {
        ...activity,
        company_name: company?.company_name ?? "Unknown Company",
        contact_number: company?.contact_number ?? "-",
        type_client: company?.type_client ?? "",
        contact_person: company?.contact_person ?? "",
        email_address: company?.email_address ?? "",
        address: company?.address ?? "",
      };
    })
    .sort(
      (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
    );


  const isLoading = loadingCompanies || loadingActivities;
  const error = errorCompanies || errorActivities;

  const excludedCompanyStatuses = ["Pending", "Transferred", "Remove"];

  const filteredCompanies = companies.filter((c) => {
    if (excludedCompanyStatuses.includes(c.status)) return false;

    const term = searchTerm.toLowerCase();
    return (
      (c.company_name?.toLowerCase().includes(term) ?? false) ||
      (c.email_address?.toLowerCase().includes(term) ?? false) ||
      (c.contact_number?.toLowerCase().includes(term) ?? false) ||
      (c.contact_person?.toLowerCase().includes(term) ?? false)
    );
  });

  const MAX_DISPLAY = 20;

  const displayedCompanies = searchTerm
    ? filteredCompanies
    : filteredCompanies.slice(0, MAX_DISPLAY);

  // Activities filtered by search term (right side)
  const filteredActivities = useMemo(() => {
    if (!activitySearchTerm.trim()) return mergedData;

    const term = activitySearchTerm.toLowerCase();
    return mergedData.filter((item) => {
      return (
        item.company_name.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term) ||
        item.activity_reference_number.toLowerCase().includes(term) ||
        item.account_reference_number.toLowerCase().includes(term)
      );
    });
  }, [activitySearchTerm, mergedData]);

  const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);

  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredActivities]);

  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    else if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  // Generates activity reference number from company initials + region + timestamp
  function generateActivityReferenceNumber(companyName: string): string {
    const initials = companyName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const region = "REG"; // TODO: replace with real region logic if needed
    const timestamp = Date.now();
    return `${initials}-${region}-${timestamp}`;
  }

  const openDoneDialog = (id: string) => {
    setSelectedActivityId(id);
    setDialogOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;

    try {
      setUpdatingId(selectedActivityId);
      setDialogOpen(false);

      const res = await fetch("/api/act-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(`Failed to update status: ${result.error || "Unknown error"}`);
        setUpdatingId(null);
        return;
      }

      await fetchActivities();

      toast.success("Transaction marked as Done.");
    } catch {
      toast.error("An error occurred while updating status.");
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleAddActivity = async (company: Company) => {
    if (!referenceid) {
      toast.error("Missing reference ID");
      return;
    }

    if (!tsm || !manager) {
      toast.error("TSM or Manager information is missing.");
      return;
    }

    setAddingAccount(company.account_reference_number);

    const newActivityReferenceNumber = generateActivityReferenceNumber(company.company_name);

    const payload = {
      referenceid,
      tsm,
      manager,
      account_reference_number: company.account_reference_number,
      status: "On-Progress",
      activity_reference_number: newActivityReferenceNumber,
    };

    try {
      const res = await fetch("/api/act-save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(`Failed to save activity: ${json.error || "Unknown error"}`);
        setAddingAccount(null);
        return;
      }

      // 2. Calculate new next_available_date based on type_client
      const now = new Date();
      let newDate: Date;

      if (company.type_client === "TOP 50") {
        newDate = new Date(now.setDate(now.getDate() + 15)); // after 15 days
      } else {
        newDate = new Date(now.setMonth(now.getMonth() + 1)); // after 1 month
      }

      // Format date as YYYY-MM-DD
      const nextAvailableDate = newDate.toISOString().split("T")[0];

      const updateRes = await fetch("/api/act-update-account-next-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: company.id, // <-- use numeric id here
          next_available_date: nextAvailableDate,
        }),
      });


      const updateData = await updateRes.json();

      if (!updateRes.ok) {
        toast.error(`Failed to update next available date: ${updateData.error || "Unknown error"}`);
      } else {
        toast.success("Activity added and next available date updated.");
        await fetchActivities();
      }
    } catch (error) {
      toast.error("Error saving activity");
    } finally {
      setAddingAccount(null);
    }
  };


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
            <AlertTitle className="text-black">Create New Data</AlertTitle>
            <AlertDescription className="text-xs">
              You can start by adding new entries to populate your database.
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* LEFT SIDE — COMPANIES */}
      <Card className="w-full md:w-1/3 p-3 rounded-lg">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-sm font-semibold">Companies</CardTitle>
        </CardHeader>

        <CardContent className="p-0 flex flex-col">
          <input
            type="search"
            placeholder="Search company, email, contact, person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3 px-3 py-2 border rounded-md text-sm"
          />

          {displayedCompanies.length === 0 ? (
            <div className="text-muted-foreground text-sm p-3 border rounded-lg">
              No company info available.
            </div>
          ) : (
            <Accordion type="multiple" className="overflow-auto space-y-2 p-2 max-h-[500px]">
              {displayedCompanies.map((c) => (
                <AccordionItem key={c.account_reference_number} value={c.account_reference_number}>
                  <div className="flex items-center justify-between text-xs font-semibold gap-2 px-4 py-2">
                    <AccordionTrigger className="text-xs font-semibold flex-1 text-left">
                      <span
                        className="flex-1 text-left break-words whitespace-normal"
                        style={{ minWidth: 0 }}
                      >
                        {c.company_name}
                      </span>
                    </AccordionTrigger>

                    <Button
                      variant="outline"
                      disabled={addingAccount === c.account_reference_number}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddActivity(c);
                      }}
                      className="text-xs px-3 py-1"
                    >
                      {addingAccount === c.account_reference_number ? "Adding..." : "Add"}
                    </Button>
                  </div>

                  <AccordionContent className="text-xs px-4 pb-2 pt-0">
                    <p>
                      <strong>Contact Number:</strong> {c.contact_number || "-"}
                    </p>
                    <p>
                      <strong>Email Address:</strong> {c.email_address || "-"}
                    </p>
                    <p>
                      <strong>Contact Person:</strong> {c.contact_person || "-"}
                    </p>
                    <p>
                      <strong>Type Client:</strong> {c.type_client || "-"}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* RIGHT SIDE — ACTIVITIES */}
      <Card className="w-full md:w-2/3 p-4 rounded-xl flex flex-col">
        <div className="mb-2 text-xs font-bold">
          Total On-Progress Activities: {filteredActivities.length}
        </div>

        <input
          type="search"
          placeholder="Search activities by company, status, reference number..."
          value={activitySearchTerm}
          onChange={(e) => {
            setActivitySearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="mb-3 px-3 py-2 border rounded-md text-sm w-full"
        />

        <div className="max-h-[400px] overflow-auto space-y-8 custom-scrollbar flex-grow">
          <Accordion type="single" collapsible className="w-full">
            {paginatedActivities.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                No activities found.
              </div>
            ) : (
              paginatedActivities.map((item) => {
                let badgeColor: "default" | "secondary" | "outline" = "default";

                if (item.status === "Assisted" || item.status === "SO-Done") {
                  badgeColor = "secondary";
                } else if (item.status === "Quote-Done") {
                  badgeColor = "outline";
                }

                return (
                  <AccordionItem key={item.id} value={item.id}>
                    <div className="p-2 cursor-pointer select-none">
                      <div className="flex justify-between items-center">
                        <AccordionTrigger className="flex-1 text-xs font-semibold">
                          {new Date(item.date_updated ?? item.date_created).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-muted-foreground mx-1">|</span>{" "}
                          {new Date(item.date_updated ?? item.date_created).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          <span className="mx-1">-</span> {item.company_name}
                        </AccordionTrigger>

                        <div className="flex gap-2 ml-4">
                          <CreateActivityDialog
                            firstname={firstname}
                            lastname={lastname}
                            target_quota={target_quota}
                            email={email}
                            contact={contact}
                            tsmname={tsmname}
                            managername={managername}
                            referenceid={item.referenceid}
                            tsm={item.tsm}
                            manager={item.manager}
                            type_client={item.type_client}
                            contact_number={item.contact_number}
                            email_address={item.email_address}
                            activityReferenceNumber={item.activity_reference_number}
                            company_name={item.company_name}
                            contact_person={item.contact_person}
                            address={item.address}
                            accountReferenceNumber={item.account_reference_number}
                            onCreated={() => {
                              fetchActivities();
                            }}
                          />

                          <Button
                            type="button"
                            variant="secondary"
                            disabled={updatingId === item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDoneDialog(item.id);
                            }}
                          >
                            {updatingId === item.id ? "Updating..." : "Done"}
                          </Button>
                        </div>
                      </div>

                      <div className="ml-1">
                        <Badge variant={badgeColor} className="text-[8px]">
                          {item.status.replace("-", " ")}
                        </Badge>
                      </div>
                    </div>

                    <AccordionContent className="text-xs px-4 py-2">
                      <p><strong>Contact Number:</strong> {item.contact_number}</p>
                      <p><strong>Contact Person:</strong> {item.contact_person}</p>
                      <p><strong>Email Address:</strong> {item.email_address}</p>
                      <p><strong>Type Client:</strong> {item.type_client}</p>
                      <p><strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}</p>
                    </AccordionContent>
                  </AccordionItem>
                );
              })
            )}
          </Accordion>
        </div>

        {/* Pagination controls */}
        <div className="mt-4 flex justify-center items-center space-x-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Prev
          </Button>

          <span>
            Page {currentPage} / {totalPages || 1}
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>

        <DoneDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={handleConfirmDone}
          loading={updatingId !== null}
        />
      </Card>
    </div>
  );
};
