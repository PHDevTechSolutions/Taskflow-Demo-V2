import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

function formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

async function fetchOverdueActivities(referenceid: string, fromDate: string, toDate: string) {
    let allData: any[] = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from("activity")
            .select("*")
            .eq("referenceid", referenceid)
            .gte("scheduled_date", fromDate)
            .lte("scheduled_date", toDate)
            .eq("status", "Assisted"); // only Assisted

        if (error) throw error;

        allData.push(...(data || []));

        if (!data || data.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }

    // sort by scheduled_date ascending
    return allData.sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { referenceid, from, to } = req.query;

    if (!referenceid || typeof referenceid !== "string") {
        return res.status(400).json({ message: "Missing or invalid referenceid" });
    }

    const today = formatDate(new Date());
    const fromDate = typeof from === "string" ? from : today;
    const toDate = typeof to === "string" ? to : today;

    try {
        const overdueActivities = await fetchOverdueActivities(referenceid, fromDate, toDate);
        return res.status(200).json({ activities: overdueActivities });
    } catch (err: any) {
        console.error("Server error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
