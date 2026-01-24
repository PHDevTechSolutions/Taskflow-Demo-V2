"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, } from "@/components/ui/select";
import { Label } from "@/components/ui/label"

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agents: any[];
    selectedAccountIds: string[];
    onConfirmTransfer: (agentRefId: string, accountIds: string[]) => void;
}

export function TransferDialog({
    open,
    onOpenChange,
    agents,
    selectedAccountIds,
    onConfirmTransfer,
}: TransferDialogProps) {
    const [selectedAgent, setSelectedAgent] = useState<string>("");

    useEffect(() => {
        if (!open) {
            setSelectedAgent("");
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Transfer Accounts</DialogTitle>
                    <DialogDescription>
                        Transfer the selected accounts to another agent.
                    </DialogDescription>
                </DialogHeader>
                <Label htmlFor="terms">Transfer to agent:</Label>
                <Select
                    value={selectedAgent}
                    onValueChange={(value) => setSelectedAgent(value)}
                    defaultValue=""
                    disabled={!agents.length}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                        {agents.map((agent, index) => (
                            <SelectItem
                                className="capitalize flex items-center gap-2"
                                key={`${agent.ReferenceID}-${index}`}
                                value={agent.ReferenceID}
                            >
                                <img
                                    src={agent.profilePicture || "/Taskflow.png"}
                                    alt={`${agent.Firstname} ${agent.Lastname}`}
                                    className="w-6 h-6 rounded-full object-cover"
                                />
                                {agent.Lastname}, {agent.Firstname}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <DialogFooter className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>

                    <Button
                        onClick={() => {
                            if (selectedAgent) onConfirmTransfer(selectedAgent, selectedAccountIds);
                        }}
                        disabled={!selectedAgent}
                    >
                        Confirm Transfer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
