import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { Opportunity } from "./arbitrage.js";

const ON_CONFLICT = "market_a_id,market_b_id,expiry_at";

let client: SupabaseClient | null = null;

export function dbConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

function db(): SupabaseClient {
  if (!client) {
    if (!dbConfigured()) throw new Error("Supabase not configured (SUPABASE_URL / SERVICE_ROLE_KEY)");
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export interface ScanRunStats {
  markets_scanned: number;
  groups: number;
  pairs_compared: number;
  opportunities_found: number;
  alerts_sent: number;
  error?: string;
}

/** Insert a scan_runs row; returns its id (or null if DB not configured). */
export async function recordScanRun(stats: ScanRunStats): Promise<string | null> {
  if (!dbConfigured()) return null;
  const { data, error } = await db()
    .from("scan_runs")
    .insert({ ...stats, finished_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`scan_runs insert failed: ${error.message}`);
  return data?.id ?? null;
}

/**
 * Upsert an opportunity on its window key. `alerted`/`alerted_at` are NOT part of the payload, so
 * they default to false on first insert and are preserved on update — that's the dedup latch.
 * Returns whether this window had already been alerted before this upsert.
 */
export async function upsertOpportunity(opp: Opportunity): Promise<{ alreadyAlerted: boolean }> {
  const existing = await db()
    .from("opportunities")
    .select("alerted")
    .eq("market_a_id", opp.market_a_id)
    .eq("market_b_id", opp.market_b_id)
    .eq("expiry_at", opp.expiry_at)
    .maybeSingle();
  if (existing.error) throw new Error(`opportunities select failed: ${existing.error.message}`);
  const alreadyAlerted = existing.data?.alerted === true;

  const { error } = await db().from("opportunities").upsert(opp, { onConflict: ON_CONFLICT });
  if (error) throw new Error(`opportunities upsert failed: ${error.message}`);
  return { alreadyAlerted };
}

/** Latch the window as alerted so it won't email again. */
export async function markAlerted(opp: Opportunity): Promise<void> {
  const { error } = await db()
    .from("opportunities")
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq("market_a_id", opp.market_a_id)
    .eq("market_b_id", opp.market_b_id)
    .eq("expiry_at", opp.expiry_at);
  if (error) throw new Error(`opportunities markAlerted failed: ${error.message}`);
}
