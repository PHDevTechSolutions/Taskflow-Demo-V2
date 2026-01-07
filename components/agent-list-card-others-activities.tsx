import React, { useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
    source: string;
    call_status: string;
    type_activity: string;
    start_date: string; // ISO string timestamp
    end_date: string;   // ISO string timestamp
}

interface OutboundCardProps {
    history: HistoryItem[];
}

// Helper: format milliseconds into readable string
function formatDurationMs(ms: number) {
    if (ms <= 0) return "-";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
    if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
    if (seconds > 0) parts.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);

    return parts.join(" ") || "0 sec";
}

// Helper: calculate average duration in ms for given filtered items
function averageDurationMs(items: HistoryItem[]) {
    if (items.length === 0) return 0;

    const totalMs = items.reduce((acc, curr) => {
        const start = new Date(curr.start_date).getTime();
        const end = new Date(curr.end_date).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
            return acc + (end - start);
        }
        return acc;
    }, 0);

    return totalMs / items.length;
}

export function OtherActivitiesCard({ history }: OutboundCardProps) {
    // Counts
    const SalesOrderCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Sales Order Preparation").length, [history]);

    const QuotationCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Quotation Preparation").length, [history]);

    const DeliveredCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Delivered / Closed Transaction").length, [history]);

    const SupplierAccreditationCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Admin - Supplier Accreditation").length, [history]);

    const AdminCreditTermsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Admin - Credit Terms Application").length, [history]);

    const AccountingConcernsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Accounting Concerns").length, [history]);

    const AfterSalesRefundsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "After Sales Refunds").length, [history]);

    const AfterSalesRepairCount = useMemo(() =>
        history.filter((item) => item.type_activity === "After Sales Repair / Replacement").length, [history]);

    const BiddingPreparationsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Bidding Preparations").length, [history]);

    const CustomerOrdersCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Customer Orders").length, [history]);

    const CustomerInquiryCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Customer Inquiry Sales").length, [history]);

    const DeliveryConcernCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Delivery Concern").length, [history]);

    const FollowUpCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Follow Up").length, [history]);

    const SampleRequestsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Sample Requests").length, [history]);

    const SiteVisitsCount = useMemo(() =>
        history.filter((item) => item.type_activity === "Site Visits / Demos").length, [history]);

    // Durations
    const avgDurationSalesOrderMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Sales Order Preparation")), [history]);

    const avgDurationQuotationMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Quotation Preparation")), [history]);

    const avgDurationDeliveredMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Delivered / Closed Transaction")), [history]);

    const avgDurationSupplierAccreditationMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Admin - Supplier Accreditation")), [history]);

    const avgDurationAdminCreditTermsMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Admin - Credit Terms Application")), [history]);

    const avgDurationAccountingConcernsMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Accounting Concerns")), [history]);

    const avgDurationAfterSalesRefundsMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "After Sales Refunds")), [history]);

    const avgDurationAfterSalesRepairMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "After Sales Repair / Replacement")), [history]);

    const avgDurationBiddingPreparationMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Bidding Preparations")), [history]);

    const avgDurationCustomerOrdersMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Customer Orders")), [history]);

    const avgDurationCustomerInquirySalesMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Customer Inquiry Sales")), [history]);

    const avgDurationDeliveryConcernMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Delivery Concern")), [history]);

    const avgDurationFollowUpMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Follow Up")), [history]);

    const avgDurationSampleRequestsMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Sample Requests")), [history]);

    const avgDurationSiteVisitsMs = useMemo(() =>
        averageDurationMs(history.filter((item) => item.type_activity === "Site Visits / Demos")), [history]);

    // Total average duration summed
    const totalAverageDurationMs = useMemo(() => (
        avgDurationSalesOrderMs +
        avgDurationQuotationMs +
        avgDurationDeliveredMs +
        avgDurationSupplierAccreditationMs +
        avgDurationAdminCreditTermsMs +
        avgDurationAccountingConcernsMs +
        avgDurationAfterSalesRepairMs +
        avgDurationAfterSalesRefundsMs +
        avgDurationBiddingPreparationMs +
        avgDurationCustomerOrdersMs +
        avgDurationCustomerInquirySalesMs +
        avgDurationDeliveryConcernMs +
        avgDurationFollowUpMs +
        avgDurationSampleRequestsMs +
        avgDurationSiteVisitsMs
    ), [
        avgDurationSalesOrderMs,
        avgDurationQuotationMs,
        avgDurationDeliveredMs,
        avgDurationSupplierAccreditationMs,
        avgDurationAdminCreditTermsMs,
        avgDurationAccountingConcernsMs,
        avgDurationAfterSalesRepairMs,
        avgDurationAfterSalesRefundsMs,
        avgDurationBiddingPreparationMs,
        avgDurationCustomerOrdersMs,
        avgDurationCustomerInquirySalesMs,
        avgDurationDeliveryConcernMs,
        avgDurationFollowUpMs,
        avgDurationSampleRequestsMs,
        avgDurationSiteVisitsMs
    ]);

    return (
        <Card className="min-h-[400px] max-h-[600px] overflow-y-auto">
            <CardHeader>
                <CardTitle>Other Activities</CardTitle>
                <CardDescription>
                    Summary of other activity types with counts and average durations for the selected agent.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-1 overflow-auto custom-scrollbar">
                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Quotation Preparation</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{QuotationCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationQuotationMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Sales Order Preparation</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{SalesOrderCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationSalesOrderMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Delivered / Closed Transaction</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{DeliveredCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationDeliveredMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Admin - Supplier Accreditation</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{SupplierAccreditationCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationSupplierAccreditationMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Admin - Credit Terms Application</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{AdminCreditTermsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationAdminCreditTermsMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Accounting Concerns</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{AccountingConcernsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationAccountingConcernsMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">After Sales Refunds</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{AfterSalesRefundsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationAfterSalesRefundsMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">After Sales Repair / Replacement</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{AfterSalesRepairCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationAfterSalesRepairMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Bidding Preparations</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{BiddingPreparationsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationBiddingPreparationMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Customer Orders</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{CustomerOrdersCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationCustomerOrdersMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Customer Inquiry Sales</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{CustomerInquiryCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationCustomerInquirySalesMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Delivery Concern</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{DeliveryConcernCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationDeliveryConcernMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Follow Up</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{FollowUpCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationFollowUpMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Sample Requests</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{SampleRequestsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationSampleRequestsMs)}</p>
                    </ItemContent>
                </Item>

                <Item variant="outline">
                    <ItemContent>
                        <div className="flex w-full items-center justify-between">
                            <ItemTitle className="text-sm font-mono tabular-nums">Site Visits / Demos</ItemTitle>
                            <ItemDescription className="text-lg font-bold">
                                <Badge className="h-8 min-w-8 rounded-full px-1 font-mono tabular-nums">{SiteVisitsCount}</Badge>
                            </ItemDescription>
                        </div>
                        <p className="text-xs italic">Avg duration: {formatDurationMs(avgDurationSiteVisitsMs)}</p>
                    </ItemContent>
                </Item>

            </CardContent>

            <CardFooter className="flex justify-between sticky bottom-0 bg-white">
                {totalAverageDurationMs > 0 && (
                    <>
                        <p className="self-center text-xs italic">
                            Avg duration total: {formatDurationMs(totalAverageDurationMs)}
                        </p>
                        <Badge className="h-8 min-w-8 rounded-full px-4 font-mono tabular-nums">
                            Total: {
                                QuotationCount +
                                SalesOrderCount +
                                DeliveredCount +
                                SupplierAccreditationCount +
                                AdminCreditTermsCount +
                                AccountingConcernsCount +
                                AfterSalesRefundsCount +
                                AfterSalesRepairCount +
                                BiddingPreparationsCount +
                                CustomerOrdersCount +
                                CustomerInquiryCount +
                                DeliveryConcernCount +
                                FollowUpCount +
                                SampleRequestsCount +
                                SiteVisitsCount
                            }
                        </Badge>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
