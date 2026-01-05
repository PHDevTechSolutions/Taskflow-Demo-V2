import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      id,
      tsmapprovedstatus,
      tsmapprovedremarks,
      tsmapproveddate,
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    // Validate id as number or string that can be parsed to number
    const idNum = typeof id === "number" ? id : Number(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Prepare update object, only include fields if they are provided
    const updateData: any = {
      tsm_approved_status: tsmapprovedstatus || "Approved",
      tsm_approved_remarks: tsmapprovedremarks || null,
      tsm_approved_date: tsmapproveddate || null,
      date_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("history")
      .update(updateData)
      .eq("id", idNum)
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
