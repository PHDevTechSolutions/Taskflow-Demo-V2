import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { quotation_number, tsm_approved_status, contact, email, signature } = req.body;

  // -----------------------------
  // 1️⃣ Validate input
  // -----------------------------
  if (!quotation_number || typeof quotation_number !== "string") {
    return res.status(400).json({ message: "Missing or invalid quotation_number" });
  }

  if (!tsm_approved_status || !["Approved", "Decline"].includes(tsm_approved_status)) {
    return res.status(400).json({ message: "Invalid tsm_approved_status" });
  }

  try {
    // -----------------------------
    // 2️⃣ Update history table by quotation_number
    // -----------------------------
    const { data: historyData, error: historyError } = await supabase
      .from("history")
      .update({ tsm_approved_status })
      .eq("quotation_number", quotation_number)
      .select();

    if (historyError) return res.status(500).json({ message: historyError.message });
    if (!historyData || historyData.length === 0) {
      return res.status(404).json({ message: "No matching history record found" });
    }

    const historyRow = historyData[0];

    // -----------------------------
    // 3️⃣ Fetch signatory by quotation_number
    // -----------------------------
    const { data: signatoryData, error: signatoryFetchError } = await supabase
      .from("signatories")
      .select("*")
      .eq("quotation_number", quotation_number);

    if (signatoryFetchError) return res.status(500).json({ message: signatoryFetchError.message });
    if (!signatoryData || signatoryData.length === 0) {
      return res.status(404).json({ message: "No matching signatory record found" });
    }

    const signatoryRow = signatoryData[0];

    // -----------------------------
    // 4️⃣ Update signatory using primary key (id)
    // -----------------------------
    const { data: updatedSignatory, error: signatoryUpdateError } = await supabase
      .from("signatories")
      .update({
        tsm_contact_number: contact ?? null,
        tsm_email_address: email ?? null,
        tsm_signature: signature ?? null,
      })
      .eq("id", signatoryRow.id)
      .select();

    if (signatoryUpdateError) return res.status(500).json({ message: signatoryUpdateError.message });

    // -----------------------------
    // 5️⃣ Return success
    // -----------------------------
    return res.status(200).json({
      success: true,
      history: historyRow,
      signatory: updatedSignatory[0],
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}