import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

// Generator for history batches
async function* fetchHistoryBatches(referenceid: string, fromDate?: string, toDate?: string, limit?: number) {
  let lastId: number | null = null;
  let totalFetched = 0;

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);
    if (fromDate) query = query.gte("date_created", fromDate);
    if (toDate) query = query.lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    // Stop if we reached the limit
    if (limit && totalFetched >= limit) break;
    lastId = data[data.length - 1].id;
  }
}

// Generator for revised quotations batches
async function* fetchRevisedQuotationsBatches(referenceid: string, fromDate?: string, toDate?: string, limit?: number) {
  let lastId: number | null = null;
  let totalFetched = 0;

  while (true) {
    let query = supabase
      .from("revised_quotations")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);
    if (fromDate) query = query.gte("date_created", fromDate);
    if (toDate) query = query.lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    totalFetched += data.length;

    // Stop if we reached the limit
    if (limit && totalFetched >= limit) break;
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
      .eq("referenceid", referenceid)
      .in("quotation_number", quotationNumbers)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    yield data;
    offset += BATCH_SIZE;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, limit } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse limit with safeguards
  const parsedLimit = Math.min(
    parseInt(typeof limit === "string" ? limit : String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  // Per-table limit to distribute load
  const perTableLimit = Math.ceil(parsedLimit / 2); // Split between history and revised_quotations

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let firstHistory = true;
    const allQuotationNumbers: string[] = [];
    const revisedQuotationsMap = new Map<string, any>();

    // First, fetch revised quotations to get PDF config (limited)
    for await (const revisedBatch of fetchRevisedQuotationsBatches(referenceid, from as string, to as string, perTableLimit)) {
      for (const r of revisedBatch) {
        revisedQuotationsMap.set(r.activity_reference_number || r.quotation_number, r);
      }
    }

    // ---------------- Stream history (limited) ----------------
    const mergedActivities: any[] = [];
    let hasMore = false;

    for await (const historyBatch of fetchHistoryBatches(referenceid, from as string, to as string, parsedLimit)) {
      for (const h of historyBatch) {
        if (mergedActivities.length >= parsedLimit) {
          hasMore = true;
          break;
        }
        allQuotationNumbers.push(h.quotation_number);
        // Merge with revised quotation data if available (for PDF config)
        const revised = revisedQuotationsMap.get(h.activity_reference_number || h.quotation_number);
        mergedActivities.push({
          ...h,
          // PDF configuration from revised_quotations takes precedence
          hide_discount_in_preview: revised?.hide_discount_in_preview ?? h.hide_discount_in_preview ?? false,
          show_discount_columns: revised?.show_discount_columns ?? h.show_discount_columns ?? false,
          show_summary_discounts: revised?.show_summary_discounts ?? h.show_summary_discounts ?? false,
          show_profit_margins: revised?.show_profit_margins ?? h.show_profit_margins ?? false,
          margin_alert_threshold: revised?.margin_alert_threshold ?? h.margin_alert_threshold ?? 0,
          show_margin_alerts: revised?.show_margin_alerts ?? h.show_margin_alerts ?? false,
          product_view_mode: revised?.product_view_mode ?? h.product_view_mode ?? 'list',
          visible_columns: revised?.visible_columns ?? h.visible_columns ?? null,
        });
      }
      if (hasMore) break;
    }

    // ---------------- Stream signatories (limited) ----------------
    const signaturesMap = new Map<string, any>();
    const uniqueQuotations = [...new Set(allQuotationNumbers)];
    const signatoryLimit = parsedLimit * 2;
    let signatoryCount = 0;

    for await (const sigBatch of fetchSignatoriesBatches(referenceid, uniqueQuotations)) {
      for (const s of sigBatch) {
        if (signatoryCount >= signatoryLimit) break;
        signaturesMap.set(s.quotation_number, s);
        signatoryCount++;
      }
      if (signatoryCount >= signatoryLimit) break;
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

    res.write(`],"has_more":${hasMore},"limit":${parsedLimit},"cached":false}`);
    res.end();
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) res.status(500).json({ message: err.message || "Server error" });
  }
}