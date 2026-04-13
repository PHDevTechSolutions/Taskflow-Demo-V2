import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    quotation_number,
    tsm_approved_status,
    manager_remarks,
    contact,
    email,
    signature,
  } = req.body;

  // -----------------------------
  // 1️⃣ Validate input
  // -----------------------------
  if (!quotation_number || typeof quotation_number !== "string") {
    return res.status(400).json({ message: "Missing or invalid quotation_number" });
  }

  if (!["Approved By Sales Head", "Decline By Sales Head"].includes(tsm_approved_status)) {
    return res.status(400).json({ message: "Invalid tsm_approved_status" });
  }

  if (
    tsm_approved_status === "Decline By Sales Head" &&
    (!manager_remarks || !manager_remarks.trim())
  ) {
    return res
      .status(400)
      .json({ message: "Manager remarks is required when declining" });
  }

  try {
    const now = new Date().toISOString();

    // -----------------------------
    // 2️⃣ Update HISTORY (ONLY tsm_approved_status)
    // -----------------------------
    const { data: historyData, error: historyError } = await supabase
      .from("history")
      .update({
        tsm_approved_status,
      })
      .eq("quotation_number", quotation_number)
      .select();

    if (historyError) {
      return res.status(500).json({ message: historyError.message });
    }

    if (!historyData || historyData.length === 0) {
      return res.status(404).json({ message: "No matching history record found" });
    }

    // -----------------------------
    // 3️⃣ Fetch SIGNATORY by quotation_number
    // -----------------------------
    const { data: signatory, error: signatoryFetchError } = await supabase
      .from("signatories")
      .select("id")
      .eq("quotation_number", quotation_number)
      .single();

    if (signatoryFetchError) {
      return res.status(500).json({ message: signatoryFetchError.message });
    }

    // -----------------------------
    // 4️⃣ Update SIGNATORIES (contact, email, signature, remarks & approval date)
    // -----------------------------
    const { data: updatedSignatory, error: signatoryUpdateError } =
      await supabase
        .from("signatories")
        .update({
          manager_contact_number: contact ?? null,
          manager_email_address: email ?? null,
          manager_signature:
            tsm_approved_status === "Decline By Sales Head"
              ? null
              : signature ?? null,
          manager_remarks:
            tsm_approved_status === "Decline By Sales Head"
              ? manager_remarks
              : manager_remarks ?? null,
          manager_approval_date: now,
        })
        .eq("id", signatory.id)
        .select();

    if (signatoryUpdateError) {
      return res.status(500).json({ message: signatoryUpdateError.message });
    }

    // ------------------------------
    // Log audit trail for manager quotation approval
    await logAuditTrailWithSession(
      req,
      "update",
      "quotation approval",
      quotation_number,
      quotation_number,
      `Manager ${tsm_approved_status === "Approved By Sales Head" ? "approved" : "declined"} quotation`,
      { status: tsm_approved_status, manager_remarks }
    );

    // ------------------------------
    // 6️⃣ Success
    // ------------------------------
    return res.status(200).json({
      success: true,
      history: historyData[0], // status updated
      signatory: updatedSignatory?.[0] ?? null, // remarks + date updated
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}