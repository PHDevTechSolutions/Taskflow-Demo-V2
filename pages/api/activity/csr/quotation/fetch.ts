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

  const fromDate =
    typeof from === "string" ? toDateStr(new Date(from)) : undefined;

  const toDate =
    typeof to === "string" ? toDateStr(new Date(to)) : undefined;

  try {
    // =============================
    // 1. FETCH SIGNATORIES (MAIN BASE)
    // =============================
    let allSignatories: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("signatories")
        .select("*")
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate) query = query.gte("date_created", fromDate);
      if (toDate)   query = query.lte("date_created", toDate);

      const { data, error } = await query;
      if (error) return res.status(500).json({ message: error.message });
      if (!data || data.length === 0) break;

      allSignatories.push(...data);
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    if (allSignatories.length === 0) {
      return res.status(200).json({ activities: [], total: 0 });
    }

    // =============================
    // 2. GET ALL QUOTATION NUMBERS
    // =============================
    const quotationNumbers = allSignatories
      .map((s) => s.quotation_number)
      .filter(Boolean);

    // =============================
    // 3. FETCH HISTORY (MATCHING ONLY)
    // =============================
    let allHistory: any[] = [];
    let histOffset = 0;

    while (histOffset < quotationNumbers.length) {
      const slice = quotationNumbers.slice(
        histOffset,
        histOffset + BATCH_SIZE
      );

      const { data, error } = await supabase
        .from("history")
        .select("*")
        .in("quotation_number", slice);

      if (error) return res.status(500).json({ message: error.message });
      if (data) allHistory.push(...data);

      histOffset += BATCH_SIZE;
    }

    // =============================
    // 4. MAP HISTORY BY QUOTATION #
    // =============================
    const historyMap = allHistory.reduce((acc, h) => {
      if (h.quotation_number) acc[h.quotation_number] = h;
      return acc;
    }, {} as Record<string, any>);

    // =============================
    // 5. MERGE (SIGNATORIES BASE)
    // =============================
    const mergedData = allSignatories.map((s) => {
      const hist = historyMap[s.quotation_number];

      return {
        ...(hist || {}), // fallback if no history
        ...s,

        // ensure consistent fields (priority: signatories)
        agent_name: s.agent_name ?? hist?.agent ?? null,
        agent_signature: s.agent_signature ?? null,
        agent_contact_number: s.agent_contact_number ?? null,
        agent_email_address: s.agent_email_address ?? null,
        tsm_name: s.tsm_name ?? hist?.tsm ?? null,
        tsm_approval_date: s.tsm_approval_date ?? null,
        tsm_remarks: s.tsm_remarks ?? null,
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