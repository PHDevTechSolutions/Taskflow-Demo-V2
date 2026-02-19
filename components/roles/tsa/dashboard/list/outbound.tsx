"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button"
import { Info, Eye } from "lucide-react";

interface Activity {
  activity_reference_number: string;  // for grouping
  company_name?: string;
  source?: string;
  status?: string;
  actual_sales?: number | string;
  type_activity?: string;
  call_status?: string;
}

interface SourceCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
  dateRange?: DateRange;
}

export function OutboundCard({ activities, loading, error, dateRange }: SourceCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showComputation, setShowComputation] = useState(false);

  // Group activities by activity_reference_number
  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    activities.forEach((activity) => {
      if (!activity.activity_reference_number) return;
      if (!groups[activity.activity_reference_number]) {
        groups[activity.activity_reference_number] = [];
      }
      groups[activity.activity_reference_number].push(activity);
    });
    return groups;
  }, [activities]);

  const referenceNumbers = React.useMemo(() => Object.keys(groupedActivities), [groupedActivities]);

  // Count the number of "Outbound - Touchbase" with call_status "Successful"
  const touchbaseCount = React.useMemo(() => {
    return activities.filter(
      (activity) =>
        activity.source === "Outbound - Touchbase" && activity.call_status === "Successful"
    ).length;
  }, [activities]);

  // Count unique referenceNumbers that have BOTH
  // - successful Outbound - Touchbase
  // - and a Quotation Preparation type_activity in same ref number
  const quotationPrepCount = React.useMemo(() => {
    let count = 0;
    for (const refNum of referenceNumbers) {
      const acts = groupedActivities[refNum];
      const hasSuccessfulOutboundTouchbase = acts.some(
        (a) => a.source === "Outbound - Touchbase" && a.call_status === "Successful"
      );
      const hasQuotationPreparation = acts.some(
        (a) => a.type_activity === "Quotation Preparation"
      );
      if (hasSuccessfulOutboundTouchbase && hasQuotationPreparation) {
        count++;
      }
    }
    return count;
  }, [groupedActivities, referenceNumbers]);

  // Count unique referenceNumbers that have BOTH
  // - successful Outbound - Touchbase
  // - and a Delivered / Closed Transaction type_activity in same ref number
  const deliveredClosedCount = React.useMemo(() => {
    let count = 0;
    for (const refNum of referenceNumbers) {
      const acts = groupedActivities[refNum];
      const hasSuccessfulOutboundTouchbase = acts.some(
        (a) => a.source === "Outbound - Touchbase" && a.call_status === "Successful"
      );
      const hasDeliveredClosedTransaction = acts.some(
        (a) => a.type_activity === "Delivered / Closed Transaction"
      );
      if (hasSuccessfulOutboundTouchbase && hasDeliveredClosedTransaction) {
        count++;
      }
    }
    return count;
  }, [groupedActivities, referenceNumbers]);

  const daysCount = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      // Calculate inclusive days difference
      const diffTime = dateRange.to.getTime() - dateRange.from.getTime();
      // one day in ms
      const oneDay = 1000 * 60 * 60 * 24;
      // add 1 for inclusive count
      return Math.floor(diffTime / oneDay) + 1;
    }
    // default working days
    return 26;
  }, [dateRange]);

  // OB Target = 20 * daysCount
  const obTarget = 20 * daysCount;

  const totalOutboundCount = React.useMemo(() => {
    return activities.filter(activity => activity.source === "Outbound - Touchbase").length;
  }, [activities]);

  const achievement = obTarget > 0 ? (touchbaseCount / obTarget) * 100 : 0;

  const callsToQuoteConversion = touchbaseCount > 0
    ? ((quotationPrepCount / touchbaseCount) * 100).toFixed(2)
    : "0.00";

  const outboundToSalesConversion = touchbaseCount > 0
    ? ((deliveredClosedCount / touchbaseCount) * 100).toFixed(2)
    : "0.00";

  const totalActualSales = React.useMemo(() => {
    return activities.reduce((sum, activity) => {
      const value = typeof activity.actual_sales === "number"
        ? activity.actual_sales
        : parseFloat(activity.actual_sales ?? "");
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  }, [activities]);

  return (
    <Card className="bg-white text-black z-10 rounded-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Outbound Calls (Touchbase)</CardTitle>
          <div className="flex space-x-2">

            <Button
              onClick={() => setShowHistory(!showHistory)}
              aria-expanded={showHistory}
              aria-controls="history-content"
            >
             <Eye /> {showHistory ? "Hide History" : "View History"}
            </Button>

            <Button variant="outline"
              onClick={() => setShowComputation(!showComputation)}
              aria-label="Show computation details"
              className="text-blue-600 hover:text-blue-800"
              title="Show computation details"
            >
              <Info /> Details
            </Button>

          </div>
        </div>

        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-4 border-b">OB Target</th>
              <th className="py-2 px-4 border-b">Total OB <span className="text-green-600 text-[10px]">(Suc-{touchbaseCount})</span></th>
              <th className="py-2 px-4 border-b">Achievement</th>
              <th className="py-2 px-4 border-b">Calls to Quote Conversion <span className="text-green-600 text-[10px]">(Suc-{quotationPrepCount})</span></th>
              <th className="py-2 px-4 border-b">Outbound to Sales Conversion <span className="text-green-600 text-[10px]">(Suc-{deliveredClosedCount})</span></th>
              <th className="py-2 px-4 border-b">Total Sales Invoice</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-4 border-b">{obTarget}</td>
              <td className="py-2 px-4 border-b">{totalOutboundCount}</td>
              <td className="py-2 px-4 border-b">{achievement.toFixed(2)}%</td>
              <td className="py-2 px-4 border-b">{callsToQuoteConversion}%</td>
              <td className="py-2 px-4 border-b">{outboundToSalesConversion}%</td>
              <td className="py-2 px-4 border-b">{totalActualSales.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        {showComputation && (
          <div
            className="mt-2 p-3 border border-blue-400 bg-blue-50 rounded text-sm text-blue-900"
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
      </CardHeader>

      {showHistory && (
        <CardContent id="history-content" aria-live="polite">
          {loading && <p className="text-sm text-gray-500">Loading...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && !error && referenceNumbers.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center">No activities found.</p>
          )}

          {!loading && !error && referenceNumbers.length > 0 && (
            <div className="space-y-6 overflow-auto max-h-[400px]">
              {referenceNumbers.map((refNum) => (
                <div key={refNum} className="border border-gray-200 rounded-md p-4">
                  <h3 className="font-semibold mb-2">
                    Reference Number: {refNum}
                  </h3>
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 border-b">Company Name</th>
                        <th className="py-2 px-4 border-b">Status</th>
                        <th className="py-2 px-4 border-b">Actual Sales</th>
                        <th className="py-2 px-4 border-b">Activity Type</th>
                        <th className="py-2 px-4 border-b">Source</th>
                        <th className="py-2 px-4 border-b">Call Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedActivities[refNum].map((activity, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-4 border-b">{activity.company_name ?? "-"}</td>
                          <td className="py-2 px-4 border-b">{activity.status ?? "-"}</td>
                          <td className="py-2 px-4 border-b">{activity.actual_sales ?? "-"}</td>
                          <td className="py-2 px-4 border-b">{activity.type_activity ?? "-"}</td>
                          <td className="py-2 px-4 border-b">{activity.source ?? "-"}</td>
                          <td className="py-2 px-4 border-b">{activity.call_status ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
