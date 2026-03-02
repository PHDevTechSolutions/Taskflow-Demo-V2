import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

const BATCH_SIZE = 5000;

// Async generator to fetch history in batches by TSM
async function* fetchHistoryBatches(tsm: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data; // ✅ allowed in async generator

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const cacheKey = `history:referenceid:${referenceid}`;

  try {
    // ---------------- Check cache first ----------------
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return res.status(200).json({ activities: JSON.parse(cached), cached: true });
    }

    // ---------------- Fetch from Supabase in batches ----------------
    const activities: any[] = [];
    for await (const batch of fetchHistoryBatches(referenceid)) {
      activities.push(...batch);
    }

    // ---------------- Cache result for 5 minutes ----------------
    if (activities.length > 0) {
      await redis.set(cacheKey, JSON.stringify(activities), { ex: 300 });
    }

    return res.status(200).json({ activities, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  }
}
