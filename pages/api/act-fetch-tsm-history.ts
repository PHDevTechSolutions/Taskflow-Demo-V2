import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Generic async generator to fetch any table in batches by TSM
async function* fetchTableBatches(table: string, tsm: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    lastId = data[data.length - 1].id;
  }
}

// Normalize each table to have type_activity, start_date, end_date
function normalizeRecord(item: any, source: string) {
  switch (source) {
    case "history":
      return item; // already has type_activity, start_date, end_date
    case "documentation":
      return {
        ...item,
        type_activity: item.doc_type || "Documentation",
        start_date: item.start_date || null,
        end_date: item.end_date || null,
      };
    case "revised_quotations":
      return {
        ...item,
        type_activity: "Revised Quotation",
        start_date: item.created_at || null,
        end_date: item.updated_at || item.created_at || null,
      };
    case "meetings":
      return {
        ...item,
        type_activity: "Meeting",
        start_date: item.meeting_start || null,
        end_date: item.meeting_end || item.meeting_start || null,
      };
    default:
      return {
        ...item,
        type_activity: "Unknown",
        start_date: null,
        end_date: null,
      };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { tsm } = req.query;

  if (!tsm || typeof tsm !== "string") {
    return res.status(400).json({ message: "Missing or invalid TSM" });
  }

  try {
    const tables = ["history", "documentation", "revised_quotations", "meetings"];
    let allActivities: any[] = [];

    for (const table of tables) {
      for await (const batch of fetchTableBatches(table, tsm)) {
        const normalizedBatch = batch.map((item) => normalizeRecord(item, table));
        allActivities.push(...normalizedBatch);
      }
    }

    // Sort by date_created descending
    allActivities.sort((a, b) => new Date(b.date_created || b.start_date).getTime() - new Date(a.date_created || a.start_date).getTime());

    return res.status(200).json({ activities: allActivities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}