import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id, newScheduledDate } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    if (!newScheduledDate) {
      return res.status(400).json({ error: "Missing newScheduledDate" });
    }

    // Convert id to number if it's a string
    const activityId = Number(id);
    if (isNaN(activityId)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Validate the date format
    const dateObj = new Date(newScheduledDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid newScheduledDate format" });
    }

    // Check if the date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    
    if (dateObj < today) {
      return res.status(400).json({ error: "Cannot reschedule to a past date" });
    }

    // First, get the current activity data for audit trail
    const { data: currentActivity, error: fetchError } = await supabase
      .from("activity")
      .select("scheduled_date, activity_reference_number")
      .eq("id", activityId)
      .single();

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!currentActivity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Update the activity's scheduled_date
    const { data, error } = await supabase
      .from("activity")
      .update({ 
        scheduled_date: newScheduledDate,
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

    // Log audit trail for reschedule
    await logAuditTrailWithSession(
      req,
      "update",
      "activity",
      activityId.toString(),
      `Rescheduled from ${currentActivity.scheduled_date} to ${newScheduledDate}`,
      `Activity ${currentActivity.activity_reference_number} rescheduled from ${currentActivity.scheduled_date} to ${newScheduledDate}`,
      { 
        old_scheduled_date: currentActivity.scheduled_date,
        new_scheduled_date: newScheduledDate,
        activity_reference_number: currentActivity.activity_reference_number
      }
    );

    return res.status(200).json({ 
      success: true, 
      data,
      message: "Activity rescheduled successfully" 
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
