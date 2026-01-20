"use client";

import React, { useMemo, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
    referenceid: string;
    source: string;
    call_status: string;
    status: string;
    type_activity: string;
    actual_sales?: string;
    start_date: string;
    end_date: string;
    date_created: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
    Role: string;
}

interface OutboundCardProps {
    history: HistoryItem[];
    agents: Agent[];
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
}

const WORKING_DAYS = 16;
const OB_PER_DAY = 20;

// Helper para safe mag-parse ng dates sa milliseconds
function parseDateMs(value?: string | null) {
    if (!value) return null;
    const ms = new Date(value.replace(" ", "T")).getTime();
    return isNaN(ms) ? null : ms;
}

export function OutboundCallsTableCard({ history, agents, dateCreatedFilterRange }: OutboundCardProps) {
    // Map agent ReferenceID to fullname and picture
    const [showTooltip, setShowTooltip] = useState(false);
    const agentMap = useMemo(() => {
        const map = new Map<string, { name: string; picture: string }>();
        agents.forEach((a) => {
            map.set(a.ReferenceID.toLowerCase(), {
                name: `${a.Firstname} ${a.Lastname}`,
                picture: a.profilePicture,
            });
        });
        return map;
    }, [agents]);

    // Calculate working days between from and to (inclusive)
    // You can enhance this later to actually calculate days from dateCreatedFilterRange
    const obTarget = WORKING_DAYS * OB_PER_DAY;

    // Aggregate stats per agent
    const statsByAgent = useMemo(() => {
        type AgentStats = {
            agentID: string;
            totalOutboundTouchbase: number;
            totalQuotationPreparationDelivered: number;
            totalDelivered: number;
            totalQuotations: number;
            totalSalesInvoice: number;
        };

        const map = new Map<string, AgentStats>();

        history.forEach((item) => {
            const agentID = item.referenceid.toLowerCase();
            if (!map.has(agentID)) {
                map.set(agentID, {
                    agentID,
                    totalOutboundTouchbase: 0,
                    totalQuotationPreparationDelivered: 0,
                    totalDelivered: 0,
                    totalQuotations: 0,
                    totalSalesInvoice: 0,
                });
            }
            const stat = map.get(agentID)!;

            if (item.source === "Outbound - Touchbase") {
                stat.totalOutboundTouchbase++;
            }

            if (item.type_activity === "Quotation Preparation") {
                stat.totalQuotations++;
            }

            if (item.status === "Delivered") {
                stat.totalDelivered++;

                const val = parseFloat(item.actual_sales ?? "0");
                if (!isNaN(val)) {
                    stat.totalSalesInvoice += val;
                }
            }

            if (item.type_activity === "Quotation Preparation" && (item.status === "Delivered" || item.status === "Quote-Done")) {
                stat.totalQuotationPreparationDelivered++;
            }
        });

        return Array.from(map.values());
    }, [history]);

    // Format percentage helper
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    const totalOutboundTouchbaseSum = statsByAgent.reduce((acc, stat) => acc + stat.totalOutboundTouchbase, 0);
    const totalQuotationPreparationDeliveredSum = statsByAgent.reduce((acc, stat) => acc + stat.totalQuotationPreparationDelivered, 0);
    const totalDeliveredSum = statsByAgent.reduce((acc, stat) => acc + stat.totalDelivered, 0);

    const totalAgents = statsByAgent.length;
    const totalObTarget = obTarget * totalAgents;
    return (
        <Card className="flex flex-col h-full bg-white text-black">
            <CardHeader className="flex justify-between items-center">
                <div>
                    <CardTitle>Outbound Calls (Touch-Based Only)</CardTitle>
                    <CardDescription>
                        Counts based on Source, Type of Activity, Status filters and OB Target computed from working days
                    </CardDescription>
                </div>
                <div
                    className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onFocus={() => setShowTooltip(true)}
                    onBlur={() => setShowTooltip(false)}
                    tabIndex={0}
                    aria-label="Information about activity filters and OB Target"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
                        />
                    </svg>

                    {showTooltip && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-180 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Counts activities with Source "Outbound - Touchbase", Type of Activity "Quotation Preparation", and Status "Delivered".</li>
                                <li>OB Target = 16 × WorkingDays, where Working Days is calculated from date range.</li>
                                <li>Achievement = (Total OB ÷ OB Target) × 100</li>
                                <li>Calls to Quote Conversion = (Total Quotations ÷ Total OB) × 100</li>
                                <li>Outbound to Sales Conversion = (Total Delivered ÷ Total OB) × 100</li>
                                <li>Total Sales Invoice = sum of Sales Invoice from Delivered activities</li>
                            </ul>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto">
                {statsByAgent.length === 0 ? (
                    <p className="text-center text-sm italic text-gray-500">
                        No records found. Coordinate with your TSA to create activities.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="font-mono">
                                <TableHead className="text-xs">Agent</TableHead>
                                <TableHead className="text-xs text-center">Total OB (Touchbase)</TableHead>
                                <TableHead className="text-xs text-center">OB Target</TableHead>
                                <TableHead className="text-xs text-center">Achievement (%)</TableHead>
                                <TableHead className="text-xs text-center">Calls to Quote (%)</TableHead>
                                <TableHead className="text-xs text-center">Outbound to Sales (%)</TableHead>
                                <TableHead className="text-xs text-center">Total Sales Invoice</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {statsByAgent.map((stat) => {
                                const agentInfo = agentMap.get(stat.agentID);
                                const achievement = stat.totalOutboundTouchbase / obTarget * 100;
                                const callsToQuote = stat.totalOutboundTouchbase
                                    ? (stat.totalQuotationPreparationDelivered / stat.totalOutboundTouchbase) * 100
                                    : 0;
                                const outboundToSales = stat.totalOutboundTouchbase
                                    ? (stat.totalDelivered / stat.totalOutboundTouchbase) * 100
                                    : 0;

                                return (
                                    <TableRow key={stat.agentID} className="text-xs">
                                        <TableCell className="flex items-center gap-2 font-mono capitalize">
                                            {agentInfo?.picture ? (
                                                <img
                                                    src={agentInfo.picture}
                                                    alt={agentInfo.name}
                                                    className="w-6 h-6 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                    ?
                                                </div>
                                            )}
                                            {agentInfo?.name ?? stat.agentID}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {stat.totalOutboundTouchbase}
                                        </TableCell>

                                        <TableCell className="text-center font-mono">{obTarget}</TableCell>

                                        <TableCell className="text-center font-mono">{formatPercent(achievement)}</TableCell>

                                        <TableCell className="text-center font-mono">{formatPercent(callsToQuote)}</TableCell>

                                        <TableCell className="text-center font-mono">{formatPercent(outboundToSales)}</TableCell>

                                        <TableCell className="text-center font-mono">
                                            {stat.totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>

                        <tfoot>
                            <TableRow className="text-xs font-semibold border-t">
                                <TableCell className="font-mono">Total</TableCell>
                                <TableCell className="text-center font-mono">
                                    {totalOutboundTouchbaseSum}
                                </TableCell>
                                <TableCell className="text-center font-mono">{totalObTarget}</TableCell>
                                <TableCell className="text-center font-mono">
                                    {totalObTarget > 0
                                        ? formatPercent((totalOutboundTouchbaseSum / totalObTarget) * 100)
                                        : "0.00%"}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {totalOutboundTouchbaseSum > 0
                                        ? formatPercent((totalQuotationPreparationDeliveredSum / totalOutboundTouchbaseSum) * 100)
                                        : "0.00%"}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {totalOutboundTouchbaseSum > 0
                                        ? formatPercent((totalDeliveredSum / totalOutboundTouchbaseSum) * 100)
                                        : "0.00%"}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent
                                        .reduce((acc, stat) => acc + stat.totalSalesInvoice, 0)
                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                )}
            </CardContent>

            <CardFooter className="flex justify-between border-t bg-white">
                <p className="text-xs italic">Working Days in Range: {obTarget}</p>
                <p className="text-xs italic">OB Target (16 × working days): {obTarget}</p>
            </CardFooter>
        </Card>
    );
}
