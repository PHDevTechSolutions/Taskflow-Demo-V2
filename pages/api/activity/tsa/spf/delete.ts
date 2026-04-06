// /pages/api/activity/tsa/spf/delete.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { id, referenceid } = req.body;
        if (!id) return res.status(400).json({ error: "Missing SPF id" });

        const { data, error } = await supabase
            .from("spf_request")
            .delete()
            .eq("id", id);

        if (error) throw error;

        // Log audit trail for SPF deletion
        await logAuditTrailWithSession(
            req,
            "delete",
            "SPF request",
            id,
            `Deleted SPF record`,
            `Deleted SPF request`,
            { deletedId: id }
        );

        return res.status(200).json({ success: true, deleted: data });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Failed to delete SPF" });
    }
}