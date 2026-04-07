import { NextRequest, NextResponse } from "next/server";
import { logAuditTrail, AuditAction, AuditTrailData } from "@/lib/auditTrail";
import { getUserInfo } from "@/lib/auditTrail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      userId, 
      action, 
      entityType, 
      entityId, 
      entityName, 
      details, 
      changes,
      ipAddress,
      userAgent 
    } = body;

    if (!userId || !action || !entityType) {
      return NextResponse.json(
        { error: "Missing required fields: userId, action, entityType" },
        { status: 400 }
      );
    }

    // Get user info from MongoDB
    const userInfo = await getUserInfo(userId);

    if (!userInfo) {
      return NextResponse.json(
        { error: `User ${userId} not found` },
        { status: 404 }
      );
    }

    // Log the audit trail
    await logAuditTrail({
      userId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email: userInfo.email,
      action: action as AuditAction,
      entityType,
      entityId,
      entityName,
      details,
      changes,
      department: userInfo.department,
      role: userInfo.role,
      referenceId: userInfo.referenceId,
      ipAddress: ipAddress || req.headers.get("x-forwarded-for")?.split(",")[0] || undefined,
      userAgent: userAgent || req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in audit-log API:", error);
    return NextResponse.json(
      { error: "Failed to log audit trail" },
      { status: 500 }
    );
  }
}
