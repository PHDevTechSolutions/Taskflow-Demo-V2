import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

const BATCH_SIZE = 5000;

// 🔁 Async generator for large datasets
async function* fetchHistoryBatches(tsm: string) {
  let lastId: number | null = null;

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

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    yield data;

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid } = req.query;

  // ✅ validate agent reference
  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({
      message: "referenceid (agent tsm) is required",
    });
  }

  const cacheKey = `history:tsm:${referenceid}`;

  try {
    // ✅ Redis cache
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return res.status(200).json({
        activities: JSON.parse(cached),
        cached: true,
      });
    }

    // ✅ Fetch ALL rows safely (100k+)
    const activities: any[] = [];

    for await (const batch of fetchHistoryBatches(referenceid)) {
      activities.push(...batch);
    }

    // ✅ Sort by date_created DESC (same behavior as before)
    activities.sort(
      (a, b) =>
        new Date(b.date_created).getTime() -
        new Date(a.date_created).getTime()
    );

    // ✅ Cache result (5 minutes)
    await redis.set(cacheKey, JSON.stringify(activities), {
      ex: 300,
    });

    return res.status(200).json({
      activities,
      cached: false,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
}