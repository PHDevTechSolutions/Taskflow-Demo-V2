"use client";

import React, { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Filter } from "lucide-react";

interface AccountsActiveFilterProps {
  typeFilter: string;
  setTypeFilterAction: (value: string) => void;
  dateCreatedFilter: string | null;
  setDateCreatedFilterAction: (value: string | null) => void;
  alphabeticalFilter: string | null;
  setAlphabeticalFilterAction: (value: string | null) => void;
}

export function AccountsActiveFilter({
  typeFilter,
  setTypeFilterAction,
  dateCreatedFilter,
  setDateCreatedFilterAction,
  alphabeticalFilter,
  setAlphabeticalFilterAction,
}: AccountsActiveFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Icon button only */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Open filters"
        className="flex items-center justify-center cursor-pointer"
      >
        <Filter />
      </Button>

      {/* Dialog with all filters */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Type Filter */}
            <div>
              <label className="block mb-1 font-medium text-xs">Type Client</label>
              <Select value={typeFilter} onValueChange={setTypeFilterAction}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Type Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TOP 50">Top 50</SelectItem>
                  <SelectItem value="NEXT 30">Next 30</SelectItem>
                  <SelectItem value="BALANCE 20">Balance 20</SelectItem>
                  <SelectItem value="CSR CLIENT">CSR Client</SelectItem>
                  <SelectItem value="TSA CLIENT">TSA Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Filters */}
            <div>
              <label className="block mb-1 font-medium text-xs">Advanced Filters</label>
              <div className="space-y-2 mt-2">
                <div>
                  <label className="block mb-1 font-medium text-xs">Sort Alphabetically</label>
                  <Select
                    value={alphabeticalFilter ?? "none"}
                    onValueChange={(val) =>
                      setAlphabeticalFilterAction(val === "none" ? null : val)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort Alphabetically" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="asc">A to Z</SelectItem>
                      <SelectItem value="desc">Z to A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant={dateCreatedFilter ? "default" : "outline"}
                  className="w-full justify-between"
                  onClick={() =>
                    setDateCreatedFilterAction(dateCreatedFilter === "asc" ? "desc" : "asc")
                  }
                >
                  By Date Created {dateCreatedFilter ? `(${dateCreatedFilter})` : ""}
                </Button>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setDateCreatedFilterAction(null);
                    setAlphabeticalFilterAction(null);
                    setTypeFilterAction("all");
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end">
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
