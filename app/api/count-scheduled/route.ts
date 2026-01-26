import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL!;
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

        // TODAY RANGE
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const rows = await sql`
            SELECT company_name
            FROM accounts
            WHERE referenceid = ${referenceid}
              AND next_available_date >= ${todayStart}
              AND next_available_date <= ${todayEnd}
            ORDER BY company_name ASC;
        `;

        return NextResponse.json({
            success: true,
            count: rows.length,
            companies: rows, // 👈 LIST
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
