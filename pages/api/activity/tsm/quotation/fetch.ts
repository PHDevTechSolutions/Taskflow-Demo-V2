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
    // -----------------------------
    // 1️⃣ Fetch history
    // -----------------------------
    let historyQuery = supabase.from("history").select("*").eq("tsm", referenceid);

    if (fromDate && toDate) {
      // FIX 1: Use full timestamp range so records with time components are not excluded
      historyQuery = historyQuery
        .gte("date_created", `${fromDate}T00:00:00`)
        .lte("date_created", `${toDate}T23:59:59.999`);
    }

    const { data: historyData, error: historyError } = await historyQuery;

    if (historyError) return res.status(500).json({ message: historyError.message });
    if (!historyData || historyData.length === 0)
      return res.status(200).json({ activities: [], cached: false });

    // -----------------------------
    // 2️⃣ Fetch signatories for these activities
    // -----------------------------
    const activityRefs = historyData.map((h) => h.quotation_number).filter(Boolean);

    // FIX 2: Only query signatories if there are valid quotation numbers.
    // Without this guard, when activityRefs is empty the .in() filter is skipped,
    // returning ALL signatories for the TSM which then corrupt the merged records.
    let signatoriesData: any[] = [];

    if (activityRefs.length > 0) {
      const { data, error: signatoriesError } = await supabase
        .from("signatories")
        .select("*")
        .eq("tsm", referenceid)
        .in("quotation_number", activityRefs);

      if (signatoriesError)
        return res.status(500).json({ message: signatoriesError.message });

      signatoriesData = data ?? [];
    }

    // -----------------------------
    // 3️⃣ Merge agent_signature directly into history items
    // -----------------------------
    const mergedData = historyData.map((h) => {
      const sig = signatoriesData.find(
        (s) => s.quotation_number === h.quotation_number
      );

      return {
        ...h,
        agent_name: sig?.agent_name || null,
        agent_signature: sig?.agent_signature || null,
        agent_contact_number: sig?.agent_contact_number || null,
        agent_email_address: sig?.agent_email_address || null,
        tsm_name: sig?.tsm_name || null,
        tsm_approval_date: sig?.tsm_approval_date || null,
        manager_approval_date: sig?.manager_approval_date || null,
        tsm_remarks: sig?.tsm_remarks || null,
      };
    });

    return res.status(200).json({ activities: mergedData, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}