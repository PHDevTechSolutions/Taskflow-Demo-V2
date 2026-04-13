import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

const COMPLETED_STATUSES = ["Cancelled", "Done", "Completed", "Delivered"];

async function fetchOverdueActivities(referenceid: string) {
  let allActivities: any[] = [];
  let offset = 0;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  while (true) {
    const { data, error } = await supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const filtered = data.filter((a) => {
      const scheduled = new Date(a.scheduled_date);
      scheduled.setHours(0, 0, 0, 0);
      return scheduled < todayDate && !COMPLETED_STATUSES.includes(a.status);
    });

    allActivities.push(...filtered);

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allActivities;
}

async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (!activityIds.length) return [];

  let allData: any[] = [];
  let offset = 0;

  while (true) {
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
  }

  const { data: successfulData, error: errSuccess } = await supabase
    .from("history")
    .select("activity_reference_number")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Successful")
    .eq("type_activity", "Outbound Calls");

  if (errSuccess) throw errSuccess;

  const successfulSet = new Set(successfulData?.map((h) => h.activity_reference_number));
  return allData.filter((h) => !successfulSet.has(h.activity_reference_number));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  try {
    const activities = await fetchOverdueActivities(referenceid);
    const activityIds = activities.map((a) => a.activity_reference_number);
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(activityIds);

    return res.status(200).json({
      activities,
      history: unsuccessfulHistory,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}