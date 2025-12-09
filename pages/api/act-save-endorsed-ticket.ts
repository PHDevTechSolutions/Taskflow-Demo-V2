import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      account_reference_number,  
      referenceid,            // agent
      tsm,                    // manager
      ticket_reference_number,
      status,
      activity_reference_number
    } = req.body;

    // Validate required fields
    if (
      !account_reference_number ||
      !referenceid ||
      !tsm ||
      !ticket_reference_number ||
      !status ||
      !activity_reference_number
    ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Insert into Supabase "activity"
    const { data, error } = await supabase.from("activity").insert({
      account_reference_number,
      referenceid,             // agent
      tsm,                     // manager
      ticket_reference_number,
      status,
      activity_reference_number
    });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Clear Redis Cache
    try {
      const cacheByTicket = `activity:ticket:${ticket_reference_number}`;
      const cacheByReference = `activity:referenceid:${referenceid}`;

      await redis.del(cacheByTicket);
      await redis.del(cacheByReference);
    } catch (cacheErr) {
      console.warn("Failed to clear cache:", cacheErr);
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
