import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    let allData: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("history")
        .select(`
          id,
          activity_reference_number,
          referenceid,
          tsm,
          manager,
          type_activity,
          date_created,
          date_updated,
          start_date,
          end_date,
          status,
          company_name,
          remarks
        `)
        .eq("manager", referenceid)
        // 🔑 STABLE ORDERING (IMPORTANT)
        .order("date_updated", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_updated", fromDate).lte("date_updated", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allData.push(...data);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    return res.status(200).json({
      activities: allData,
      total: allData.length,
      cached: false,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}