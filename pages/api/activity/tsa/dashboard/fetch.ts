import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000; // safe batch size

async function fetchAllRows(
  table: string,
  referenceid: string,
  fromDate?: string,
  toDate?: string
) {
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("referenceid", referenceid)
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    allData.push(...(data || []));

    if (!data || data.length < BATCH_SIZE) break; // tapos na
    offset += BATCH_SIZE;
  }

  return allData;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    /* -------------------- 1️⃣ HISTORY -------------------- */
    const historyData = await fetchAllRows("history", referenceid, fromDate, toDate);

    /* -------------------- 2️⃣ REVISED QUOTATIONS -------------------- */
    const revisedData = await fetchAllRows("revised_quotations", referenceid, fromDate, toDate);

    /* -------------------- 3️⃣ MEETINGS -------------------- */
    const meetingsData = await fetchAllRows("meetings", referenceid, fromDate, toDate);

    const documentationData = await fetchAllRows("documentation", referenceid, fromDate, toDate);

    /* -------------------- 4️⃣ NORMALIZE + MERGE -------------------- */
    const activities = [
      ...(historyData || []).map((item) => ({ source: "history", ...item })),
      ...(revisedData || []).map((item) => ({ source: "revised_quotations", ...item })),
<<<<<<< HEAD
      ...(meetingsData || []).map((item) => ({ source: "meetings", ...item })),
=======
      ...(meetingsData || []).map((item) => ({ source: "meeting", ...item })),
>>>>>>> 302ff9927fdce73a988ae888fee117b402e109c6
      ...(documentationData || []).map((item) => ({ source: "documentation", ...item })),
    ].sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
