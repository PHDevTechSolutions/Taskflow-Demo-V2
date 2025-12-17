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
    const { ids, status, transfer_to } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "IDs array is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (typeof status !== "string" || !status.trim()) {
      return NextResponse.json(
        { success: false, error: "Status is required." },
        { status: 400 }
      );
    }

    if (typeof transfer_to !== "string" || !transfer_to.trim()) {
      return NextResponse.json(
        { success: false, error: "transfer_to is required." },
        { status: 400 }
      );
    }

    await Xchire_sql`
      UPDATE accounts
      SET status = ${status}, transfer_to = ${transfer_to}, date_transferred = NOW()
      WHERE id = ANY(${ids});
    `;

    return NextResponse.json(
      { success: true, message: "Accounts transferred successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error transferring accounts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error transferring accounts" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
