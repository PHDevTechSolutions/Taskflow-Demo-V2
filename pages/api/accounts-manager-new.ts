import type { NextApiRequest, NextApiResponse } from "next";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.TASKFLOW_DB_URL;

if (!DATABASE_URL) {
  throw new Error("TASKFLOW_DB_URL is not set");
}

const sql = neon(DATABASE_URL);

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { manager, limit, offset } = req.query;

    if (!manager || typeof manager !== "string") {
      return res.status(400).json({ success: false, error: "Missing manager" });
    }

    // Parse pagination params
    const pageLimit = Math.min(
      parseInt(limit as string) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const pageOffset = parseInt(offset as string) || 0;

    // Fetch accounts with pagination
    const accounts = await sql`
      SELECT 
        id,
        referenceid,
        tsm,
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
      WHERE manager = ${manager}
        AND LOWER(status) = 'active'
      ORDER BY date_created DESC
      LIMIT ${pageLimit}
      OFFSET ${pageOffset}
    `;

    // Get total count for pagination metadata
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM accounts
      WHERE manager = ${manager}
        AND LOWER(status) = 'active'
    `;
    const totalCount = parseInt(countResult[0]?.total || '0', 10);

    return res.status(200).json({
      success: true,
      data: accounts || [],
      pagination: {
        total: totalCount,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: totalCount > pageOffset + pageLimit,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
}
