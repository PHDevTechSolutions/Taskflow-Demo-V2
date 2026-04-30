import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000; // Reduced from 5000 to lower memory usage

// 🔁 Async generator for large datasets with optional date filtering
async function* fetchHistoryBatches(
  tsm: string,
  fromISO?: string,
  toISO?: string,
  limit?: number
) {
  let lastId: number | null = null;
  let totalFetched = 0;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) {
      query = query.gt("id", lastId);
    }

    // Apply date filters if provided
    if (fromISO) {
      query = query.gte("date_created", fromISO);
    }
    if (toISO) {
      query = query.lt("date_created", toISO);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    // Stop if we reached the limit
    if (limit && totalFetched >= limit) break;

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, from, to, limit = "500" } = req.query;

  // ✅ validate agent reference
  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({
      message: "referenceid (agent tsm) is required",
    });
  }

  // Parse pagination limit (max 2000 for safety)
  const parsedLimit = Math.min(parseInt(limit as string, 10) || 500, 2000);

  // Parse date filters
  const fromISO = typeof from === "string" && from ? new Date(from).toISOString() : undefined;
  const toISO = typeof to === "string" && to ? new Date(to).toISOString() : undefined;

  try {
    const activities: any[] = [];

    for await (const batch of fetchHistoryBatches(referenceid, fromISO, toISO, parsedLimit)) {
      activities.push(...batch);
      if (activities.length >= parsedLimit) break;
    }

    // Trim to exact limit
    const trimmedActivities = activities.slice(0, parsedLimit);

    // ✅ Sort by date_created DESC
    trimmedActivities.sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    // Add pagination info in response
    return res.status(200).json({
      activities: trimmedActivities,
      pagination: {
        limit: parsedLimit,
        returned: trimmedActivities.length,
        hasMore: activities.length > parsedLimit,
      },
      filters: {
        from: fromISO || null,
        to: toISO || null,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
}
