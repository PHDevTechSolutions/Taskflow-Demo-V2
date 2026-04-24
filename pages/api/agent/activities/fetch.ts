import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentReferenceId = searchParams.get("referenceid");
    const companyName = searchParams.get("company");

    if (!agentReferenceId) {
      return NextResponse.json(
        { error: "Agent reference ID is required" },
        { status: 400 }
      );
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
    if (companyName) {
      filteredActivities = activities.filter((activity: any) =>
        activity.company_name?.toLowerCase() === companyName.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      activities: filteredActivities,
      total: filteredActivities.length,
    });

  } catch (error) {
    console.error("Error fetching agent activities:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch activities",
        activities: [],
        total: 0 
      },
      { status: 500 }
    );
  }
}
