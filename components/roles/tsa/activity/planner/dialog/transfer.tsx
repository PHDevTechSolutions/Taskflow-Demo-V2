"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Loader2, Search, UserCheck, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  ReferenceID?: string;
  Firstname: string;
  Lastname: string;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedUser: User | null) => void;
  loading?: boolean;
  ticketReferenceNumber?: string | null;
  tsm?: string | null;
  account_reference_number?: string | null; // FIX: was typed as string but defaulted to null
}

// ─── Component ────────────────────────────────────────────────────────────────
export const TransferDialog: React.FC<TransferDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  ticketReferenceNumber = null,
  tsm = null,
  account_reference_number = null,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false); // FIX: separate loading for fetch vs confirm
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Derived: filtered users ─────────────────────────────────────────────────
  // FIX: was a separate useEffect + state — now a simple useMemo to avoid stale state
  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter(
      (u) =>
        u.Firstname.toLowerCase().includes(term) ||
        u.Lastname.toLowerCase().includes(term) ||
        (u.ReferenceID?.toLowerCase().includes(term) ?? false),
    );
  }, [search, users]);

  // ── Fetch users when dialog opens ──────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setFetchLoading(true);
    setError(null);
    setSelectedUser(null);
    setSearch("");

    try {
      const url = tsm
        ? `/api/fetch-transfer-ticket?tsm=${encodeURIComponent(tsm)}`
        : "/api/fetch-transfer-ticket";

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch users. Please try again.");

      const data: User[] = await res.json();

      // FIX: deduplicate was correct, kept as-is but simplified
      const seen = new Set<string>();
      const unique = data.filter((u) => {
        if (!u.ReferenceID || seen.has(u.ReferenceID)) return false;
        seen.add(u.ReferenceID);
        return true;
      });

      setUsers(unique);
    } catch (err: any) {
      setError(err.message || "Error fetching users.");
      setUsers([]);
    } finally {
      setFetchLoading(false);
    }
  }, [tsm]);

  useEffect(() => {
    if (open) fetchUsers();
  }, [open, fetchUsers]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectUser = (refId: string) => {
    setSelectedUser(users.find((u) => u.ReferenceID === refId) ?? null);
  };

  const handleClose = () => {
    if (!loading) onOpenChange(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-none p-0 overflow-hidden max-w-md w-full gap-0">

        {/* ── Header strip ─────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 px-6 pt-6 pb-5">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <ArrowLeftRight className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Transfer Ticket
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
              Select the agent to reassign this ticket to. The ticket will be
              immediately transferred upon confirmation.
            </DialogDescription>
          </DialogHeader>

          {/* Ticket reference pill */}
          {ticketReferenceNumber && (
            <div className="mt-4 inline-flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded px-3 py-1.5">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                TRN
              </span>
              <span className="text-xs font-mono text-red-300 uppercase">
                {ticketReferenceNumber}
              </span>
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-none bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
            />
          </div>

          {/* User list */}
          <div className="border border-zinc-200 rounded-none overflow-hidden">
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {fetchLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-400">Loading agents...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 px-4">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-xs text-red-500 text-center">{error}</p>
                  <button
                    type="button"
                    onClick={fetchUsers}
                    className="text-xs text-zinc-600 underline hover:text-zinc-900 mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1">
                  <span className="text-xs text-zinc-400">No agents found.</span>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="text-xs text-zinc-500 underline hover:text-zinc-800"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {filteredUsers.map((user, idx) => {
                    const isSelected = selectedUser?.ReferenceID === user.ReferenceID;
                    return (
                      <li
                        key={user.ReferenceID ?? `user-${idx}`}
                        onClick={() =>
                          user.ReferenceID && handleSelectUser(user.ReferenceID)
                        }
                        className={`
                          flex items-center justify-between px-4 py-3 cursor-pointer
                          text-xs transition-colors select-none
                          ${isSelected
                            ? "bg-zinc-900 text-white"
                            : "hover:bg-zinc-50 text-zinc-700"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar circle */}
                          <div
                            className={`
                              w-7 h-7 rounded-full flex items-center justify-center
                              text-[10px] font-bold flex-shrink-0
                              ${isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}
                            `}
                          >
                            {user.Firstname.charAt(0).toUpperCase()}
                            {user.Lastname.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {user.Firstname} {user.Lastname}
                            </p>
                            <p className={`text-[10px] font-mono ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>
                              {user.ReferenceID ?? "N/A"}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <UserCheck className="h-4 w-4 text-white flex-shrink-0" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Selected agent confirmation strip */}
          {selectedUser && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2">
              <UserCheck className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              <p className="text-xs text-zinc-600">
                Transferring to{" "}
                <strong className="text-zinc-900">
                  {selectedUser.Firstname} {selectedUser.Lastname}
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button
            variant="outline"
            className="rounded-none flex-1 text-xs h-10"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
            onClick={() => onConfirm(selectedUser)}
            disabled={loading || !selectedUser || fetchLoading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                Transfer Ticket
              </>
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};