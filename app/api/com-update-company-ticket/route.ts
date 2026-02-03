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
    const { account_reference_number, referenceid, tsm, manager } = body;

    if (!account_reference_number || !referenceid || !tsm || !manager) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: account_reference_number, referenceid, or manager",
        },
        { status: 400 }
      );
    }

    const updated = await Xchire_sql`
      UPDATE accounts
      SET
        referenceid = ${referenceid},
        manager = ${manager},
        tsm = ${tsm}
      WHERE account_reference_number = ${account_reference_number}
      RETURNING id, account_reference_number, referenceid, manager, tsm;
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
    console.error("Error updating account referenceid and manager:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update account referenceid and manager.",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
