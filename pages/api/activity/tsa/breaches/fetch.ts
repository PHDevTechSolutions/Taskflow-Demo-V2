import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, date } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const today = date && typeof date === "string" ? date : new Date().toISOString().slice(0, 10);

  try {
    // 1️⃣ Fetch history for the day
    const { data: historyData, error: historyError } = await supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid)
      .gte("date_created", `${today}T00:00:00`)
      .lte("date_created", `${today}T23:59:59`);

    if (historyError) throw historyError;

    // 2️⃣ Fetch revised_quotations for the day
    const { data: revisedData, error: revisedError } = await supabase
      .from("revised_quotations")
      .select("referenceid, start_date, end_date, type_activity, date_created")
      .eq("referenceid", referenceid)
      .gte("date_created", `${today}T00:00:00`)
      .lte("date_created", `${today}T23:59:59`);

    if (revisedError) throw revisedError;

    // 3️⃣ Merge both datasets
    const activities = [
      ...(historyData || []),
      ...(revisedData || []),
    ];

    // Optional: sort by date_created
    activities.sort(
      (a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
    );

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
