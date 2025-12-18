"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FilterIcon } from "lucide-react";

interface TaskListDialogProps {
  filterStatus: string;
  filterTypeActivity: string;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  setFilterTypeActivity: React.Dispatch<React.SetStateAction<string>>;
  statusOptions: string[];
  typeActivityOptions: string[];
}

export const TaskListDialog: React.FC<TaskListDialogProps> = ({
  filterStatus,
  filterTypeActivity,
  setFilterStatus,
  setFilterTypeActivity,
  statusOptions,
  typeActivityOptions,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Icon button trigger */}
      <Button
        variant="outline"
        aria-label="Open filters"
        className="ml-auto flex items-center justify-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <FilterIcon className="h-5 w-5" />
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Activities</DialogTitle>
            <DialogDescription>
              Select status and activity type to filter the list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Status Select */}
            <div>
              <label
                htmlFor="status-select"
                className="block text-sm font-medium mb-1"
              >
                Status
              </label>
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value)}
                aria-label="Filter by status"
              >
                <SelectTrigger id="status-select" className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Activity Select */}
            <div>
              <label
                htmlFor="type-activity-select"
                className="block text-sm font-medium mb-1"
              >
                Activity Type
              </label>
              <Select
                value={filterTypeActivity}
                onValueChange={(value) => setFilterTypeActivity(value)}
                aria-label="Filter by activity type"
              >
                <SelectTrigger id="type-activity-select" className="w-full">
                  <SelectValue placeholder="All Activity Types" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Activity Types</SelectItem>
                  {typeActivityOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setFilterStatus("all");
                setFilterTypeActivity("all");
              }}
            >
              Clear Filters
            </Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
