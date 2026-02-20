import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ------------------ Fetch overdue activities ------------------ */
async function fetchOverdueActivities(referenceid: string, today: string) {
  let allActivities: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .lt("scheduled_date", today) // only overdue
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;

    allActivities.push(...(data || []));
    if (!data || data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allActivities;
}

/* ------------------ Fetch Unsuccessful history only ------------------ */
async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (activityIds.length === 0) return [];

  // Fetch all Unsuccessful Outbound Calls
  const { data: unsuccessfulData, error: errUnsuccess } = await supabase
    .from("history")
    .select("*")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Unsuccessful")
    .eq("type_activity", "Outbound Calls");

  if (errUnsuccess) throw errUnsuccess;

  // Fetch all Successful Outbound Calls
  const { data: successfulData, error: errSuccess } = await supabase
    .from("history")
    .select("activity_reference_number")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Successful")
    .eq("type_activity", "Outbound Calls");

  if (errSuccess) throw errSuccess;

  const successfulSet = new Set(successfulData?.map(h => h.activity_reference_number));

  // Only include Unsuccessful histories that do NOT have a Successful counterpart
  const filteredUnsuccessful = (unsuccessfulData || []).filter(
    h => !successfulSet.has(h.activity_reference_number)
  );

  return filteredUnsuccessful;
}

/* ------------------ API Handler ------------------ */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const today = formatDate(new Date());

  try {
    // 1️⃣ Fetch overdue activities
    const activities = await fetchOverdueActivities(referenceid, today);

    const activityIds = activities.map(a => a.activity_reference_number);

    // 2️⃣ Fetch filtered Unsuccessful history
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(activityIds);

    // Optional: Only include activities that have at least 1 Unsuccessful history
    const overdueActivities = activities.filter(a =>
      unsuccessfulHistory.some(h => h.activity_reference_number === a.activity_reference_number)
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