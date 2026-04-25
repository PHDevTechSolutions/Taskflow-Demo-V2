import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { referenceid: agentReferenceId, company: companyName } = req.query;

    if (!agentReferenceId || typeof agentReferenceId !== "string") {
      return res.status(400).json({
        error: "Agent reference ID is required",
      });
    }

    // Use the same logic as the existing reports/tsm/fetch endpoint
    // but filter by agent reference ID instead of TSM reference ID
    const activitiesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/activities?select=*&referenceid=eq.${encodeURIComponent(agentReferenceId)}`;

    const response = await fetch(activitiesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE || "",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE || ""}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const activities = await response.json();

    // If company name is provided, filter by company
    let filteredActivities = activities || [];
    if (companyName && typeof companyName === "string") {
      filteredActivities = activities.filter((activity: any) =>
        activity.company_name?.toLowerCase() === companyName.toLowerCase()
      );
    }

    return res.status(200).json({
      success: true,
      activities: filteredActivities,
      total: filteredActivities.length,
    });

  } catch (error) {
    console.error("Error fetching agent activities:", error);
    return res.status(500).json({
      error: "Failed to fetch activities",
      activities: [],
      total: 0
    });
  }
}
