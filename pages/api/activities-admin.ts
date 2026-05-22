import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const MAX_LIMIT = 1000; // Supabase hard limit
const DEFAULT_LIMIT = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const { from, to, limit, offset, company_name, fetchAll } = req.query;

    // If fetchAll=true, use batch processing
    if (fetchAll === "true") {
      return await fetchAllActivities(req, res, from, to, company_name);
    }

    // Pagination
    const pageLimit = Math.min(
      parseInt(limit as string) || DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const pageOffset = parseInt(offset as string) || 0;

    // Base query
    let query = supabase
      .from("history")
      .select("*", { count: "exact" });

    // Date filters
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }

    if (to && typeof to === "string") {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      query = query.lte("date_created", toDate.toISOString());
    }

    // Company filter
    if (company_name && typeof company_name === "string") {
      query = query.ilike("company_name", `%${company_name}%`);
    }

    // Execute query
    const { data: activities, error, count } = await query
      .order("date_created", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch activities",
      });
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
    return res.status(500).json({
      success: false,
      error: "Failed to fetch activities",
    });
  }
}

// Fetch all activities using batch processing
async function fetchAllActivities(
  req: NextApiRequest,
  res: NextApiResponse,
  from?: string | string[],
  to?: string | string[],
  company_name?: string | string[]
) {
  const BATCH_SIZE = 1000;

  let allActivities: any[] = [];
  let offset = 0;
  let hasMore = true;

  const startTime = Date.now();
  const MAX_RUNTIME = 55000;

  while (hasMore) {
    let query = supabase
      .from("history")
      .select("*", { count: "exact" });

    // Date filters
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }

    if (to && typeof to === "string") {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      query = query.lte("date_created", toDate.toISOString());
    }

    // Company filter
    if (company_name && typeof company_name === "string") {
      query = query.ilike("company_name", `%${company_name}%`);
    }

    // Fetch batch
    const { data: batch, error, count } = await query
      .order("date_created", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      break;
    }

    if (batch && batch.length > 0) {
      allActivities = [...allActivities, ...batch];

      offset += BATCH_SIZE;
      hasMore = (count || 0) > offset;

      // Safety stop — if we got fewer than batch size, we're done
      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }

    // Prevent timeout
    const elapsedTime = Date.now() - startTime;

    if (elapsedTime > MAX_RUNTIME) {
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
      hasMore: false,
    },
    batchProcessed: true,
  });
}