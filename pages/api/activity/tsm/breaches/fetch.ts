import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

async function fetchAllRows(table: string, tsm: string, fromDate?: string, toDate?: string) {
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("tsm", tsm)
      .order("date_created", { ascending: false })
      .order("id", { ascending: false }) // secondary sort to avoid skipping
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    allData.push(...data);

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allData;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { tsm, from, to } = req.query;

  if (!tsm || typeof tsm !== "string") {
    return res.status(400).json({ message: "Missing or invalid tsm reference" });
  }

  try {
    let fromDate: string | undefined = undefined;
    let toDate: string | undefined = undefined;

    if (typeof from === "string" && typeof to === "string") {
      fromDate = from;
      toDate = to;
    }

    /* -------------------- 1️⃣ HISTORY -------------------- */
    const historyData = await fetchAllRows("history", tsm, fromDate, toDate);

    /* -------------------- 2️⃣ REVISED QUOTATIONS -------------------- */
    const revisedData = await fetchAllRows("revised_quotations", tsm, fromDate, toDate);

    /* -------------------- 3️⃣ MEETINGS -------------------- */
    const meetingsData = await fetchAllRows("meetings", tsm, fromDate, toDate);

    /* -------------------- 4️⃣ DOCUMENTATION -------------------- */
    const documentationData = await fetchAllRows("documentation", tsm, fromDate, toDate);

    /* -------------------- 5️⃣ NORMALIZE + MERGE -------------------- */
    const activities = [
      ...(historyData || []).map((item) => ({ source: "history", ...item })),
      ...(revisedData || []).map((item) => ({ source: "revised_quotations", ...item })),
      ...(meetingsData || []).map((item) => ({ source: "meeting", ...item })),
      ...(documentationData || []).map((item) => ({ source: "documentation", ...item })),
    ].sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    // 🔹 Optional: filter only Outbound + Inbound Calls (kung gusto mo)
    const filteredActivities = activities.filter(
      (a) => a.type_activity === "Outbound Calls" || a.type_activity === "Inbound Calls"
    );

    return res.status(200).json({
      total: filteredActivities.length,
      activities: filteredActivities,
    });
  } catch (err: any) {
    console.error("API ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}