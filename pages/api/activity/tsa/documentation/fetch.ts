import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    referenceid, 
    from, 
    to, 
    limit = "10",
    page = "1",
    search,
    type
  } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse pagination parameters
  const pageNum = Math.max(1, parseInt(typeof page === "string" ? page : "1", 10));
  const limitNum = Math.min(Math.max(1, parseInt(typeof limit === "string" ? limit : "10", 10)), 50);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Build base query for documentation table
    let query = supabase
      .from("documentation")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid)
      .order("date_created", { ascending: false });

    // Apply search filter
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`type_activity.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`);
      }
    }

    // Apply type filter
    if (type && typeof type === "string" && type !== "all") {
      query = query.eq("type_activity", type);
    }

    // Apply date range filter
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      query = query.lte("date_created", to);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data, error, count: totalCount } = await query;

    if (error) {
      console.error("Documentation query error:", error);
      throw error;
    }

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / limitNum);
    const hasMore = pageNum < totalPages;

    // Validate and sanitize response data
    const safeResponse = {
      notes: data || [],
      totalCount: Math.max(0, totalCount || 0),
      totalPages: Math.max(0, totalPages),
      currentPage: Math.max(1, pageNum),
      itemsPerPage: Math.max(1, limitNum),
      hasMore: Boolean(hasMore),
      offset: Math.max(0, offset),
      search_applied: {
        query: typeof search === 'string' ? search.trim() : null,
        type: typeof type === 'string' ? type : null,
        date_range: {
          from: from || null,
          to: to || null
        }
      },
      cached: false
    };

    return res.status(200).json(safeResponse);
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error",
      notes: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      itemsPerPage: 10,
      hasMore: false,
      offset: 0
    });
  }
}
