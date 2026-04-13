import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

type Data = {
  success: boolean;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { ids } = req.body as { ids: number[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No IDs provided" });
    }

    // --- Replace below with your DB delete logic ---
    // Example Supabase:
    const { error } = await supabase
      .from("history") // table name
      .delete()
      .in("id", ids);

    if (error) {
      throw error;
    }

    // Log audit trail for deletion
    const { type_activity, company_name } = req.body;
    await logAuditTrailWithSession(
      req,
      "delete",
      "activity",
      ids.join(", "),
      `Deleted ${ids.length} record(s)`,
      `Deleted ${type_activity || "activity"} records`,
      { deletedIds: ids, companyName: company_name }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Delete activities error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
