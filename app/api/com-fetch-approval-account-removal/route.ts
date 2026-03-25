import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) throw new Error("TASKFLOW_DB_URL is not set.");

const Xchire_sql = neon(Xchire_databaseUrl);
const DEFAULT_LIMIT = 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tsm    = url.searchParams.get("tsm");
    const limit  = parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const safeLimit  = isNaN(limit)  || limit < 1 ? DEFAULT_LIMIT : limit;
    const safeOffset = isNaN(offset) || offset < 0 ? 0 : offset;

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing TSM ID." }, { status: 400 });
    }

    // ✅ Safer query: trim & lower, deduplicate by company_name
    const accounts = await Xchire_sql`
      SELECT DISTINCT ON (company_name) *
      FROM accounts
      WHERE TRIM(LOWER(tsm)) = LOWER(${tsm})
      ORDER BY company_name, date_removed ASC, id ASC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset};
    `;

    return NextResponse.json({ success: true, data: accounts }, { status: 200 });

  } catch (err: any) {
    console.error("Error fetching accounts:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch accounts." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";