import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Search API: Searches full database by company_name, quotation_number, so_number ───
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { referenceid, search, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  if (!search || typeof search !== "string") {
    return res.status(400).json({ message: "Missing search term" });
  }

  const searchTerm = search.toLowerCase().trim();

  // Parse date range
  const fromISO =
    typeof from === "string" && from
      ? new Date(from).toISOString()
      : undefined;

  let toISO: string | undefined;
  if (typeof to === "string" && to) {
    const toDay = new Date(to);
    toDay.setDate(toDay.getDate() + 1);
    toISO = toDay.toISOString();
  }

  try {
    // Search activities by company_name (case-insensitive)
    let activityQuery = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .ilike("company_name", `%${searchTerm}%`)
      .order("date_updated", { ascending: false });

    if (fromISO) activityQuery = activityQuery.gte("date_created", fromISO);
    if (toISO) activityQuery = activityQuery.lt("date_created", toISO);

    const { data: activities, error: activityError } = await activityQuery;

    if (activityError) throw activityError;

    // Get activity reference numbers for history fetch
    const activityRefNumbers = activities
      ?.map((a) => a.activity_reference_number)
      .filter(Boolean) || [];

    // Fetch history for matching activities
    let history: any[] = [];
    if (activityRefNumbers.length > 0) {
      const { data: historyData, error: historyError } = await supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", activityRefNumbers);

      if (historyError) throw historyError;
      history = historyData || [];
    }

    // Also search by quotation_number and so_number in history
    // This finds activities where the search term matches quotation or SO numbers
    const { data: historySearchData, error: historySearchError } = await supabase
      .from("history")
      .select("activity_reference_number, quotation_number, so_number")
      .or(`quotation_number.ilike.%${searchTerm}%,so_number.ilike.%${searchTerm}%`);

    if (historySearchError) throw historySearchError;

    // Get unique activity reference numbers from history search
    const historyMatchedRefs = [
      ...new Set(
        historySearchData?.map((h) => h.activity_reference_number).filter(Boolean) || []
      )
    ];

    // Fetch activities that match via history (quotation/SO numbers)
    let historyMatchedActivities: any[] = [];
    if (historyMatchedRefs.length > 0) {
      const { data: matchedActivities, error: matchedError } = await supabase
        .from("activity")
        .select("*")
        .eq("referenceid", referenceid)
        .in("activity_reference_number", historyMatchedRefs)
        .order("date_updated", { ascending: false });

      if (matchedError) throw matchedError;
      historyMatchedActivities = matchedActivities || [];
    }

    // Merge activities from both searches, removing duplicates
    const allActivities = [
      ...(activities || []),
      ...historyMatchedActivities
    ].filter((activity, index, self) =>
      index === self.findIndex((a) => a.id === activity.id)
    );

    // Fetch history for history-matched activities
    if (historyMatchedRefs.length > 0) {
      const { data: additionalHistory, error: additionalHistoryError } = await supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", historyMatchedRefs);

      if (additionalHistoryError) throw additionalHistoryError;
      history = [...history, ...(additionalHistory || [])];
    }

    // Deduplicate history
    const uniqueHistory = history.filter((item, index, self) =>
      index === self.findIndex((h) => h.id === item.id)
    );

    res.status(200).json({
      activities: allActivities,
      history: uniqueHistory,
      total_activities: allActivities.length,
      total_history: uniqueHistory.length,
    });
  } catch (err: any) {
    console.error("[search] Server error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
}
