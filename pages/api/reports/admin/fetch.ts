import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Config ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1_000;
const HARD_LIMIT = 500_000;

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
  fromDate: string,
  toDate: string,
  typeActivity: string | null,
  offset: number,
  needCount: boolean
) {
  let query = supabase
    .from("history")
    .select(COLUMNS, needCount ? { count: "exact" } : { count: "estimated" })
    .gte("date_created", fromDate)
    .lte("date_created", toDate)
    .order("date_created", { ascending: false })
    .order("id",           { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1);

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

  const { from, to, type_activity } = req.query;

  // ── Resolve date range ────────────────────────────────────────────────────
  let fromDate: string;
  let toDate: string;

  if (typeof from === "string" && typeof to === "string") {
    fromDate = toDateString(from);
    toDate   = toDateString(to);
  } else {
    ({ fromDate, toDate } = currentMonthRange());
  }

  const activityFilter =
    typeof type_activity === "string" && type_activity.trim()
      ? type_activity.trim()
      : null;

  try {
    // ── Step 1: Get total count ───────────────────────────────────────────
    let countQuery = supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .gte("date_created", fromDate)
      .lte("date_created", toDate);

    if (activityFilter) {
      countQuery = countQuery.ilike("type_activity", activityFilter);
    }

    const { count: totalDbCount, error: countError } = await countQuery;

    if (countError) {
      console.error("[admin/fetch] count error:", countError.message);
      return res.status(500).json({ message: countError.message });
    }

    const totalRows = Math.min(totalDbCount ?? 0, HARD_LIMIT);

    console.log(
      `[admin/fetch] type_activity=${activityFilter ?? "all"} | ` +
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

    // ── Step 2: Fire all batch requests in parallel ───────────────────────
    const offsets: number[] = [];
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    const batchResults = await Promise.all(
      offsets.map((offset) =>
        fetchBatch(fromDate, toDate, activityFilter, offset, false)
      )
    );

    // ── Step 3: Collect rows ──────────────────────────────────────────────
    const allActivities: any[] = [];

    for (let i = 0; i < batchResults.length; i++) {
      const { data, error } = batchResults[i];

      if (error) {
        // PGRST103 = "Requested range not satisfiable"
        // Fires when the offset overshoots the actual row count — can happen
        // when the count query and batch queries race against live inserts/deletes.
        // Safe to treat as an empty batch rather than a hard failure.
        if ((error as any).code === "PGRST103") {
          console.warn(
            `[admin/fetch] range not satisfiable at offset=${offsets[i]} — skipping (row count likely changed mid-request)`
          );
          continue;
        }

        console.error(
          `[admin/fetch] batch error at offset=${offsets[i]}:`,
          error.message,
          error.code
        );
        return res.status(500).json({ message: error.message });
      }

      allActivities.push(...(data ?? []));
    }

    if (totalDbCount && totalDbCount > HARD_LIMIT) {
      console.warn(
        `[admin/fetch] WARNING: hit HARD_LIMIT (${HARD_LIMIT}). ` +
        `DB total=${totalDbCount}. Some records may be missing.`
      );
    }

    console.log(
      `[admin/fetch] fetched ${allActivities.length} rows ` +
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