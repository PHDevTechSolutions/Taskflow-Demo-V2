import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Fetch all SPF records in batches (optionally filter by date)
async function* fetchAllSPFBatches(fromDate?: string, toDate?: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("spf_request")
      .select("*")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    yield data;

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { from, to } = req.query;

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let first = true;
    let total = 0;

    for await (const batch of fetchAllSPFBatches(fromDate, toDate)) {
      for (const row of batch) {
        const json = JSON.stringify(row);
        res.write(first ? json : `,${json}`);
        first = false;
        total++;
      }
    }

    res.write(`],"total":${total},"cached":false}`);
    res.end();
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
}