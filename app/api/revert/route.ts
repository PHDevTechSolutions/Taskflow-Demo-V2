import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

export async function PUT(req: Request) {
  const body = await req.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing or empty 'ids' array." },
      { status: 400 }
    );
  }

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

  const query = `
    UPDATE accounts
    SET status = 'Active'
    WHERE id IN (${placeholders})
      AND status = 'Removed'
    RETURNING id, company_name, status;
  `;

  const updatedRows = await Xchire_sql.query(query, ids);

  if (updatedRows.length === 0) {
    return NextResponse.json(
      { success: false, error: "No accounts updated." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, updatedCount: updatedRows.length },
    { status: 200 }
  );
}

export const dynamic = "force-dynamic";
