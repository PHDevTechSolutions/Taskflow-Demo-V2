import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  try {
    // Fetch from the history table - including company info directly in the table
    // Adjust columns as needed based on your actual history table schema
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid);

    if (error) {
      res.status(500).json({ message: error.message });
      return;
    }

    res.status(200).json({ activities: data });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}
