import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Helper: format Date → "YYYY-MM-DD"
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { from, to } = req.query;

  // Use plain date strings since date_created is a DATE column, not TIMESTAMPTZ
  const fromDate =
    typeof from === "string" ? toDateStr(new Date(from)) : undefined;

  const toDate =
    typeof to === "string" ? toDateStr(new Date(to)) : undefined;

  try {
    let allHistory: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("history")
        .select("*")
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate) query = query.gte("date_created", fromDate);
      if (toDate)   query = query.lte("date_created", toDate);

      const { data, error } = await query;
      if (error) return res.status(500).json({ message: error.message });
      if (!data || data.length === 0) break;

      allHistory.push(...data);
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    if (allHistory.length === 0) {
      return res.status(200).json({ activities: [], total: 0 });
    }

    // Fetch signatories in batches
    const quotationNumbers = allHistory
      .map((h) => h.quotation_number)
      .filter(Boolean);

    let allSignatories: any[] = [];
    let sigOffset = 0;

    while (sigOffset < quotationNumbers.length) {
      const slice = quotationNumbers.slice(sigOffset, sigOffset + BATCH_SIZE);
      const { data, error } = await supabase
        .from("signatories")
        .select("*")
        .in("quotation_number", slice);

      if (error) return res.status(500).json({ message: error.message });
      if (data) allSignatories.push(...data);
      sigOffset += BATCH_SIZE;
    }

    const sigMap = allSignatories.reduce((acc, s) => {
      if (s.quotation_number) acc[s.quotation_number] = s;
      return acc;
    }, {} as Record<string, any>);

    const mergedData = allHistory.map((h) => {
      const sig = sigMap[h.quotation_number];
      return {
        ...h,
        agent_name:           sig?.agent_name          ?? null,
        agent_signature:      sig?.agent_signature     ?? null,
        agent_contact_number: sig?.agent_contact_number ?? null,
        agent_email_address:  sig?.agent_email_address ?? null,
        tsm_name:             sig?.tsm_name            ?? null,
        tsm_approval_date:    sig?.tsm_approval_date   ?? null,
        tsm_remarks:          sig?.tsm_remarks         ?? null,
      };
    });

    return res.status(200).json({
      activities: mergedData,
      total: mergedData.length,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}