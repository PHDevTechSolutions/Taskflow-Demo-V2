// pages/api/act-fetch-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

const BATCH_SIZE = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Parse pagination params
    const { limit, lastId } = req.query;
    const parsedLimit = Math.min(
      parseInt(typeof limit === "string" ? limit : String(BATCH_SIZE), 10) || BATCH_SIZE,
      100 // Max 100 per request
    );
    const parsedLastId = lastId ? parseInt(String(lastId), 10) : null;

    // Skip cache for paginated requests (always fetch fresh)
    const isPaginated = parsedLastId !== null;

    if (!isPaginated) {
      const cacheKey = "activity:all:first";
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === "string") {
        const parsed = JSON.parse(cached);
        // Return only first batch from cache
        return res.status(200).json({
          success: true,
          data: parsed.slice(0, parsedLimit),
          cached: true,
          hasMore: parsed.length >= parsedLimit
        });
      }
    }

    // Build query with cursor-based pagination
    let query = supabase
      .from("activity")
      .select("*")
      .order("id", { ascending: true })
      .limit(parsedLimit + 1); // Fetch one extra to check if there are more

    // Apply cursor if provided
    if (parsedLastId !== null) {
      query = query.gt("id", parsedLastId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Check if there are more records
    const hasMore = data && data.length > parsedLimit;
    const trimmedData = hasMore ? data.slice(0, parsedLimit) : (data || []);

    // Cache only first batch
    if (!isPaginated && trimmedData.length > 0) {
      await redis.set("activity:all:first", JSON.stringify(trimmedData), { ex: 60 });
    }

    return res.status(200).json({
      success: true,
      data: trimmedData,
      cached: false,
      hasMore
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
