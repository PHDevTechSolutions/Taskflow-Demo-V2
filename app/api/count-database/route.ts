import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
    throw new Error("TASKFLOW_DB_URL is not set");
}

const sql = neon(TASKFLOW_DB_URL);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const referenceid = searchParams.get("referenceid");

        if (!referenceid) {
            return NextResponse.json(
                { success: false, error: "referenceid is required" },
                { status: 400 }
            );
        }

        const result = await sql`
      SELECT COUNT(*)::text AS count
      FROM accounts
      WHERE referenceid = ${referenceid};
    `;

        const rows = result as { count: string }[];
        const count = Number(rows[0]?.count ?? 0);

        return NextResponse.json({ success: true, count }, { status: 200 });

    } catch (error: any) {
        console.error("Error counting companies:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}


export const dynamic = "force-dynamic";
