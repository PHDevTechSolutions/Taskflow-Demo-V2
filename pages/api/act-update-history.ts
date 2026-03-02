import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing ID" });

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
    "start_date",
    "end_date" // only goes to revised_quotations
  ];

  // Filter out empty/null fields
  const filteredData: Record<string, any> = {};
  allowedFields.forEach((key) => {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      filteredData[key] = value;
    }
  });

  // Generate revised quotation number
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
    const revisionSuffix = String(revisionCount + 1).padStart(3, "0");
    revisedQuotationNumber = `Revised-Quotation-${revisionSuffix}-${originalQuotationNumber}`;
  }

  // Insert into revised_quotations
  const revisedInsertData = {
    ...filteredData,
    version: revisedQuotationNumber || null,
  };

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

  // Prepare history update data: exclude start_date & end_date
  const { quotation_number, start_date, end_date, ...historyUpdateData } = filteredData;

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
