import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: "Missing ID" });
  }

  const body = req.body;

  const allowedFields = [
    "product_quantity",
    "product_amount",
    "product_title",
    "product_description",
    "product_photo",
    "product_sku",
    "quotation_amount",
    "quotation_type",
    "quotation_number", // original quotation number, used only for history update
    "activity_reference_number",
    "referenceid",
    "tsm",
    "manager",
    "company_name",
    "contact_person",
    "contact_number",
    "email_address",
    "address",
    "start_date", // Timestamp
    "end_date",
  ];

  const filteredData: Record<string, any> = {};
  allowedFields.forEach((key) => {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      filteredData[key] = value;
    }
  });

  // Generate revised quotation number for inserting to revised_quotations version column
  const activityReferenceNumber = body.activity_reference_number;
  const originalQuotationNumber = body.quotation_number || "";

  let revisedQuotationNumber = "";
  if (activityReferenceNumber && originalQuotationNumber) {
    const { data: existingRevisions, error: countError } = await supabase
      .from("revised_quotations")
      .select("id", { count: "exact" })
      .eq("activity_reference_number", activityReferenceNumber);

    if (countError) {
      console.error("Error counting revisions:", countError);
      return res.status(500).json({ error: "Failed to count existing revisions." });
    }

    const revisionCount = existingRevisions ? existingRevisions.length : 0;
    const nextRevisionNumber = revisionCount + 1;
    const revisionSuffix = nextRevisionNumber.toString().padStart(3, "0");
    revisedQuotationNumber = `Revised-Quotation-${revisionSuffix}-${originalQuotationNumber}`;
  }

  // Prepare data to insert into revised_quotations
  // Copy filteredData but override or add `version` column with revisedQuotationNumber
  const revisedInsertData = {
    ...filteredData,
    version: revisedQuotationNumber || null, // insert version column here
  };

  // Remove quotation_number from update payload for history so it remains original
  // We'll update history with original quotation_number, not revised
  const { quotation_number, ...historyUpdateData } = filteredData;

  // Insert into revised_quotations
  if (Object.keys(filteredData).length > 0) {
    const { error: revisedError } = await supabase
      .from("revised_quotations")
      .insert(revisedInsertData);

    if (revisedError) {
      console.error("Revised quotation insert failed:", revisedError);
      return res.status(500).json({
        error: "Failed to insert revised quotation.",
        details: revisedError.message,
      });
    }
  }

  // Update history table with original quotation_number and other filtered fields
  const { error } = await supabase
    .from("history")
    .update(historyUpdateData)
    .eq("id", id);

  if (error) {
    console.error("History update failed:", error);
    return res.status(500).json({ error: "Failed to update history." });
  }

  return res.status(200).json({ success: true });
}
