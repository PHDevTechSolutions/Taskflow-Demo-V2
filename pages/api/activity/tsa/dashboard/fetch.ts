import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // 1️⃣ Fetch history
    let historyQuery = supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid);

    if (fromDate && toDate) {
      historyQuery = historyQuery.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data: historyData, error: historyError } = await historyQuery;
    if (historyError) throw historyError;

    // 2️⃣ Fetch revised_quotations
    let revisedQuery = supabase
      .from("revised_quotations")
      .select("referenceid, start_date, end_date, type_activity, date_created")
      .eq("referenceid", referenceid);

    if (fromDate && toDate) {
      revisedQuery = revisedQuery.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data: revisedData, error: revisedError } = await revisedQuery;
    if (revisedError) throw revisedError;

    // 3️⃣ Merge both
    const activities = [
      ...(historyData || []),
      ...(revisedData || []),
    ];

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
