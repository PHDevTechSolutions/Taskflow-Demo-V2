import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { logAuditTrailApp } from "@/lib/auditTrail";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, remarks } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing activity id" },
        { status: 400 }
      );
    }

    // Fetch current activity to get reference info
    const { data: currentActivity, error: fetchError } = await supabase
      .from("activity")
      .select("id, activity_reference_number, company_name, status, referenceid, tsm, manager, agent")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching activity:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch activity" },
        { status: 500 }
      );
    }

    if (!currentActivity) {
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      );
    }

    // Update activity status to Cancelled
    const { data: updatedActivity, error: updateError } = await supabase
      .from("activity")
      .update({
        status: "Cancelled",
        date_updated: new Date().toISOString(),
        cancellation_remarks: remarks || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating activity status:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update activity status" },
        { status: 500 }
      );
    }

    // Log audit trail
    await logAuditTrailApp(
      req,
      "update",
      "activity",
      id,
      `Activity: ${currentActivity.activity_reference_number || id}`,
      `Cancelled activity for ${currentActivity.company_name || "Unknown"}${remarks ? ` - Reason: ${remarks}` : ""}`,
      {
        previous_status: currentActivity.status,
        new_status: "Cancelled",
        remarks: remarks || null,
        activity_reference_number: currentActivity.activity_reference_number,
        company_name: currentActivity.company_name,
      }
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedActivity,
        message: "Activity marked as Cancelled",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error cancelling activity:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel activity" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
