import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const fromDate = req.query.from as string | undefined;
  const toDate = req.query.to as string | undefined;

  // Create cache key based on date range (or all if no filter)
  const cacheKey = fromDate && toDate
    ? `history:${fromDate}:${toDate}`
    : "history:all";

  try {
    // Check Redis cache first
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res
        .status(200)
        .json({ activities: JSON.parse(cached), cached: true });
    }

    // Build query with optional date filters
    let query = supabase.from("history").select("*");

    if (fromDate && toDate) {
      query = query.gte("si_date", fromDate).lte("si_date", toDate);
    }

    // Fetch data from Supabase
    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    // Cache results for 5 minutes
    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
