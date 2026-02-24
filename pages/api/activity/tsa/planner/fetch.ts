import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Convert to ISO timestamps
    const fromISO = fromDate ? new Date(fromDate).toISOString() : undefined;
    let toISO: string | undefined = undefined;
    if (toDate) {
      const toDay = new Date(toDate);
      toDay.setDate(toDay.getDate() + 1); // include the full 'to' day
      toISO = toDay.toISOString();
    }

    // ---------------- Fetch all activities in batches ----------------
    let allActivities: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("activity")
        .select("*")
        .eq("referenceid", referenceid);

      if (fromISO && toISO) {
        query = query.gte("date_created", fromISO).lt("date_created", toISO);
      }

      query = query.range(offset, offset + BATCH_SIZE - 1);

      const { data, error } = await query;
      if (error) throw error;

      allActivities.push(...(data || []));

      if (!data || data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    // ---------------- Fetch all related histories in batches ----------------
    const activityIds = allActivities.map(a => a.activity_reference_number);
    let allHistory: any[] = [];
    offset = 0;

    while (activityIds.length && true) {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", activityIds)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;

      allHistory.push(...(data || []));

      if (!data || data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    // ---------------- Return response ----------------
    return res.status(200).json({
      activities: allActivities,
      history: allHistory,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}