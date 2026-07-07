import { NextResponse } from "next/server";
import { dbConfigured, listPairWindows } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbConfigured()) return NextResponse.json({ windows: [] });
  try {
    const windows = await listPairWindows(100);
    return NextResponse.json({ windows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
