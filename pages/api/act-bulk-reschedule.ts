import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { ids, newDate } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Missing or invalid IDs array" });
    }

    if (!newDate) {
      return res.status(400).json({ error: "Missing newDate" });
    }

    // Validate the date format
    const dateObj = new Date(newDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid newDate format" });
    }

    // Convert string IDs to numbers
    const activityIds = ids.map(id => Number(id));
    if (activityIds.some(id => isNaN(id))) {
      return res.status(400).json({ error: "All IDs must be valid numbers" });
    }

    // Update all activities in bulk
    const { data, error } = await supabase
      .from("activity")
      .update({ 
        scheduled_date: newDate,
        date_updated: new Date().toISOString(),
      })
      .in("id", activityIds)
      .select();

    if (error) {
      console.error("Supabase bulk update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No activities found" });
    }

    // Log audit trail for each activity
    for (const activityId of activityIds) {
      await logAuditTrailWithSession(
        req,
        "update",
        "activity",
        activityId.toString(),
        `Scheduled date: ${newDate}`,
        `Bulk rescheduled activity to ${newDate}`,
        { scheduled_date: newDate }
      );
    }

    return res.status(200).json({ 
      success: true, 
      data,
      updatedCount: data.length,
      message: `Successfully rescheduled ${data.length} activities to ${newDate}`
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
