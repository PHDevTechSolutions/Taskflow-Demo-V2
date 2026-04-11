import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Missing or invalid IDs array" });
    }

    // Convert string IDs to numbers
    const activityIds = ids.map(id => Number(id));
    if (activityIds.some(id => isNaN(id))) {
      return res.status(400).json({ error: "All IDs must be valid numbers" });
    }

    // Update all activities to "Done" status in bulk
    const { data, error } = await supabase
      .from("activity")
      .update({ 
        status: "Done",
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
        `Status: Done`,
        `Bulk marked activity as Done`,
        { status: "Done" }
      );
    }

    return res.status(200).json({ 
      success: true, 
      data,
      updatedCount: data.length,
      message: `Successfully marked ${data.length} activities as Done`
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
