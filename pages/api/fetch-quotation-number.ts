import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { prefix } = req.query;

  if (!prefix || typeof prefix !== "string") {
    res.status(400).json({ message: "Missing or invalid prefix" });
    return;
  }

  const cacheKey = `quotations:prefix:${prefix}`;

  try {
    // Check Redis cache first
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({ quotationNumbers: JSON.parse(cached), cached: true });
    }

    // Query Supabase quotations table (assuming table name is 'quotations' and column is 'quotation_number')
    // Use ilike for case-insensitive "starts with" filter: 'prefix%'
    const { data, error } = await supabase
      .from("history")
      .select("quotation_number")
      .ilike("quotation_number", `${prefix}%`)
      .order("quotation_number", { ascending: true });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const quotationNumbers = data ? data.map((row) => row.quotation_number) : [];

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(quotationNumbers), { ex: 300 });

    return res.status(200).json({ quotationNumbers, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
