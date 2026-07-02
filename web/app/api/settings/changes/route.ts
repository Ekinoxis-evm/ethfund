import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { dbConfigured, listSettingsChanges } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!dbConfigured()) return NextResponse.json({ changes: [] });
  try {
    const changes = await listSettingsChanges(50);
    return NextResponse.json({ changes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
