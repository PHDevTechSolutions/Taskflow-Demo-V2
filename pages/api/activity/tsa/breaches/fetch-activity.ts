import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ------------------ STEP 1: Overdue Assisted Activities ------------------ */
async function fetchOverdueActivities(referenceid: string, today: string) {
  let allActivities: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .lt("scheduled_date", today) // ✅ overdue
      .eq("status", "Assisted")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;

    allActivities.push(...(data || []));
    if (!data || data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allActivities;
}

/* ------------------ STEP 2: Successful History ------------------ */
async function fetchSuccessfulHistory(activityIds: string[]) {
  if (activityIds.length === 0) return [];

  const { data, error } = await supabase
    .from("history")
    .select("activity_reference_number")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Successful");

  if (error) throw error;
  return data || [];
}

/* ------------------ STEP 3: Unsuccessful History (optional) ------------------ */
async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (activityIds.length === 0) return [];

  const { data, error } = await supabase
    .from("history")
    .select("*")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Unsuccessful");

  if (error) throw error;
  return data || [];
}

/* ------------------ API HANDLER ------------------ */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const today = formatDate(new Date());

  try {
    // 1️⃣ Assisted + overdue activities
    const activities = await fetchOverdueActivities(referenceid, today);
    const activityIds = activities.map(a => a.activity_reference_number);

    // 2️⃣ Activities na may Successful call → EXCLUDE
    const successfulHistory = await fetchSuccessfulHistory(activityIds);
    const successfulSet = new Set(
      successfulHistory.map(h => h.activity_reference_number)
    );

    const overdueActivities = activities.filter(
      a => !successfulSet.has(a.activity_reference_number)
    );

    // 3️⃣ Optional: Unsuccessful history ng tunay na overdue
    const overdueIds = overdueActivities.map(a => a.activity_reference_number);
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(overdueIds);

    return res.status(200).json({
      activities: overdueActivities,
      history: unsuccessfulHistory,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
