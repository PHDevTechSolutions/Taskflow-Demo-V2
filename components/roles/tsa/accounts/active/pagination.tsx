"use client";

import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, } from "@/components/ui/pagination";
import { Table } from "@tanstack/react-table";

interface AccountsActivePaginationProps<TData> {
  table: Table<TData>;
}

export function AccountsActivePagination<TData>({ table }: AccountsActivePaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <Pagination>
      <PaginationContent className="flex items-center space-x-4">
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (table.getCanPreviousPage()) table.previousPage();
            }}
            aria-disabled={!table.getCanPreviousPage()}
            className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {/* Current page / total pages */}
        <div className="px-4 font-medium">
          {pageCount === 0 ? "0 / 0" : `${pageIndex + 1} / ${pageCount}`}
        </div>

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (table.getCanNextPage()) table.nextPage();
            }}
            aria-disabled={!table.getCanNextPage()}
            className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
