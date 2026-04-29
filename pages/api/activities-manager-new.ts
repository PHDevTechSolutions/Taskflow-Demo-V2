import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const MAX_LIMIT = 1000; // Supabase hard limit per query
const DEFAULT_LIMIT = 1000; // Use maximum allowed per request
const FETCH_ALL_MAX_TOTAL = 2000; // Max total records even in fetchAll mode to prevent 4MB limit

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { manager, from, to, limit, offset, company_name, fetchAll } = req.query;

    if (!manager || typeof manager !== "string") {
      return res.status(400).json({ success: false, error: "Missing manager" });
    }

    // If fetchAll=true, use batch processing for large datasets
    if (fetchAll === "true") {
      return await fetchAllActivities(req, res, manager, from, to, company_name);
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
      .eq("manager", manager);

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
      .order("date_created", { ascending: false }) // Order by date_created for consistency
      .range(pageOffset, pageOffset + pageLimit - 1);

    if (error) {
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
    return res.status(500).json({ success: false, error: "Failed to fetch activities" });
  }
}

// Helper function to fetch all activities with batch processing
async function fetchAllActivities(
  req: NextApiRequest,
  res: NextApiResponse,
  manager: string,
  from?: string | string[],
  to?: string | string[],
  company_name?: string | string[]
) {
  const BATCH_SIZE = 1000; // Supabase limit
  let allActivities: any[] = [];
  let offset = 0;
  let hasMoreData = true;
  let totalProcessed = 0;
  const startTime = Date.now();
  const MAX_RUNTIME = 55000; // 55 seconds max to avoid timeout

  while (hasMoreData && allActivities.length < FETCH_ALL_MAX_TOTAL) {
    // Build query for this batch
    let query = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("manager", manager);

    // Apply date filters if provided
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("date_created", toDate.toISOString());
    }

    // Apply company filter if provided
    if (company_name && typeof company_name === "string") {
      query = query.ilike("company_name", `%${company_name}%`);
    }

    // Add ordering and pagination for this batch
    const { data: batch, error, count } = await query
      .order("date_created", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      break;
    }

    if (batch && batch.length > 0) {
      allActivities = [...allActivities, ...batch];
      totalProcessed += batch.length;
      offset += BATCH_SIZE;
      hasMoreData = (count || 0) > offset;

      // Safety check to prevent infinite loops
      if (batch.length < BATCH_SIZE) {
        hasMoreData = false;
      }
    } else {
      hasMoreData = false;
    }

    // Check for total limit reached
    if (allActivities.length >= FETCH_ALL_MAX_TOTAL) {
      hasMoreData = true; // Indicate there may be more data
      break;
    }

    // Check for timeout to prevent API timeout
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > MAX_RUNTIME) {
      hasMoreData = true;
      break;
    }
  }

  return res.status(200).json({
    success: true,
    data: allActivities,
    pagination: {
      total: allActivities.length,
      limit: BATCH_SIZE,
      offset: 0,
      hasMore: hasMoreData, // True if we hit the limit or timeout
      maxLimit: FETCH_ALL_MAX_TOTAL,
    },
    batchProcessed: true,
    note: hasMoreData
      ? `Limited to ${FETCH_ALL_MAX_TOTAL} records. Use date filters or pagination (offset/limit) to fetch more.`
      : undefined,
  });
}
