import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in environment variables.");
}

const sql = neon(TASKFLOW_DB_URL);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const companyNameRaw = url.searchParams.get("company_name");

    if (!companyNameRaw || companyNameRaw.trim().length < 3) {
      return NextResponse.json(
        { exists: false, companies: [], error: "Invalid or missing company_name." },
        { status: 400 }
      );
    }

    // Clean the input similarly to your client-side cleanCompanyName function
    let cleaned = companyNameRaw.toUpperCase();
    cleaned = cleaned.replace(/[-_.]/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/\d+$/g, "");
    cleaned = cleaned.trim();

    // Query DB for possible duplicates (case-insensitive fuzzy match)
    const resultsRaw = await sql`
      SELECT company_name, contact_person, contact_number, referenceid AS owner_referenceid
      FROM accounts
      WHERE company_name ILIKE ${`%${cleaned}%`}
      LIMIT 10;
    `;

    if (resultsRaw.length === 0) {
      return NextResponse.json({ exists: false, companies: [] }, { status: 200 });
    }

    // Convert contact_person and contact_number from comma-separated strings to arrays
    const results = resultsRaw.map((row: any) => ({
      company_name: row.company_name,
      owner_referenceid: row.owner_referenceid,
      contact_person: row.contact_person
        ? row.contact_person.split(",").map((s: string) => s.trim())
        : [],
      contact_number: row.contact_number
        ? row.contact_number.split(",").map((s: string) => s.trim())
        : [],
    }));

    return NextResponse.json({ exists: true, companies: results }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/accounts/check-duplicate:", error);
    return NextResponse.json(
      { exists: false, companies: [], error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
