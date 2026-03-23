import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Config ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1_000;   // keep ≤ Supabase dashboard "Max Rows" setting
const HARD_LIMIT = 500_000; // safety ceiling — raise if needed

// ─── Selected columns ──────────────────────────────────────────────────────────
const COLUMNS = `
  id,
  referenceid,
  account_reference_number,
  company_name,
  type_activity,
  remarks,
  status,
  date_created,
  date_updated,
  contact_number,
  contact_person,
  type_client,
  source,
  call_status,
  call_type,
  quotation_amount,
  quotation_number,
  quotation_status,
  so_number,
  so_amount,
  actual_sales,
  dr_number,
  delivery_date,
  payment_terms,
  ticket_reference_number,
  start_date,
  end_date,
  si_date
`.trim();

// ─── Date helper ───────────────────────────────────────────────────────────────
// date_created is a DATE column — always compare with plain "YYYY-MM-DD" strings.
// Passing ISO timestamps causes silent mismatches or cast errors in PostgREST.
function toDateString(value: string): string {
  return value.split("T")[0];
}

function currentMonthRange(): { fromDate: string; toDate: string } {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    fromDate: `${year}-${month}-01`,
    toDate:   `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

// ─── Single batch fetcher ──────────────────────────────────────────────────────
async function fetchBatch(
  referenceid: string,
  fromDate: string,
  toDate: string,
  typeActivity: string | null,
  offset: number,
  needCount: boolean
) {
  let query = supabase
    .from("history")
    .select(COLUMNS, needCount ? { count: "exact" } : { count: "estimated" })
    .eq("manager", referenceid)
    .gte("date_created", fromDate)
    .lte("date_created", toDate)
    .order("date_created", { ascending: false })
    .order("id",           { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1);

  // ── KEY FIX: filter type_activity at the DB level ─────────────────────────
  // Previously, the API fetched ALL activity types and let the frontend filter.
  // This meant fetching 10–50x more rows than needed, causing sequential batch
  // loops to time out on wide date ranges (e.g. March 1–23).
  // Filtering here cuts the result set down to only relevant rows.
  if (typeActivity) {
    query = query.ilike("type_activity", typeActivity);
  }

  return query;
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { referenceid, from, to, type_activity } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // ── Resolve date range ────────────────────────────────────────────────────
  let fromDate: string;
  let toDate: string;

  if (typeof from === "string" && typeof to === "string") {
    fromDate = toDateString(from);
    toDate   = toDateString(to);
  } else {
    ({ fromDate, toDate } = currentMonthRange());
  }

  // Optional type_activity filter passed from the frontend
  const activityFilter =
    typeof type_activity === "string" && type_activity.trim()
      ? type_activity.trim()
      : null;

  // ── Step 1: Get total count first (single lightweight query) ──────────────
  //
  // WHY: Instead of sequential while-loop batches (slow, timeout-prone),
  // we first get the exact count, then fire ALL batch requests in parallel
  // using Promise.all. This turns N sequential round-trips into 1 + ceil(N/1000)
  // parallel round-trips — massively faster for wide date ranges.
  //
  try {
    let countQuery = supabase
      .from("history")
      .select("id", { count: "exact", head: true }) // head:true = no rows, just count
      .eq("manager", referenceid)
      .gte("date_created", fromDate)
      .lte("date_created", toDate);

    if (activityFilter) {
      countQuery = countQuery.ilike("type_activity", activityFilter);
    }

    const { count: totalDbCount, error: countError } = await countQuery;

    if (countError) {
      console.error("[manager/fetch] count error:", countError.message);
      return res.status(500).json({ message: countError.message });
    }

    const totalRows = Math.min(totalDbCount ?? 0, HARD_LIMIT);

    console.log(
      `[manager/fetch] referenceid=${referenceid} | ` +
      `type_activity=${activityFilter ?? "all"} | ` +
      `DB count=${totalDbCount} | range=${fromDate} → ${toDate}`
    );

    if (totalRows === 0) {
      return res.status(200).json({
        activities: [],
        total:      0,
        count:      totalDbCount,
        cached:     false,
        range:      { from: fromDate, to: toDate },
      });
    }

    // ── Step 2: Fire all batch requests in PARALLEL ───────────────────────
    //
    // Sequential await in a while-loop = each batch waits for the previous.
    // For 50 batches × 200ms = 10s timeout hit.
    //
    // Parallel Promise.all = all batches fire at once = ~200–500ms total
    // regardless of how many batches there are.
    //
    const offsets: number[] = [];
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    const batchResults = await Promise.all(
      offsets.map((offset) =>
        fetchBatch(referenceid, fromDate, toDate, activityFilter, offset, false)
      )
    );

    // ── Step 3: Collect + check errors ────────────────────────────────────
    const allActivities: any[] = [];

    for (let i = 0; i < batchResults.length; i++) {
      const { data, error } = batchResults[i];
      if (error) {
        console.error(
          `[manager/fetch] batch error at offset=${offsets[i]}:`,
          error.message,
          error.code
        );
        return res.status(500).json({ message: error.message });
      }
      allActivities.push(...(data ?? []));
    }

    if (totalDbCount && totalDbCount > HARD_LIMIT) {
      console.warn(
        `[manager/fetch] WARNING: hit HARD_LIMIT (${HARD_LIMIT}). ` +
        `DB total=${totalDbCount}. Some records may be missing.`
      );
    }

    console.log(
      `[manager/fetch] fetched ${allActivities.length} rows ` +
      `in ${offsets.length} parallel batch(es).`
    );

    return res.status(200).json({
      activities: allActivities,
      total:      allActivities.length,
      count:      totalDbCount,
      cached:     false,
      range:      { from: fromDate, to: toDate },
    });
  } catch (err) {
    console.error("[manager/fetch] server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}