import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

interface HistoryItem {
    referenceid: string;
    source: string;
    call_status: string;
    status: string;
    type_activity: string;
    actual_sales?: string;
    quotation_amount: string;
    so_amount: string;
    start_date: string;
    end_date: string;
    date_created: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
}

interface OutboundCardProps {
    history: HistoryItem[];
    agents: Agent[];
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
}

export function QuotationTableCard({ history, agents, dateCreatedFilterRange }: OutboundCardProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    // Map agent ReferenceID to fullname and picture
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
    const workingDays = useMemo(() => {
        if (!dateCreatedFilterRange?.from || !dateCreatedFilterRange?.to) return 1;

        let count = 0;
        const current = new Date(dateCreatedFilterRange.from);
        const to = new Date(dateCreatedFilterRange.to);

        while (current <= to) {
            const day = current.getDay();
            if (day !== 0) count++; // Exclude Sundays (0)
            current.setDate(current.getDate() + 1);
        }
        return count || 1;
    }, [dateCreatedFilterRange]);

    // Aggregate stats per agent
    const statsByAgent = useMemo(() => {
        type AgentStats = {
            agentID: string;

            totalQuoteDoneCount: number;           // Quotations with status "Quote-Done"
            totalQuotationAmount: number;          // Sum of Quotation Amount
            totalSOPreparationCount: number;       // Count Sales Order Preparation
            totalSOAmount: number;                  // Sum SO Amount
            totalSalesInvoice: number;              // Sum Sales Invoice from all activities
        };

        const map = new Map<string, AgentStats>();

        history.forEach((item) => {
            const agentID = item.referenceid.toLowerCase();

            if (!map.has(agentID)) {
                map.set(agentID, {
                    agentID,
                    totalQuoteDoneCount: 0,
                    totalQuotationAmount: 0,
                    totalSOPreparationCount: 0,
                    totalSOAmount: 0,
                    totalSalesInvoice: 0,
                });
            }

            const stat = map.get(agentID)!;

            // Quotations with status "Quote-Done"
            if (item.type_activity === "Quotation Preparation" && item.status === "Quote-Done") {
                stat.totalQuoteDoneCount++;
                const val = parseFloat(item.quotation_amount ?? "0");
                if (!isNaN(val)) {
                    stat.totalQuotationAmount += val;
                }
            }

            // Count activities with status "SO-Done"
            if (item.status === "SO-Done") {
                stat.totalSOPreparationCount++;
                const val = parseFloat(item.so_amount ?? "0");
                if (!isNaN(val)) {
                    stat.totalSOAmount += val;
                }
            }

            // Total Sales Invoice (from all activities with status "Delivered")
            if (item.status === "Delivered") {
                const val = parseFloat(item.actual_sales ?? "0");
                if (!isNaN(val)) {
                    stat.totalSalesInvoice += val;
                }
            }
        });

        return Array.from(map.values());
    }, [history]);

    // Format percentage helper
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    return (
        <Card className="flex flex-col h-full bg-white text-black">
            <CardHeader className="flex justify-between items-center">
                <div>
                    <CardTitle>Quotations</CardTitle>
                    <CardDescription>Counts and totals for quotations (status "Quote-Done") and Sales Order Preparation</CardDescription>
                </div>
                <div
                    className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onFocus={() => setShowTooltip(true)}
                    onBlur={() => setShowTooltip(false)}
                    tabIndex={0}
                    aria-label="Information about quotation computations"
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
                        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Counts all Quotations with status "Quote-Done".</li>
                                <li>Sums Quotation Amount from Quotations.</li>
                                <li>Counts Sales Order Preparation based on Type of Activity.</li>
                                <li>Sums SO Amount from Sales Order Preparation activities.</li>
                                <li>Quote to SO Conversion (%) = (Total SO Preparation ÷ Total Quote Count) × 100</li>
                                <li>Total Sales Invoice = sum of Sales Invoice from all activities</li>
                                <li>Quotation to SI Conversion (%) = (Total Sales Invoice ÷ Total Quotation Amount) × 100</li>
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
                                <TableHead className="text-xs text-center">Total Quotations<br />(Quote-Done)</TableHead>
                                <TableHead className="text-xs text-center">Total Quotation Amount</TableHead>
                                <TableHead className="text-xs text-center">Total SO Preparation</TableHead>
                                <TableHead className="text-xs text-center">Total SO Amount</TableHead>
                                <TableHead className="text-xs text-center">Quote to SO Conversion (%)</TableHead>
                                <TableHead className="text-xs text-center">Total Sales Invoice</TableHead>
                                <TableHead className="text-xs text-center">Quotation to SI Conversion (%)</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {statsByAgent.map((stat) => {
                                const agentInfo = agentMap.get(stat.agentID);
                                const quoteToSOConversion = stat.totalQuoteDoneCount
                                    ? (stat.totalSOPreparationCount / stat.totalQuoteDoneCount) * 100
                                    : 0;

                                const quotationToSIConversion = stat.totalQuotationAmount
                                    ? (stat.totalSalesInvoice / stat.totalQuotationAmount) * 100
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

                                        <TableCell className="text-center font-mono">
                                            {stat.totalQuoteDoneCount}
                                        </TableCell>
                                        <TableCell className="text-center font-mono">
                                            {stat.totalQuotationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>

                                        <TableCell className="text-center font-mono">
                                            {stat.totalSOPreparationCount}
                                        </TableCell>

                                        <TableCell className="text-center font-mono">
                                            {stat.totalSOAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>

                                        <TableCell className="text-center font-mono">{formatPercent(quoteToSOConversion)}</TableCell>

                                        <TableCell className="text-center font-mono">
                                            {stat.totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>

                                        <TableCell className="text-center font-mono">{formatPercent(quotationToSIConversion)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>

                        <tfoot>
                            <TableRow className="text-xs font-semibold border-t">
                                <TableCell className="font-mono">Total</TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent.reduce((acc, stat) => acc + stat.totalQuoteDoneCount, 0)}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent
                                        .reduce((acc, stat) => acc + stat.totalQuotationAmount, 0)
                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent.reduce((acc, stat) => acc + stat.totalSOPreparationCount, 0)}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent
                                        .reduce((acc, stat) => acc + stat.totalSOAmount, 0)
                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {formatPercent(
                                        statsByAgent.reduce((acc, stat) => {
                                            if (stat.totalQuoteDoneCount === 0) return acc;
                                            return acc + (stat.totalSOPreparationCount / stat.totalQuoteDoneCount);
                                        }, 0) /
                                        statsByAgent.length * 100
                                    )}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {statsByAgent
                                        .reduce((acc, stat) => acc + stat.totalSalesInvoice, 0)
                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                    {formatPercent(
                                        statsByAgent.reduce((acc, stat) => {
                                            if (stat.totalQuotationAmount === 0) return acc;
                                            return acc + (stat.totalSalesInvoice / stat.totalQuotationAmount);
                                        }, 0) /
                                        statsByAgent.length * 100
                                    )}
                                </TableCell>
                            </TableRow>
                        </tfoot>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
