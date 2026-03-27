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

  if (typeActivity) {
    query = query.ilike("type_activity", typeActivity);
  }

  return query;
}

// ─── Endorsed-ticket fetcher ───────────────────────────────────────────────────
// Fetches ALL endorsed-ticket rows for the given ticket_reference_numbers in
// batches of 500 (PostgREST .in() limit) and returns a lookup map:
//   ticket_reference_number → { tsm, agent }
async function fetchEndorsedTicketMap(
  ticketRefs: string[]
): Promise<Record<string, { tsm: string | null; agent: string | null }>> {
  const map: Record<string, { tsm: string | null; agent: string | null }> = {};
  if (!ticketRefs.length) return map;

  // Deduplicate
  const unique = Array.from(new Set(ticketRefs.filter(Boolean)));
  const IN_BATCH = 500;

  // Fire all .in() queries in parallel
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_BATCH) {
    chunks.push(unique.slice(i, i + IN_BATCH));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("endorsed-ticket")
        .select("ticket_reference_number, tsm, agent")
        .in("ticket_reference_number", chunk)
    )
  );

  for (const { data, error } of results) {
    if (error) {
      console.error("[endorsed-ticket] fetch error:", error.message);
      continue; // non-fatal — merge will just leave those fields null
    }
    for (const row of data ?? []) {
      if (row.ticket_reference_number) {
        map[row.ticket_reference_number] = {
          tsm:   row.tsm   ?? null,
          agent: row.agent ?? null,
        };
      }
    }
  }

  return map;
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

  const activityFilter =
    typeof type_activity === "string" && type_activity.trim()
      ? type_activity.trim()
      : null;

  try {
    // ── Step 1: Get total count ───────────────────────────────────────────
    let countQuery = supabase
      .from("history")
      .select("id", { count: "exact", head: true })
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

    // ── Step 2: Fetch all history batches in parallel ─────────────────────
    const offsets: number[] = [];
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    const batchResults = await Promise.all(
      offsets.map((offset) =>
        fetchBatch(referenceid, fromDate, toDate, activityFilter, offset, false)
      )
    );

    // ── Step 3: Collect history rows ──────────────────────────────────────
    // ── Step 3: Collect history rows ──────────────────────────────────────
const allActivities: any[] = [];

for (let i = 0; i < batchResults.length; i++) {
  const { data, error } = batchResults[i];

  if (error) {
    // PGRST103 = "Requested range not satisfiable"
    // Fires when offset overshoots actual row count (race between
    // count query and batch queries). Safe to treat as empty batch.
    if ((error as any).code === "PGRST103") {
      console.warn(
        `[manager/fetch] range not satisfiable at offset=${offsets[i]} — skipping (row count likely changed mid-request)`
      );
      continue; // ← skip this batch, don't abort
    }

    console.error(
      `[manager/fetch] batch error at offset=${offsets[i]}:`,
      error.message,
      error.code
    );
    return res.status(500).json({ message: error.message });
  }

  allActivities.push(...(data ?? []));
}

    // ── Step 4: Merge endorsed-ticket data ────────────────────────────────
    // Collect all non-null ticket_reference_numbers from the fetched rows,
    // then fetch their tsm + agent from endorsed-ticket in parallel batches.
    // Merge back by ticket_reference_number — history rows without a matching
    // ticket will get endorsed_tsm: null and endorsed_agent: null.
    const ticketRefs = allActivities
      .map((a) => a.ticket_reference_number)
      .filter(Boolean) as string[];

    const endorsedMap = await fetchEndorsedTicketMap(ticketRefs);

    const merged = allActivities.map((activity) => {
      const ref = activity.ticket_reference_number;
      const endorsed = ref ? endorsedMap[ref] : null;
      return {
        ...activity,
        endorsed_tsm:   endorsed?.tsm   ?? null,
        endorsed_agent: endorsed?.agent ?? null,
      };
    });

    console.log(
      `[manager/fetch] fetched ${allActivities.length} rows ` +
      `in ${offsets.length} parallel batch(es). ` +
      `Merged endorsed-ticket for ${Object.keys(endorsedMap).length} unique refs.`
    );

    return res.status(200).json({
      activities: merged,
      total:      merged.length,
      count:      totalDbCount,
      cached:     false,
      range:      { from: fromDate, to: toDate },
    });
  } catch (err) {
    console.error("[manager/fetch] server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}