// /pages/api/activity/tsa/spf/update.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

    try {
        const {
            id,
            spf_number,
            customer_name,
            contact_person,
            contact_number,
            registered_address,
            delivery_address,
            billing_address,
            collection_address,
            payment_terms,
            warranty,
            delivery_date,
            special_instructions,
            tin_no,
            sales_person,
            prepared_by,
            approved_by,
            referenceid,
            tsm,
            manager,
            item_description,
            item_photo,
            item_code
        } = req.body;

        if (!id) return res.status(400).json({ error: "Missing SPF id" });

        const { data, error } = await supabase
            .from("spf_request")
            .update({
                spf_number,
                customer_name,
                contact_person,
                contact_number,
                registered_address,
                delivery_address,
                billing_address,
                collection_address,
                payment_terms,
                warranty,
                special_instructions,
                tin_no,
                sales_person,
                delivery_date,
                prepared_by,
                approved_by,
                referenceid,
                tsm,
                manager,
                item_description,
                item_photo,
                item_code
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        // Log audit trail for SPF update
        await logAuditTrailWithSession(
            req,
            "update",
            "SPF request",
            id,
            spf_number,
            `Updated SPF request for ${customer_name}`,
            { spf_number, customer_name }
        );

        return res.status(200).json({ success: true, updated: data });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Failed to update SPF" });
    }
}