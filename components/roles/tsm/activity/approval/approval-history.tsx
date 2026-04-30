"use client";

import React, { useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";

interface HistoryItem {
  id: number;
  activity_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  call_type: string;
  source: string;
  status: string;
  tsm_approved_status?: string;
  date_created: string;
  referenceid: string;
}

interface ApprovalHistoryProps {
  history: HistoryItem[];
  dateCreatedFilterRange?: DateRange;
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
  onRefresh?: () => void;
}

export function ApprovalHistory({ history, dateCreatedFilterRange, onRefresh }: ApprovalHistoryProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [visibleItems, setVisibleItems] = useState(10);
  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Filter for "Approval for TSM" status only
    filtered = filtered.filter((h) => h.status === "Approval for TSM");

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );
  }, [history, dateCreatedFilterRange]);

  const handleApprove = (item: HistoryItem) => {
    setSelectedItem(item);
    setRemarks("");
    setApproveDialogOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedItem) return;

    setIsApproving(true);
    try {
      const response = await fetch("/api/act-update-tsm-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activity_reference_number: selectedItem.activity_reference_number,
          tsmapprovedstatus: "Approved by TSM",
          tsmapprovedremarks: remarks,
          tsmapproveddate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve");
      }

      sileo.success({
        title: "Success",
        description: "Activity approved successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });

      setApproveDialogOpen(false);
      setSelectedItem(null);
      setRemarks("");

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to approve activity. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setIsApproving(false);
    }
  };

  if (filteredHistory.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        No pending approval records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-bold uppercase">Ref #</TableHead>
            <TableHead className="text-xs font-bold uppercase">Company</TableHead>
            <TableHead className="text-xs font-bold uppercase">Contact</TableHead>
            <TableHead className="text-xs font-bold uppercase">Call Type</TableHead>
            <TableHead className="text-xs font-bold uppercase">Status</TableHead>
            <TableHead className="text-xs font-bold uppercase">Date</TableHead>
            <TableHead className="text-xs font-bold uppercase">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredHistory.slice(0, visibleItems).map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-xs font-medium">
                {item.activity_reference_number}
              </TableCell>
              <TableCell className="text-xs">
                {item.company_name || "N/A"}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex flex-col">
                  <span>{item.contact_person || "N/A"}</span>
                  <span className="text-gray-500 text-[10px]">{item.contact_number || ""}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                {item.call_type || item.source || "N/A"}
              </TableCell>
              <TableCell className="text-xs">
                <Badge variant="secondary" className="text-xs">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {item.date_created ? new Date(item.date_created).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApprove(item)}
                    title="Approve"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredHistory.length > visibleItems && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => setVisibleItems(prev => prev + 10)}
        >
          Load More ({filteredHistory.length - visibleItems} remaining)
        </Button>
      )}

      {/* Approval Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Approve Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-xs text-gray-600">
              <p><strong>Ref #:</strong> {selectedItem?.activity_reference_number}</p>
              <p><strong>Company:</strong> {selectedItem?.company_name || "N/A"}</p>
              <p><strong>Contact:</strong> {selectedItem?.contact_person || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-700 block mb-1">
                Remarks (Optional)
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter approval remarks..."
                className="rounded-none text-xs resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isApproving}
              className="rounded-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApproval}
              disabled={isApproving}
              className="rounded-none"
            >
              {isApproving ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
