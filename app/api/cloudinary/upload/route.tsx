import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { logAuditTrailApp } from "@/lib/auditTrail";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // Upload to Cloudinary under a dedicated SPF folder
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "quotation/spf",
      resource_type: "image",
    });

    // Log audit trail for image upload
    await logAuditTrailApp(
      req,
      "create",
      "cloudinary image",
      result.public_id,
      result.public_id,
      `Uploaded image to Cloudinary: ${result.public_id}`,
      { public_id: result.public_id, folder: "quotation/spf" }
    );

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}