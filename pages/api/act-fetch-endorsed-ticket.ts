import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, offset, limit } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse pagination parameters
  const parsedOffset = offset ? parseInt(String(offset), 10) : 0;
  const parsedLimit = limit ? parseInt(String(limit), 10) : 10;

  try {
    // First get total count
    const { count: totalCount, error: countError } = await supabase
      .from("endorsed-ticket")
      .select("id", { count: "exact", head: true })
      .eq("referenceid", referenceid)
      .eq("status", "Endorsed");

    if (countError) {
      console.error("Supabase count error:", countError);
      return res.status(500).json({ message: countError.message });
    }

    // Get paginated data
    const { data, error } = await supabase
      .from("endorsed-ticket")
      .select("*")
      .eq("referenceid", referenceid)
      .eq("status", "Endorsed")
      .order("date_created", { ascending: false }) // Show newest first
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({
      activities: data ?? [],
      total: totalCount ?? 0,
      offset: parsedOffset,
      limit: parsedLimit,
      has_more: (totalCount ?? 0) > (parsedOffset + (data?.length ?? 0)),
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
