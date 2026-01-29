"use client";

import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListTree } from "lucide-react";
import { Spinner } from "@/components/ui/spinner"

import CountUp from 'react-countup';

interface Company {
  type_client?: string;
  status?: string;
}

interface AccountCardProps {
  referenceid: string;
}

const excludedStatuses = [
  "removed",
  "subject for approval",
  "approved for deletion",
  "subject for transfer",
];

export const AccountCard: React.FC<AccountCardProps> = ({ referenceid }) => {
  const [totalAccounts, setTotalAccounts] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [breakdownData, setBreakdownData] = useState<Record<string, number> | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!referenceid) {
      setTotalAccounts(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to fetch accounts");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.data)) {
          const filteredData = data.data.filter((company: Company) => {
            const status = (company.status || "").toLowerCase();
            const typeClient = company.type_client?.toLowerCase() ?? "";
            return status && !excludedStatuses.includes(status) && typeClient.length > 0;
          });
          setTotalAccounts(filteredData.length);
        } else {
          setTotalAccounts(0);
        }
      })
      .catch((err) => {
        setError(err.message || "Error fetching accounts");
        setTotalAccounts(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [referenceid]);

  useEffect(() => {
    if (!open || !referenceid) return;

    setLoadingBreakdown(true);
    setBreakdownError(null);

    fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to fetch accounts");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.data)) {
          const filteredData = data.data.filter((company: Company) => {
            const status = (company.status || "").toLowerCase();
            const typeClient = company.type_client?.toLowerCase() ?? "";
            return status && !excludedStatuses.includes(status) && typeClient.length > 0;
          });

          const counts: Record<string, number> = {};
          filteredData.forEach((company: Company) => {
            const type = company.type_client!.toLowerCase();
            counts[type] = (counts[type] ?? 0) + 1;
          });

          setBreakdownData(counts);
        } else {
          setBreakdownData(null);
        }
      })
      .catch((err) => {
        setBreakdownError(err.message || "Error fetching breakdown");
        setBreakdownData(null);
      })
      .finally(() => {
        setLoadingBreakdown(false);
      });
  }, [open, referenceid]);

  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between">
      <CardHeader>
        <CardTitle>Total Accounts</CardTitle>
        <CardDescription>
          Number of accounts excluding removed or invalid statuses
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col justify-center items-center p-6 space-y-2">
        {loading ? (
          <Spinner />
        ) : error ? (
          <span className="text-red-600 font-semibold">{error}</span>
        ) : totalAccounts !== null ? (
          <>
            <CountUp
              end={totalAccounts}
              duration={1.5}
              className="text-6xl font-extrabold text-black"
            />
            <div className="text-sm text-gray-500">Total Accounts</div>
          </>
        ) : (
          <div className="text-gray-400 text-3xl">-</div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end border-t">
        <Button
          onClick={() => setOpen(true)}
          disabled={loading || !!error || !totalAccounts}
        >
          <ListTree /> Show Breakdown
        </Button>
      </CardFooter>

      {/* Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="max-w-sm p-4">
          <SheetHeader>
            <SheetTitle>Accounts Breakdown</SheetTitle>
            <SheetDescription>
              Number of accounts grouped by client type
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 p-4">
            {loadingBreakdown && <p>Loading breakdown...</p>}
            {breakdownError && (
              <p className="text-red-500 text-xs">{breakdownError}</p>
            )}
            {!loadingBreakdown && !breakdownError && breakdownData && (
              <>
                <ul className="divide-y divide-gray-200 text-xs uppercase">
                  {Object.entries(breakdownData).map(([type, count]) => (
                    <li key={type} className="flex justify-between py-2">
                      <span>{type}</span>
                      <span className="font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-between font-semibold border-t border-gray-300 pt-2 text-xs">
                  <span>TOTAL</span>
                  <span>{Object.values(breakdownData).reduce((a, b) => a + b, 0)}</span>
                </div>
              </>
            )}

            {!loadingBreakdown && !breakdownError && !breakdownData && (
              <p>No data available</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};
