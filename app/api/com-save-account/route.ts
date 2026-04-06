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

function getPrefix(companyName: string, region: string) {
  // First two letters of company name, uppercase
  const companyPart = companyName.trim().substring(0, 2).toUpperCase();

  // Region uppercase, remove spaces
  const regionPart = region.trim().toUpperCase().replace(/\s+/g, "");

  return `${companyPart}-${regionPart}`;
}

async function getNextSequenceNumber(prefix: string) {
  // Search last highest account_reference_number that starts with prefix + '-'
  const lastEntry = await Xchire_sql`
    SELECT account_reference_number
    FROM accounts
    WHERE account_reference_number LIKE ${prefix + "-%"}
    ORDER BY account_reference_number DESC
    LIMIT 1;
  `;

  if (lastEntry.length === 0) {
    return 1; // start from 1 if none found
  }

  // Extract number part after prefix + '-'
  const lastNumberStr = lastEntry[0].account_reference_number.substring(prefix.length + 1);

  const lastNumber = parseInt(lastNumberStr, 10);
  if (isNaN(lastNumber)) return 1;
  return lastNumber + 1;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received save account data:", body);

    const {
      referenceid,
      tsm,
      manager,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      delivery_address,
      region,
      type_client,
      date_created,
      industry,
      status,
      company_group
    } = body;

    if (!referenceid || !company_name || !type_client || !region) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: referenceid, company_name, type_client or region." },
        { status: 400 }
      );
    }

    // Generate account_reference_number
    const prefix = getPrefix(company_name, region);
    const nextSeq = await getNextSequenceNumber(prefix);
    const seqStr = nextSeq.toString().padStart(10, "0");
    const account_reference_number = `${prefix}-${seqStr}`;

    // Normalize array or string fields
    const normalizedContactPerson = normalizeField(contact_person);
    const normalizedContactNumber = normalizeField(contact_number);
    const normalizedEmailAddress = normalizeField(email_address);

    // Use current timestamp if date_created not provided or invalid
    const createdDate =
      date_created && !isNaN(Date.parse(date_created))
        ? date_created
        : new Date().toISOString();

    const inserted = await Xchire_sql`
      INSERT INTO accounts
      (
        referenceid,
        tsm,
        manager,
        company_name,
        contact_person,
        contact_number,
        email_address,
        address,
        delivery_address,
        region,
        type_client,
        date_created,
        industry,
        status,
        company_group,
        account_reference_number
      )
      VALUES
      (
        ${referenceid},
        ${tsm || null},
        ${manager || null},
        ${company_name},
        ${normalizedContactPerson || null},
        ${normalizedContactNumber || null},
        ${normalizedEmailAddress || null},
        ${address || null},
        ${delivery_address || null},
        ${region || null},
        ${type_client},
        ${createdDate},
        ${industry || null},
        ${status || "Active"},
        ${company_group || null},
        ${account_reference_number}
      )
      RETURNING *;
    `;

    // Log audit trail for account creation
    await logAuditTrailApp(
      req,
      "create",
      "company account",
      inserted[0].id?.toString(),
      account_reference_number,
      `Created company account: ${company_name}`,
      { company_name, type_client, region }
    );

    return NextResponse.json(
      { success: true, data: inserted[0] },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error saving account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save account." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
