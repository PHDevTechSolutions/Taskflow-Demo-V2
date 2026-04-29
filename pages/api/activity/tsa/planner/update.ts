import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

// Allowed fields for inline editing
const ALLOWED_FIELDS = [
  "contact_person",
  "contact_number",
  "email_address",
  "address",
  "type_client",
  "ticket_reference_number",
  "ticket_remarks",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id } = req.query;
    const updates = req.body;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing or invalid ID" });
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Filter only allowed fields
    const filteredUpdates: Record<string, string | null> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        filteredUpdates[key] = updates[key] === "" ? null : updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Add date_updated timestamp
    filteredUpdates["date_updated"] = new Date().toISOString();

    const { data, error } = await supabase
      .from("activity")
      .update(filteredUpdates)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Log audit trail
    const updatedFields = Object.keys(updates).join(", ");
    await logAuditTrailWithSession(
      req,
      "update",
      "activity",
      id,
      `Updated fields: ${updatedFields}`,
      `Updated activity ${data[0]?.activity_reference_number || id} via inline edit`,
      filteredUpdates,
    );

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
