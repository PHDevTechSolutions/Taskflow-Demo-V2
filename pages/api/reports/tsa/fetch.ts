import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  // Validate date params
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Build Supabase query
    let query = supabase
      .from("history")
      .select(`
        id,
        quotation_amount,
        quotation_number,
        ticket_reference_number,
        remarks,
        date_created,
        date_updated,
        company_name,
        contact_number,
        contact_person,
        type_client,
        status,
        type_activity,
        source,
        actual_sales,
        dr_number,
        delivery_date,
        si_date,
        payment_terms,
        so_number,
        so_amount,
        call_type
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

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
