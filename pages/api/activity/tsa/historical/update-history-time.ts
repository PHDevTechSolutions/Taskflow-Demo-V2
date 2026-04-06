// pages/api/activity/tsa/historical/update-history-time.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { id, start_date, end_date } = req.body;

    // ── Validate id ──────────────────────────────────────────────────────────
    const parsedId = Number(id);
    if (!id || isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: "Missing or invalid id." });
    }

    // ── Validate dates ───────────────────────────────────────────────────────
    if (!start_date || !end_date) {
      return res.status(400).json({ error: "start_date and end_date are required." });
    }

    const start = new Date(start_date);
    const end   = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format." });
    }
    if (end <= start) {
      return res.status(400).json({ error: "end_date must be after start_date." });
    }

    // ── Update history table (timestamptz columns) ───────────────────────────
    const { data, error } = await supabase
      .from("history")
      .update({
        start_date:   start.toISOString(),
        end_date:     end.toISOString(),
        date_updated: new Date().toISOString(),
      })
      .eq("id", parsedId)
      .select("id");

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: `No record found with id ${parsedId}.` });
    }

    // Log audit trail for history time update
    await logAuditTrailWithSession(
      req,
      "update",
      "history schedule",
      parsedId.toString(),
      `Updated schedule`,
      `Updated history schedule dates`,
      { start_date, end_date }
    );

    return res.status(200).json({ success: true, id: parsedId });
  } catch (err: any) {
    console.error("update-history-time error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}