import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

async function* fetchHistoryBatches(
  referenceid: string,
  fromDate?: string,
  toDate?: string
) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("spf_request")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    // Fetch status from spf_creation table for each SPF request
    const spfNumbers = data.map(item => item.spf_number).filter(Boolean);
    let statusMap = new Map();
    
    if (spfNumbers.length > 0) {
      const { data: statusData, error: statusError } = await supabase
        .from("spf_creation")
        .select("spf_number, status")
        .in("spf_number", spfNumbers);
      
      if (statusError) {
        console.error("Error fetching status from spf_creation:", statusError);
      } else if (statusData) {
        statusMap = new Map(statusData.map(item => [item.spf_number, item.status]));
      }
    }

    // Merge status information into the data
    const mergedData = data.map(item => ({
      ...item,
      status: statusMap.get(item.spf_number) || item.status || "pending"
    }));

    yield mergedData;

    lastId = data[data.length - 1].id;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let first = true;
    let total = 0;

    for await (const batch of fetchHistoryBatches(referenceid, fromDate, toDate)) {
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
