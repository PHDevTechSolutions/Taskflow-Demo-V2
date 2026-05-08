import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000;
const IN_CHUNK_SIZE = 500;

// ─── Activity batch fetcher ───────────────────────────────────────────────────
async function* fetchActivityBatches(
  referenceid: string,
  fromISO?: string,
  toISO?: string,
  search?: string,
  maxRecords?: number | null,
) {
  let totalFetched = 0;

  while (true) {
    const remaining = maxRecords ? maxRecords - totalFetched : null;
    const batchSize =
      remaining !== null && remaining < BATCH_SIZE ? remaining : BATCH_SIZE;

    if (remaining !== null && remaining <= 0) break;

    let query = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("date_updated", { ascending: false })
      .limit(batchSize);

    if (fromISO) query = query.gte("date_created", fromISO);
    if (toISO)   query = query.lt("date_created", toISO);

    // Full-text search across key fields using ilike
    if (search) {
      query = query.or(
        [
          `company_name.ilike.%${search}%`,
          `contact_person.ilike.%${search}%`,
          `contact_number.ilike.%${search}%`,
          `email_address.ilike.%${search}%`,
          `address.ilike.%${search}%`,
          `activity_reference_number.ilike.%${search}%`,
          `ticket_reference_number.ilike.%${search}%`,
          `status.ilike.%${search}%`,
          `type_client.ilike.%${search}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    if (maxRecords && totalFetched >= maxRecords) break;
    if (data.length < batchSize) break;
  }
}

// ─── History batch fetcher ────────────────────────────────────────────────────
async function* fetchHistoryBatches(activityReferenceNumbers: string[]) {
  if (!activityReferenceNumbers.length) return;

  const uniqueRefs = [...new Set(activityReferenceNumbers)];

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
  const { referenceid, from, to, limit, search } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const searchStr = typeof search === "string" && search.trim() ? search.trim() : undefined;
  const hasFrom   = typeof from === "string" && from.trim().length > 0;
  const hasTo     = typeof to === "string" && to.trim().length > 0;

  // ── Guard: require at least one filter ────────────────────────────────────
  // Prevents loading all records on mount with no filter applied.
  if (!searchStr && !hasFrom) {
    return res.status(200).json({
      activities: [],
      history: [],
      total_activities: 0,
      total_history: 0,
      has_more: false,
    });
  }

  const parsedLimit = limit ? parseInt(String(limit), 10) : 500;

  const fromISO = hasFrom ? new Date(from as string).toISOString() : undefined;

  let toISO: string | undefined;
  if (hasTo) {
    const toDay = new Date(to as string);
    toDay.setDate(toDay.getDate() + 1); // include the full "to" day
    toISO = toDay.toISOString();
  }

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`);

    let firstActivity = true;
    const allActivityReferenceNumbers: string[] = [];
    let totalActivities = 0;
    let hasMore = false;

    for await (const batch of fetchActivityBatches(
      referenceid, fromISO, toISO, searchStr, parsedLimit,
    )) {
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