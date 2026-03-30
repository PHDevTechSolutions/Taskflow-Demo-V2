import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Config ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1_000;
const HARD_LIMIT = 500_000;

// ─── Selected columns ──────────────────────────────────────────────────────────
const COLUMNS = `
  id,
  referenceid,
  manager,
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

// ─── Date helpers ──────────────────────────────────────────────────────────────
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

// ─── Single batch fetcher (no manager filter — super admin sees all) ───────────
async function fetchBatch(
  fromDate: string,
  toDate: string,
  typeActivity: string | null,
  offset: number
) {
  let query = supabase
    .from("history")
    .select(COLUMNS, { count: "estimated" })
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

// ─── Endorsed-ticket map fetcher ───────────────────────────────────────────────
async function fetchEndorsedTicketMap(
  ticketRefs: string[]
): Promise<Record<string, { tsm: string | null; agent: string | null }>> {
  const map: Record<string, { tsm: string | null; agent: string | null }> = {};
  if (!ticketRefs.length) return map;

  const unique = Array.from(new Set(ticketRefs.filter(Boolean)));
  const IN_BATCH = 500;

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
      continue;
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

// ─── Endorsed-ticket rows + count per TSM ─────────────────────────────────────
async function fetchEndorsedTicketData(
  fromDate: string,
  toDate: string
): Promise<{
  rows: {
    ticket_reference_number: string;
    company_name: string | null;
    contact_person: string | null;
    contact_number: string | null;
    tsm: string | null;
    date_created: string | null;
  }[];
  countsByTsm: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from("endorsed-ticket")
    .select("ticket_reference_number, company_name, contact_person, contact_number, tsm, date_created")
    .gte("date_created", fromDate)
    .lte("date_created", toDate)
    .order("date_created", { ascending: false });

  if (error) {
    console.error("[endorsed-ticket] fetch data error:", error.message);
    return { rows: [], countsByTsm: {} };
  }

  const rows = data ?? [];

  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    const tsmId = (row.tsm ?? "").toLowerCase();
    if (!tsmId || !row.ticket_reference_number) continue;
    if (!sets.has(tsmId)) sets.set(tsmId, new Set());
    sets.get(tsmId)!.add(row.ticket_reference_number);
  }

  const countsByTsm: Record<string, number> = {};
  sets.forEach((refs, tsmId) => { countsByTsm[tsmId] = refs.size; });

  return { rows, countsByTsm };
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

  // ── Resolve date range ──────────────────────────────────────────────────────
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
    // ── Step 1: Get total count (no manager filter) ─────────────────────────
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
      console.error("[superadmin/fetch] count error:", countError.message);
      return res.status(500).json({ message: countError.message });
    }

    const totalRows = Math.min(totalDbCount ?? 0, HARD_LIMIT);

    console.log(
      `[superadmin/fetch] SUPER ADMIN | ` +
      `type_activity=${activityFilter ?? "all"} | ` +
      `DB count=${totalDbCount} | range=${fromDate} → ${toDate}`
    );

    // ── Step 2: Fetch endorsed-ticket data (parallel) ───────────────────────
    const endorsedTicketDataPromise = fetchEndorsedTicketData(fromDate, toDate);

    if (totalRows === 0) {
      const { rows: endorsedTicketRows, countsByTsm: endorsedTicketCountsByTsm } =
        await endorsedTicketDataPromise;
      return res.status(200).json({
        activities:               [],
        total:                    0,
        count:                    totalDbCount,
        cached:                   false,
        range:                    { from: fromDate, to: toDate },
        endorsedTicketCountsByTsm,
        endorsedTicketRows,
      });
    }

    // ── Step 3: Fetch all batches in parallel ───────────────────────────────
    const offsets: number[] = [];
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      offsets.push(offset);
    }

    const [batchResults, { rows: endorsedTicketRows, countsByTsm: endorsedTicketCountsByTsm }] =
      await Promise.all([
        Promise.all(
          offsets.map((offset) =>
            fetchBatch(fromDate, toDate, activityFilter, offset)
          )
        ),
        endorsedTicketDataPromise,
      ]);

    // ── Step 4: Collect rows ────────────────────────────────────────────────
    const allActivities: any[] = [];

    for (let i = 0; i < batchResults.length; i++) {
      const { data, error } = batchResults[i];

      if (error) {
        if ((error as any).code === "PGRST103") {
          console.warn(
            `[superadmin/fetch] range not satisfiable at offset=${offsets[i]} — skipping`
          );
          continue;
        }
        console.error(
          `[superadmin/fetch] batch error at offset=${offsets[i]}:`,
          error.message,
          error.code
        );
        return res.status(500).json({ message: error.message });
      }

      allActivities.push(...(data ?? []));
    }

    // ── Step 5: Merge endorsed-ticket data ──────────────────────────────────
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
      `[superadmin/fetch] fetched ${allActivities.length} rows ` +
      `in ${offsets.length} parallel batch(es). ` +
      `Merged endorsed-ticket for ${Object.keys(endorsedMap).length} unique refs. ` +
      `TSM ticket counts: ${Object.keys(endorsedTicketCountsByTsm).length} TSMs.`
    );

    return res.status(200).json({
      activities:               merged,
      total:                    merged.length,
      count:                    totalDbCount,
      cached:                   false,
      range:                    { from: fromDate, to: toDate },
      endorsedTicketCountsByTsm,
      endorsedTicketRows,
    });
  } catch (err) {
    console.error("[superadmin/fetch] server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}