import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;
const MAX_RUNTIME = 55000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { tsm, from, to } = req.query;

    if (!tsm || typeof tsm !== "string") {
      return res.status(400).json({ success: false, error: "Missing tsm parameter" });
    }

    console.log("=== TSM ACTIVITIES API ===");
    console.log("TSM ReferenceID:", tsm);
    console.log("From:", from);
    console.log("To:", to);

    // Step 1: Find all agents under this TSM
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("TSM", tsm)
      .eq("Role", "TSM");

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return res.status(500).json({ success: false, error: "Failed to fetch agents" });
    }

    const agentIds = agents?.map(a => a.ReferenceID).filter(Boolean) || [];
    console.log(`Found ${agentIds.length} agents under TSM ${tsm}:`, agentIds);

    // Include TSM's own referenceid in case activities are stored under TSM
    const allReferenceIds = [tsm, ...agentIds];
    console.log("Fetching activities for referenceids:", allReferenceIds);

    // Step 2: Fetch activities for all agents
    let allActivities: any[] = [];
    const startTime = Date.now();

    for (const refId of allReferenceIds) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("history")
          .select("*", { count: "exact" })
          .eq("referenceid", refId);

        // Apply date filters if provided
        if (from && typeof from === "string") {
          query = query.gte("date_created", from);
        }
        if (to && typeof to === "string") {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte("date_created", toDate.toISOString());
        }

        const { data: batch, error, count } = await query
          .order("date_created", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          console.error(`Error fetching activities for ${refId}:`, error);
          break;
        }

        if (batch && batch.length > 0) {
          allActivities = [...allActivities, ...batch];
          offset += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }

        // Timeout check
        if (Date.now() - startTime > MAX_RUNTIME) {
          console.warn("Approaching timeout, returning partial results");
          break;
        }
      }
    }

    console.log(`Total activities fetched: ${allActivities.length}`);

    // Remove duplicates (same activity might appear under different referenceids)
    const uniqueActivities = Array.from(
      new Map(allActivities.map(a => [a.id, a])).values()
    );

    console.log(`Unique activities after deduplication: ${uniqueActivities.length}`);

    return res.status(200).json({
      success: true,
      data: uniqueActivities,
      count: uniqueActivities.length,
      agentsFound: agentIds.length
    });

  } catch (error) {
    console.error("TSM Activities API Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
