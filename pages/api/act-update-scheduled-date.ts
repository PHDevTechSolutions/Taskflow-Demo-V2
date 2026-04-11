import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id, scheduled_date } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    if (!scheduled_date) {
      return res.status(400).json({ error: "Missing scheduled_date" });
    }

    // Convert id to number if it's a string
    const activityId = Number(id);
    if (isNaN(activityId)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Validate the date format
    const dateObj = new Date(scheduled_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid scheduled_date format" });
    }

    // Update the activity's scheduled_date
    const { data, error } = await supabase
      .from("activity")
      .update({ 
        scheduled_date: scheduled_date,
        date_updated: new Date().toISOString(),
      })
      .eq("id", activityId)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Log audit trail for scheduled date update
    await logAuditTrailWithSession(
      req,
      "update",
      "activity",
      activityId.toString(),
      `Scheduled date: ${scheduled_date}`,
      `Updated activity scheduled date to ${scheduled_date}`,
      { scheduled_date }
    );

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
