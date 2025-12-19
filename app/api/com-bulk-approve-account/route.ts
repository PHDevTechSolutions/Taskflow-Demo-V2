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
        const { ids, status } = body;

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

        // Generate placeholders like $1, $2, ..., for the ids
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

        // Status param will be at position ids.length + 1
        // date_approved is set to CURRENT_DATE or NOW()
        const query = `
          UPDATE accounts
          SET status = $${ids.length + 1},
              date_approved = NOW()
          WHERE id IN (${placeholders})
          RETURNING *;
        `;

        const params = [...ids, status];

        const updatedRows = await Xchire_sql.query(query, params);

        if (updatedRows.length === 0) {
            return NextResponse.json(
                { success: false, error: "No accounts updated. IDs may not exist." },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, updatedCount: updatedRows.length, data: updatedRows },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error bulk approve accounts:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to bulk approve accounts." },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
