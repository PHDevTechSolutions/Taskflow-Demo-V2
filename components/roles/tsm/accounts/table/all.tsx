"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DownloadCloud } from "lucide-react";

interface Account {
    id: string;
    tsm: string;
    referenceid: string;
    company_name: string;
    type_client: string;
    date_created: string;
    date_updated: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    industry: string;
    status?: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;
    profilepicture: string;
}

interface AccountsTableProps {
    posts: Account[];
    userDetails: UserDetails;
}

export function AccountsTable({ posts = [], userDetails }: AccountsTableProps) {
    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTypeClient, setFilterTypeClient] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Merge
    const [mergedAgents, setMergedAgents] = useState<Record<string, string[]>>({});


    useEffect(() => {
        if (!userDetails.referenceid) return;
        const fetchAgents = async () => {
            try {
                const response = await fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`);
                if (!response.ok) throw new Error("Failed to fetch agents");
                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error("Error fetching agents:", err);
            }
        };
        fetchAgents();
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach(agent => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = `${agent.Firstname} ${agent.Lastname}`;
            }
        });
        return map;
    }, [agents]);

    // Only include Active accounts
    const activePosts = useMemo(() => posts.filter(post => post.status === "Active"), [posts]);

    const groupedByAgent = useMemo(() => {
        const groups: Record<string, Account[]> = {};
        activePosts.forEach(post => {
            const agentName = agentMap[post.referenceid?.toLowerCase() ?? ""] || "-";
            if (!groups[agentName]) groups[agentName] = [];
            groups[agentName].push(post);
        });
        return groups;
    }, [activePosts, agentMap]);

    const handleViewAgent = (agentName: string) => setSelectedAgent(agentName);

    // Count type_client per agent and total
    const typeClientCountsByAgent = useMemo(() => {
        const counts: Record<string, Record<string, number>> = {};
        Object.entries(groupedByAgent).forEach(([agentName, accounts]) => {
            counts[agentName] = {};
            accounts.forEach(acc => {
                counts[agentName][acc.type_client] = (counts[agentName][acc.type_client] || 0) + 1;
            });
        });
        return counts;
    }, [groupedByAgent]);

    const totalTypeClientCounts = useMemo(() => {
        const total: Record<string, number> = {};
        activePosts.forEach(acc => {
            total[acc.type_client] = (total[acc.type_client] || 0) + 1;
        });
        return total;
    }, [activePosts]);

    const convertToCSV = (data: Account[]) => {
        if (data.length === 0) return "";
        const header = [
            "Agent Name", "Company Name", "Contact Person", "Contact Number", "Email Address",
            "Address", "Delivery Address", "Region", "Type of Client", "Industry", "Status", "Date Created"
        ];
        const csvRows = [
            header.join(","),
            ...data.map(item => [
                agentMap[item.referenceid?.toLowerCase() ?? "-"],
                item.company_name, item.contact_person, item.contact_number, item.email_address,
                item.address, item.delivery_address, item.region, item.type_client, item.industry,
                item.status || "-", new Date(item.date_created).toLocaleDateString()
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
        ];
        return csvRows.join("\n");
    };

    const handleDownloadCSV = (data: Account[]) => {
        const csv = convertToCSV(data);
        if (!csv) return;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "accounts.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Default table view is all Active accounts if no agent is selected
    //const tableAccounts = selectedAgent ? groupedByAgent[selectedAgent] : activePosts;
    const tableAccounts = useMemo(() => {
        if (!selectedAgent) return activePosts;

        const agentsToInclude = mergedAgents[selectedAgent] || [selectedAgent];
        let combined: Account[] = [];
        agentsToInclude.forEach(name => {
            if (groupedByAgent[name]) combined = combined.concat(groupedByAgent[name]);
        });
        return combined;
    }, [selectedAgent, mergedAgents, groupedByAgent]);
    const tableTitle = selectedAgent ? `${selectedAgent} Accounts` : `All Active Accounts`;

    // All unique type_client options for filter dropdown
    const typeClientOptions = useMemo(() => {
        const types = new Set<string>();
        activePosts.forEach(acc => types.add(acc.type_client));
        return Array.from(types);
    }, [activePosts]);

    // Filtered accounts based on search & type_client
    const filteredAccounts = useMemo(() => {
        return tableAccounts.filter(acc => {
            const matchesSearch =
                acc.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                acc.contact_person.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterTypeClient ? acc.type_client === filterTypeClient : true;
            return matchesSearch && matchesType;
        });
    }, [tableAccounts, searchQuery, filterTypeClient]);

    // Pagination
    const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
    const paginatedAccounts = filteredAccounts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Merging
    const getMergedAccounts = (agentName: string) => {
        const agentsToInclude = mergedAgents[agentName] || [agentName];
        return agentsToInclude.flatMap(name => groupedByAgent[name] || []);
    };

    return (
        <div className="grid grid-cols-4 gap-4">
            {/* Left column: cards */}
            <div className="col-span-1">
                <Card className="rounded-none border">
                    <CardHeader className="flex flex-col gap-2">
                        {/* Top row: title left, view all button right */}
                        <div className="flex justify-between items-center w-full">
                            <CardTitle className="text-sm font-semibold">Total by Type Client</CardTitle>
                            <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={() => setSelectedAgent(null)}
                            >
                                View All
                            </Button>
                        </div>

                        {/* Counts list (stacked below) */}
                        <div className="flex flex-col gap-1 mt-1">
                            {Object.entries(totalTypeClientCounts).map(([type, count]) => (
                                <span key={type} className="text-xs">
                                    {type}: {count}
                                </span>
                            ))}
                        </div>
                    </CardHeader>
                </Card>

                {Object.entries(groupedByAgent)
                    .filter(([agentName]) => {
                        // If this agent is part of a merged group as a child, hide it
                        const isChild = Object.values(mergedAgents).some(
                            mergedArray => mergedArray.includes(agentName) && mergedArray[0] !== agentName
                        );
                        return !isChild;
                    })
                    .map(([agentName, accounts]) => {
                        const agentsInCard = mergedAgents[agentName] || [agentName];

                        // Get profile pictures
                        const profilePics = agentsInCard
                            .map(name => agents.find(ag => `${ag.Firstname} ${ag.Lastname}` === name)?.profilePicture)
                            .filter(Boolean);

                        const isMerged = agentsInCard.length > 1;

                        // Limit visible pics to 3
                        const visiblePics = profilePics.slice(0, 3);
                        const remainingCount = profilePics.length - visiblePics.length;

                        return (
                            <Card
                                key={agentName}
                                className="rounded-none border relative group"
                                draggable
                                onDragStart={e => e.dataTransfer.setData("text/plain", agentName)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    const draggedAgent = e.dataTransfer.getData("text/plain");
                                    if (!draggedAgent || draggedAgent === agentName) return;

                                    setMergedAgents(prev => {
                                        const newMerged = { ...prev };
                                        const currentMerged = newMerged[agentName] || [agentName];
                                        const draggedMerged = newMerged[draggedAgent] || [draggedAgent];
                                        newMerged[agentName] = Array.from(new Set([...currentMerged, ...draggedMerged]));
                                        delete newMerged[draggedAgent];
                                        return newMerged;
                                    });

                                    if (selectedAgent === draggedAgent || selectedAgent === agentName) {
                                        setSelectedAgent(agentName);
                                    }
                                }}
                            >
                                <CardHeader className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2 z-50">
                                            {isMerged ? (
                                                <div className="flex -space-x-2">
                                                    {visiblePics.map((pic, idx) => (
                                                        <img
                                                            key={idx}
                                                            src={pic}
                                                            alt={`Agent ${idx + 1}`}
                                                            className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                                        />
                                                    ))}
                                                    {remainingCount > 0 && (
                                                        <span className="w-8 h-8 flex items-center justify-center text-[8px] font-bold bg-gray-700 text-white rounded-full border-2 border-white">
                                                            +{remainingCount}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    {profilePics[0] && (
                                                        <img
                                                            src={profilePics[0]}
                                                            alt={agentsInCard[0]}
                                                            className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                                        />
                                                    )}
                                                    <CardTitle className="text-sm font-semibold uppercase">
                                                        {agentsInCard[0]}
                                                    </CardTitle>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 z-50">
                                            <Badge className="bg-blue-500 text-white">{getMergedAccounts(agentName).length}</Badge>

                                            {isMerged && (
                                                <Button
                                                    variant="destructive"
                                                    className="ml-2 rounded-none"
                                                    onClick={() => {
                                                        setMergedAgents(prev => {
                                                            const newMerged = { ...prev };
                                                            delete newMerged[agentName];
                                                            return newMerged;
                                                        });
                                                        if (selectedAgent === agentName) setSelectedAgent(null);
                                                    }}
                                                >
                                                    Reset
                                                </Button>
                                            )}

                                            <Button
                                                variant="outline"
                                                className="rounded-none"
                                                onClick={() => handleViewAgent(agentName)}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(
                                            getMergedAccounts(agentName).reduce<Record<string, number>>((acc, cur) => {
                                                acc[cur.type_client] = (acc[cur.type_client] || 0) + 1;
                                                return acc;
                                            }, {})
                                        ).map(([type, count]) => (
                                            <span key={type} className="text-[10px]">
                                                {type}: {count}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="hidden group-hover:flex absolute top-0 left-0 w-full h-full items-center justify-center border-2 border-dashed border-red-400 bg-red-50 text-xs text-black cursor-move z-10 pointer-events-none">
                                        <span className="pt-10 uppercase font-bold text-red-700">Drag to Another Agent</span>
                                    </div>
                                </CardHeader>
                            </Card>
                        );
                    })}
            </div>

            {/* Right columns: table with search, filter, pagination */}
            <div className="col-span-3">
                <Card className="rounded-none">
                    <CardHeader className="mb-2 flex flex-col gap-2">
                        <CardTitle>{tableTitle}</CardTitle>

                        {/* Search & filter row */}
                        <div className="flex flex-wrap gap-2">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="border rounded-none px-4 py-1 text-xs flex-1"
                            />

                            <select
                                value={filterTypeClient}
                                onChange={e => setFilterTypeClient(e.target.value)}
                                className="border rounded-none px-2 py-1 text-xs uppercase"
                            >
                                <option value="">All Types</option>
                                {typeClientOptions.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            <Button
                                className="rounded bg-green-600 text-white"
                                onClick={() => handleDownloadCSV(filteredAccounts)}
                            >
                                <DownloadCloud /> Download CSV
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Contact Number</TableHead>
                                    <TableHead>Email Address</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Delivery Address</TableHead>
                                    <TableHead>Region</TableHead>
                                    <TableHead>Type of Client</TableHead>
                                    <TableHead>Industry</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date Created</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {paginatedAccounts.map(account => {
                                    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                                    if (account.status === "Active") badgeVariant = "default";
                                    else if (account.status === "Pending") badgeVariant = "secondary";
                                    else if (account.status === "Inactive") badgeVariant = "destructive";

                                    return (
                                        <TableRow key={account.id}>
                                            <TableCell>{account.company_name}</TableCell>
                                            <TableCell className="capitalize">{account.contact_person}</TableCell>
                                            <TableCell>{account.contact_number}</TableCell>
                                            <TableCell>{account.email_address}</TableCell>
                                            <TableCell>{account.address}</TableCell>
                                            <TableCell>{account.delivery_address}</TableCell>
                                            <TableCell>{account.region}</TableCell>
                                            <TableCell>{account.type_client}</TableCell>
                                            <TableCell>{account.industry}</TableCell>
                                            <TableCell>
                                                <Badge variant={badgeVariant}>{account.status ?? "-"}</Badge>
                                            </TableCell>
                                            <TableCell>{new Date(account.date_created).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>

                        {/* Pagination controls */}
                        <div className="mt-2 flex justify-between items-center text-sm">
                            <div>
                                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                                {Math.min(currentPage * itemsPerPage, filteredAccounts.length)} of{" "}
                                {filteredAccounts.length} records
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-none"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                >
                                    Previous
                                </Button>

                                <span>
                                    Page {currentPage} of {totalPages}
                                </span>

                                <Button
                                    variant="outline"
                                    className="rounded-none"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}