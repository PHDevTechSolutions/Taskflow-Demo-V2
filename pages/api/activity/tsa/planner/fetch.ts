import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000;  // FIX: lowered from 5000 — avoids timeouts on large datasets
const IN_CHUNK_SIZE = 500; // FIX: Supabase .in() is unreliable beyond ~500 values

// ─────────────────────────────────────────────────────────────────────────────
// SORT: Orders by date_updated DESC (latest first) to get most recent activities
// LIMIT: Defaults to 500 max records per request to reduce payload size
// ─────────────────────────────────────────────────────────────────────────────
async function* fetchActivityBatches(
  referenceid: string,
  fromISO?: string,
  toISO?: string,
  maxRecords?: number | null,
) {
  let totalFetched = 0;

  while (true) {
    // Calculate remaining batch size
    const remaining = maxRecords ? maxRecords - totalFetched : null;
    const batchSize = remaining !== null && remaining < BATCH_SIZE
      ? remaining
      : BATCH_SIZE;

    if (remaining !== null && remaining <= 0) break;

    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("date_updated", { ascending: false })
      .limit(batchSize);

    // Apply date filters independently
    if (fromISO) query = query.gte("date_created", fromISO);
    if (toISO)   query = query.lt("date_created", toISO);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    // Stop if we reached maxRecords
    if (maxRecords && totalFetched >= maxRecords) break;

    // Stop if partial batch — no more rows
    if (data.length < batchSize) break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: History was using offset-based pagination — unreliable on large
//   datasets and concurrent writes (rows can shift between pages).
//   New code: cursor-based using `id`, same pattern as activities.
//
// FIX 5: Supabase .in() with thousands of values causes query plan issues
//   or silent truncation. New code: chunks refs into groups of 500 and
//   paginates each chunk with a cursor.
// ─────────────────────────────────────────────────────────────────────────────
async function* fetchHistoryBatches(activityReferenceNumbers: string[]) {
  if (!activityReferenceNumbers.length) return;

  // Deduplicate first to minimize query size
  const uniqueRefs = [...new Set(activityReferenceNumbers)];

  // Split into chunks to avoid Supabase .in() limits
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueRefs.length; i += IN_CHUNK_SIZE) {
    chunks.push(uniqueRefs.slice(i, i + IN_CHUNK_SIZE));
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
  const { referenceid, from, to, limit } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse pagination params - default to 500 max records
  const parsedLimit = limit ? parseInt(String(limit), 10) : 500;

  // Parse date range — filter is on date_created for this endpoint
  const fromISO =
    typeof from === "string" && from
      ? new Date(from).toISOString()
      : undefined;

  let toISO: string | undefined;
  if (typeof to === "string" && to) {
    const toDay = new Date(to);
    toDay.setDate(toDay.getDate() + 1); // include full 'to' day
    toISO = toDay.toISOString();
  }

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`);

    let firstActivity = true;
    const allActivityReferenceNumbers: string[] = [];
    let totalActivities = 0;
    let hasMore = false;

    for await (const batch of fetchActivityBatches(referenceid, fromISO, toISO, parsedLimit)) {
      for (const row of batch) {
        if (row.activity_reference_number) {
          allActivityReferenceNumbers.push(row.activity_reference_number);
        }

        const json = JSON.stringify(row);
        res.write(firstActivity ? json : `,${json}`);
        firstActivity = false;
        totalActivities++;
      }
    }

    // Check if there might be more records (only when limit is applied)
    if (parsedLimit && totalActivities >= parsedLimit) {
      hasMore = true;
    }

    res.write(`],"history":[`);

    let firstHistory = true;
    let totalHistory = 0;

    for await (const batch of fetchHistoryBatches(allActivityReferenceNumbers)) {
      for (const row of batch) {
        const json = JSON.stringify(row);
        res.write(firstHistory ? json : `,${json}`);
        firstHistory = false;
        totalHistory++;
      }
    }

    res.write(
      `],"total_activities":${totalActivities},"total_history":${totalHistory},"has_more":${hasMore}}`,
    );
    res.end();
  } catch (err: any) {
    console.error("[fetch] Server error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
}