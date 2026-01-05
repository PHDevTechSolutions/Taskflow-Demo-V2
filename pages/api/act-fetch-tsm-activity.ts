// pages/api/act-fetch-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { referenceid } = req.query;

    const cacheKey = referenceid && typeof referenceid === "string"
      ? `activity:tsm:${referenceid}`
      : null;

    if (cacheKey) {
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === "string") {
        return res.status(200).json({ success: true, data: JSON.parse(cached), cached: true });
      }
    }

    let query = supabase.from("activity").select("*");

    if (referenceid && typeof referenceid === "string") {
      query = query.eq("tsm", referenceid);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (cacheKey && data) {
      // Cache the data for 5 minutes
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ success: true, data, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
