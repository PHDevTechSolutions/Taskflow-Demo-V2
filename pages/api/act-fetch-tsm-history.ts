import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Fetch HISTORY in batches by TSM only
async function* fetchHistoryBatches(tsm: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) {
      query = query.gt("id", lastId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    lastId = data[data.length - 1].id;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { tsm } = req.query;

  if (!tsm || typeof tsm !== "string") {
    return res.status(400).json({ message: "Missing or invalid TSM" });
  }

  try {
    const activities: any[] = [];

    for await (const batch of fetchHistoryBatches(tsm)) {
      activities.push(...batch);
    }

    // Sort by date_created (fallback to start_date if needed)
    activities.sort(
      (a, b) =>
        new Date(b.date_created || b.start_date).getTime() -
        new Date(a.date_created || a.start_date).getTime()
    );

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
}