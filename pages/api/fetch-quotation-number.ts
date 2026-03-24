import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { prefix } = req.query;

  if (!prefix || typeof prefix !== "string") {
    res.status(400).json({ message: "Missing or invalid prefix" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("history")
      .select("quotation_number")
      .ilike("quotation_number", `${prefix}%`)
      .order("quotation_number", { ascending: true });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const quotationNumbers = data ? data.map((row) => row.quotation_number) : [];

    return res.status(200).json({ quotationNumbers });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}