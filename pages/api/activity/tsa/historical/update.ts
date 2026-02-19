import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing ID" });

  const body = req.body;

  const allowedFields = [
    "quotation_number",
    "quotation_amount",
    "quotation_status",
    "so_number",
    "so_amount",
    "actual_sales",
    "delivery_date",
    "dr_number",
    "remarks",
    "payment_terms",
    "project_name",
    "project_type",
    "source",
    "type_activity",
    "call_status",
  ];

  const filteredData: Record<string, any> = {};
  allowedFields.forEach((key) => {
    const value = body[key];
    if (value !== undefined && value !== null) {
      filteredData[key] = value; // allow empty strings!
    }
  });

  // Insert revised quotation if needed
  const activityReferenceNumber = body.activity_reference_number;
  const originalQuotationNumber = body.quotation_number || "";

  let revisedQuotationNumber = "";
  if (activityReferenceNumber && originalQuotationNumber) {
    const { data: existingRevisions, error: countError } = await supabase
      .from("revised_quotations")
      .select("id", { count: "exact" })
      .eq("activity_reference_number", activityReferenceNumber);

    if (countError) return res.status(500).json({ error: "Failed to count existing revisions." });

    const revisionCount = existingRevisions ? existingRevisions.length : 0;
    const nextRevisionNumber = revisionCount + 1;
    revisedQuotationNumber = `Revised-Quotation-${nextRevisionNumber.toString().padStart(3, "0")}-${originalQuotationNumber}`;

    await supabase.from("revised_quotations").insert({
      ...filteredData,
      version: revisedQuotationNumber,
    });
  }

  // Update history table
  const { error } = await supabase.from("history").update(filteredData).eq("id", id);
  if (error) return res.status(500).json({ error: "Failed to update history." });

  return res.status(200).json({ success: true });
}
