import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, page = "1", limit = "10", search } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ message: "Invalid pagination parameters" });
  }

  const offset = (pageNum - 1) * limitNum;

  const fromDate = !from ? undefined : Array.isArray(from) ? from[0] : from;
  const toDate = !to ? undefined : Array.isArray(to) ? to[0] : to;

  try {
    let query = supabase
      .from("spf_request")
      .select("*", { count: "exact" })
      .eq("manager", referenceid)
      .order("id", { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    // Apply search filter
    if (search && typeof search === "string" && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      query = query.or(
        `customer_name.ilike.%${searchLower}%,contact_person.ilike.%${searchLower}%,spf_number.ilike.%${searchLower}%`
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch status and creation id from spf_creation table for each SPF request
    const spfNumbers = data?.map(item => item.spf_number).filter(Boolean) || [];
    let statusMap = new Map();
    let creationIdMap = new Map();
    
    if (spfNumbers.length > 0) {
      const { data: creationData, error: creationError } = await supabase
        .from("spf_creation")
        .select("id, spf_number, status")
        .in("spf_number", spfNumbers);
      
      if (creationError) {
        console.error("Error fetching data from spf_creation:", creationError);
      } else if (creationData) {
        statusMap = new Map(creationData.map(item => [item.spf_number, item.status]));
        creationIdMap = new Map(creationData.map(item => [item.spf_number, item.id]));
      }
    }

    // Merge status and creation id into the data
    const mergedData = (data || []).map(item => ({
      ...item,
      status: statusMap.get(item.spf_number) || item.status || "pending",
      spf_creation_id: creationIdMap.get(item.spf_number) || null
    }));

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasMore = pageNum < totalPages;

    return res.status(200).json({
      success: true,
      activities: mergedData,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasMore,
        limit: limitNum
      }
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || "Server error" 
    });
  }
}