import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;   // Records per page / per Load More click
const MAX_TOTAL = 50;   // Hard cap — never fetch beyond 50 records total
const IN_CHUNK_SIZE = 500;

// ─── History fetcher (no streaming needed — small payload per page) ───────────
async function fetchHistoryForActivities(activityRefs: string[]) {
  if (!activityRefs.length) return [];

  const uniqueRefs = [...new Set(activityRefs)];
  const allHistory: any[] = [];

  for (let i = 0; i < uniqueRefs.length; i += IN_CHUNK_SIZE) {
    const chunk = uniqueRefs.slice(i, i + IN_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .in("activity_reference_number", chunk);

    if (error) throw error;
    if (data) allHistory.push(...data);
  }

  return allHistory;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { referenceid, from, to, offset: offsetParam } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const offset = parseInt(offsetParam as string) || 0;

  // Guard: never go beyond the 50-record cap
  if (offset >= MAX_TOTAL) {
    return res.status(200).json({
      activities: [],
      history: [],
      has_more: false,
      next_offset: offset,
    });
  }

  // Clamp so we never overshoot MAX_TOTAL
  const limit = Math.min(PAGE_SIZE, MAX_TOTAL - offset);

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
    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("date_updated", { ascending: false })
      .range(offset, offset + limit - 1); // offset-based page

    if (fromISO) query = query.gte("date_created", fromISO);
    if (toISO)   query = query.lt("date_created", toISO);

    const { data: activities, error: actError } = await query;
    if (actError) throw actError;

    const activityList = activities ?? [];
    const activityRefs = activityList
      .map((a: any) => a.activity_reference_number)
      .filter(Boolean);

    const history = await fetchHistoryForActivities(activityRefs);

    const nextOffset = offset + activityList.length;

    // has_more = fetched a full page AND haven't hit the 50-record cap yet
    const has_more = activityList.length === limit && nextOffset < MAX_TOTAL;

    return res.status(200).json({
      activities: activityList,
      history,
      has_more,
      next_offset: nextOffset,
    });
  } catch (err: any) {
    console.error("[fetch] Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}