"use client";

import React, { useMemo, useState, useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";

import { RefreshCcw } from "lucide-react";

/* ================= FORMAT HOURS ================= */

function formatHoursToHMS(hours: number) {
  const totalSeconds = Math.round(hours * 3600);

  const h = Math.floor(totalSeconds / 3600);

  const m = Math.floor((totalSeconds % 3600) / 60);

  const s = totalSeconds % 60;

  return `${h}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

/* ================= SPEEDOMETER COMPONENT START ================= */

function Speedometer({
  label,
  value,
  maxHours = 2, // adjust depending on KPI target
}: {
  label: string;
  value: number;
  maxHours?: number;
}) {
  const percentage = Math.min((value / maxHours) * 100, 100);

  const angle = (percentage / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        {/* Background arc */}
        <div className="absolute w-full h-full border-t-[10px] border-gray-200 rounded-t-full"></div>

        {/* Active arc */}
        <div
          className="absolute w-full h-full border-t-[10px] border-blue-500 rounded-t-full transition-all duration-500"
          style={{
            clipPath: `inset(0 ${100 - percentage}% 0 0)`,
          }}
        ></div>

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-700 ease-out"
          style={{
            transform: `rotate(${angle - 90}deg)`,
          }}
        >
          <div className="w-1 h-16 bg-red-500"></div>
        </div>

        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full"></div>
      </div>

      {/* Value */}
      <div className="text-sm font-bold mt-2">{formatHoursToHMS(value)}</div>

      {/* Label */}
      <div className="text-xs text-gray-500 text-center">{label}</div>
    </div>
  );
}

/* ================= COMPONENT ================= */

export function CSRMetricsCard({
  dateRange,
}: {
  dateRange?: { from?: Date; to?: Date };
}) {
  /* ================= DEBUG STATE START ================= */

  const today = new Date().toISOString().split("T")[0];

  const [referenceId, setReferenceId] = useState("AE-NCR-555756");

  const [targetDate, setTargetDate] = useState(today);

  /* ================= DATE RANGE FROM REACT DATE PICKER ================= */

  const rangeFrom = dateRange?.from ? new Date(dateRange.from).getTime() : null;

  const rangeTo = dateRange?.to
    ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).getTime()
    : null;

  /* ================= FETCH STATE ================= */

  const [activities, setActivities] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /* ================= FETCH FUNCTION ================= */

  async function fetchCSRMetrics() {
    if (!referenceId) return;

    setLoading(true);

    setError(null);

    try {
      const res = await fetch(
        `/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(
          referenceId,
        )}`,
      );

      const result = await res.json();

      setActivities(result.data || []);

      console.log("CSR DEBUG DATA:", result.data);
    } catch (err) {
      console.error(err);

      setError("Failed to fetch CSR metrics");
    } finally {
      setLoading(false);
    }
  }

  /* ================= INITIAL LOAD ================= */

  useEffect(() => {
    fetchCSRMetrics();
  }, []);

  /* ================= SAME LOGIC AS BREACHES ================= */

  const { avgResponseTime, avgNonQuotationHT, avgQuotationHT, avgSpfHT } =
    useMemo(() => {
      let responseTotal = 0;

      let responseCount = 0;

      let nonQuotationTotal = 0;

      let nonQuotationCount = 0;

      let quotationTotal = 0;

      let quotationCount = 0;

      let spfTotal = 0;

      let spfCount = 0;

      const excludedWrapUps = [
        "CustomerFeedback/Recommendation",
        "Job Inquiry",
        "Job Applicants",
        "Supplier/Vendor Product Offer",
        "Internal Whistle Blower",
        "Threats/Extortion/Intimidation",
        "Prank Call",
      ];

      activities.forEach((row: any) => {
        /* STATUS FILTER */

        if (row.status !== "Closed" && row.status !== "Converted into Sales")
          return;

        /* DATE FILTER */

        const created = new Date(row.date_created).getTime();

        /* PRIORITY: React Date Picker */
        if (rangeFrom && rangeTo) {
          if (isNaN(created) || created < rangeFrom || created > rangeTo)
            return;
        } else {
          /* FALLBACK: Debug Target Date */
          const from = new Date(targetDate).getTime();

          const toDateEnd = new Date(targetDate);

          toDateEnd.setHours(23, 59, 59, 999);

          const to = toDateEnd.getTime();

          if (isNaN(created) || created < from || created > to) return;
        }

        /* WRAP UP FILTER */

        if (excludedWrapUps.includes(row.wrap_up)) return;

        /* RESPONSE TIME */

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();

        const endorsed = new Date(row.ticket_endorsed).getTime();

        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          responseTotal += (tsaAck - endorsed) / 3600000;

          responseCount++;
        }

        /* BASE HT */

        let baseHT = 0;

        const tsaHandle = new Date(row.tsa_handling_time).getTime();

        const tsmHandle = new Date(row.tsm_handling_time).getTime();

        const received = new Date(row.ticket_received).getTime();

        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
          baseHT = (tsaHandle - received) / 3600000;
        else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
          baseHT = (tsmHandle - received) / 3600000;

        if (!baseHT) return;

        /* CLASSIFY */

        const remarks = (row.remarks || "").toUpperCase();

        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          quotationTotal += baseHT;

          quotationCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT;

          spfCount++;
        } else {
          nonQuotationTotal += baseHT;

          nonQuotationCount++;
        }
      });

      return {
        avgResponseTime: responseCount ? responseTotal / responseCount : 0,

        avgNonQuotationHT: nonQuotationCount
          ? nonQuotationTotal / nonQuotationCount
          : 0,

        avgQuotationHT: quotationCount ? quotationTotal / quotationCount : 0,

        avgSpfHT: spfCount ? spfTotal / spfCount : 0,
      };
}, [activities, targetDate, rangeFrom, rangeTo]);

  /* ================= UI ================= */

  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between rounded-none">
      <CardHeader>
        <CardTitle>CSR Metrics Tickets</CardTitle>
      </CardHeader>

      <CardContent>
        {/* DEBUG PANEL remain this as a comment */}

        <div className="p-3 mb-4 bg-[#F9FAFA] border border-gray-200 rounded-md">
          <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2">
            Debugging Calibration
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] uppercase font-semibold text-gray-400">
                Target Reference ID
              </label>

              <Input
                className="h-8 text-xs font-mono"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-semibold text-gray-400">
                Target Date
              </label>

              <Input
                type="date"
                className="h-8 text-xs"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full mt-3 h-8 bg-[#121212] text-[10px] uppercase gap-2 rounded-md"
            onClick={fetchCSRMetrics}
          >
            <RefreshCcw size={12} />
            Sync Debug Parameters
          </Button>
        </div>

        {/* RESULTS */}

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 justify-items-center">
            <Speedometer
              label="TSA Response Time"
              value={avgResponseTime}
              maxHours={2}
            />

            <Speedometer
              label="Non-Quotation HT"
              value={avgNonQuotationHT}
              maxHours={2}
            />

            <Speedometer
              label="Quotation HT"
              value={avgQuotationHT}
              maxHours={2}
            />

            <Speedometer
              label="SPF Handling Duration"
              value={avgSpfHT}
              maxHours={2}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        CSR performance summary
      </CardFooter>
    </Card>
  );
}
