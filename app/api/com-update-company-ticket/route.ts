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
    const { account_reference_number, referenceid } = body;

    if (!account_reference_number || !referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: account_reference_number or referenceid" },
        { status: 400 }
      );
    }

    const updated = await Xchire_sql`
      UPDATE accounts
      SET referenceid = ${referenceid}
      WHERE account_reference_number = ${account_reference_number}
      RETURNING id, account_reference_number, referenceid;
    `;

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Account not found or no changes applied." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: updated[0] },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Error updating company ticket referenceid:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update company ticket referenceid." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
