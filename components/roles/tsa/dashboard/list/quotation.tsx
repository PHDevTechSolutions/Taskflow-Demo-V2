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

export function QuotationCard({ activities, loading, error, dateRange }: SourceCardProps) {
  const [showComputation, setShowComputation] = useState(false);

  const totalQuotationsDone = useMemo(() => {
    return activities.filter((a) => a.status === "Quote-Done").length;
  }, [activities]);

  // Sum quotation_amount for status "Quote-Done"
  const totalQuotationAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "Quote-Done")
      .reduce((sum, a) => sum + (Number(a.quotation_amount) || 0), 0);
  }, [activities]);

  // Count Sales Order Preparation by type_activity
  const totalSOPreparation = useMemo(() => {
    return activities.filter((a) => a.status === "SO-Done").length;
  }, [activities]);

  // Sum so_amount for Sales Order Preparation
  const totalSOAmount = useMemo(() => {
    return activities
      .filter((a) => a.status === "SO-Done")
      .reduce((sum, a) => sum + (Number(a.so_amount) || 0), 0);
  }, [activities]);

  // Sum actual_sales from all activities (or filter if needed)
  const totalSalesInvoice = useMemo(() => {
    return activities.reduce((sum, a) => sum + (Number(a.actual_sales) || 0), 0);
  }, [activities]);

  // Calculate Quote to SO Conversion (%)
  const quoteToSOConversion = useMemo(() => {
    if (totalQuotationsDone === 0) return 0;
    return (totalSOPreparation / totalQuotationsDone) * 100;
  }, [totalSOPreparation, totalQuotationsDone]);

  // Calculate Quotation to SI Conversion (%)
  const quotationToSIConversion = useMemo(() => {
    if (totalQuotationAmount === 0) return 0;
    return (totalSalesInvoice / totalQuotationAmount) * 100;
  }, [totalSalesInvoice, totalQuotationAmount]);

  return (
    <Card className="bg-white text-black z-10 rounded-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Quotations Summary</CardTitle>
          <div className="flex space-x-2">

            <Button variant="outline"
              onClick={() => setShowComputation(!showComputation)}
              aria-label="Show computation details"
              className="text-blue-600 hover:text-blue-800 rounded-none p-6"
              title="Show computation details"
            >
              <Info /> Details
            </Button>

          </div>
        </div>

        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-4 border-b">Total Quotations (Quote-Done)</th>
              <th className="py-2 px-4 border-b">Total Quotation Amount</th>
              <th className="py-2 px-4 border-b">Total Sales Order Preparation</th>
              <th className="py-2 px-4 border-b">Total SO Amount</th>
              <th className="py-2 px-4 border-b">Quote to SO Conversion (%)</th>
              <th className="py-2 px-4 border-b">Total Sales Invoice</th>
              <th className="py-2 px-4 border-b">Quotation to SI Conversion (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-4 border-b">{totalQuotationsDone}</td>
              <td className="py-2 px-4 border-b">₱ {totalQuotationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 border-b">{totalSOPreparation}</td>
              <td className="py-2 px-4 border-b">₱ {totalSOAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 border-b">{quoteToSOConversion.toFixed(2)}%</td>
              <td className="py-2 px-4 border-b">₱ {totalSalesInvoice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 border-b">{quotationToSIConversion.toFixed(2)}%</td>
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
              <li><strong>Total Quotations:</strong> Counts all Quotations with status "Quote-Done".</li>
              <li><strong>Total Quotation Amount:</strong> Sums Quotation Amount from Quotations.</li>
              <li><strong>Total Sales Order Preparation:</strong> Counts Sales Order Preparation based on Type of Activity.</li>
              <li><strong>Total SO Amount:</strong> Sums SO Amount from Sales Order Preparation activities.</li>
              <li><strong>Quote to SO Conversion:</strong> Quote to SO Conversion (%) = (Total SO Preparation ÷ Total Quote Count) × 100</li>
              <li><strong>Total Sales Invoice:</strong> Sum of all actual sales values.</li>
              <li><strong>Quotation to SI Conversion:</strong> (Total Sales Invoice ÷ Total Quotation Amount) × 100</li>
            </ul>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
