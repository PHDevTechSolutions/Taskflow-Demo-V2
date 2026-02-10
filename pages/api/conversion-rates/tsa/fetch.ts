import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  // Validate date params
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Build Supabase query
    let query = supabase
      .from("history")
      .select(`
        id,
        source,
        status,
        date_created,
        dr_number,
        si_date,
        actual_sales
      `)
      .eq("referenceid", referenceid);

    // Apply date_created filter if both from & to are provided
    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
