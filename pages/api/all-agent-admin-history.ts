import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Removed referenceid extraction and validation

  // Cache key for all history (no agent-specific key)
  const cacheKey = `history:all`;

  try {
    // Redis cache for all history
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({
        activities: JSON.parse(cached),
        cached: true,
      });
    }

    // Fetch ALL history (no filtering by tsm)
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .order("date_created", { ascending: false });

    if (error) {
      return res.status(500).json({
        message: error.message,
      });
    }

    // Cache results
    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), {
        ex: 300, // 5 minutes
      });
    }

    return res.status(200).json({
      activities: data ?? [],
      cached: false,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
}
