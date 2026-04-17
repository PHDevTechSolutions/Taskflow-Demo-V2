import type { NextApiRequest, NextApiResponse } from "next";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.TASKFLOW_DB_URL;

if (!DATABASE_URL) {
  throw new Error("TASKFLOW_DB_URL is not set");
}

const sql = neon(DATABASE_URL);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { referenceid } = req.query;

    if (!referenceid || typeof referenceid !== "string") {
      return res.status(400).json({ success: false, error: "Missing referenceid" });
    }

    // Fetch all accounts for the referenceid
    const accounts = await sql`
      SELECT 
        id,
        referenceid,
        company_name,
        type_client,
        date_created,
        contact_person,
        contact_number,
        email_address,
        address,
        delivery_address,
        region,
        industry,
        status
      FROM accounts
      WHERE referenceid = ${referenceid}
      ORDER BY date_created DESC
    `;

    return res.status(200).json({
      success: true,
      data: accounts || [],
    });
  } catch (error: any) {
    console.error("Accounts API error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
}
