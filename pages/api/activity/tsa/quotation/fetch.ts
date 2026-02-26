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
    let historyQuery = supabase.from("history").select("*").eq("referenceid", referenceid);

    if (fromDate && toDate) {
      historyQuery = historyQuery.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data: historyData, error: historyError } = await historyQuery;
    if (historyError) return res.status(500).json({ message: historyError.message });
    if (!historyData || historyData.length === 0) return res.status(200).json({ activities: [], cached: false });

    // -----------------------------
    // 2️⃣ Fetch signatories for these activities
    // -----------------------------
    const activityRefs = historyData.map((h) => h.quotation_number).filter(Boolean);

    let signatoriesQuery = supabase.from("signatories").select("*").eq("referenceid", referenceid);
    if (activityRefs.length > 0) {
      signatoriesQuery = signatoriesQuery.in("quotation_number", activityRefs);
    }

    const { data: signatoriesData, error: signatoriesError } = await signatoriesQuery;
    if (signatoriesError) return res.status(500).json({ message: signatoriesError.message });

    // -----------------------------
    // 3️⃣ Merge agent_signature directly into history items
    // -----------------------------
    const mergedData = historyData.map((h) => {
      const sig = signatoriesData?.find(
        (s) => s.quotation_number === h.quotation_number
      );

      return {
        ...h,
        agent_signature: sig?.agent_signature || null,
        agent_contact_number: sig?.agent_contact_number || null, 
        agent_email_address: sig?.agent_email_address || null, 
        tsm_signature: sig?.tsm_signature || null, 
        tsm_contact_number: sig?.tsm_contact_number || null, 
        tsm_email_address: sig?.tsm_email_address || null, 
        manager_signature: sig?.manager_signature || null, 
        manager_contact_number: sig?.manager_contact_number || null, 
        manager_email_address: sig?.manager_email_address || null, 
        tsm_approval_date: sig?.tsm_approval_date || null, 
        tsm_remarks: sig?.tsm_remarks || null, 
        manager_remarks: sig?.manager_remarks || null, 
      };
    });

    return res.status(200).json({ activities: mergedData, cached: false });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}