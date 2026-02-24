import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;
const HISTORY_BATCH_SIZE = 1000;

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ------------------ Fetch all overdue activities in batches ------------------ */
async function fetchOverdueActivities(manager: string, today: string) {
  let allActivities: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("activity")
      .select("*")
      .eq("manager", manager)
      .lt("scheduled_date", today)
      .neq("status", "Cancelled") // filter out Cancelled
      .neq("status", "Done")      // filter out Done
      .order("scheduled_date", { ascending: false }) // latest first
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;

    allActivities.push(...(data || []));

    if (!data || data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  // Mark each activity as "Assisted"
  return allActivities.map((a) => ({ ...a, status: "Assisted" }));
}

/* ------------------ Fetch all unsuccessful histories in batches ------------------ */
async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (activityIds.length === 0) return [];

  let allUnsuccessful: any[] = [];
  let allSuccessful: any[] = [];

  // Split activityIds into chunks of HISTORY_BATCH_SIZE (Supabase .in() limit)
  for (let i = 0; i < activityIds.length; i += HISTORY_BATCH_SIZE) {
    const batchIds = activityIds.slice(i, i + HISTORY_BATCH_SIZE);

    // Fetch Unsuccessful
    const { data: unsuccessfulData, error: errUnsuccess } = await supabase
      .from("history")
      .select("*")
      .in("activity_reference_number", batchIds)
      .eq("call_status", "Unsuccessful")
      .eq("type_activity", "Outbound Calls");
    if (errUnsuccess) throw errUnsuccess;
    allUnsuccessful.push(...(unsuccessfulData || []));

    // Fetch Successful
    const { data: successfulData, error: errSuccess } = await supabase
      .from("history")
      .select("activity_reference_number")
      .in("activity_reference_number", batchIds)
      .eq("call_status", "Successful")
      .eq("type_activity", "Outbound Calls");
    if (errSuccess) throw errSuccess;
    allSuccessful.push(...(successfulData || []));
  }

  const successfulSet = new Set(allSuccessful.map((h) => h.activity_reference_number));

  // Only include Unsuccessful histories that do NOT have a Successful counterpart
  return allUnsuccessful.filter((h) => !successfulSet.has(h.activity_reference_number));
}

/* ------------------ API Handler ------------------ */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { manager } = req.query;

  if (!manager || typeof manager !== "string") {
    return res.status(400).json({ message: "Missing or invalid manager" });
  }

  const today = formatDate(new Date());

  try {
    // 1️⃣ Fetch all overdue activities
    const activities = await fetchOverdueActivities(manager, today);

    const activityIds = activities.map((a) => a.activity_reference_number);

    // 2️⃣ Fetch all filtered unsuccessful history
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(activityIds);

    // 3️⃣ Only include activities that have at least 1 unmatched unsuccessful history
    const overdueActivities = activities.filter((a) =>
      unsuccessfulHistory.some((h) => h.activity_reference_number === a.activity_reference_number)
    );

    return res.status(200).json({
      activities: overdueActivities,
      history: unsuccessfulHistory,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}