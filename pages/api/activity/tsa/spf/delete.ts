// /pages/api/activity/tsa/spf/delete.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Missing SPF id" });

        const { data, error } = await supabase
            .from("spf_request")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return res.status(200).json({ success: true, deleted: data });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Failed to delete SPF" });
    }
}