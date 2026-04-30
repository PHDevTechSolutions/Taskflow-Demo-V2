import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

// Async generator to fetch any table in batches
async function* fetchTableBatches(
  table: string,
  tsm: string,
  from?: string,
  to?: string,
  limit?: number
) {
  let lastId: number | null = null;
  let totalFetched = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);
    if (from) query = query.gte("date_created", from);
    if (to) query = query.lte("date_created", to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    // Stop if we reached the limit
    if (limit && totalFetched >= limit) break;
    lastId = data[data.length - 1].id;
  }
}

// Normalize each table to a common structure
function normalizeRecord(item: any, source: string) {
  switch (source) {
    case "history":
      return { ...item, type_activity: item.type_activity, start_date: item.start_date, end_date: item.end_date, source: item.source };
    case "documentation":
      return { ...item, type_activity: item.doc_type || "Documentation", start_date: item.start_date || null, end_date: item.end_date || null, source };
    case "revised_quotations":
      return { ...item, type_activity: "Revised Quotation", start_date: item.start_date || null, end_date: item.end_date || item.date_created || null, source };
    case "meetings":
      return { ...item, type_activity: "Client Meeting", start_date: item.start_date || null, end_date: item.end_date || item.meeting_start || null, source };
    default:
      return { ...item, type_activity: "Unknown", start_date: null, end_date: null, source };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, limit } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "referenceid (agent tsm) is required" });
  }

  // Parse limit with safeguards
  const parsedLimit = Math.min(
    parseInt(typeof limit === "string" ? limit : String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Tables to fetch
    const tables = ["history", "documentation", "revised_quotations", "meetings"];
    let allActivities: any[] = [];
    let hasMore = false;

    // Per-table limit to distribute load
    const perTableLimit = Math.ceil(parsedLimit / tables.length);

    for (const table of tables) {
      if (allActivities.length >= parsedLimit) {
        hasMore = true;
        break;
      }

      for await (const batch of fetchTableBatches(table, referenceid, fromDate, toDate, perTableLimit)) {
        const remaining = parsedLimit - allActivities.length;
        if (remaining <= 0) {
          hasMore = true;
          break;
        }

        const normalizedBatch = batch.map((item) => normalizeRecord(item, table));
        // Only take what we need
        if (normalizedBatch.length > remaining) {
          allActivities.push(...normalizedBatch.slice(0, remaining));
          hasMore = true;
        } else {
          allActivities.push(...normalizedBatch);
        }
      }
    }

    // Sort by date_created / start_date descending
    allActivities.sort(
      (a, b) =>
        new Date(b.date_created || b.start_date).getTime() -
        new Date(a.date_created || a.start_date).getTime()
    );

    return res.status(200).json({
      activities: allActivities,
      pagination: {
        limit: parsedLimit,
        returned: allActivities.length,
        hasMore,
      },
      filters: {
        from: fromDate || null,
        to: toDate || null,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
