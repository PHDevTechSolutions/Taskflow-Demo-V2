import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

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

  try {
    // ---------------- Fetch from Supabase in batches ----------------
    const activities: any[] = [];
    for await (const batch of fetchHistoryBatches(referenceid)) {
      activities.push(...batch);
    }

    return res.status(200).json({ activities, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  }
}