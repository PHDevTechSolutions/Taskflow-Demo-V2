import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

const BATCH_SIZE = 5000;

// Async generator to fetch any table in batches
async function* fetchTableBatches(table: string, tsm: string, from?: string, to?: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (from) query = query.gte("date_created", from);
    if (to) query = query.lte("date_created", to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    lastId = data[data.length - 1].id;
  }
}

// Normalize each table to a common structure
function normalizeRecord(item: any, source: string) {
  switch (source) {
    case "history":
      return { ...item, type_activity: item.type_activity, start_date: item.start_date, end_date: item.end_date, source };
    case "documentation":
      return { ...item, type_activity: item.doc_type || "Documentation", start_date: item.start_date || null, end_date: item.end_date || null, source };
    case "revised_quotations":
      return { ...item, type_activity: "Revised Quotation", start_date: item.start_date || null, end_date: item.end_date || item.created_at || null, source };
    case "meetings":
      return { ...item, type_activity: "Meeting", start_date: item.meeting_start || null, end_date: item.meeting_end || item.meeting_start || null, source };
    default:
      return { ...item, type_activity: "Unknown", start_date: null, end_date: null, source };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "referenceid (agent tsm) is required" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const cacheKey = `activities:tsm:${referenceid}:${fromDate || "all"}:${toDate || "all"}`;

  try {
    // ✅ Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return res.status(200).json({ activities: JSON.parse(cached), cached: true });
    }

    // Tables to fetch
    const tables = ["history", "documentation", "revised_quotations", "meetings"];
    const allActivities: any[] = [];

    for (const table of tables) {
      for await (const batch of fetchTableBatches(table, referenceid, fromDate, toDate)) {
        const normalizedBatch = batch.map((item) => normalizeRecord(item, table));
        allActivities.push(...normalizedBatch);
      }
    }

    // Sort by date_created / start_date descending
    allActivities.sort(
      (a, b) =>
        new Date(b.date_created || b.start_date).getTime() -
        new Date(a.date_created || a.start_date).getTime()
    );

    // Cache the merged result for 5 minutes
    await redis.set(cacheKey, JSON.stringify(allActivities), { ex: 300 });

    return res.status(200).json({ activities: allActivities, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}