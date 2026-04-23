// /pages/api/activity/tsm/spf/update.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Siguraduhin na PUT method ang ginagamit
    if (req.method !== "PUT") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Kunin lamang ang ID at ang dalawang fields na kailangang i-update
        const { id, status, approved_by, date_approved_tsm, referenceid } = req.body;

        // Validation para sa ID
        if (!id) {
            return res.status(400).json({ error: "Missing SPF id" });
        }

        const updateData: any = {
            status,
            approved_by,
        };

        // Set date_approved_tsm when endorsing to Sales Head
        if (status === "Endorsed to Sales Head") {
            updateData.date_approved_tsm = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from("spf_request")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        // Log audit trail for TSM SPF status update
        await logAuditTrailWithSession(
            req,
            "update",
            "SPF request",
            id,
            data.spf_number || id,
            `TSM updated SPF status to ${status}`,
            { status, approved_by }
        );

        return res.status(200).json({ 
            success: true, 
            message: "SPF status and signatory updated successfully",
            updated: data 
        });

    } catch (err: any) {
        console.error("SPF Update Error:", err);
        return res.status(500).json({ 
            error: err.message || "Failed to update SPF" 
        });
    }
}