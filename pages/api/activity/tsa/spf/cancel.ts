import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { id, is_cancelled_reason, is_cancelled_reason_others_remarks } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID is required" });
        }

        if (!is_cancelled_reason) {
            return res.status(400).json({ message: "Cancellation reason is required" });
        }

        // First, get the spf_number from the record being cancelled
        const { data: spfRecord, error: fetchError } = await supabase
            .from("spf_request")
            .select("spf_number")
            .eq("id", id)
            .single();

        if (fetchError || !spfRecord) {
            console.error("Error fetching SPF record:", fetchError);
            return res.status(500).json({ message: "Failed to fetch SPF record" });
        }

        const spfNumber = spfRecord.spf_number;

        // Update the SPF record with cancellation details
        const { data, error } = await supabase
            .from("spf_request")
            .update({
                is_cancelled: true,
                is_cancelled_reason: is_cancelled_reason,
                is_cancelled_reason_others_remarks: is_cancelled_reason_others_remarks || null,
                date_updated: new Date().toISOString(),
            })
            .eq("id", id)
            .select();

        if (error) {
            console.error("Error cancelling SPF:", error);
            return res.status(500).json({ message: "Failed to cancel SPF" });
        }

        // Also update the status in spf_creation table (disruptive-product-database)
        try {
            // First, fetch current spf_creation data to duplicate for version history
            const { data: currentCreation, error: fetchCreationError } = await supabase
                .from("spf_creation")
                .select("*")
                .eq("spf_number", spfNumber)
                .maybeSingle();

            if (fetchCreationError) {
                console.error("Error fetching spf_creation data:", fetchCreationError);
            }

            // Get current version number
            const { data: historyRows } = await supabase
                .from("spf_creation_history")
                .select("version_number")
                .eq("spf_number", spfNumber)
                .order("version_number", { ascending: false })
                .limit(1);

            const lastVersion = historyRows && historyRows.length > 0 ? historyRows[0].version_number : 0;
            const nextVersion = lastVersion + 1;

            // Create version history entry with Cancelled status
            if (currentCreation) {
                const nowISO = new Date().toISOString();
                await supabase.from("spf_creation_history").insert({
                    spf_number: spfNumber,
                    version_number: nextVersion,
                    version_label: `${spfNumber}_v${nextVersion}`,
                    created_at: nowISO,
                    edited_by: "System",
                    item_added_author: "System",
                    date_updated: nowISO,
                    status: "Cancelled",
                    supplier_brand: currentCreation.supplier_brand,
                    product_offer_image: currentCreation.product_offer_image,
                    product_offer_qty: currentCreation.product_offer_qty,
                    product_offer_technical_specification: currentCreation.product_offer_technical_specification,
                    original_technical_specification: currentCreation.original_technical_specification,
                    product_reference_id: currentCreation.product_reference_id,
                    supplier_branch: currentCreation.supplier_branch,
                    commercial_type: currentCreation.commercial_type,
                    product_name: currentCreation.product_name,
                    product_offer_unit_cost: currentCreation.product_offer_unit_cost,
                    product_offer_pcs_per_carton: currentCreation.product_offer_pcs_per_carton,
                    product_offer_packaging_details: currentCreation.product_offer_packaging_details,
                    warranty: currentCreation.warranty,
                    product_offer_factory_address: currentCreation.product_offer_factory_address,
                    product_offer_port_of_discharge: currentCreation.product_offer_port_of_discharge,
                    product_offer_subtotal: currentCreation.product_offer_subtotal,
                    spf_remarks_pd: currentCreation.spf_remarks_pd,
                    company_name: currentCreation.company_name,
                    contact_name: currentCreation.contact_name,
                    contact_number: currentCreation.contact_number,
                    final_selling_cost: currentCreation.final_selling_cost,
                    proj_lead_time: currentCreation.proj_lead_time,
                    price_validity: currentCreation.price_validity,
                    tds: currentCreation.tds,
                    dimensional_drawing: currentCreation.dimensional_drawing,
                    illuminance_drawing: currentCreation.illuminance_drawing,
                    spf_creation_start_time: null,
                    spf_creation_end_time: null,
                    referenceid: currentCreation.referenceid,
                    tsm: currentCreation.tsm,
                    manager: currentCreation.manager,
                    item_code: currentCreation.item_code,
                });
            }

            // Update spf_creation status to Cancelled
            const { error: spfCreationError } = await supabase
                .from("spf_creation")
                .update({
                    status: "Cancelled",
                    date_updated: new Date().toISOString(),
                })
                .eq("spf_number", spfNumber);

            if (spfCreationError) {
                console.error("Error updating spf_creation status:", spfCreationError);
                // Don't fail the request if spf_creation update fails, just log it
            }
        } catch (spfCreationErr) {
            console.error("Error updating spf_creation:", spfCreationErr);
            // Don't fail the request if spf_creation update fails, just log it
        }

        return res.status(200).json({ message: "SPF cancelled successfully", data });
    } catch (error) {
        console.error("Error in cancel SPF API:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
