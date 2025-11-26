import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Update scheduled_status AND date_updated to current time
    const { data, error } = await supabase
      .from("history")
      .update({ 
        scheduled_status: "Done",
        date_updated: new Date().toISOString(),  // <-- add this line
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
