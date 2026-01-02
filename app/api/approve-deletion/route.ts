import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.TASKFLOW_DB_URL;
if (!DATABASE_URL) throw new Error("TASKFLOW_DB_URL is not set");

const sql = neon(DATABASE_URL);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");
    if (!referenceid)
      return NextResponse.json({ success: false, error: "Missing referenceid" }, { status: 400 });

    // Get today's date in YYYY-MM-DD (UTC)
    const today = new Date().toISOString().split("T")[0];

    // Query for transfers where date_transferred is today AND status = 'Active'
    const deletion = await sql`
      SELECT company_name, date_removed, status, remarks, referenceid
      FROM accounts
      WHERE tsm = ${referenceid}
        AND status = 'Removed'
        AND TO_CHAR(date_removed::date, 'YYYY-MM-DD') = ${today};
    `;

    return NextResponse.json({ success: true, data: deletion }, { status: 200 });
  } catch (error) {
    console.error("Active transfers API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch active transfers" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
