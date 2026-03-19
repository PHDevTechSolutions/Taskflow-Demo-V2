import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000; // FIX: lowered from 5000 — large batches cause timeouts on 15k rows

// ─────────────────────────────────────────────────────────────────────────────
// BUG FIX 1: Activity batch generator now filters by `scheduled_date` (not
// `date_created`). The Scheduled component filters on scheduled_date client-
// side, so the API must expose ALL activities for the agent regardless of date.
// Date-range params (from/to) remain optional and filter on scheduled_date when
// provided.
//
// BUG FIX 2: Cursor-based pagination uses `id` correctly. Previously the date
// filter was applied alongside the cursor which caused rows to be skipped when
// `date_created` didn't match even though `scheduled_date` was in range.
//
// BUG FIX 3: History now uses cursor-based pagination (lastId) instead of
// offset-based, which was unreliable on large datasets with concurrent writes.
// ─────────────────────────────────────────────────────────────────────────────

async function* fetchActivityBatches(
  referenceid: string,
  scheduledFrom?: string, // YYYY-MM-DD or ISO — filter on scheduled_date
  scheduledTo?: string,   // YYYY-MM-DD or ISO — filter on scheduled_date (inclusive end)
) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    // Cursor: only fetch rows after the last seen id
    if (lastId !== null) query = query.gt("id", lastId);

    // FIX: filter on scheduled_date — NOT date_created
    if (scheduledFrom) query = query.gte("scheduled_date", scheduledFrom);
    if (scheduledTo)   query = query.lte("scheduled_date", scheduledTo);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;

    // FIX: only advance cursor if we got a full batch — if partial, we're done
    if (data.length < BATCH_SIZE) break;
    lastId = data[data.length - 1].id;
  }
}

// FIX: cursor-based pagination for history (was offset-based → unreliable)
async function* fetchHistoryBatches(activityReferenceNumbers: string[]) {
  if (!activityReferenceNumbers.length) return;

  // Supabase `.in()` has a practical limit — chunk into groups of 500
  const CHUNK_SIZE = 500;
  const chunks: string[][] = [];
  for (let i = 0; i < activityReferenceNumbers.length; i += CHUNK_SIZE) {
    chunks.push(activityReferenceNumbers.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    let lastHistoryId: number | null = null;

    while (true) {
      let query = supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", chunk)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastHistoryId !== null) query = query.gt("id", lastHistoryId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      yield data;

      if (data.length < BATCH_SIZE) break;
      lastHistoryId = data[data.length - 1].id;
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // FIX: parse scheduled_date range — NOT date_created
  // from/to should be YYYY-MM-DD strings (as sent by the Scheduled component)
  let scheduledFrom: string | undefined;
  let scheduledTo: string | undefined;

  if (typeof from === "string" && from) {
    // Normalize to date-only string for scheduled_date comparison
    scheduledFrom = from.length > 10 ? from.slice(0, 10) : from;
  }

  if (typeof to === "string" && to) {
    scheduledTo = to.length > 10 ? to.slice(0, 10) : to;
  }

  try {
    res.setHeader("Content-Type", "application/json");

    // Stream JSON manually — avoids loading all 15k rows into memory at once
    res.write(`{"activities":[`);

    let firstActivity = true;
    const allActivityReferenceNumbers: string[] = [];
    let totalActivities = 0;

    for await (const batch of fetchActivityBatches(
      referenceid,
      scheduledFrom,
      scheduledTo,
    )) {
      for (const row of batch) {
        // Collect activity_reference_number for history lookup
        if (row.activity_reference_number) {
          allActivityReferenceNumbers.push(row.activity_reference_number);
        }

        const json = JSON.stringify(row);
        res.write(firstActivity ? json : `,${json}`);
        firstActivity = false;
        totalActivities++;
      }
    }

    res.write(`],"history":[`);

    let firstHistory = true;
    let totalHistory = 0;

    // Deduplicate refs before querying history
    const uniqueRefs = [...new Set(allActivityReferenceNumbers)];

    for await (const batch of fetchHistoryBatches(uniqueRefs)) {
      for (const row of batch) {
        const json = JSON.stringify(row);
        res.write(firstHistory ? json : `,${json}`);
        firstHistory = false;
        totalHistory++;
      }
    }

    res.write(
      `],"total_activities":${totalActivities},"total_history":${totalHistory}}`,
    );
    res.end();
  } catch (err: any) {
    console.error("[planner/fetch] Server error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
}