"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button"
import { Info, Eye } from "lucide-react";

interface Activity {
  activity_reference_number: string;  // for grouping
  company_name?: string;
  source?: string;
  status?: string;
  quotation_amount?: number | string;
  type_activity?: string;
  so_amount?: string;
  actual_sales?: string;
}

interface SourceCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
  dateRange?: DateRange;
}

export function SOCard({ activities, loading, error, dateRange }: SourceCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  const totalSODone = useMemo(() => {
    return activities.filter((a) => a.status === "SO-Done").length;
  }, [activities]);

  // Sum so_amount only for activities with status "SO-Done"
  const totalSOAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "SO-Done") // <-- filter here
      .reduce((sum, a) => sum + (Number(a.so_amount) || 0), 0);
  }, [activities]);

  // Count activities with status "Delivered"
  const totalDelivered = useMemo(() => {
    return activities.filter((a) => a.status === "Delivered").length;
  }, [activities]);

  // Sum actual_sales for all activities (Total Sales Invoice)
  const totalSalesInvoice = useMemo(() => {
    return activities.reduce((sum, a) => sum + (Number(a.actual_sales) || 0), 0);
  }, [activities]);

  // Calculate SO to SI Conversion (%)
  const soToSIConversion = useMemo(() => {
    if (totalSOAmount === 0) return 0;
    return (totalSalesInvoice / totalSOAmount) * 100;
  }, [totalSalesInvoice, totalSOAmount]);

  return (
    <Card className="bg-white text-black z-10 rounded-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Sales Order Summary</CardTitle>
          <div className="flex space-x-2">

            <Button variant="outline"
              onClick={() => setShowComputation(!showComputation)}
              aria-label="Show computation details"
              className="text-blue-600 hover:text-blue-800"
              title="Show computation details"
            >
              <Info />
            </Button>

          </div>
        </div>

        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-4 border-b">Total SO-Done</th>
              <th className="py-2 px-4 border-b">Total SO Amount</th>
              <th className="py-2 px-4 border-b">Total Delivered</th>
              <th className="py-2 px-4 border-b">Total Sales Invoice</th>
              <th className="py-2 px-4 border-b">SO to SI Conversion (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-4 border-b">{totalSODone}</td>
              <td className="py-2 px-4 border-b">₱ {totalSOAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 border-b">{totalDelivered}</td>
              <td className="py-2 px-4 border-b">₱ {totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 border-b">{soToSIConversion.toFixed(2)}%</td>
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
              <li><strong>Total SO:</strong> Count of activities with status "SO-Done".</li>
              <li><strong>Total SO Amount:</strong> Total SO Amount summed only from activities with status "SO-Done".</li>
              <li><strong>Total Delivered:</strong> Count of activities with status "Delivered".</li>
              <li><strong>Total SO Amount:</strong> Sums SO Amount from Sales Order Preparation activities.</li>
              <li><strong>Total Sales Invoice:</strong> Total Sales Invoice summed from actual_sales.</li>
              <li><strong>SO To SI Conversion:</strong> (Total Sales Invoice ÷ Total SO Amount) × 100.</li>
            </ul>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
