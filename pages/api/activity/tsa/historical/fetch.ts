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
        target_quota,
        type_activity,
        callback,
        call_status,
        call_type,
        quotation_number,
        quotation_amount,
        quotation_status,
        so_number,
        so_amount,
        actual_sales,
        delivery_date,
        dr_number,
        ticket_reference_number,
        remarks,
        status,
        start_date,
        end_date,
        date_followup,
        date_site_visit,
        date_created,
        date_updated,
        company_name,
        contact_number,
        payment_terms,
        scheduled_status
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

    return res.status(200).json({ activities: data || [] });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
