import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id, cancellation_remarks } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    if (typeof cancellation_remarks !== "string" || cancellation_remarks.trim() === "") {
      return res.status(400).json({ error: "Cancellation remarks are required" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Update status, cancellation_remarks, and date_updated to current time
    const { data, error } = await supabase
      .from("activity")
      .update({
        status: "Cancelled",
        cancellation_remarks: cancellation_remarks.trim(),
        date_updated: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
