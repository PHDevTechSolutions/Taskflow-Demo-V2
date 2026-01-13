import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid } = req.query;

  // ✅ validate agent reference (stored in manager)
  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({
      message: "referenceid (agent manager) is required",
    });
  }

  /**
   * IMPORTANT:
   * - referenceid (query) = agent reference
   * - history.manager          = agent reference
   */
  const cacheKey = `history:manager:${referenceid}`;

  try {
    // ✅ Redis cache (per agent)
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({
        activities: JSON.parse(cached),
        cached: true,
      });
    }

    // ✅ Fetch ALL history for this agent (match via manager)
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .eq("manager", referenceid)
      .order("date_created", { ascending: false });

    if (error) {
      return res.status(500).json({
        message: error.message,
      });
    }

    // ✅ Cache results
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
