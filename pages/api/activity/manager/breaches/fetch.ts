import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000; // Safe batch size

// -------------------- Helper: fetch all rows in batches --------------------
async function fetchAllRows(
  table: string,
  manager: string,
  fromDate?: string,
  toDate?: string
) {
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("manager", manager)
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate && toDate) {
      // date_created is a date-only string (YYYY-MM-DD)
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    allData.push(...(data || []));

    if (!data || data.length < BATCH_SIZE) break; // finished fetching
    offset += BATCH_SIZE;
  }

  return allData;
}

// -------------------- API Handler --------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { manager, from, to } = req.query;

  if (!manager || typeof manager !== "string") {
    return res.status(400).json({ message: "Missing or invalid manager" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // 1️⃣ Fetch all tables
    const historyData = await fetchAllRows("history", manager, fromDate, toDate);
    const revisedData = await fetchAllRows("revised_quotations", manager, fromDate, toDate);
    const meetingsData = await fetchAllRows("meetings", manager, fromDate, toDate);
    const documentationData = await fetchAllRows("documentation", manager, fromDate, toDate);

    // 2️⃣ Merge and normalize with table source
    const activities = [
      ...(historyData || []).map(item => ({ source: "history", ...item })),
      ...(revisedData || []).map(item => ({ source: "revised_quotations", ...item })),
      ...(meetingsData || []).map(item => ({ source: "meeting", ...item })),
      ...(documentationData || []).map(item => ({ source: "documentation", ...item })),
    ].sort((a, b) =>
      // ✅ Sort by date only, newest first
      b.date_created > a.date_created ? 1 : b.date_created < a.date_created ? -1 : 0
    );

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}