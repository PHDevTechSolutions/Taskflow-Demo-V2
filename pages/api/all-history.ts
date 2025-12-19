// pages/api/all-history.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cacheKey = `history:all`;

  try {
    // Check cache first
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({ activities: JSON.parse(cached), cached: true });
    }

    // Fetch all records without filter
    const { data, error } = await supabase
      .from("history")
      .select("referenceid, tsm, type_activity, call_status, date_created");

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
