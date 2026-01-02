import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { ids, status, remarks } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing or empty 'ids' array." },
        { status: 400 }
      );
    }
    if (typeof status !== "string" || !status.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'status'." },
        { status: 400 }
      );
    }
    if (typeof remarks !== "string" || !remarks.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'remarks'." },
        { status: 400 }
      );
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      UPDATE accounts
      SET status = $${ids.length + 1}, 
          remarks = $${ids.length + 2}, 
          date_removed = now()
      WHERE id IN (${placeholders})
      RETURNING *;
    `;

    const params = [...ids, status, remarks];

    const updated = await Xchire_sql.query(query, params);

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "No accounts updated. IDs may not exist." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, updatedCount: updated.length, data: updated },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error bulk removing accounts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to bulk remove accounts." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
