import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Convert to proper ISO timestamps
    const fromISO = fromDate ? new Date(fromDate).toISOString() : undefined;
    let toISO: string | undefined = undefined;
    if (toDate) {
      const toDay = new Date(toDate);
      // Add 1 day so range includes entire "to" date
      toDay.setDate(toDay.getDate() + 1);
      toISO = toDay.toISOString();
    }

    // Fetch activities with date filter
    let activityQuery = supabase
      .from("activity")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid);

    if (fromISO && toISO) {
      activityQuery = activityQuery.gte("date_created", fromISO).lt("date_created", toISO);
    }

    activityQuery = activityQuery.range(0, 9999);
    const { data: activityData, error: activityError } = await activityQuery;
    if (activityError) throw activityError;

    // Get activity IDs to fetch related history
    const activityIds = activityData?.map((a) => a.activity_reference_number) || [];

    // Fetch history **only for these activities**
    let historyQuery = supabase
      .from("history")
      .select("*", { count: "exact" })
      .in("activity_reference_number", activityIds);

    historyQuery = historyQuery.range(0, 9999);
    const { data: historyData, error: historyError } = await historyQuery;
    if (historyError) throw historyError;

    return res.status(200).json({
      activities: activityData || [],
      history: historyData || [],
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
