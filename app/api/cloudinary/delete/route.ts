import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { logAuditTrailApp } from "@/lib/auditTrail";

export async function POST(req: Request) {
  try {
    const { public_id } = await req.json();

    if (!public_id) {
      return NextResponse.json({ error: "Missing public_id" }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(public_id);

    // Log audit trail for image deletion
    await logAuditTrailApp(
      req,
      "delete",
      "cloudinary image",
      public_id,
      public_id,
      `Deleted image from Cloudinary: ${public_id}`,
      { public_id }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}