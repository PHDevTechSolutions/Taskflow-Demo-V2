import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { spf_number } = req.query;

    if (!spf_number || typeof spf_number !== "string") {
        return res.status(400).json({ message: "Missing or invalid spf_number" });
    }

    try {
        const { data, error } = await supabase
            .from("spf_creation")
            .select("*")
            .eq("spf_number", spf_number)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return res.status(404).json({ message: "No spf_creation record found" });
            }
            throw error;
        }

        return res.status(200).json({ data });
    } catch (err: any) {
        console.error("Server error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
