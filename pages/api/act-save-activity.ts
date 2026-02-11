import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import redis from "../../lib/redis";

const safe = (v: any) => (v === undefined || v === "" ? null : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      activity_reference_number,
      account_reference_number,
      ticket_reference_number,
      status,
      type_activity,
      referenceid,
      tsm,
      manager,
      target_quota,
      type_client,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      source,
      callback,
      call_status,
      call_type,
      product_category,
      product_quantity,
      product_amount,
      product_description,
      product_photo,
      product_sku,
      product_title,
      project_type,
      project_name,
      quotation_number,
      quotation_amount,
      quotation_type,
      so_number,
      so_amount,
      si_date,
      dr_number,
      actual_sales,
      payment_terms,
      delivery_date,
      date_followup,
      remarks,
      agent,
      start_date,
      end_date,
    } = req.body;

    // Basic required field validation
    if (!activity_reference_number)
      return res.status(400).json({ error: "Missing activity_reference_number" });
    if (!account_reference_number)
      return res.status(400).json({ error: "Missing account_reference_number" });
    if (!status) return res.status(400).json({ error: "Missing status" });
    if (!type_activity)
      return res.status(400).json({ error: "Missing type_activity" });

    // Validate product fields if provided, all should be strings (likely CSV or JSON string)
    const productFields = {
      product_category,
      product_quantity,
      product_amount,
      product_description,
      product_photo,
      product_sku,
      product_title,
    };

    for (const [key, value] of Object.entries(productFields)) {
      if (value !== undefined && typeof value !== "string") {
        return res.status(400).json({ error: `Invalid ${key} format, must be string` });
      }
    }

    // Validate lengths of product-related arrays if all present
    if (
      product_category &&
      product_quantity &&
      product_amount &&
      product_description &&
      product_photo &&
      product_sku &&
      product_title
    ) {
      const categories = product_category.split(",");
      const quantities = product_quantity.split(",");
      const amounts = product_amount.split(",");
      const descriptions = product_description.split("||"); // assuming you joined descriptions with "||"
      const photos = product_photo.split(",");
      const skus = product_sku.split(",");
      const titles = product_title.split(",");

      const lengthSet = new Set([
        categories.length,
        quantities.length,
        amounts.length,
        descriptions.length,
        photos.length,
        skus.length,
        titles.length,
      ]);

      if (lengthSet.size !== 1) {
        return res.status(400).json({ error: "Product arrays length mismatch" });
      }
    }

    // Check cache for existing entry
    const cacheKey = `history:${activity_reference_number}`;
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({ success: true, data: JSON.parse(cached), cached: true });
    }

    // Insert into Supabase "history" table
    const { data, error } = await supabase
      .from("history")
      .insert({
        referenceid: safe(referenceid),
        tsm: safe(tsm),
        manager: safe(manager),
        target_quota: safe(target_quota),
        type_client: safe(type_client),
        company_name: safe(company_name),
        contact_person: safe(contact_person),
        contact_number: safe(contact_number),
        email_address: safe(email_address),
        address: safe(address),
        activity_reference_number,
        account_reference_number,
        ticket_reference_number,
        status,
        type_activity,
        source: safe(source),
        callback: safe(callback),
        call_status: safe(call_status),
        call_type: safe(call_type),

        product_category: safe(product_category),
        product_quantity: safe(product_quantity),
        product_amount: safe(product_amount),
        product_description: safe(product_description),
        product_photo: safe(product_photo),
        product_sku: safe(product_sku),
        product_title: safe(product_title),

        project_type: safe(project_type),
        project_name: safe(project_name),
        quotation_number: safe(quotation_number),
        quotation_amount: safe(quotation_amount),
        quotation_type: safe(quotation_type),
        so_number: safe(so_number),
        so_amount: safe(so_amount),
        si_date: safe(si_date),
        dr_number: safe(dr_number),
        actual_sales: safe(actual_sales),
        payment_terms: safe(payment_terms),
        delivery_date: safe(delivery_date),
        date_followup: safe(date_followup),
        remarks: safe(remarks),
        start_date: safe(start_date),
        end_date: safe(end_date),
        agent: safe(agent),

      })
      .select();

    if (error) {
      console.error("Supabase Insert Error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Cache inserted data for 5 minutes
    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    return res.status(200).json({ success: true, data, cached: false });
  } catch (err: any) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
}
