// /pages/api/activity/tsm/breaches/fetch-activity.ts
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
async function fetchOverdueActivities(tsm: string, today: string) {
  console.log("📌 fetchOverdueActivities:", { tsm, today });

  let allActivities: any[] = [];
  let offset = 0;

  while (true) {
    try {
      const { data, error } = await supabase
        .from("activity")
        .select("*")
        .eq("tsm", tsm)
        .lt("scheduled_date", today)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;

      if (!data || data.length === 0) break;

      const filtered = data.filter(
        (a) => a.status !== "Cancelled" && a.status !== "Done"
      );

      const mapped = filtered.map((a) => ({ ...a, status: "Assisted" }));

      allActivities.push(...mapped);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    } catch (err) {
      console.error("❌ Error fetching overdue activities batch:", offset, err);
      throw err;
    }
  }

  console.log("✅ Total overdue activities fetched:", allActivities.length);
  return allActivities;
}

/* ------------------ Fetch Unsuccessful history ------------------ */
async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (!activityIds.length) {
    console.log("⚠️ No activity IDs for history fetch");
    return [];
  }

  console.log("📌 fetchUnsuccessfulHistory:", { activityIdsLength: activityIds.length });

  let allData: any[] = [];
  let offset = 0;

  while (true) {
    try {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", activityIds)
        .eq("call_status", "Unsuccessful")
        .eq("type_activity", "Outbound Calls")
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;

      if (!data || data.length === 0) break;

      allData.push(...data);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    } catch (err) {
      console.error("❌ Error fetching unsuccessful history batch:", offset, err);
      throw err;
    }
  }

  console.log("✅ Total unsuccessful history fetched:", allData.length);

  // Fetch successful counterparts
  try {
    const { data: successfulData, error: errSuccess } = await supabase
      .from("history")
      .select("activity_reference_number")
      .in("activity_reference_number", activityIds)
      .eq("call_status", "Successful")
      .eq("type_activity", "Outbound Calls");

    if (errSuccess) throw errSuccess;

    const successfulSet = new Set(successfulData?.map((h) => h.activity_reference_number));

    const filtered = allData.filter((h) => !successfulSet.has(h.activity_reference_number));

    console.log("✅ Unsuccessful history after removing successful counterparts:", filtered.length);
    return filtered;
  } catch (err) {
    console.error("❌ Error fetching successful history counterparts:", err);
    throw err;
  }
}

/* ------------------ API Handler ------------------ */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("📥 fetch-activity called with query:", req.query);

  const { tsm } = req.query;

  if (!tsm || typeof tsm !== "string") {
    console.warn("⚠️ Missing or invalid tsm parameter");
    return res.status(400).json({ message: "Missing or invalid tsm" });
  }

  const today = formatDate(new Date());
  console.log("✅ tsm:", tsm, "today:", today);

  try {
    // 1️⃣ Fetch overdue activities
    const activities = await fetchOverdueActivities(tsm, today);
    const activityIds = activities.map((a) => a.activity_reference_number);

    // 2️⃣ Fetch filtered Unsuccessful history
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(activityIds);

    // 3️⃣ Include only activities that have at least 1 Unsuccessful history
    const overdueActivities = activities.filter((a) =>
      unsuccessfulHistory.some((h) => h.activity_reference_number === a.activity_reference_number)
    );

    console.log("✅ Overdue activities to return:", overdueActivities.length);

    return res.status(200).json({
      activities: overdueActivities,
      history: unsuccessfulHistory,
    });
  } catch (err: any) {
    console.error("🔥 fetch-activity handler error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}