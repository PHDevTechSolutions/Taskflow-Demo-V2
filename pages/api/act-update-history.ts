import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = req.query.id as string;
    const body = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing history id" });
    }

    const {
      quotation_number: originalQuotationNumber,
      activity_reference_number,
    } = body;

    if (!originalQuotationNumber) {
      return res.status(400).json({ error: "quotation_number is required" });
    }

    /**
     * ------------------------------------------------
     * 1. HANAPIN SA HISTORY VIA ID
     * ------------------------------------------------
     */
    const { data: historyRow, error: historyFindError } = await supabase
      .from("history")
      .select("id, quotation_number")
      .eq("id", id)
      .single();

    if (historyFindError || !historyRow) {
      return res.status(404).json({
        error: "History record not found",
      });
    }

    if (historyRow.quotation_number !== originalQuotationNumber) {
      return res.status(400).json({
        error: "quotation_number mismatch with history record",
      });
    }

    /**
     * ------------------------------------------------
     * 2. FILTER ALLOWED FIELDS
     * ------------------------------------------------
     */
    const allowedFields = [
      "product_quantity",
      "product_amount",
      "product_title",
      "product_description",
      "product_photo",
      "product_sku",
      "quotation_amount",
      "quotation_type",
      "quotation_number",
      "activity_reference_number",
      "referenceid",
      "tsm",
      "manager",
      "company_name",
      "contact_person",
      "contact_number",
      "email_address",
      "address",
      "start_date",
      "end_date",
      "vat_type",
      "delivery_fee",
      "restocking_fee",
      "quotation_vatable",
      "quotation_subject",
      "item_remarks",
      "discounted_priced",
      "discounted_amount",
      "hide_discount_in_preview",
      "show_discount_columns",
      "show_summary_discounts",
      "show_profit_margins",
      "margin_alert_threshold",
      "show_margin_alerts",
      "product_view_mode",
      "visible_columns",
      "product_is_promo",
      "product_is_hidden",
      "product_display_mode",
    ];

    // Filter out empty/null fields
    const filteredData: Record<string, any> = {};
    for (const key of allowedFields) {
      const value = body[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        filteredData[key] = value;
      }
    }

    /**
     * ------------------------------------------------
     * 3. GENERATE REVISED QUOTATION NUMBER
     * ------------------------------------------------
     */
    let revisedQuotationNumber: string | null = null;

    if (activity_reference_number) {
      const { data: existingRevisions, error } = await supabase
        .from("revised_quotations")
        .select("id")
        .eq("activity_reference_number", activity_reference_number);

      if (error) {
        return res.status(500).json({
          error: "Failed to count revised quotations",
        });
      }

      const revisionCount = existingRevisions?.length ?? 0;
      const suffix = String(revisionCount + 1).padStart(3, "0");

      revisedQuotationNumber = `Revised-Quotation-${suffix}-${originalQuotationNumber}`;
    }

    /**
     * ------------------------------------------------
     * 4. INSERT SA revised_quotations
     * ------------------------------------------------
     */
    const { error: revisedInsertError } = await supabase
      .from("revised_quotations")
      .insert({
        ...filteredData,
        version: revisedQuotationNumber,
      });

    if (revisedInsertError) {
      console.error(revisedInsertError);
      return res.status(500).json({
        error: "Failed to insert revised quotation",
      });
    }

    /**
     * ------------------------------------------------
     * 5. CLEAR SIGNATORIES (NEW)
     * ------------------------------------------------
     */
    const { error: signatoriesError } = await supabase
      .from("signatories")
      .update({
        tsm_signature: null,
        manager_signature: null,
        tsm_approval_date: null,
        tsm_remarks: null,
        manager_remarks: null,
        manager_approval_date: null,
      })
      .eq("quotation_number", originalQuotationNumber);

    if (signatoriesError) {
      console.error(signatoriesError);
      return res.status(500).json({
        error: "Failed to reset signatories",
      });
    }

    /**
     * ------------------------------------------------
     * 6. UPDATE HISTORY VIA ID
     * - reset approval
     * ------------------------------------------------
     */
    const { start_date, end_date, quotation_number, ...historyUpdateData } =
      filteredData;

    const { error: historyUpdateError } = await supabase
      .from("history")
      .update({
        ...historyUpdateData,
        tsm_approved_status: "Pending",
        delivery_fee: body.delivery_fee ?? null,
        restocking_fee: body.restocking_fee ?? null,
        quotation_vatable: body.quotation_vatable ?? null,
        quotation_subject: body.quotation_subject ?? null,
      })
      .eq("id", id);

    if (historyUpdateError) {
      console.error(historyUpdateError);
      return res.status(500).json({
        error: "Failed to update history",
      });
    }

    // Log audit trail for quotation update
    await logAuditTrailWithSession(
      req,
      "update",
      "quotation",
      id,
      originalQuotationNumber,
      `Updated quotation and created revision: ${revisedQuotationNumber}`,
      { revisedQuotationNumber, changes: Object.keys(filteredData) }
    );

    /**
     * ------------------------------------------------
     * 7. SUCCESS
     * ------------------------------------------------
     */
    return res.status(200).json({
      success: true,
      revised_quotation_number: revisedQuotationNumber,
      status: "Pending",
    });
  } catch (err: any) {
    console.error("Unhandled error in act-update-history:", err);
    return res.status(500).json({
      error: err?.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
  }
}