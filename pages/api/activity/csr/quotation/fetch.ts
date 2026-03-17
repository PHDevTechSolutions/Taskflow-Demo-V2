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

  // Convert to YYYY-MM-DD (since column is DATE)
  const fromDate =
    typeof from === "string" ? toDateStr(new Date(from)) : undefined;

  const toDate =
    typeof to === "string" ? toDateStr(new Date(to)) : undefined;

  try {
    let allHistory: any[] = [];
    let offset = 0;

    // ─────────────────────────────────────────────
    // FETCH ALL QUOTATIONS (WITH PAGINATION)
    // ─────────────────────────────────────────────
    while (true) {
      let query = supabase
        .from("history")
        .select("*")
        .not("quotation_number", "is", null) // ✅ must have quotation
        .neq("quotation_number", "") // ✅ no empty string
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      // Apply date filter from sidebar
      if (fromDate) query = query.gte("date_created", fromDate);
      if (toDate) query = query.lte("date_created", toDate);

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allHistory.push(...data);

      if (data.length < BATCH_SIZE) break;

      offset += BATCH_SIZE;
    }

    // No data case
    if (allHistory.length === 0) {
      return res.status(200).json({
        activities: [],
        total: 0,
      });
    }

    // ─────────────────────────────────────────────
    // GET UNIQUE QUOTATION NUMBERS
    // ─────────────────────────────────────────────
    const quotationNumbers = [
      ...new Set(
        allHistory
          .map((h) => h.quotation_number)
          .filter((q) => q && q.trim() !== "")
      ),
    ];

    // ─────────────────────────────────────────────
    // FETCH SIGNATORIES (BATCHED)
    // ─────────────────────────────────────────────
    let allSignatories: any[] = [];
    let sigOffset = 0;

    while (sigOffset < quotationNumbers.length) {
      const slice = quotationNumbers.slice(
        sigOffset,
        sigOffset + BATCH_SIZE
      );

      const { data, error } = await supabase
        .from("signatories")
        .select("*")
        .in("quotation_number", slice);

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      if (data) {
        allSignatories.push(...data);
      }

      sigOffset += BATCH_SIZE;
    }

    // ─────────────────────────────────────────────
    // MAP SIGNATORIES BY QUOTATION NUMBER
    // ─────────────────────────────────────────────
    const sigMap = allSignatories.reduce((acc, s) => {
      if (s.quotation_number) {
        acc[s.quotation_number] = s;
      }
      return acc;
    }, {} as Record<string, any>);

    // ─────────────────────────────────────────────
    // MERGE HISTORY + SIGNATORIES
    // ─────────────────────────────────────────────
    const mergedData = allHistory.map((h) => {
      const sig = sigMap[h.quotation_number];

      return {
        ...h,

        // Agent
        agent_name: sig?.agent_name ?? null,
        agent_signature: sig?.agent_signature ?? null,
        agent_contact_number: sig?.agent_contact_number ?? null,
        agent_email_address: sig?.agent_email_address ?? null,

        // TSM
        tsm_name: sig?.tsm_name ?? null,
        tsm_approval_date: sig?.tsm_approval_date ?? null,
        tsm_remarks: sig?.tsm_remarks ?? null,

        // Manager (ready if needed)
        manager_name: sig?.manager_name ?? null,
        manager_approval_date: sig?.manager_approval_date ?? null,
        manager_remarks: sig?.manager_remarks ?? null,
      };
    });

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────
    return res.status(200).json({
      activities: mergedData,
      total: mergedData.length,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
}