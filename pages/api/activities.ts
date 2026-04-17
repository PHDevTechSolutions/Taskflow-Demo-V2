import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const MAX_LIMIT = 1000; // Maximum records per request
const DEFAULT_LIMIT = 500; // Default records per request

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { referenceid, from, to, limit, offset, company_name } = req.query;

    if (!referenceid || typeof referenceid !== "string") {
      return res.status(400).json({ success: false, error: "Missing referenceid" });
    }

    // Parse pagination params
    const pageLimit = Math.min(
      parseInt(limit as string) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const pageOffset = parseInt(offset as string) || 0;

    // Build query
    let query = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid);

    // Filter by date range if provided
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      // Add 23:59:59 to include the entire day
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("date_created", toDate.toISOString());
    }

    // Filter by company name if provided
    if (company_name && typeof company_name === "string") {
      query = query.ilike("company_name", `%${company_name}%`);
    }

    // Add pagination and ordering
    const { data: activities, error, count } = await query
      .order("date_created", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch activities" });
    }

    return res.status(200).json({
      success: true,
      data: activities || [],
      pagination: {
        total: count || 0,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: (count || 0) > pageOffset + pageLimit,
      },
    });
  } catch (error: any) {
    console.error("Activities API error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch activities" });
  }
}
