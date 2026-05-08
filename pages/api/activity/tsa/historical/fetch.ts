import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 10; // 10 items per page as requested
const MAX_PAGE_SIZE = 50; // Maximum limit to prevent excessive data transfer

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    referenceid, 
    from, 
    to, 
    page = "1", 
    limit = String(PAGE_SIZE),
    search,
    status,
    type_activity,
    source,
    type_client,
    call_status,
    quotation_status
  } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse and validate pagination parameters
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(limit), 10)));
  const offset = (pageNum - 1) * limitNum;

  // Parse date filters
  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // Build base query with all filters first
    let query = supabase
      .from("history")
      .select("*", { count: "exact" }) // Get total count
      .eq("referenceid", referenceid);

    // Apply date filters
    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    } else if (fromDate) {
      query = query.gte("date_created", fromDate);
    } else if (toDate) {
      query = query.lte("date_created", toDate);
    }

    // Apply search filter (search across multiple fields)
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`company_name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%,email_address.ilike.%${searchTerm}%,quotation_number.ilike.%${searchTerm}%,so_number.ilike.%${searchTerm}%,ticket_reference_number.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`);
      }
    }

    // Apply specific filters
    if (status && typeof status === "string" && status !== "all") {
      query = query.eq("status", status);
    }
    if (type_activity && typeof type_activity === "string" && type_activity !== "all") {
      query = query.eq("type_activity", type_activity);
    }
    if (source && typeof source === "string" && source !== "all") {
      query = query.eq("source", source);
    }
    if (type_client && typeof type_client === "string" && type_client !== "all") {
      query = query.eq("type_client", type_client);
    }
    if (call_status && typeof call_status === "string" && call_status !== "all") {
      query = query.eq("call_status", call_status);
    }
    if (quotation_status && typeof quotation_status === "string" && quotation_status !== "all") {
      query = query.eq("quotation_status", quotation_status);
    }

    // Apply ordering (latest first by date_updated, then by date_created)
    query = query.order("date_updated", { ascending: false }).order("date_created", { ascending: false });

    // Apply pagination and get data in one call
    const { data, error, count: totalCount } = await query.range(offset, offset + limitNum - 1);
    if (error) throw error;

    // Filter out items without meaningful data (client-side filter for now)
    const filteredData = (data || []).filter(item => {
      if (!item || typeof item !== 'object') return false;
      
      const checks = [
        "type_activity", "call_status", "call_type", "quotation_number",
        "quotation_amount", "quotation_status", "so_number", "so_amount",
        "actual_sales", "dr_number", "ticket_reference_number", "remarks",
        "source", "project_name", "project_type", "status",
      ];
      return checks.some((col) => {
        try {
          const val = item[col as keyof typeof item];
          if (val === null || val === undefined) return false;
          if (typeof val === "string") return val.trim() !== "" && val.trim() !== "-";
          if (typeof val === "number") return !isNaN(val);
          return Boolean(val);
        } catch (err) {
          return false;
        }
      });
    });

    const totalPages = Math.ceil((totalCount || 0) / limitNum);
    const hasMore = pageNum < totalPages;

    // Validate and sanitize response data
    const safeResponse = {
      activities: filteredData || [],
      pagination: {
        current_page: Math.max(1, pageNum),
        total_pages: Math.max(0, totalPages),
        total_count: Math.max(0, totalCount || 0),
        items_per_page: Math.max(1, limitNum),
        has_more: Boolean(hasMore),
        offset: Math.max(0, offset)
      },
      search_applied: {
        query: typeof search === 'string' ? search.trim() : null,
        filters: {
          status: typeof status === 'string' ? status : null,
          type_activity: typeof type_activity === 'string' ? type_activity : null,
          source: typeof source === 'string' ? source : null,
          type_client: typeof type_client === 'string' ? type_client : null,
          call_status: typeof call_status === 'string' ? call_status : null,
          quotation_status: typeof quotation_status === 'string' ? quotation_status : null,
          date_range: {
            from: fromDate || null,
            to: toDate || null
          }
        }
      },
      cached: false
    };

    return res.status(200).json(safeResponse);

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error",
      error: err.message 
    });
  }
}