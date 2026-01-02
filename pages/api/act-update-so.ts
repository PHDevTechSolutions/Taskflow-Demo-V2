import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id, so_number, so_amount } = req.body;

    /* =======================
       VALIDATION
    ======================= */
    if (!id) {
      return res.status(400).json({ error: "Missing ID" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    if (!so_number || typeof so_number !== "string") {
      return res.status(400).json({ error: "Invalid SO Number" });
    }

    if (
      so_amount === undefined ||
      so_amount === null ||
      isNaN(Number(so_amount))
    ) {
      return res.status(400).json({ error: "Invalid SO Amount" });
    }

    /* =======================
       1️⃣ GET ORIGINAL RECORD
    ======================= */
    const { data: original, error: fetchError } = await supabase
      .from("history")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({ error: "Original record not found" });
    }

    /* =======================
       2️⃣ CREATE DUPLICATE RECORD
    ======================= */
    const { id: _, ...copyData } = original; // remove id

    const { data: newRecord, error: insertError } = await supabase
      .from("history")
      .insert({
        ...copyData,
        so_number: so_number.toUpperCase(),
        so_amount: Number(so_amount),
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: insertError.message });
    }

    /* =======================
       3️⃣ ZERO OUT OLD SO AMOUNT
    ======================= */
    const { error: updateOldError } = await supabase
      .from("history")
      .update({
        so_amount: 0,
      })
      .eq("id", id);

    if (updateOldError) {
      console.error("Update old record error:", updateOldError);
      return res.status(500).json({ error: updateOldError.message });
    }

    /* =======================
       SUCCESS RESPONSE
    ======================= */
    return res.status(200).json({
      success: true,
      message: "Re-Sales Order created successfully",
      old_id: id,
      new_record: newRecord,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
