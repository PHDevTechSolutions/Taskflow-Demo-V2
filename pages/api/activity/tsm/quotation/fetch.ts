import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

// Generator for history batches
async function* fetchHistoryBatches(tsm: string, fromDate?: string, toDate?: string) {
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("tsm", tsm)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    lastId = data[data.length - 1].id;
  }
}

// Generator for signatories batches
async function* fetchSignatoriesBatches(referenceid: string, quotationNumbers: string[]) {
  if (!quotationNumbers.length) return;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("signatories")
      .select("*")
      .eq("tsm", referenceid)
      .in("quotation_number", quotationNumbers)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    offset += BATCH_SIZE;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let firstHistory = true;
    const allQuotationNumbers: string[] = [];

    // ---------------- Stream history ----------------
    const mergedActivities: any[] = [];
    for await (const historyBatch of fetchHistoryBatches(referenceid, from as string, to as string)) {
      for (const h of historyBatch) {
        allQuotationNumbers.push(h.quotation_number);
        mergedActivities.push({ ...h }); // placeholder, signatures will be added later
      }
    }

    // ---------------- Stream signatories ----------------
    const signaturesMap = new Map<string, any>();
    for await (const sigBatch of fetchSignatoriesBatches(referenceid, allQuotationNumbers)) {
      for (const s of sigBatch) {
        signaturesMap.set(s.quotation_number, s);
      }
    }

    // ---------------- Merge signatures into activities ----------------
    for (const h of mergedActivities) {
      const sig = signaturesMap.get(h.quotation_number);
      const merged = {
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
        manager_approval_date: sig?.manager_approval_date || null,
      };

      const json = JSON.stringify(merged);
      res.write(firstHistory ? json : `,${json}`);
      firstHistory = false;
    }

    res.write(`],"cached":false}`);
    res.end();
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) res.status(500).json({ message: err.message || "Server error" });
  }
}