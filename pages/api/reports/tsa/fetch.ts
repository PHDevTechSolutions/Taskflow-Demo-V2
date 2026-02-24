import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    res.status(400).json({ message: "Missing or invalid referenceid" });
    return;
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    const batchSize = 1000; // fetch 1000 rows per batch
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
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
          quotation_status
        `)
        .eq("referenceid", referenceid)
        .range(page * batchSize, (page + 1) * batchSize - 1);

      // Apply date_updated filter if provided
      if (fromDate && toDate) {
        query = query.gte("date_updated", fromDate).lte("date_updated", toDate);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    return res.status(200).json({ activities: allData, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}