import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Column lists ─────────────────────────────────────────────────────────────

const HISTORY_COLUMNS = [
  "id",
  "activity_reference_number",
  "referenceid",
  "tsm",
  "manager",
  "type_client",
  "company_name",
  "contact_person",
  "contact_number",
  "email_address",
  "address",
  "quotation_number",
  "quotation_amount",
  "tsm_approved_status",
  "date_created",
  "date_updated",
  "delivery_fee",
  "vat_type",
  "remarks",
  "status",
  "source",
  "type_activity",
  "product_category",
  "project_name",
  "project_type",
  "product_quantity",
  "product_amount",
  "product_description",
  "product_photo",
  "product_title",
  "product_sku",
  "item_remarks",
  "ticket_reference_number",
  "account_reference_number",
  "quotation_type",
  "start_date",
  "end_date",
];

const SIGNATORY_COLUMNS = [
  "quotation_number",
  "agent_name",
  "agent_signature",
  "agent_contact_number",
  "agent_email_address",
  "tsm_name",
  "tsm_approval_date",
  "tsm_remarks",
];

// ─── Explicit row types (avoids GenericStringError from Supabase inference) ───

interface HistoryRow {
  id: number;
  activity_reference_number: string | null;
  referenceid: string | null;
  tsm: string | null;
  manager: string | null;
  type_client: string | null;
  company_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email_address: string | null;
  address: string | null;
  quotation_number: string | null;
  quotation_amount: number | null;
  tsm_approved_status: string | null;
  date_created: string;
  date_updated: string | null;
  delivery_fee: string | null;
  vat_type: string | null;
  remarks: string | null;
  status: string | null;
  source: string | null;
  type_activity: string | null;
  product_category: string | null;
  project_name: string | null;
  project_type: string | null;
  product_quantity: string | null;
  product_amount: string | null;
  product_description: string | null;
  product_photo: string | null;
  product_title: string | null;
  product_sku: string | null;
  item_remarks: string | null;
  ticket_reference_number: string | null;
  account_reference_number: string | null;
  quotation_type: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface SignatoryRow {
  quotation_number: string | null;
  agent_name: string | null;
  agent_signature: string | null;
  agent_contact_number: string | null;
  agent_email_address: string | null;
  tsm_name: string | null;
  tsm_approval_date: string | null;
  tsm_remarks: string | null;
}

interface MergedRow extends HistoryRow {
  agent_name: string | null;
  agent_signature: string | null;
  agent_contact_number: string | null;
  agent_email_address: string | null;
  tsm_name: string | null;
  tsm_approval_date: string | null;
  tsm_remarks: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSearchFilter(term: string): string {
  const t = term.replace(/'/g, "''");
  return [
    `company_name.ilike.%${t}%`,
    `contact_person.ilike.%${t}%`,
    `quotation_number.ilike.%${t}%`,
    `activity_reference_number.ilike.%${t}%`,
  ].join(",");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { from, to, page = "1", search = "" } = req.query;

  const fromDate =
    typeof from === "string" && from ? toDateStr(new Date(from)) : undefined;
  const toDate =
    typeof to === "string" && to ? toDateStr(new Date(to)) : undefined;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const searchTerm = typeof search === "string" ? search.trim() : "";
  const offset = (pageNum - 1) * PAGE_SIZE;

  try {
    // ── 1. COUNT ────────────────────────────────────────────────────────────
    let countQuery = supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("type_activity", "Quotation Preparation");

    if (fromDate) countQuery = countQuery.gte("date_created", fromDate);
    if (toDate)   countQuery = countQuery.lte("date_created", toDate);
    if (searchTerm) countQuery = countQuery.or(buildSearchFilter(searchTerm));

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("[quotation/fetch] count error:", countError);
      return res.status(500).json({ message: countError.message });
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (total === 0) {
      return res
        .status(200)
        .json({ activities: [], total: 0, totalPages: 1, page: pageNum });
    }

    // ── 2. DATA (one page only) ─────────────────────────────────────────────
    let dataQuery = supabase
      .from("history")
      .select(HISTORY_COLUMNS.join(", "))
      .eq("type_activity", "Quotation Preparation")
      .order("date_created", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fromDate) dataQuery = dataQuery.gte("date_created", fromDate);
    if (toDate)   dataQuery = dataQuery.lte("date_created", toDate);
    if (searchTerm) dataQuery = dataQuery.or(buildSearchFilter(searchTerm));

    const { data: rawHistory, error: historyError } = await dataQuery;

    if (historyError) {
      console.error("[quotation/fetch] history error:", historyError);
      return res.status(500).json({ message: historyError.message });
    }

    // Cast to our explicit interface — escapes Supabase's GenericStringError
    const historyData = (rawHistory ?? []) as unknown as HistoryRow[];

    if (historyData.length === 0) {
      return res
        .status(200)
        .json({ activities: [], total, totalPages, page: pageNum });
    }

    // ── 3. SIGNATORIES (current page rows only) ─────────────────────────────
    const quotationNumbers = historyData
      .map((h) => h.quotation_number)
      .filter((q): q is string => typeof q === "string" && q.length > 0);

    let sigMap: Record<string, SignatoryRow> = {};

    if (quotationNumbers.length > 0) {
      const { data: rawSig, error: sigError } = await supabase
        .from("signatories")
        .select(SIGNATORY_COLUMNS.join(", "))
        .in("quotation_number", quotationNumbers);

      if (sigError) {
        // Non-fatal — log and continue; UI will still render without signatories
        console.error("[quotation/fetch] signatories error:", sigError);
      } else {
        const sigData = (rawSig ?? []) as unknown as SignatoryRow[];
        sigMap = sigData.reduce<Record<string, SignatoryRow>>((acc, s) => {
          if (s.quotation_number) acc[s.quotation_number] = s;
          return acc;
        }, {});
      }
    }

    // ── 4. MERGE ────────────────────────────────────────────────────────────
    const activities: MergedRow[] = historyData.map((h) => {
      const sig =
        h.quotation_number ? sigMap[h.quotation_number] ?? null : null;
      return {
        ...h,
        agent_name:           sig?.agent_name           ?? null,
        agent_signature:      sig?.agent_signature      ?? null,
        agent_contact_number: sig?.agent_contact_number ?? null,
        agent_email_address:  sig?.agent_email_address  ?? null,
        tsm_name:             sig?.tsm_name             ?? null,
        tsm_approval_date:    sig?.tsm_approval_date    ?? null,
        tsm_remarks:          sig?.tsm_remarks          ?? null,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");

    return res
      .status(200)
      .json({ activities, total, totalPages, page: pageNum });
  } catch (err) {
    console.error("[quotation/fetch] unexpected error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}