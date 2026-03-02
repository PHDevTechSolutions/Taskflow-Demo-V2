import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Generator for streaming activity batches
async function* fetchActivityBatches(referenceid: string, fromISO?: string, toISO?: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromISO && toISO) query = query.gte("date_created", fromISO).lt("date_created", toISO);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;

    lastId = data[data.length - 1].id;
  }
}

// Generator for streaming history batches based on activity_reference_number
async function* fetchHistoryBatches(activityIds: string[]) {
  if (!activityIds.length) return;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .in("activity_reference_number", activityIds)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;

    offset += BATCH_SIZE;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? new Date(from).toISOString() : undefined;
  let toISO: string | undefined = undefined;
  if (typeof to === "string") {
    const toDay = new Date(to);
    toDay.setDate(toDay.getDate() + 1); // include full 'to' day
    toISO = toDay.toISOString();
  }

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON
    let firstActivity = true;
    const allActivityIds: string[] = [];
    let totalActivities = 0;

    // Stream activities
    for await (const batch of fetchActivityBatches(referenceid, fromDate, toISO)) {
      for (const row of batch) {
        allActivityIds.push(row.activity_reference_number);
        const json = JSON.stringify(row);
        res.write(firstActivity ? json : `,${json}`);
        firstActivity = false;
        totalActivities++;
      }
    }
    res.write(`],"history":[`); // start history array
    let firstHistory = true;
    let totalHistory = 0;

    // Stream history
    for await (const batch of fetchHistoryBatches(allActivityIds)) {
      for (const row of batch) {
        const json = JSON.stringify(row);
        res.write(firstHistory ? json : `,${json}`);
        firstHistory = false;
        totalHistory++;
      }
    }

    res.write(`],"total_activities":${totalActivities},"total_history":${totalHistory}}`);
    res.end();
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) res.status(500).json({ message: err.message || "Server error" });
  }
}