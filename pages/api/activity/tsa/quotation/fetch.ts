import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Validate date params
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Select all required fields
    let query = supabase
      .from("history")
      .select(`
        id,
        activity_reference_number,
        referenceid,
        tsm,
        manager,
        type_client,
        project_name,
        product_category,
        project_type,
        source,
        type_activity,
        quotation_number,
        quotation_amount,
        ticket_reference_number,
        remarks,
        status,
        start_date,
        end_date,
        date_created,
        date_updated,
        account_reference_number,
        quotation_type,
        company_name,
        contact_number,
        email_address,
        address,
        contact_person,
        product_quantity,
        product_amount,
        product_description,
        product_photo,
        product_title,
        product_sku
      `)
      .eq("referenceid", referenceid);

    // Apply date_created filter if both from & to are provided
    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({ activities: data || [], cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
