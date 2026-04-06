import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

function normalizeField(value: any): string {
  if (Array.isArray(value)) {
    const filtered = value.filter((v) => v && v.trim() !== "");
    return filtered.join(", ");
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      referenceid,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      delivery_address,
      region,
      type_client,
      date_updated,
      industry,
      status,
      company_group,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing account id." }, { status: 400 });
    }

    const contactPersonArray = normalizeField(contact_person);
    const contactNumberArray = normalizeField(contact_number);
    const emailAddressArray = normalizeField(email_address);

    const updated = await Xchire_sql`
      UPDATE accounts SET
        referenceid = ${referenceid},
        company_name = ${company_name},
        contact_person = ${contactPersonArray},
        contact_number = ${contactNumberArray},
        email_address = ${emailAddressArray},
        address = ${address},
        delivery_address = ${delivery_address},
        region = ${region},
        type_client = ${type_client},
        date_updated = ${date_updated},
        industry = ${industry},
        status = ${status},
        company_group = ${company_group}
      WHERE id = ${id}
      RETURNING *;
    `;

    if (updated.length === 0) {
      return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    }

    // Log audit trail for account update
    await logAuditTrailApp(
      req,
      "update",
      "company account",
      id,
      company_name,
      `Updated company account: ${company_name}`,
      { company_name, status, region }
    );

    return NextResponse.json({ success: true, data: updated[0] }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
