import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

// helper function
const capitalize = (str: string = "") =>
  str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id, tsm_approved_status } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    if (!tsm_approved_status || typeof tsm_approved_status !== "string") {
      return res.status(400).json({ error: "Missing or invalid tsm_approved_status" });
    }

    // Capitalize each word before saving
    const normalizedStatus = capitalize(tsm_approved_status.trim());

    const { data, error } = await supabase
      .from("history")
      .update({
        tsm_approved_status: normalizedStatus,
        date_updated: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Log audit trail for status update
    await logAuditTrailWithSession(
      req,
      "update",
      "activity status",
      id.toString(),
      `Status: ${normalizedStatus}`,
      `Updated activity status to ${normalizedStatus}`,
      { status: normalizedStatus }
    );

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}