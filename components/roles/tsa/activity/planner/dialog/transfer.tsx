"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    tsm?: string | null; // Territory Sales Manager filter
    account_reference_number?: string;
}

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
    const [search, setSearch] = useState("");
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        const fetchUsers = async () => {
            try {
                setError(null);
                const url = tsm
                    ? `/api/fetch-transfer-ticket?tsm=${encodeURIComponent(tsm)}`
                    : "/api/fetch-transfer-ticket";

                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch users");
                const data: User[] = await res.json();

                const uniqueUsers = data.filter(
                    (user, index, self) =>
                        user.ReferenceID &&
                        self.findIndex((u) => u.ReferenceID === user.ReferenceID) === index
                );

                setUsers(uniqueUsers);
                setFilteredUsers(uniqueUsers);
            } catch (err: any) {
                setError(err.message || "Error fetching users");
            }
        };

        fetchUsers();
    }, [open, tsm]);

    useEffect(() => {
        const term = search.toLowerCase();
        setFilteredUsers(
            users.filter(
                (u) =>
                    u.Firstname.toLowerCase().includes(term) ||
                    u.Lastname.toLowerCase().includes(term) ||
                    (u.ReferenceID?.toLowerCase().includes(term) ?? false)
            )
        );
    }, [search, users]);

    const handleSelectUser = (refId: string) => {
        const user = users.find((u) => u.ReferenceID === refId) || null;
        setSelectedUser(user);
    };

    const handleConfirm = () => {
        onConfirm(selectedUser);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Transfer Ticket to Another User</DialogTitle>
                    <DialogDescription>
                        Please select the user to whom you want to transfer this ticket.
                        The ticket will be reassigned from the original account to the selected user.
                    </DialogDescription>
                </DialogHeader>

                {/* Ticket Reference Number display */}
                {ticketReferenceNumber && (
                    <div className="mb-2 bg-red-100 text-red-700 text-center border border-red-400 rounded shadow px-4 py-2">
                        <strong>TRN: </strong>
                        <span className="uppercase">{ticketReferenceNumber}</span>
                    </div>
                )}

                {/* Search input */}
                <div className="my-4">
                    <input
                        type="text"
                        placeholder="Search users by name or ReferenceID"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                {/* User select dropdown */}
                <div className="max-h-48 overflow-auto border rounded">
                    {error ? (
                        <p className="text-red-500 p-2">{error}</p>
                    ) : filteredUsers.length === 0 ? (
                        <p className="p-2 text-gray-500">No users found</p>
                    ) : (
                        <ul>
                            {filteredUsers.map((user, idx) => (
                                <li
                                    key={user.ReferenceID ?? `user-${idx}`}
                                    onClick={() => user.ReferenceID && handleSelectUser(user.ReferenceID)}
                                    className={`cursor-pointer px-3 py-2 hover:bg-gray-100 ${selectedUser?.ReferenceID === user.ReferenceID
                                            ? "bg-blue-100 font-semibold"
                                            : ""
                                        }`}
                                >
                                    {user.Firstname} {user.Lastname} ({user.ReferenceID ?? "N/A"})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <DialogFooter className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading || !selectedUser}>
                        {loading ? "Transferring..." : "Transfer Ticket"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
