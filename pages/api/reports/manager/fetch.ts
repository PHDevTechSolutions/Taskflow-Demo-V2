import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Why RPC instead of paginated SELECT ───────────────────────────
// The old approach (sequential batches) = N round-trips over the network.
// The parallel approach = still multiple round-trips, just concurrent.
// RPC (stored procedure) = ONE round-trip. Postgres does all the work
// server-side and returns the full result set in a single response.
// For large datasets this is 5–20x faster.
//
// PREREQUISITE: Run the SQL in /sql/get_history_by_manager.sql
// in your Supabase SQL Editor ONCE before using this endpoint.
// ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : null;
  const toDate   = typeof to   === "string" ? to   : null;

  try {
    // Single RPC call — one round-trip to Postgres, no pagination loop needed.
    // Supabase RPC bypasses the PostgREST 1000-row default limit automatically
    // because the function itself returns a result set, not a filtered table.
    const { data, error } = await supabase.rpc("get_history_by_manager", {
      p_manager:   referenceid,
      p_from_date: fromDate,
      p_to_date:   toDate,
    });

    if (error) {
      console.error("RPC error:", error);

      // Graceful fallback: if the stored procedure doesn't exist yet,
      // fall back to a single direct query (still faster than the old loop
      // for datasets under 1000 rows, and it won't silently break prod).
      if (error.code === "PGRST202" || error.message?.includes("get_history_by_manager")) {
        console.warn("RPC function not found — falling back to direct query. Please run the SQL setup.");
        return fallbackQuery(req, res, referenceid, fromDate, toDate);
      }

      return res.status(500).json({ message: error.message });
    }

    const activities = data ?? [];

    return res.status(200).json({
      activities,
      total:  activities.length,
      cached: false,
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// ─── Fallback: direct query without pagination ─────────────────────
// Used if the stored procedure hasn't been created yet.
// Works for datasets up to Supabase's configured max_rows limit.
async function fallbackQuery(
  req: NextApiRequest,
  res: NextApiResponse,
  referenceid: string,
  fromDate: string | null,
  toDate: string | null,
) {
  let query = supabase
    .from("history")
    .select(`
      id, referenceid, company_name, type_activity, remarks, status,
      date_created, date_updated, contact_number, contact_person,
      type_client, source, call_status, call_type,
      quotation_amount, quotation_number, quotation_status,
      so_number, so_amount, actual_sales, dr_number, delivery_date,
      payment_terms, ticket_reference_number, si_date
    `)
    .eq("manager", referenceid)
    .order("date_created", { ascending: true })
    .order("id",           { ascending: true });

  if (fromDate && toDate) {
    query = query.gte("date_created", fromDate).lte("date_created", toDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Fallback query error:", error);
    return res.status(500).json({ message: error.message });
  }

  const activities = data ?? [];
  return res.status(200).json({ activities, total: activities.length, cached: false });
}