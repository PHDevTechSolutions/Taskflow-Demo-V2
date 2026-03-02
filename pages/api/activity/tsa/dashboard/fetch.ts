import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

async function* fetchRowsInBatches(
  table: string,
  referenceid: string,
  fromDate?: string,
  toDate?: string
) {
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("referenceid", referenceid)
      .order("date_created", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    yield data; // yield each batch instead of storing all in memory

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // For multiple tables, we process sequentially to reduce memory usage
    const tables = ["history", "revised_quotations", "meetings", "documentation"];
    let totalCount = 0;

    // Store merged activities in a temporary array if needed for sorting
    const activities: any[] = [];

    for (const table of tables) {
      for await (const batch of fetchRowsInBatches(table, referenceid, fromDate, toDate)) {
        const normalized = batch.map((item) => ({ source: table, ...item }));
        totalCount += normalized.length;
        activities.push(...normalized); // optional: process each batch immediately instead of pushing if needed
      }
    }

    // Sort at the end by date_created
    activities.sort(
      (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    return res.status(200).json({
      activities,
      total: totalCount,
      cached: false,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}