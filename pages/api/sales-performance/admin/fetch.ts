import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, role } = req.query;

  // Validate from and to as strings (optional)
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Build query
    let query = supabase.from("history").select("*");

    // If the user is not a Super Admin, filter by referenceid
    if (role !== "Super Admin") {
      if (!referenceid || typeof referenceid !== "string") {
        res.status(400).json({ message: "Missing or invalid referenceid" });
        return;
      }
      query = query.eq("manager", referenceid);
    }

    // Add date filtering if from and to are valid
    if (fromDate && toDate) {
      query = query.gte("delivery_date", fromDate).lte("delivery_date", toDate);
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
