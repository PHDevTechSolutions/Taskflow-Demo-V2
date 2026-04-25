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
    const { tsm } = req.query;

    if (!tsm || typeof tsm !== "string") {
      return res.status(400).json({ success: false, error: "Missing tsm" });
    }

    // Fetch all accounts for the tsm (all agents under this TSM)
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
        status,
        account_reference_number
      FROM accounts
      WHERE tsm = ${tsm}
        AND LOWER(status) = 'active'
      ORDER BY date_created DESC
    `;

    return res.status(200).json({
      success: true,
      data: accounts || [],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
}
