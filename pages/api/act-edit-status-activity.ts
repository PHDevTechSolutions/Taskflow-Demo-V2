import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { activity_reference_number, status, scheduled_date } = req.body;

  if (!activity_reference_number) {
    return res.status(400).json({ error: "Missing activity_reference_number" });
  }

  if (!status) {
    return res.status(400).json({ error: "Missing status" });
  }

  try {
    // Build update data object dynamically
    const updateData: any = {
      status,
      date_updated: new Date().toISOString(),
    };

    if (scheduled_date) {
      updateData.scheduled_date = scheduled_date;
    }

    const { data, error } = await supabase
      .from("activity")
      .update(updateData)
      .eq("activity_reference_number", activity_reference_number)
      .select();

    if (error) {
      console.error("Supabase Update Error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
}
