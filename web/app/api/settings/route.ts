import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { envThresholds, loadThresholds, validateSettingsInput } from "@/lib/settings";
import { dbConfigured, saveSettings } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const effective = await loadThresholds();
  const { source, updatedAt, ...settings } = effective;
  return NextResponse.json({ settings, source, updatedAt, envDefaults: envThresholds() });
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!dbConfigured()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { body: "invalid JSON" } }, { status: 400 });
  }

  const result = validateSettingsInput(body);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });

  const { note, ...values } = result.value;
  try {
    await saveSettings(
      {
        min_spread: values.minSpread,
        min_liquidity: values.minLiquidity,
        min_volume: values.minVolume,
        max_bidask: values.maxBidAsk,
        pairs: values.pairs,
      },
      note,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const effective = await loadThresholds();
  const { source, updatedAt, ...settings } = effective;
  return NextResponse.json({ ok: true, settings, source, updatedAt });
}
