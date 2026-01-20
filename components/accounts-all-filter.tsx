"use client";

import React, { useState } from "react";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Filter } from "lucide-react";

interface AccountsAllFilterProps {
    typeFilter: string;
    setTypeFilterAction: (value: string) => void;
    statusFilter: string;
    setStatusFilterAction: (value: string) => void;
    dateCreatedFilter: string | null;
    setDateCreatedFilterAction: (value: string | null) => void;
    industryFilter: string;
    setIndustryFilterAction: (value: string) => void;
    alphabeticalFilter: string | null;
    setAlphabeticalFilterAction: (value: string | null) => void;

    // New props for agent filter
    agentFilter: string;
    setAgentFilterAction: (value: string) => void;
    agents: { ReferenceID: string; Firstname: string; Lastname: string }[];
}

export function AccountsAllFilter({
    typeFilter,
    setTypeFilterAction,
    statusFilter,
    setStatusFilterAction,
    dateCreatedFilter,
    setDateCreatedFilterAction,
    industryFilter,
    setIndustryFilterAction,
    alphabeticalFilter,
    setAlphabeticalFilterAction,
    agentFilter,
    setAgentFilterAction,
    agents,
}: AccountsAllFilterProps) {
    const [open, setOpen] = useState(false);

    // Prepare agent options (unique fullnames sorted)
    const agentOptions = React.useMemo(() => {
        const uniqueAgents = Array.from(
            new Set(agents.map(a => `${a.Firstname} ${a.Lastname}`))
        ).sort();

        return [{ label: "All Agents", value: "all" }].concat(
            uniqueAgents.map(fullname => ({
                label: fullname,
                value: fullname,
            }))
        );
    }, [agents]);

    return (
        <>
            {/* Filter Icon Button */}
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                aria-label="Open filters"
                className="flex items-center justify-center"
            >
                <Filter />
            </Button>

            {/* Filter Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full max-w-md">
                    <DialogHeader>
                        <DialogTitle>Filters</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        {/* Agent Filter */}
                        <div>
                            <label className="block mb-1 font-medium text-xs">Agent</label>
                            <Select value={agentFilter} onValueChange={setAgentFilterAction}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Agent" />
                                </SelectTrigger>
                                <SelectContent className="uppercase">
                                    {agentOptions.map((agent) => (
                                        <SelectItem key={agent.value} value={agent.value}>
                                            {agent.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type Client Filter */}
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

                        {/* Status Filter */}
                        <div>
                            <label className="block mb-1 font-medium text-xs">Status</label>
                            <Select value={statusFilter} onValueChange={setStatusFilterAction}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="New Client">New Client</SelectItem>
                                    <SelectItem value="Non-Buying">Non-Buying</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Advanced Filters */}
                        <div>
                            <label className="block mb-1 font-medium text-xs">Advanced Filters</label>
                            <div className="space-y-2 mt-2">
                                <div>
                                    <label className="block mb-1 font-medium text-xs">
                                        Sort Alphabetically
                                    </label>
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
                                        setDateCreatedFilterAction(
                                            dateCreatedFilter === "asc" ? "desc" : "asc"
                                        )
                                    }
                                >
                                    By Date Created {dateCreatedFilter ? `(${dateCreatedFilter})` : ""}
                                </Button>

                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => {
                                        setDateCreatedFilterAction(null);
                                        setIndustryFilterAction("all");
                                        setAlphabeticalFilterAction(null);
                                        setTypeFilterAction("all");
                                        setStatusFilterAction("all");
                                        setAgentFilterAction("all");
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
