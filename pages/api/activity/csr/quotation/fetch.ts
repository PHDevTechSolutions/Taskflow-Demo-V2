import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { from, to } = req.query;

    const fromDate = typeof from === "string" ? from : undefined;
    const toDate = typeof to === "string" ? to : undefined;

    try {
        let allHistory: any[] = [];
        let fromIndex = 0;

        // -----------------------------
        // 1️⃣ FETCH HISTORY IN BATCHES
        // -----------------------------
        while (true) {
            let query = supabase
                .from("history")
                .select("*")
                .order("date_created", { ascending: false })
                .range(fromIndex, fromIndex + BATCH_SIZE - 1);

            if (fromDate && toDate) {
                query = query.gte("date_created", fromDate).lte("date_created", toDate);
            }

            const { data, error } = await query;

            if (error) {
                return res.status(500).json({ message: error.message });
            }

            if (!data || data.length === 0) break;

            allHistory = [...allHistory, ...data];

            if (data.length < BATCH_SIZE) break;

            fromIndex += BATCH_SIZE;
        }

        if (allHistory.length === 0) {
            return res.status(200).json({ activities: [] });
        }

        // -----------------------------
        // 2️⃣ FETCH SIGNATORIES IN BATCH
        // -----------------------------
        const quotationNumbers = allHistory
            .map((h) => h.quotation_number)
            .filter(Boolean);

        let allSignatories: any[] = [];
        let sigIndex = 0;

        while (true) {
            const slice = quotationNumbers.slice(sigIndex, sigIndex + BATCH_SIZE);
            if (slice.length === 0) break;

            const { data, error } = await supabase
                .from("signatories")
                .select("*")
                .in("quotation_number", slice);

            if (error) {
                return res.status(500).json({ message: error.message });
            }

            if (data) {
                allSignatories = [...allSignatories, ...data];
            }

            sigIndex += BATCH_SIZE;
        }

        // -----------------------------
        // 3️⃣ MERGE DATA
        // -----------------------------
        const mergedData = allHistory.map((h) => {
            const sig = allSignatories.find(
                (s) => s.quotation_number === h.quotation_number
            );

            return {
                ...h,
                agent_name: sig?.agent_name || null,
                agent_signature: sig?.agent_signature || null,
                agent_contact_number: sig?.agent_contact_number || null,
                agent_email_address: sig?.agent_email_address || null,
                tsm_name: sig?.tsm_name || null,
                tsm_approval_date: sig?.tsm_approval_date || null,
                tsm_remarks: sig?.tsm_remarks || null,
            };
        });

        return res.status(200).json({
            activities: mergedData,
            total: mergedData.length,
        });

    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}