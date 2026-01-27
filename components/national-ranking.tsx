"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner"

interface HistoryItem {
  referenceid: string;
  tsm: string;
  type_activity: string;
  call_status: string;
  date_created: string;
}

interface UserTransfer {
  Firstname: string;
  Lastname: string;
  ReferenceID: string;
  profilePicture: string;
}

interface Props {
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

function Top3Ranking({
  top3,
  userTransfers,
}: {
  top3: { referenceid: string; successful: number }[];
  userTransfers: UserTransfer[];
}) {
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card className="mb-6 bg-white text-black z-50">
      <CardHeader>
        <CardTitle className="text-2xl">🏆 Ranking Achievements</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row justify-around gap-6 p-6">
        {top3.length === 0 ? (
          <p className="text-center w-full text-gray-500">No ranking data</p>
        ) : (
          top3.map(({ referenceid, successful }, index) => {
            const user = userTransfers.find((u) => u.ReferenceID === referenceid);
            return (
              <div
                key={referenceid}
                className="flex flex-col items-center bg-yellow-50 rounded-xl shadow-md p-4 w-full max-w-xs"
              >
                <div className="text-5xl mb-2">{medals[index] || `#${index + 1}`}</div>
                <img
                  src={user?.profilePicture ?? "/Taskflow.png"}
                  alt={user ? `${user.Firstname} ${user.Lastname}` : "Unknown User"}
                  className="w-30 h-30 rounded-full object-cover mb-2 border-4 border-yellow-400"
                />
                <h3 className="text-lg font-semibold text-center uppercase">
                  {user ? `${user.Firstname} ${user.Lastname}` : "Unknown User"}
                </h3>
                <p className="text-yellow-700 font-bold text-xl mt-1">
                  {successful} Successful Calls
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function NationalRanking({ dateCreatedFilterRange }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  const [userTransfers, setUserTransfers] = useState<UserTransfer[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [errorTransfers, setErrorTransfers] = useState<string | null>(null);

  const { userId } = useUser();

  // Fetch all user transfers (Mongo users)
  useEffect(() => {
    if (!userId) return;

    const fetchUserTransfers = async () => {
      setLoadingTransfers(true);
      setErrorTransfers(null);
      try {
        const res = await fetch(
          `/api/fetch-users?referenceid=${encodeURIComponent(userId)}`
        );
        if (!res.ok) throw new Error("Failed to fetch user transfers");
        setUserTransfers(await res.json());
      } catch (err: any) {
        setErrorTransfers(err.message);
      } finally {
        setLoadingTransfers(false);
      }
    };

    fetchUserTransfers();
  }, [userId]);

  // Fetch all history records
  useEffect(() => {
    const fetchAllHistory = async () => {
      setLoadingHistory(true);
      setErrorHistory(null);
      try {
        const res = await fetch("/api/all-history");
        if (!res.ok) throw new Error("Failed to fetch history data");
        const data = await res.json();
        setHistory(data.activities ?? []);
      } catch (err: any) {
        setErrorHistory(err.message);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchAllHistory();
  }, []);

  // Compare two dates ignoring time
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // Helper to check if a date is inside the filter range (if any)
  const isDateInRange = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) {
      // No filter = only today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return isSameDay(date, today);
    }

    let fromDate = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from)
      : null;
    let toDate = dateCreatedFilterRange?.to ? new Date(dateCreatedFilterRange.to) : null;

    if (toDate) toDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      if (isSameDay(fromDate, toDate)) {
        return isSameDay(date, fromDate);
      }
      return date >= fromDate && date <= toDate;
    }

    if (fromDate && !toDate) return date >= fromDate;
    if (!fromDate && toDate) return date <= toDate;

    return true;
  };

  // Card 1: Group successful Outbound Calls by referenceid (associates)
  const groupedByReferenceid = React.useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((item) => {
      if (item.type_activity !== "Outbound Calls" || item.call_status !== "Successful")
        return;
      if (!isDateInRange(item.date_created)) return;
      if (!item.referenceid) return;

      map.set(item.referenceid, (map.get(item.referenceid) ?? 0) + 1);
    });

    return Array.from(map.entries()).map(([referenceid, successful]) => ({
      referenceid,
      successful,
    }));
  }, [history, dateCreatedFilterRange]);

  // Card 2: Group successful Outbound Calls by tsm (managers)
  const groupedByTsm = React.useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((item) => {
      if (item.type_activity !== "Outbound Calls" || item.call_status !== "Successful")
        return;
      if (!isDateInRange(item.date_created)) return;
      if (!item.tsm) return;

      map.set(item.tsm, (map.get(item.tsm) ?? 0) + 1);
    });

    const array = Array.from(map.entries()).map(([tsm, total]) => {
      const user = userTransfers.find((u) => u.ReferenceID === tsm);
      return {
        tsm,
        user,
        total,
      };
    });

    const grandTotal = array.reduce((acc, cur) => acc + cur.total, 0);

    return { array, grandTotal };
  }, [history, dateCreatedFilterRange, userTransfers]);

  // Sort groupedByReferenceid by successful calls descending
  const sortedGroupedByReferenceid = React.useMemo(() => {
    return groupedByReferenceid.slice().sort((a, b) => b.successful - a.successful);
  }, [groupedByReferenceid]);

  const grandTotalReferenceid = React.useMemo(() => {
    return sortedGroupedByReferenceid.reduce((acc, cur) => acc + cur.successful, 0);
  }, [sortedGroupedByReferenceid]);

  // Sort groupedByTsm by total successful calls descending
  const sortedGroupedByTsm = React.useMemo(() => {
    return groupedByTsm.array.slice().sort((a, b) => b.total - a.total);
  }, [groupedByTsm]);

  const top3 = sortedGroupedByReferenceid.slice(0, 3);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto z-50">
      {loadingHistory ? (
        <div className="flex justify-center items-center py-10">
          <Spinner className="size-10" />
        </div>
      ) : errorHistory ? (
        <div className="text-center text-red-500 py-10">{errorHistory}</div>
      ) : (
        <>
          <Top3Ranking top3={top3} userTransfers={userTransfers} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* CARD 1: National Ranking (Associates) */}
            <Card className="bg-white text-black">
              <CardHeader>
                <CardTitle>National Ranking</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Rank
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Successful Calls
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedGroupedByReferenceid.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      sortedGroupedByReferenceid.map(({ referenceid, successful }, index) => {
                        const user = userTransfers.find(
                          (u) => u.ReferenceID === referenceid
                        );
                        return (
                          <tr key={referenceid}>
                            <td className="px-4 py-2 text-xs">{index + 1}</td>
                            <td className="px-4 py-2 flex items-center gap-2 capitalize font-semibold text-xs">
                              {user ? (
                                <>
                                  <img
                                    src={user.profilePicture}
                                    alt={`${user.Firstname} ${user.Lastname}`}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                  {user.Firstname} {user.Lastname}
                                </>
                              ) : (
                                <span className="italic text-gray-400">Unknown User</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs font-bold">{successful}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                </table>
              </CardContent>
              <CardFooter>
                {sortedGroupedByReferenceid.length > 0 && (
                  <div className="flex justify-end items-center bg-gray-100 px-4 py-2 text-xs font-semibold rounded-md gap-2 w-full">
                    <span>Grand Total</span>
                    <Badge className="font-bold">
                      {grandTotalReferenceid}
                    </Badge>
                  </div>
                )}
              </CardFooter>
            </Card>

            {/* CARD 2: TSM Summary (Managers) */}
            <Card className="bg-white text-black">
              <CardHeader>
                <CardTitle>TSM Summary</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Rank
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        TSM
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Successful Calls
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedGroupedByTsm.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      sortedGroupedByTsm.map(({ tsm, user, total }, index) => (
                        <tr key={tsm}>
                          <td className="px-4 py-2 text-xs">{index + 1}</td>
                          <td className="px-4 py-2 flex items-center gap-2 text-xs font-semibold capitalize">
                            {user ? (
                              <>
                                <img
                                  src={user.profilePicture}
                                  alt={`${user.Firstname} ${user.Lastname}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                {user.Firstname} {user.Lastname}
                              </>
                            ) : (
                              <span className="italic text-gray-400">Unknown User</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs">{total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
              <CardFooter>
                {sortedGroupedByTsm.length > 0 && (
                  <div className="flex justify-end items-center bg-gray-100 px-4 py-2 text-xs font-semibold rounded-md gap-2 w-full">
                    <span>Grand Total</span>
                    <Badge className="font-bold">
                      {groupedByTsm.grandTotal}
                    </Badge>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
