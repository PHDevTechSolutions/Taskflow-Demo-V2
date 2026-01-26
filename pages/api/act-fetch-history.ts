import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  try {
    // Direct fetch from Supabase without cache
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
