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

// Fetch ALL activities for referenceid (cursor-based pagination)
async function fetchAllActivitiesForReferenceId(referenceid: string) {
  const allActivities: any[] = [];
  let lastId: number | null = null;

  while (true) {
    let query = supabase
      .from("activity")
      .select("id, activity_reference_number, company_name, referenceid")
      .eq("referenceid", referenceid)
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

// Fetch ALL history entries linked to activities (cursor-based pagination)
async function fetchAllHistoryForActivities(activityRefNumbers: string[]) {
  if (activityRefNumbers.length === 0) return [];
  
  const allHistory: any[] = [];
  const uniqueRefs = [...new Set(activityRefNumbers)];
  
  // Process in chunks to avoid Supabase limits
  const CHUNK_SIZE = 500;
  for (let i = 0; i < uniqueRefs.length; i += CHUNK_SIZE) {
    const chunk = uniqueRefs.slice(i, i + CHUNK_SIZE);
    
    let lastId: number | null = null;
    while (true) {
      let query = supabase
        .from("history")
        .select("id, activity_reference_number, company_name")
        .in("activity_reference_number", chunk)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastId !== null) query = query.gt("id", lastId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      allHistory.push(...data);

      if (data.length < BATCH_SIZE) break;
      lastId = data[data.length - 1].id;
    }
  }

  return allHistory;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid parameter" },
        { status: 400 }
      );
    }

    // ─── STEP 1: Fetch ALL accounts for this referenceid ───
    const allAccounts = await Xchire_sql`
      SELECT * FROM accounts 
      WHERE referenceid = ${referenceid}
        AND (
          status IS NULL 
          OR (
            LOWER(status) != 'subject for transfer' 
            AND LOWER(status) != 'removed' 
            AND LOWER(status) != 'approved for deletion'
          )
        );
    `;

    // ─── STEP 2: Fetch ALL activities for this referenceid ───
    const allActivities = await fetchAllActivitiesForReferenceId(referenceid);

    // ─── STEP 3: Fetch ALL history for these activities ───
    const activityRefNumbers = allActivities
      .map(a => a.activity_reference_number)
      .filter(Boolean);
    
    const allHistory = await fetchAllHistoryForActivities(activityRefNumbers);

    // ─── STEP 4: Get DISTINCT companies WITH activity (SQL-style JOIN) ───
    // Build activity lookup map
    const activityMap = new Map(
      allActivities.map(a => [a.activity_reference_number, a])
    );

    // Get companies with activity via history-activity JOIN
    const companiesWithActivity = new Set<string>();
    for (const history of allHistory) {
      const activity = activityMap.get(history.activity_reference_number);
      const companyName = history.company_name || activity?.company_name;
      if (companyName) {
        companiesWithActivity.add(companyName.toLowerCase());
      }
    }

    // ─── STEP 5: Calculate NO ACTIVITY accounts ───
    // accounts.total - with_activity = NO_ACTIVITY
    const totalAccounts = allAccounts.length;
    const withActivityCount = companiesWithActivity.size;
    const withoutActivityCount = totalAccounts - withActivityCount;

    // Filter accounts with NO activity
    const accountsWithNoActivity = allAccounts.filter((account: any) => {
      const status = account.status?.toLowerCase();
      const isStatusAllowed =
        status !== "subject for transfer" &&
        status !== "removed" &&
        status !== "approved for deletion";

      if (!isStatusAllowed) return false;

      const hasActivity = companiesWithActivity.has(account.company_name?.toLowerCase());
      return !hasActivity; // NO ACTIVITY
    });

    return NextResponse.json(
      {
        success: true,
        referenceid,
        summary: {
          totalAccounts,
          withActivityCount,
          withoutActivityCount,
          uniqueCompaniesWithActivity: Array.from(companiesWithActivity),
        },
        data: {
          noActivityAccounts: accountsWithNoActivity,
        },
        debug: {
          totalActivitiesFetched: allActivities.length,
          totalHistoryFetched: allHistory.length,
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching activity status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
