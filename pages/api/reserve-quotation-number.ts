import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { quotationNumber } = req.body;

  if (!quotationNumber || typeof quotationNumber !== "string") {
    return res.status(400).json({ message: "Missing or invalid quotationNumber" });
  }

  try {
    /** 1️⃣ Check if already reserved */
    const { data: existing, error: fetchError } = await supabase
      .from("history")
      .select("id, is_reserved")
      .eq("quotation_number", quotationNumber)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return res.status(500).json({ message: fetchError.message });
    }

    if (existing?.is_reserved) {
      return res.status(409).json({ message: "Quotation number already reserved" });
    }

    /** 2️⃣ Reserve (atomic update) */
    const { error: updateError } = await supabase
      .from("history")
      .update({
        is_reserved: true,
        reserved_at: new Date().toISOString(),
      })
      .eq("quotation_number", quotationNumber)
      .or("is_reserved.is.null,is_reserved.eq.false");

    if (updateError) {
      return res.status(500).json({ message: updateError.message });
    }

    /** 3️⃣ Clear Redis cache (VERY IMPORTANT) */
    const prefix = quotationNumber.split("-").slice(0, -1).join("-");
    const cacheKey = `quotations:prefix:${prefix}`;
    await redis.del(cacheKey);

    return res.status(200).json({
      success: true,
      quotationNumber,
      message: "Quotation number reserved successfully",
    });
  } catch (err) {
    console.error("Reserve quotation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
