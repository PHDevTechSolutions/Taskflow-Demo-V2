import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Async generator to fetch activity in batches by TSM
async function* fetchActivityBatches(tsm?: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("activity")
      .select("*")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (tsm) query = query.eq("tsm", tsm);
    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { referenceid } = req.query;

  if (referenceid && typeof referenceid !== "string") {
    return res.status(400).json({ error: "Invalid referenceid" });
  }

  try {
    // ---------------- Fetch from Supabase in batches ----------------
    const activities: any[] = [];
    for await (const batch of fetchActivityBatches(referenceid as string | undefined)) {
      activities.push(...batch);
    }

    return res.status(200).json({ success: true, data: activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}