import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5_000;
const HARD_LIMIT = 500_000;

// ─── Fetch all history rows via cursor pagination ──────────────────────────────
async function fetchAllHistory(
  tsm: string,
  fromDate?: string,
  toDate?: string
): Promise<any[]> {
  const all: any[] = [];
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);
    if (fromDate)        query = query.gte("date_created", fromDate);
    if (toDate)          query = query.lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw new Error(`History fetch error: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    lastId = data[data.length - 1].id;

    // Safety ceiling
    if (all.length >= HARD_LIMIT) {
      console.warn(`[fetch-activity-tsm] hit HARD_LIMIT (${HARD_LIMIT})`);
      break;
    }
  }

  return all;
}

// ─── Fetch signatories for a set of quotation numbers ─────────────────────────
async function fetchSignatories(
  tsm: string,
  quotationNumbers: string[]
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!quotationNumbers.length) return map;

  const IN_BATCH = 500; // PostgREST .in() safe limit
  const chunks: string[][] = [];
  for (let i = 0; i < quotationNumbers.length; i += IN_BATCH) {
    chunks.push(quotationNumbers.slice(i, i + IN_BATCH));
  }

  // Fire all chunks in parallel
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("signatories")
        .select("*")
        .eq("tsm", tsm)
        .in("quotation_number", chunk)
    )
  );

  for (const { data, error } of results) {
    if (error) {
      console.error(`[fetch-activity-tsm] signatories error: ${error.message}`);
      continue; // non-fatal — activity rows will just have null signature fields
    }
    for (const row of data ?? []) {
      if (row.quotation_number) map.set(row.quotation_number, row);
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

  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from.split("T")[0] : undefined;
  const toDate   = typeof to   === "string" ? to.split("T")[0]   : undefined;

  try {
    // ── 1. Fetch all history rows ──────────────────────────────────────────
    const activities = await fetchAllHistory(referenceid, fromDate, toDate);

    // ── 2. Collect valid quotation numbers (skip null/undefined/empty) ─────
    const quotationNumbers = Array.from(
      new Set(
        activities
          .map((a) => a.quotation_number)
          .filter((n): n is string => typeof n === "string" && n.trim() !== "")
      )
    );

    // ── 3. Fetch signatories in parallel batches ───────────────────────────
    const signaturesMap = await fetchSignatories(referenceid, quotationNumbers);

    // ── 4. Merge signatures into each activity row ─────────────────────────
    const merged = activities.map((h) => {
      const sig = h.quotation_number ? signaturesMap.get(h.quotation_number) : null;
      return {
        ...h,
        agent_name:        sig?.agent_name        ?? null,
        agent_signature:        sig?.agent_signature        ?? null,
        agent_contact_number:   sig?.agent_contact_number   ?? null,
        agent_email_address:    sig?.agent_email_address    ?? null,
        tsm_name:          sig?.tsm_name          ?? null,
        tsm_signature:          sig?.tsm_signature          ?? null,
        tsm_contact_number:     sig?.tsm_contact_number     ?? null,
        tsm_email_address:      sig?.tsm_email_address      ?? null,
        manager_name:           sig?.manager_name           ?? null,
        manager_signature:      sig?.manager_signature      ?? null,
        manager_contact_number: sig?.manager_contact_number ?? null,
        manager_email_address:  sig?.manager_email_address  ?? null,
        tsm_approval_date:      sig?.tsm_approval_date      ?? null,
        tsm_remarks:            sig?.tsm_remarks            ?? null,
        manager_remarks:        sig?.manager_remarks        ?? null,
        manager_approval_date:  sig?.manager_approval_date  ?? null,
      };
    });

    console.log(
      `[fetch-activity-tsm] tsm=${referenceid} | ` +
      `rows=${merged.length} | quotations=${quotationNumbers.length} | ` +
      `range=${fromDate ?? "all"} → ${toDate ?? "all"}`
    );

    return res.status(200).json({
      activities: merged,
      total:      merged.length,
      cached:     false,
    });

  } catch (err: any) {
    console.error("[fetch-activity-tsm] server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}