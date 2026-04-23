import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { supabase } from "@/utils/supabase";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

// Batch size for Supabase pagination
const BATCH_SIZE = 1000;

// Fetch ALL activities from Supabase (using cursor-based pagination)
async function fetchAllActivities() {
  const allActivities: any[] = [];
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("activity")
      .select("id, account_reference_number")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allActivities.push(...data);

    if (data.length < BATCH_SIZE) break;
    lastId = data[data.length - 1].id;
  }

  return allActivities;
}

export async function GET(req: Request) {
  try {
    // Fetch ALL accounts from Neon
    const allAccounts = await Xchire_sql`
      SELECT * FROM accounts 
      WHERE status IS NULL 
         OR (LOWER(status) != 'subject for transfer' 
         AND LOWER(status) != 'removed' 
         AND LOWER(status) != 'approved for deletion');
    `;

    // Fetch ALL activities from Supabase
    const allActivities = await fetchAllActivities();

    // Create Set of accounts that have activity
    const accountsWithActivity = new Set(
      allActivities
        .map((a) => a.account_reference_number?.toLowerCase())
        .filter(Boolean)
    );

    // Filter accounts with NO activity ever
    const noActivityAccounts = allAccounts.filter(
      (account: any) => !accountsWithActivity.has(account.account_reference_number?.toLowerCase())
    );

    return NextResponse.json(
      { 
        success: true, 
        data: noActivityAccounts,
        totalAccounts: allAccounts.length,
        totalWithActivity: accountsWithActivity.size,
        totalNoActivity: noActivityAccounts.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching no-activity accounts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch accounts." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
