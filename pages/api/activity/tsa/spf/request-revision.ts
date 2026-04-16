import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { spf_number, revision_type, revision_remarks } = req.body;

        if (!spf_number) {
            return res.status(400).json({ message: "spf_number is required" });
        }

        const updateData: any = {
            status: "For Revision",
            date_updated: new Date().toISOString()
        };

        if (revision_type) updateData.revision_type = revision_type;
        if (revision_remarks) updateData.revision_remarks = revision_remarks;

        const { data, error } = await supabase
            .from("spf_creation")
            .update(updateData)
            .eq("spf_number", spf_number)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ message: "No spf_creation record found" });
        }

        return res.status(200).json({
            success: true,
            message: "Status updated to For Revision",
            data
        });
    } catch (err: any) {
        console.error("Server error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
