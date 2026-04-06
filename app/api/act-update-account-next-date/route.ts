import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, next_available_date } = body;

    if (!id || !next_available_date) {
      return NextResponse.json(
        { success: false, error: "Missing id or next_available_date" },
        { status: 400 }
      );
    }

    const result = await Xchire_sql`
      UPDATE accounts
      SET next_available_date = ${next_available_date}
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Account not found or not updated" },
        { status: 404 }
      );
    }

    // Log audit trail for next available date update
    await logAuditTrailApp(
      req,
      "update",
      "account next date",
      id,
      `Account ID: ${id}`,
      `Updated next available date to ${next_available_date}`,
      { next_available_date }
    );

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating next_available_date:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; // always fetch latest
