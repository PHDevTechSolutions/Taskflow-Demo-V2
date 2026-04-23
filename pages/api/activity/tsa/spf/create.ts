import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

function incrementSPF(spf: string) {
    const parts = spf.split("-");
    const num = parseInt(parts[parts.length - 1], 10) || 0;
    const next = num + 1;
    parts[parts.length - 1] = String(next).padStart(4, "0");
    return parts.join("-");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {

        const data = req.body;

        if (!data.spf_number || !data.customer_name || !data.referenceid) {
            return res.status(400).json({
                message: "SPF Number, Customer Name, and ReferenceID are required."
            });
        }

        let spfNumber = data.spf_number;
        let attempts = 0;

        while (attempts < 5) {

            const insertData = {
                spf_number: spfNumber,
                customer_name: data.customer_name,
                contact_person: data.contact_person ?? null,
                contact_number: data.contact_number ?? null,
                registered_address: data.registered_address ?? null,
                delivery_address: data.delivery_address ?? null,
                billing_address: data.billing_address ?? null,
                collection_address: data.collection_address ?? null,
                payment_terms: data.payment_terms ?? null,
                warranty: data.warranty ?? null,
                delivery_date: data.delivery_date ?? null,
                special_instructions: data.special_instructions ?? null,
                prepared_by: data.prepared_by ?? null,
                approved_by: data.approved_by ?? null,
                status: "Approval For TSM",
                tin_no: data.tin_no ?? null,
                sales_person: data.sales_person ?? null,
                referenceid: data.referenceid,
                tsm: data.tsm ?? null,
                manager: data.manager ?? null,
                item_description: data.item_description ?? null,
                item_photo: data.item_photo ?? null,
                start_date: data.start_date ? new Date(data.start_date) : null,
                end_date: data.end_date ? new Date(data.end_date) : null,
                date_created: new Date().toISOString(),
                date_request_tsa: new Date().toISOString(),
            };

            const { data: inserted, error } = await supabase
                .from("spf_request")
                .insert([insertData])
                .select();

            if (!error) {
                // Log audit trail for SPF creation
                await logAuditTrailWithSession(
                    req,
                    "create",
                    "SPF request",
                    inserted[0].id,
                    spfNumber,
                    `Created SPF request for ${data.customer_name}`,
                    { customer_name: data.customer_name, status: "Approval For TSM" }
                );

                return res.status(200).json({
                    message: "SPF record created successfully.",
                    record: inserted[0]
                });
            }

            // if duplicate SPF number
            if (error.code === "23505") {
                spfNumber = incrementSPF(spfNumber);
                attempts++;
                continue;
            }

            console.error("Supabase insert error:", error);
            return res.status(500).json({
                message: "Failed to insert SPF record.",
                error
            });
        }

        return res.status(500).json({
            message: "Unable to generate unique SPF number. Please try again."
        });

    } catch (err: any) {
        console.error("API error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
}