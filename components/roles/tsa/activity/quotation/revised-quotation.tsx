"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PenIcon,
  MoreVertical,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { TaskListDialog } from "../tasklist/dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../planner/dialog/delete";

interface SupervisorDetails {
  firstname: string;
  lastname: string;
  email: string;
  profilePicture: string;
  signatureImage: string;
  contact: string;
}

interface Completed {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_client: string;
  project_name?: string;
  product_category?: string;
  project_type?: string;
  source?: string;
  type_activity?: string;
  quotation_number?: string;
  quotation_amount?: number;
  ticket_reference_number?: string;
  remarks?: string;
  status?: string;
  start_date: string;
  end_date: string;
  date_created: string;
  date_updated?: string;
  account_reference_number?: string;
  quotation_type: string;
  company_name: string;
  contact_number: string;
  email_address: string;
  address: string;
  contact_person: string;
  tsm_approved_status: string;
  vat_type: string;
  delivery_fee: string;
  restocking_fee?: string;
  quotation_vatable?: string;
  quotation_subject?: string;
  agent_signature: string;
  agent_contact_number: string;
  agent_email_address: string;
  tsm_signature: string;
  tsm_contact_number: string;
  tsm_email_address: string;
  manager_signature: string;
  manager_contact_number: string;
  manager_email_address: string;
  tsm_approval_date: string;
  manager_approval_date: string;
  tsm_remarks: string;
  manager_remarks: string;
  quotation_status: string;
}

interface CompletedProps {
  referenceid: string;
  target_quota?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
  signature?: string;
  managerDetails?: SupervisorDetails | null;
  tsmDetails?: SupervisorDetails | null;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const RevisedQuotation: React.FC<CompletedProps> = ({
  referenceid,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  signature,
  managerDetails: managerDetailsProp,
  tsmDetails: tsmDetailsProp,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const searchParams = useSearchParams();

  const highlightRef = searchParams?.get("highlight") ?? null;
  const openEditRef = searchParams?.get("openEdit") ?? null;
  const actionRef = (searchParams?.get("action") ?? null) as
    | "preview"
    | "download"
    | null;

  const [activities, setActivities] = useState<Completed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Set search term if highlight is present
  useEffect(() => {
    if (highlightRef) {
      setSearchTerm(highlightRef);
    }
  }, [highlightRef]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

  const [editItem, setEditItem] = useState<Completed | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAutoAction, setEditAutoAction] = useState<
    "preview" | "download" | null
  >(null);

  const autoOpenFiredRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");

  const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(
    tsmDetailsProp ?? null,
  );
  const [managerDetails, setManagerDetails] =
    useState<SupervisorDetails | null>(managerDetailsProp ?? null);

  const [highlightedArn, setHighlightedArn] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // ── Inline status edit state ─────────────────────────────────────────────
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});

  // ── Master password dialog ───────────────────────────────────────────────
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const MASTER_PASSWORD = "PHDEVTECH";

  useEffect(() => {
    if (tsmDetailsProp !== undefined) setTsmDetails(tsmDetailsProp);
  }, [tsmDetailsProp]);

  useEffect(() => {
    if (managerDetailsProp !== undefined) setManagerDetails(managerDetailsProp);
  }, [managerDetailsProp]);

  useEffect(() => {
    if (!referenceid) return;
    if (managerDetailsProp !== undefined && tsmDetailsProp !== undefined)
      return;
    const fetchHierarchy = async () => {
      try {
        const response = await fetch(
          `/api/user?id=${encodeURIComponent(referenceid)}`,
        );
        if (!response.ok) throw new Error("Failed");
        const data = await response.json();
        setTsmDetails(data.tsmDetails ?? null);
        setManagerDetails(data.managerDetails ?? null);
      } catch (e) {
        console.error("Hierarchy fetch error:", e);
      }
    };
    fetchHierarchy();
  }, [referenceid, managerDetailsProp, tsmDetailsProp]);

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

    const url = new URL(
      "/api/activity/tsa/quotation/fetch",
      window.location.origin,
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    if (!referenceid) return;
    fetchActivities();
    const channel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        () => fetchActivities(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  // ── Highlight + scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!highlightRef) return;
    setHighlightedArn(highlightRef);
    const t1 = setTimeout(() => {
      // Find row by either activity_reference_number OR quotation_number
      const targetRow = rowRefs.current.get(highlightRef);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    const t2 = setTimeout(() => setHighlightedArn(null), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightRef, activities]);

  // ── Auto-open edit dialog ────────────────────────────────────────────────
  useEffect(() => {
    if (!openEditRef || activities.length === 0) return;
    if (autoOpenFiredRef.current === openEditRef) return;

    const target = activities.find(
      (a) => a.activity_reference_number === openEditRef,
    );
    if (!target) return;

    autoOpenFiredRef.current = openEditRef;
    setEditItem(target);
    setEditAutoAction(actionRef);
    setEditOpen(true);
  }, [openEditRef, actionRef, activities]);

  // ── Alt + Ctrl + E  →  toggle inline status-edit mode ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (editStatusMode) {
          // Already on — toggle off directly, no password needed
          setEditStatusMode(false);
          setPendingStatuses({});
        } else {
          // Toggle on — require password first
          setPwInput("");
          setPwError(false);
          setPwDialogOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editStatusMode]);

  // ── Save a single row's inline status ───────────────────────────────────
  const saveStatus = async (item: Completed) => {
    const newStatus = pendingStatuses[item.id];
    if (!newStatus || newStatus === item.tsm_approved_status) return;
    try {
      await fetch("/api/act-update-status", { // ← adjust to your real endpoint
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, tsm_approved_status: newStatus }),
      });
      fetchActivities();
    } catch (err) {
      console.error("Status update failed", err);
    }
  };

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.date_updated ?? b.date_created).getTime() -
          new Date(a.date_updated ?? a.date_created).getTime(),
      ),
    [activities],
  );

  const hasMeaningfulData = (item: Completed) =>
    [
      "activity_reference_number",
      "referenceid",
      "quotation_number",
      "quotation_amount",
    ].some((col) => {
      const val = (item as any)[col];
      if (val === null || val === undefined) return false;
      if (typeof val === "string") return val.trim() !== "";
      if (typeof val === "number") return !isNaN(val);
      return Boolean(val);
    });

  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return sortedActivities
      .filter((item) => {
        if (!search) return true;
        return Object.values(item).some(
          (v) =>
            v !== null &&
            v !== undefined &&
            String(v).toLowerCase().includes(search),
        );
      })
      .filter((item) => {
        if (filterStatus !== "all" && item.status !== filterStatus)
          return false;
        return item.type_activity === "Quotation Preparation";
      })
      .filter((item) => {
        if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to)
          return true;
        const updated = new Date(item.date_updated ?? item.date_created);
        if (isNaN(updated.getTime())) return false;
        if (
          dateCreatedFilterRange.from &&
          updated < new Date(dateCreatedFilterRange.from)
        )
          return false;
        if (
          dateCreatedFilterRange.to &&
          updated > new Date(dateCreatedFilterRange.to)
        )
          return false;
        return true;
      })
      .filter(hasMeaningfulData);
  }, [sortedActivities, searchTerm, filterStatus, dateCreatedFilterRange]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.status) s.add(a.status);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const typeActivityOptions = useMemo(() => {
    const s = new Set<string>();
    sortedActivities.forEach((a) => {
      if (a.type_activity) s.add(a.type_activity);
    });
    return Array.from(s).sort();
  }, [sortedActivities]);

  const openEditDialog = (item: Completed) => {
    setEditItem(item);
    setEditAutoAction(null);
    setEditOpen(true);
  };
  const closeEditDialog = () => {
    setEditOpen(false);
    setEditItem(null);
    setEditAutoAction(null);
  };
  const onEditSaved = () => {
    fetchActivities();
    closeEditDialog();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const onConfirmRemove = async () => {
    try {
      const res = await fetch("/api/act-delete-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          remarks: removeRemarks,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setRemoveRemarks("");
      fetchActivities();
    } catch (e) {
      console.error(e);
    }
  };

  const displayValue = (v: any) =>
    v === null || v === undefined || String(v).trim() === "" ? "" : String(v);

  function formatDuration(start?: string, end?: string) {
    if (!start || !end) return "-";
    const s = new Date(start),
      e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
    let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    diff %= 3600;
    const m = Math.floor(diff / 60);
    const sec = diff % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} hr${h !== 1 ? "s" : ""}`);
    if (m > 0) parts.push(`${m} min${m !== 1 ? "s" : ""}`);
    if (sec > 0 || parts.length === 0)
      parts.push(`${sec} sec${sec !== 1 ? "s" : ""}`);
    return parts.join(" ");
  }

  return (
    <>
      <style>{`
        @keyframes rq-highlight-pulse {
          0%   { background-color: rgb(254 249 195); }
          50%  { background-color: rgb(253 224 71);  }
          100% { background-color: rgb(254 249 195); }
        }
        .rq-highlight-row {
          animation: rq-highlight-pulse 0.8s ease-in-out 3;
          outline: 2px solid rgb(234 179 8);
          outline-offset: -2px;
        }
        .status-edit-mode-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgb(239 246 255);
          border: 1px solid rgb(147 197 253);
          color: rgb(29 78 216);
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search company, reference ID, status, or activity..."
          className="input input-bordered input-sm grow max-w-md rounded-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex items-center space-x-2">
          {/* Edit-mode indicator badge */}
          {editStatusMode && (
            <span className="status-edit-mode-badge">
              <PenIcon className="w-3 h-3" />
              Status Edit ON
            </span>
          )}

          <TaskListDialog
            filterStatus={filterStatus}
            filterTypeActivity={filterTypeActivity}
            setFilterStatus={setFilterStatus}
            setFilterTypeActivity={setFilterTypeActivity}
            statusOptions={statusOptions}
            typeActivityOptions={typeActivityOptions}
          />
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center space-x-1 cursor-pointer rounded-none"
            >
              <span>Delete Selected ({selectedIds.size})</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="flex flex-col space-y-4 p-4 text-xs"
        >
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

      {filteredActivities.length > 0 && (
        <div className="mb-2 text-xs font-bold">
          Total Records: {filteredActivities.length}
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="overflow-auto space-y-8 custom-scrollbar">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-[60px] text-center">Tools</TableHead>
                <TableHead>Quotation #</TableHead>
                <TableHead className="text-left">Remarks</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date Approved/Decline</TableHead>
                <TableHead>Contact #</TableHead>
                <TableHead>Quotation Amount</TableHead>
                <TableHead>Date Created</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredActivities.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isHighlighted =
                  highlightedArn === item.activity_reference_number ||
                  highlightedArn === item.quotation_number;

                return (
                  <TableRow
                    key={item.id}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current.set(item.activity_reference_number, el);
                        if (item.quotation_number)
                          rowRefs.current.set(item.quotation_number, el);
                      } else {
                        rowRefs.current.delete(item.activity_reference_number);
                        if (item.quotation_number)
                          rowRefs.current.delete(item.quotation_number);
                      }
                    }}
                    className={isHighlighted ? "rq-highlight-row" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        className="w-6 h-6 hover:bg-gray-100 rounded cursor-pointer"
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>

                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="rounded-none flex items-center gap-1 text-xs cursor-pointer">
                            Actions <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-none text-xs"
                        >
                          <DropdownMenuItem
                            onClick={() => openEditDialog(item)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <PenIcon className="w-4 h-4" /> Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    <TableCell className="uppercase">
                      {displayValue(item.quotation_number)}
                    </TableCell>

                    <TableCell className="text-left">
                      {item.quotation_status}
                    </TableCell>

                    {/* ── Status cell: inline-edit when mode is ON ── */}
                    <TableCell className="p-2 font-semibold">
                      {editStatusMode ? (
                        <input
                          className="border border-blue-300 rounded px-2 py-1 text-xs w-28 capitalize font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
                          value={
                            pendingStatuses[item.id] !== undefined
                              ? pendingStatuses[item.id]
                              : item.tsm_approved_status
                          }
                          onChange={(e) => {
                            const value = e.target.value
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()); // capitalize each word

                            setPendingStatuses((prev) => ({
                              ...prev,
                              [item.id]: value,
                            }));
                          }}
                          onBlur={() => saveStatus(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") {
                              setPendingStatuses((prev) => {
                                const next = { ...prev };
                                delete next[item.id];
                                return next;
                              });
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold 
                            ${item.tsm_approved_status === "Approved" ||
                              item.tsm_approved_status === "Approved By Sales Head"
                              ? "bg-green-100 text-green-700"
                              : item.tsm_approved_status === "Pending"
                                ? "bg-orange-100 text-orange-700"
                                : item.tsm_approved_status === "Decline"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                        >
                          {item.tsm_approved_status}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap font-mono">
                      {formatDuration(item.start_date, item.end_date)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {item.company_name}
                    </TableCell>
                    <TableCell>
                      {item.tsm_approval_date && (
                        <>
                          Approved:{" "}
                          {new Date(item.tsm_approval_date).toLocaleString(
                            "en-PH",
                            {
                              timeZone: "Asia/Manila",
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            },
                          )}
                        </>
                      )}
                      {item.manager_approval_date && (
                        <>
                          <br />
                          Sales Head Approved:{" "}
                          {new Date(item.manager_approval_date).toLocaleString(
                            "en-PH",
                            {
                              timeZone: "Asia/Manila",
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            },
                          )}
                        </>
                      )}
                      {item.tsm_remarks && displayValue(item.tsm_remarks) && (
                        <>
                          <br />
                          TSM: {displayValue(item.tsm_remarks)}
                        </>
                      )}
                      {item.manager_remarks &&
                        displayValue(item.manager_remarks) && (
                          <>
                            <br />
                            Sales Head: {displayValue(item.manager_remarks)}
                          </>
                        )}
                    </TableCell>
                    <TableCell>{displayValue(item.contact_number)}</TableCell>
                    <TableCell>
                      ₱
                      {displayValue(item.quotation_amount) !== ""
                        ? parseFloat(
                          displayValue(item.quotation_amount),
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(
                        item.date_updated ?? item.date_created,
                      ).toLocaleDateString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editOpen && editItem && (
        <TaskListEditDialog
          item={editItem}
          onClose={closeEditDialog}
          onSave={onEditSaved}
          firstname={firstname}
          lastname={lastname}
          email={email}
          contact={contact}
          tsmname={tsmname}
          managername={managername}
          company={{
            company_name: editItem.company_name,
            contact_number: editItem.contact_number,
            email_address: editItem.email_address,
            address: editItem.address,
            contact_person: editItem.contact_person,
          }}
          vatType={editItem.vat_type}
          deliveryFee={editItem.delivery_fee}
          restockingFee={editItem.restocking_fee ?? ""}
          whtType={editItem.quotation_vatable ?? "none"}
          quotationSubject={editItem.quotation_subject ?? "For Quotation"}
          agentSignature={editItem.agent_signature}
          agentContactNumber={editItem.agent_contact_number}
          agentEmailAddress={editItem.agent_email_address}
          TsmSignature={editItem.tsm_signature}
          TsmEmailAddress={editItem.tsm_email_address}
          TsmContactNumber={editItem.tsm_contact_number}
          ManagerSignature={editItem.manager_signature}
          ManagerContactNumber={editItem.manager_contact_number}
          ManagerEmailAddress={editItem.manager_email_address}
          ApprovedStatus={editItem.tsm_approved_status}
          autoAction={editAutoAction}
        />
      )}

      {/* ── Master Password Dialog ── */}
      {pwDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPwDialogOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <PenIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">Status Edit — Authorization</h2>
            </div>
            <p className="text-xs text-gray-500">
              Enter the master password to enable inline status editing.
            </p>
            <input
              autoFocus
              type="password"
              placeholder="Master password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }
                if (e.key === "Escape") setPwDialogOpen(false);
              }}
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${pwError
                ? "border-red-400 focus:ring-red-200 bg-red-50"
                : "border-gray-300 focus:ring-blue-200"
                }`}
            />
            {pwError && (
              <p className="text-xs text-red-500 -mt-2 flex items-center gap-1">
                <AlertCircleIcon className="w-3 h-3" /> Incorrect password. Try again.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="text-xs rounded-lg"
                onClick={() => setPwDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="text-xs rounded-lg"
                onClick={() => {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }}
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}

      <AccountsActiveDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={onConfirmRemove}
      />
    </>
  );
};