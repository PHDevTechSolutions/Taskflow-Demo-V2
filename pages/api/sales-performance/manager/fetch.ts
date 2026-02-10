import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  // Validate from and to as strings (optional)
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  // Cache key includes date range for uniqueness
  const cacheKey = fromDate && toDate
    ? `history:referenceid:${referenceid}:from:${fromDate}:to:${toDate}`
    : `history:referenceid:${referenceid}`;

  try {
    // Check cache first
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({ activities: JSON.parse(cached), cached: true });
    }

    // Build query
    let query = supabase
      .from("history")
      .select("*")
      .eq("manager", referenceid);

    // Add date filtering if from and to are valid
    if (fromDate && toDate) {
      query = query.gte("si_date", fromDate).lte("si_date", toDate);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    // Cache for 5 minutes
    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
