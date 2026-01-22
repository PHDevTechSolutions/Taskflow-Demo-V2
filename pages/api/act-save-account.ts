import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      referenceid,
      tsm,
      manager,
      account_reference_number,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      status,
      activity_reference_number,
    } = req.body;

    if (!referenceid || !tsm || !manager || !account_reference_number || !status || !activity_reference_number) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Insert to Supabase table
    const { data, error } = await supabase
      .from("activity")
      .insert({
        referenceid,
        tsm,
        manager,
        account_reference_number,
        status,
        activity_reference_number,
        company_name,
        contact_person,
        contact_number,
        email_address,
        address,
      });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Clear cache related to this activity_reference_number and referenceid
    try {
      const cacheKeyByActivity = `activity:referenceid:${activity_reference_number}`;
      const cacheKeyByRefId = `activity:referenceid:${referenceid}`;
      await redis.del(cacheKeyByActivity);
      await redis.del(cacheKeyByRefId);
    } catch (cacheErr) {
      console.warn("Failed to clear cache:", cacheErr);
      // Don't fail the request just because cache clearing failed
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
