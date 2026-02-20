import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

const BATCH_SIZE = 5000; // safe batch size per request

async function fetchAllRows(
  table: string,
  referenceid?: string
) {
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*", { count: "exact" })
      .order("date_created", { ascending: true }) // ensure consistent order
      .range(offset, offset + BATCH_SIZE - 1);

    if (referenceid) {
      query = query.eq("referenceid", referenceid);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data?.length) {
      allData.push(...data);
    }

    if (!data || data.length < BATCH_SIZE) break; // finished fetching
    offset += BATCH_SIZE;
  }

  return allData;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { referenceid } = req.query;

    // Fetch all rows from activity table
    const data = await fetchAllRows("activity", typeof referenceid === "string" ? referenceid : undefined);

    return res.status(200).json({ success: true, data, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}