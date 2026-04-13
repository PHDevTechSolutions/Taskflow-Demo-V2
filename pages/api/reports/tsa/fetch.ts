import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    let allData: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("history")
        .select(`
          id,
          referenceid,
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
          call_type,
          quotation_status,
          quotation_status_sub
        `)
        .eq("referenceid", referenceid)
        .order("id", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_created", fromDate).lte("date_created", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allData.push(...data);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    return res.status(200).json({
      activities: allData,
      total: allData.length,
      cached: false,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}