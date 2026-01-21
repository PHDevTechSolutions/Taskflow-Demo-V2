// pages/api/act-fetch-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const cacheKey = "activity:all";

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return res.status(200).json({ success: true, data: JSON.parse(cached), cached: true });
    }

    // Query all activities (no filtering)
    const { data, error } = await supabase.from("activity").select("*");

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      // Cache the data for 5 minutes
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ success: true, data, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
