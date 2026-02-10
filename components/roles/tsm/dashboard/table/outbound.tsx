import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

import { Button } from "@/components/ui/button"
import { Info, Eye } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string; // AGENT ID
  source: string;
  call_status: string;
  status: string;
  type_activity: string;
  actual_sales?: number | string;
  start_date: string;
  end_date: string;
  date_created: string;
  activity_reference_number: string;
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
  dateCreatedFilterRange?: { from: Date; to: Date };
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
}

/* ================= COMPONENT ================= */

export function OutboundCallsTableCard({ history, agents, dateCreatedFilterRange, }: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  /* -------- Agent Map -------- */
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

  /* -------- Filter history by date range -------- */
  const filteredActivities = useMemo(() => {
    if (!dateCreatedFilterRange?.from || !dateCreatedFilterRange?.to) {
      return history;
    }
    return history.filter((h) => {
      const d = new Date(h.date_created);
      return d >= dateCreatedFilterRange.from && d <= dateCreatedFilterRange.to;
    });
  }, [history, dateCreatedFilterRange]);

  /* -------- Calculate days & OB target -------- */
  const daysCount = useMemo(() => {
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const diffTime = dateCreatedFilterRange.to.getTime() - dateCreatedFilterRange.from.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diffTime / oneDay) + 1;
    }
    return 26;
  }, [dateCreatedFilterRange]);

  const obTarget = 20 * daysCount;

  /* -------- Compute stats per agent -------- */
  const statsByAgent = useMemo(() => {
    // Prepare a map to group activities per agent
    const agentActivitiesMap: Record<string, HistoryItem[]> = {};

    filteredActivities.forEach((activity) => {
      const agentId = activity.referenceid?.toLowerCase();
      if (!agentId) return;
      if (!agentActivitiesMap[agentId]) agentActivitiesMap[agentId] = [];
      agentActivitiesMap[agentId].push(activity);
    });

    // For each agent, calculate the grouped stats
    const results = [];

    for (const [agentId, activities] of Object.entries(agentActivitiesMap)) {
      // Group activities by activity_reference_number for this agent
      const groups: Record<string, HistoryItem[]> = {};
      activities.forEach((act) => {
        if (!act.activity_reference_number) return;
        if (!groups[act.activity_reference_number]) groups[act.activity_reference_number] = [];
        groups[act.activity_reference_number].push(act);
      });

      const referenceNumbers = Object.keys(groups);

      // Count successful Outbound - Touchbase activities
      const touchbaseCount = activities.filter(
        (a) => a.source === "Outbound - Touchbase" && a.call_status === "Successful"
      ).length;

      // Count Quotation Preparation refs with successful touchbase in same ref
      let quotationPrepCount = 0;
      for (const refNum of referenceNumbers) {
        const acts = groups[refNum];
        const hasSuccessfulOutboundTouchbase = acts.some(
          (a) => a.source === "Outbound - Touchbase" && a.call_status === "Successful"
        );
        const hasQuotationPreparation = acts.some(
          (a) => a.type_activity === "Quotation Preparation"
        );
        if (hasSuccessfulOutboundTouchbase && hasQuotationPreparation) {
          quotationPrepCount++;
        }
      }

      // Count Delivered / Closed Transaction refs with successful touchbase
      let deliveredClosedCount = 0;
      for (const refNum of referenceNumbers) {
        const acts = groups[refNum];
        const hasSuccessfulOutboundTouchbase = acts.some(
          (a) => a.source === "Outbound - Touchbase" && a.call_status === "Successful"
        );
        const hasDeliveredClosedTransaction = acts.some(
          (a) => a.type_activity === "Delivered / Closed Transaction"
        );
        if (hasSuccessfulOutboundTouchbase && hasDeliveredClosedTransaction) {
          deliveredClosedCount++;
        }
      }

      // Total OB count = all Outbound - Touchbase source activities
      const totalOutboundCount = activities.filter((a) => a.source === "Outbound - Touchbase").length;

      // Sum actual sales for this agent
      const totalActualSales = activities.reduce((sum, a) => {
        const value =
          typeof a.actual_sales === "number" ? a.actual_sales : parseFloat(a.actual_sales ?? "");
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Compute achievement and conversion percentages
      const achievement = obTarget > 0 ? (touchbaseCount / obTarget) * 100 : 0;
      const callsToQuoteConversion =
        touchbaseCount > 0 ? ((quotationPrepCount / touchbaseCount) * 100).toFixed(2) : "0.00";
      const outboundToSalesConversion =
        touchbaseCount > 0 ? ((deliveredClosedCount / touchbaseCount) * 100).toFixed(2) : "0.00";

      results.push({
        agentID: agentId,
        totalOB: totalOutboundCount,
        successfulTouchbase: touchbaseCount,
        quotationPrep: quotationPrepCount,
        deliveredClosed: deliveredClosedCount,
        totalSales: totalActualSales,
        achievement,
        callsToQuoteConversion,
        outboundToSalesConversion,
      });
    }

    return results;
  }, [filteredActivities, obTarget]);

  return (
    <Card className="h-full bg-white text-black">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Outbound Calls (Touch-Based)</CardTitle>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowComputation(!showComputation)}
          aria-label="Show computation details"
          className="flex items-center text-blue-600 hover:text-blue-800"
          title="Show computation details"
        >
          <Info className="mr-2" />
          Details
        </Button>
      </CardHeader>

      <CardContent className="overflow-auto">
        {statsByAgent.length === 0 ? (
          <p className="text-center text-sm italic text-gray-500">
            No outbound records found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Agent</TableHead>
                <TableHead className="font-bold">OB Target</TableHead>
                <TableHead className="font-bold">Total OB </TableHead>
                <TableHead className="font-bold">Achievement</TableHead>
                <TableHead className="font-bold">Calls to Quote Conversion</TableHead>
                <TableHead className="font-bold">Outbound to Sales Conversion</TableHead>
                <TableHead className="font-bold">Total Sales Invoice</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {statsByAgent.map((stat) => {
                const agentInfo = agentMap.get(stat.agentID);

                return (
                  <TableRow key={stat.agentID} className="text-xs">
                    <TableCell className="flex items-center gap-2 capitalize">
                      {agentInfo?.picture ? (
                        <img
                          src={agentInfo.picture}
                          alt={agentInfo.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                          ?
                        </div>
                      )}
                      {agentInfo?.name ?? stat.agentID}
                    </TableCell>

                    <TableCell>{obTarget}</TableCell>
                    <TableCell>{stat.totalOB} - <span className="text-green-600 text-[10px]">(Suc-{stat.successfulTouchbase})</span></TableCell>
                    <TableCell>{stat.achievement.toFixed(2)}%</TableCell>
                    <TableCell>{stat.callsToQuoteConversion}% - <span className="text-green-600 text-[10px]">(Suc-{stat.quotationPrep})</span></TableCell>
                    <TableCell>{stat.outboundToSalesConversion}% - <span className="text-green-600 text-[10px]">(Suc-{stat.deliveredClosed})</span></TableCell>
                    <TableCell>{stat.totalSales.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {showComputation && (
          <div
            className="mt-2 p-3 w-full border border-blue-400 bg-blue-50 rounded text-sm text-blue-900"
            role="region"
            aria-live="polite"
            aria-label="Computation explanation"
          >
            <p><strong>Computation Details:</strong></p>
            <ul className="list-disc list-inside">
              <li><strong>OB Target:</strong> 20 x number of days in selected date range (default 26 days).</li>
              <li><strong>Total OB:</strong> Total count of all activities with source "Outbound - Touchbase".</li>
              <li><strong>Achievement:</strong> (Successful Outbound Touchbase / OB Target) × 100.</li>
              <li><strong>Calls to Quote Conversion:</strong> (Quotation Preparation count / Successful Outbound Touchbase) × 100.</li>
              <li><strong>Outbound to Sales Conversion:</strong> (Delivered / Closed Transaction count / Successful Outbound Touchbase) × 100.</li>
              <li><strong>Total Sales Invoice:</strong> Sum of all actual sales values.</li>
            </ul>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
