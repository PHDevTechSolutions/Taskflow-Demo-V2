"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Search } from "lucide-react";

interface AccountsActiveSearchProps {
  globalFilter: string;
  setGlobalFilterAction: (value: string) => void; // renamed prop
  isFiltering: boolean;
}

export function AccountsActiveSearch({
  globalFilter,
  setGlobalFilterAction,
  isFiltering,
}: AccountsActiveSearchProps) {
  return (
    <div className="relative w-full">
      <Input
        placeholder="Search accounts..."
        value={globalFilter}
        onChange={(e) => setGlobalFilterAction(e.target.value)}
        className="pl-8"
      />
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      {isFiltering && (
        <div className="absolute right-3 top-2.5">
          <Spinner />
        </div>
      )}
    </div>
  );
}
