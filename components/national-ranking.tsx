"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";

interface HistoryItem {
  referenceid: string;
  tsm: string;
  call_status?: string;
  date_created: string;
}

interface UserInfo {
  ReferenceID: string | null | undefined;
  Firstname: string;
  Lastname: string;
  profilePicture: string | null;
}

interface RankedItem {
  referenceid: string;
  count: number;
  firstname: string;
  lastname: string;
  profilePicture: string | null;
  rank: number;
}

interface NationalRankingProps {
  dateCreatedFilterRange: [Date | null, Date | null];
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<[Date | null, Date | null]>
  >;
}

export function NationalRanking({
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}: NationalRankingProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, endDate] = dateCreatedFilterRange;

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}`;
  };

  // Normalize users map for fast lookup and safe key access
  const usersByRef = useMemo(() => {
    const map = new Map<string, UserInfo>();
    users.forEach((u) => {
      if (typeof u.ReferenceID === "string" && u.ReferenceID.trim()) {
        map.set(u.ReferenceID.trim().toLowerCase(), u);
      }
    });
    return map;
  }, [users]);

  const assignRank = (items: Omit<RankedItem, "rank">[]): RankedItem[] => {
    let lastCount = -1;
    let rank = 0;

    return items
      .sort((a, b) => b.count - a.count)
      .map((item, index) => {
        if (item.count !== lastCount) {
          rank = index + 1;
          lastCount = item.count;
        }
        return { ...item, rank };
      });
  };

  const fetchAllHistory = async () => {
    let all: HistoryItem[] = [];
    let from = 0;
    const size = 1000;

    while (true) {
      let query = supabase
        .from("history")
        .select("referenceid, tsm, call_status, date_created")
        .range(from, from + size - 1);

      if (startDate && endDate) {
        const start = formatDate(startDate);
        const end = formatDate(endDate);

        query =
          start === end
            ? query.eq("date_created", start)
            : query.gte("date_created", start).lte("date_created", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < size) break;
      from += size;
    }

    return all;
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/fetch-users");
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setHistory(await fetchAllHistory());
        setUsers(await fetchUsers());
      } catch (e: any) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate]);

  const tsaRank = useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((h) => {
      if (h.call_status?.toLowerCase() !== "successful") return;
      if (!h.referenceid) return;

      const key = h.referenceid.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const items = Array.from(map.entries()).map(([ref, count]) => {
      const user = usersByRef.get(ref);
      return {
        referenceid: ref,
        count,
        firstname: user?.Firstname || "Unknown",
        lastname: user?.Lastname || "",
        profilePicture: user?.profilePicture || null,
      };
    });

    return assignRank(items);
  }, [history, usersByRef]);

  const tsmRank = useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((h) => {
      if (h.call_status?.toLowerCase() !== "successful") return;
      if (!h.tsm) return;

      const key = h.tsm.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const items = Array.from(map.entries()).map(([ref, count]) => {
      const user = usersByRef.get(ref);
      return {
        referenceid: ref,
        count,
        firstname: user?.Firstname || "Unknown",
        lastname: user?.Lastname || "",
        profilePicture: user?.profilePicture || null,
      };
    });

    return assignRank(items);
  }, [history, usersByRef]);

  const overallTotal = useMemo(
    () => tsaRank.reduce((a, b) => a + b.count, 0),
    [tsaRank]
  );

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateCreatedFilterRangeAction([
      e.target.value ? new Date(e.target.value) : null,
      endDate,
    ]);

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateCreatedFilterRangeAction([
      startDate,
      e.target.value ? new Date(e.target.value) : null,
    ]);

  const renderTable = (data: RankedItem[]) => (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50 text-left">
        <tr>
          <th className="px-4 py-2 text-xs">Rank</th>
          <th className="px-4 py-2 text-xs">Agent</th>
          <th className="px-4 py-2 text-xs">Successful</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.referenceid} className="border-b">
            <td className="px-4 py-2 text-xs font-semibold">{item.rank}</td>
            <td className="px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                {item.profilePicture ? (
                  <img
                    src={item.profilePicture}
                    className="w-8 h-8 rounded-full"
                    alt={`${item.firstname} ${item.lastname}`}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                    N/A
                  </div>
                )}
                <div>
                  <div className="font-semibold uppercase">
                    {item.firstname} {item.lastname}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-4 py-2 text-xs font-bold">{item.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex gap-4">
        <label className="text-sm font-semibold">
          Start Date:{" "}
          <input
            type="date"
            value={startDate ? formatDate(startDate) : ""}
            onChange={handleStartDateChange}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm font-semibold">
          End Date:{" "}
          <input
            type="date"
            value={endDate ? formatDate(endDate) : ""}
            onChange={handleEndDateChange}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-10" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-10">{error}</div>
      ) : (
        <>
          <Card className="bg-white text-black p-4 rounded-none">
            <CardContent className="p-0 overflow-auto">
              <div className="flex gap-6">
                {/* TSA Ranking Column */}
                <div className="flex-1 min-w-0 border-r">
                  <h3 className="font-semibold mb-2">TSA Ranking</h3>
                  {renderTable(tsaRank)}
                  <div className="flex justify-end mt-2 gap-2 p-4 text-xs font-semibold">
                    <span>Overall Total</span>
                    <Badge>{overallTotal}</Badge>
                  </div>
                </div>

                {/* TSM Ranking Column */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold mb-2">TSM Ranking</h3>
                  {renderTable(tsmRank)}
                </div>
              </div>
            </CardContent>
          </Card>

        </>
      )}
    </main>
  );
}
