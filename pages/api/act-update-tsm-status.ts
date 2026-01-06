import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      activity_reference_number,
      tsmapprovedstatus,
      tsmapprovedremarks,
      tsmapproveddate,
    } = req.body;

    if (!activity_reference_number) {
      return res.status(400).json({ error: "Missing activity_reference_number" });
    }

    const updateData = {
      tsm_approved_status: tsmapprovedstatus || "Approved",
      tsm_approved_remarks: tsmapprovedremarks || null,
      tsm_approved_date: tsmapproveddate
        ? new Date(tsmapproveddate).toISOString()
        : null,
      date_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("history")
      .update(updateData)
      .eq("activity_reference_number", activity_reference_number)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No matching activity found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
