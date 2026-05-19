import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses the anon key — RLS policy must allow anon inserts on screenshot_logs.
// Run this in Supabase SQL editor if not already done:
//   DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.screenshot_logs;
//   CREATE POLICY "Allow anon insert" ON public.screenshot_logs
//     FOR INSERT TO anon WITH CHECK (true);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface ScreenshotLogPayload {
  referenceid: string;
  event_type:
    | "table_viewed"
    | "tab_hidden"
    | "tab_visible"
    | "window_blurred"
    | "window_focused"
    | "table_scrolled"
    | "copy_attempted";
  page?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as
      | ScreenshotLogPayload
      | ScreenshotLogPayload[];

    const events = Array.isArray(body) ? body : [body];

    if (!events.length) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 });
    }

    for (const e of events) {
      if (!e.referenceid || !e.event_type) {
        return NextResponse.json(
          { error: "referenceid and event_type are required" },
          { status: 400 }
        );
      }
    }

    const rows = events.map((e) => ({
      referenceid: e.referenceid,
      event_type:  e.event_type,
      page:        e.page ?? "accounts-table",
      metadata:    e.metadata ?? {},
    }));

    const { error } = await supabase.from("screenshot_logs").insert(rows);

    if (error) {
      console.error("[screenshot-log] Supabase error:", JSON.stringify(error));
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (err) {
    console.error("[screenshot-log] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
