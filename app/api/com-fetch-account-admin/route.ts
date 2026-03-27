// /api/com-fetch-cluster-account-manager/route.ts

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

const DEFAULT_LIMIT = 1000;

export async function GET(req: Request) {
  try {
    const Xchire_url = new URL(req.url);
    const limit  = parseInt(Xchire_url.searchParams.get("limit")  ?? `${DEFAULT_LIMIT}`, 10);
    const offset = parseInt(Xchire_url.searchParams.get("offset") ?? "0", 10);

    const safeLimit  = isNaN(limit)  || limit  < 1 ? DEFAULT_LIMIT : limit;
    const safeOffset = isNaN(offset) || offset < 0 ? 0             : offset;

    // ── Super Admin behavior: Fetch ALL active accounts ──
    const Xchire_fetch = await Xchire_sql`
        SELECT *
        FROM accounts
        WHERE LOWER(status) = 'active'
        ORDER BY date_created ASC, id ASC
        LIMIT ${safeLimit}
        OFFSET ${safeOffset};
    `;

    return NextResponse.json(
      { success: true, data: Xchire_fetch },
      { status: 200 }
    );

  } catch (Xchire_error: any) {
    console.error("Error fetching accounts:", Xchire_error);
    return NextResponse.json(
      { success: false, error: Xchire_error.message || "Failed to fetch accounts." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";