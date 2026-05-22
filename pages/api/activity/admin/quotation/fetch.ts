import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

interface HistoryItem {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_client: string;
  project_name: string;
  product_category: string;
  project_type: string;
  source: string;
  type_activity: string;
  quotation_number: string;
  quotation_amount: number;
  quotation_status: string;
  product_quantity: number;
  product_amount: number;
  product_description: string;
  product_photo: string;
  product_title: string;
  product_sku: string;
  ticket_reference_number: string;
  remarks: string;
  status: string;
  start_date: string;
  end_date: string;
  date_created: string;
  date_updated: string;
  account_reference_number: string;
  quotation_type: string;
  company_name: string;
  contact_number: string;
  email_address: string;
  address: string;
  contact_person: string;
  tsm_approved_status: string;
  delivery_fee: number;
  vat_type: string;
  quotation_subject: string;
  quotation_vatable: boolean;
  restocking_fee: number;
  item_remarks: string;
}

interface SignatoryItem {
  quotation_number: string;
  agent_name: string;
  agent_signature: string;
  agent_contact_number: string;
  agent_email_address: string;
  tsm_name: string;
  tsm_signature: string;
  tsm_contact_number: string;
  tsm_email_address: string;
  tsm_approval_date: string;
  manager_name: string;
  manager_approval_date: string;
  tsm_remarks: string;
}

type StatusType = "pending" | "approved" | "declined";

interface PaginationMeta {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
}

interface ApiResponse {
  activities: (HistoryItem & Partial<SignatoryItem>)[];
  pagination?: PaginationMeta;
  cached?: boolean;
  message?: string;
}

const HISTORY_SELECT_COLUMNS = [
  "id",
  "activity_reference_number",
  "referenceid",
  "tsm",
  "manager",
  "type_client",
  "project_name",
  "product_category",
  "project_type",
  "source",
  "type_activity",
  "quotation_number",
  "quotation_amount",
  "quotation_status",
  "product_quantity",
  "product_amount",
  "product_description",
  "product_photo",
  "product_title",
  "product_sku",
  "ticket_reference_number",
  "remarks",
  "status",
  "start_date",
  "end_date",
  "date_created",
  "date_updated",
  "account_reference_number",
  "quotation_type",
  "company_name",
  "contact_number",
  "email_address",
  "address",
  "contact_person",
  "tsm_approved_status",
  "delivery_fee",
  "vat_type",
  "quotation_subject",
  "quotation_vatable",
  "restocking_fee",
  "item_remarks",
].join(",");

const SIGNATORIES_SELECT_COLUMNS = [
  "quotation_number",
  "agent_name",
  "agent_signature",
  "agent_contact_number",
  "agent_email_address",
  "tsm_name",
  "tsm_signature",
  "tsm_contact_number",
  "tsm_email_address",
  "tsm_approval_date",
  "manager_name",
  "manager_approval_date",
  "tsm_remarks",
].join(",");

function validateDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function getErrorContext(error: any, context: string): string {
  return `${context}: ${error.message || "Unknown error"}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ activities: [], message: "Method not allowed" });
  }

  const { from, to, statusType, referenceid, page, limit, search } = req.query;

  const fromDate     = typeof from        === "string" ? from.trim()        : undefined;
  const toDate       = typeof to          === "string" ? to.trim()          : undefined;
  const managerRef   = typeof referenceid === "string" ? referenceid.trim() : undefined;
  const searchTerm   = typeof search      === "string" ? search.trim()      : undefined;
  const statusTypeVal: StatusType =
    typeof statusType === "string" &&
    ["pending", "approved", "declined"].includes(statusType.trim())
      ? (statusType.trim() as StatusType)
      : "pending";

  // Pagination params
  const pageSize    = Math.min(Math.max(parseInt(typeof limit === "string" ? limit : "10", 10) || 10, 1), 100);
  const currentPage = Math.max(parseInt(typeof page  === "string" ? page  : "1",  10) || 1, 1);
  const rangeFrom   = (currentPage - 1) * pageSize;
  const rangeTo     = rangeFrom + pageSize - 1;

  // Validate dates
  if (fromDate && !validateDate(fromDate)) {
    return res.status(400).json({ activities: [], message: "Invalid 'from' date format. Use YYYY-MM-DD" });
  }
  if (toDate && !validateDate(toDate)) {
    return res.status(400).json({ activities: [], message: "Invalid 'to' date format. Use YYYY-MM-DD" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ activities: [], message: "'from' date cannot be after 'to' date" });
  }

  try {
    const statusFilter =
      statusTypeVal === "approved"
        ? ["Approved By Sales Head", "Approved"]
        : statusTypeVal === "declined"
        ? ["Decline By Sales Head", "Decline"]
        : ["Pending", "Endorsed to Sales Head", "Endorsed to Saleshead"];

    // ── Build base query (used for both count + data) ────────────────────────
    const buildBaseQuery = (selectCols: string, countMode = false) => {
      let q = supabase
        .from("history")
        .select(selectCols, countMode ? { count: "exact", head: true } : undefined)
        .eq("type_activity", "Quotation Preparation")
        .in("tsm_approved_status", statusFilter);

      if (managerRef) q = q.eq("manager", managerRef);
      if (fromDate)   q = q.gte("date_created", fromDate);
      if (toDate)     q = q.lte("date_created", `${toDate}T23:59:59`);

      // Server-side search across key columns
      if (searchTerm) {
        q = q.or(
          [
            `quotation_number.ilike.%${searchTerm}%`,
            `company_name.ilike.%${searchTerm}%`,
            `activity_reference_number.ilike.%${searchTerm}%`,
            `contact_number.ilike.%${searchTerm}%`,
            `contact_person.ilike.%${searchTerm}%`,
          ].join(",")
        );
      }

      return q;
    };

    // ── Get total count ───────────────────────────────────────────────────────
    const { count: totalCount, error: countError } = await (buildBaseQuery("id", true) as any);

    if (countError) {
      console.error(getErrorContext(countError, "Count query failed"));
      return res.status(500).json({
        activities: [],
        message: getErrorContext(countError, "Failed to count records"),
      });
    }

    const total = totalCount ?? 0;

    if (total === 0) {
      return res.status(200).json({
        activities: [],
        pagination: { totalCount: 0, currentPage, pageSize, hasMore: false },
        cached: false,
      });
    }

    // ── Fetch paginated page ──────────────────────────────────────────────────
    const { data: historyPage, error: historyError } = await buildBaseQuery(HISTORY_SELECT_COLUMNS)
      .order("id", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (historyError) {
      console.error(getErrorContext(historyError, "History query failed"));
      return res.status(500).json({
        activities: [],
        message: getErrorContext(historyError, "Failed to fetch history data"),
      });
    }

    const historyData = (historyPage ?? []) as unknown as HistoryItem[];

    // ── Fetch signatories for this page ───────────────────────────────────────
    const quotationNums = Array.from(
      new Set(historyData.map((h) => h.quotation_number).filter(Boolean))
    );

    let signatoriesData: SignatoryItem[] = [];

    if (quotationNums.length > 0) {
      const REF_CHUNK = 200;
      for (let i = 0; i < quotationNums.length; i += REF_CHUNK) {
        const chunk = quotationNums.slice(i, i + REF_CHUNK);
        const { data: signChunk, error: signError } = await supabase
          .from("signatories")
          .select(SIGNATORIES_SELECT_COLUMNS)
          .in("quotation_number", chunk);

        if (signError) {
          console.error(getErrorContext(signError, "Signatories query failed"));
          return res.status(500).json({
            activities: [],
            message: getErrorContext(signError, "Failed to fetch signatories data"),
          });
        }
        if (signChunk?.length) {
          signatoriesData.push(...(signChunk as unknown as SignatoryItem[]));
        }
      }
    }

    // ── Merge history + signatories ───────────────────────────────────────────
    const mergedData = historyData.map((h) => {
      const sig = signatoriesData.find((s) => s.quotation_number === h.quotation_number);
      return {
        ...h,
        agent_name:            sig?.agent_name            || undefined,
        agent_signature:       sig?.agent_signature       || undefined,
        agent_contact_number:  sig?.agent_contact_number  || undefined,
        agent_email_address:   sig?.agent_email_address   || undefined,
        tsm_name:              sig?.tsm_name              || undefined,
        tsm_signature:         sig?.tsm_signature         || undefined,
        tsm_contact_number:    sig?.tsm_contact_number    || undefined,
        tsm_email_address:     sig?.tsm_email_address     || undefined,
        tsm_approval_date:     sig?.tsm_approval_date     || undefined,
        manager_name:          sig?.manager_name          || undefined,
        manager_approval_date: sig?.manager_approval_date || undefined,
        tsm_remarks:           sig?.tsm_remarks           || undefined,
      };
    });

    const hasMore = rangeFrom + historyData.length < total;

    console.log(
      `Page ${currentPage}/${Math.ceil(total / pageSize)} — returned ${mergedData.length} of ${total} records`
    );

    return res.status(200).json({
      activities: mergedData,
      pagination: { totalCount: total, currentPage, pageSize, hasMore },
      cached: false,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      activities: [],
      message: err.message || "Internal server error occurred",
    });
  }
}