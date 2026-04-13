import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

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
  "discounted_priced",
  "discounted_amount",
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, statusType } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const statusTypeValue = typeof statusType === "string" ? statusType : "pending";
  const PAGE_SIZE = 1000;

  try {
    const statusFilter =
      statusTypeValue === "approved"
        ? ["Approved By Sales Head", "Approved"]
        : statusTypeValue === "declined"
          ? ["Decline By Sales Head", "Decline"]
          : ["Pending", "Endorsed to Sales Head", "Endorsed to Saleshead"];

    // -----------------------------
    // 1) Fetch already-filtered history rows
    // -----------------------------
    const historyData: any[] = [];
    let fromRow = 0;
    let hasMore = true;

    while (hasMore) {
      let pageQuery = supabase
        .from("history")
        .select(HISTORY_SELECT_COLUMNS)
        .eq("manager", referenceid)
        .eq("type_activity", "Quotation Preparation")
        .in("tsm_approved_status", statusFilter)
        .order("id", { ascending: false })
        .range(fromRow, fromRow + PAGE_SIZE - 1);

      // `date_created` is a DATE column (no timestamp), so compare as YYYY-MM-DD directly.
      if (fromDate) {
        pageQuery = pageQuery.gte("date_created", fromDate);
      }
      if (toDate) {
        pageQuery = pageQuery.lte("date_created", toDate);
      }

      const { data: pageData, error: historyError } = await pageQuery;
      if (historyError) return res.status(500).json({ message: historyError.message });

      const rows = pageData ?? [];
      historyData.push(...rows);

      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        fromRow += PAGE_SIZE;
      }
    }

    if (!historyData || historyData.length === 0) return res.status(200).json({ activities: [], cached: false });

    // -----------------------------
    // 2) Fetch matching signatories only for fetched quotations
    // -----------------------------
    const activityRefs = Array.from(
      new Set(historyData.map((h) => h.quotation_number).filter(Boolean))
    );
    const signatoriesData: any[] = [];

    if (activityRefs.length > 0) {
      const REF_CHUNK = 200;
      for (let i = 0; i < activityRefs.length; i += REF_CHUNK) {
        const chunk = activityRefs.slice(i, i + REF_CHUNK);
        const { data: signChunk, error: signatoriesError } = await supabase
          .from("signatories")
          .select(SIGNATORIES_SELECT_COLUMNS)
          .eq("manager", referenceid)
          .in("quotation_number", chunk);

        if (signatoriesError) return res.status(500).json({ message: signatoriesError.message });
        if (signChunk?.length) signatoriesData.push(...signChunk);
      }
    }

    // -----------------------------
    // 3) Merge signatories into history items
    // -----------------------------
    const mergedData = historyData.map((h) => {
      const sig = signatoriesData?.find(
        (s) => s.quotation_number === h.quotation_number
      );

      return {
        ...h,
        agent_name: sig?.agent_name || null,
        agent_signature: sig?.agent_signature || null,
        agent_contact_number: sig?.agent_contact_number || null, 
        agent_email_address: sig?.agent_email_address || null, 
        tsm_name: sig?.tsm_name || null,
        tsm_signature: sig?.tsm_signature || null, 
        tsm_contact_number: sig?.tsm_contact_number || null, 
        tsm_email_address: sig?.tsm_email_address || null, 
        tsm_approval_date: sig?.tsm_approval_date || null, 
        manager_name: sig?.manager_name || null,
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