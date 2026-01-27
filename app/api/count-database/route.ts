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

        // Query to get total count and counts grouped by type_client
        const result = await sql`
          SELECT 
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE LOWER(type_client) = 'top 50')::int AS top_50_count,
            COUNT(*) FILTER (WHERE LOWER(type_client) = 'next 30')::int AS next_30_count,
            COUNT(*) FILTER (WHERE LOWER(type_client) = 'balance 20')::int AS balance_20_count,
            COUNT(*) FILTER (WHERE LOWER(type_client) = 'csr client')::int AS csr_client_count,
            COUNT(*) FILTER (WHERE LOWER(type_client) = 'tsa client')::int AS tsa_client_count
          FROM accounts
          WHERE referenceid = ${referenceid};
        `;

        const row = result[0];

        return NextResponse.json({
            success: true,
            totalCount: row.total_count,
            top50Count: row.top_50_count,
            next30Count: row.next_30_count,
            balance20Count: row.balance_20_count,
            csrClientCount: row.csr_client_count,
            tsaClientCount: row.tsa_client_count,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Error counting companies:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
