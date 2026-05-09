import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const MAX_TOTAL = 50;
const IN_CHUNK_SIZE = 500;

// Only these statuses qualify as "overdue" — filter server-side so pagination
// counts are accurate and ghost items don't appear after Load More.
const ALLOWED_STATUSES = ["Assisted", "Quote-Done"];

// ─── History fetcher ──────────────────────────────────────────────────────────
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

  // ─── Today's date (server-side, PH timezone) ──────────────────────────────
  // scheduled_date < today means overdue.
  const todayStr = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // "YYYY-MM-DD"

  // ─── Optional date filter on scheduled_date ───────────────────────────────
  let scheduledFrom: string | undefined;
  let scheduledTo: string | undefined;

  if (typeof from === "string" && from) {
    scheduledFrom = from.length > 10 ? from.slice(0, 10) : from;
  }
  if (typeof to === "string" && to) {
    // Cap the upper bound at yesterday — never include today or future dates.
    const toNormalized = to.length > 10 ? to.slice(0, 10) : to;
    scheduledTo = toNormalized < todayStr ? toNormalized : undefined;
  }

  try {
    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      // FIX 1: Only fetch allowed statuses server-side so pagination is accurate.
      // Previously, all statuses were fetched and filtered client-side, which made
      // has_more=true even when no visible items remained → ghost items after Load More.
      .in("status", ALLOWED_STATUSES)
      // FIX 2: Only fetch past scheduled dates (overdue) server-side.
      // The frontend previously filtered `scheduled_date >= today` client-side,
      // same problem — items fetched but invisible, inflating has_more.
      .lt("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Optional date range (already capped to past dates above)
    if (scheduledFrom) query = query.gte("scheduled_date", scheduledFrom);
    if (scheduledTo)   query = query.lte("scheduled_date", scheduledTo);

    const { data: activities, error: actError } = await query;
    if (actError) throw actError;

    const activityList = activities ?? [];

    const activityRefs = activityList
      .map((a: any) => a.activity_reference_number)
      .filter(Boolean);

    const history = await fetchHistoryForActivities(activityRefs);

    const nextOffset = offset + activityList.length;

    // has_more: fetched a full page AND haven't hit the 50-record cap yet.
    const has_more = activityList.length === limit && nextOffset < MAX_TOTAL;

    return res.status(200).json({
      activities: activityList,
      history,
      has_more,
      next_offset: nextOffset,
    });
  } catch (err: any) {
    console.error("[fetch-overdue] Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}