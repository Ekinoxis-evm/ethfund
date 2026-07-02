import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverConfig } from "../config";
import type { Evaluation, Opportunity } from "../polymarket/arbitrage";
import type { SettingsChangeRow } from "../types";

const ON_CONFLICT = "market_a_id,market_b_id,expiry_at";

let client: SupabaseClient | null = null;

export function dbConfigured(): boolean {
  return Boolean(serverConfig.supabaseUrl && serverConfig.supabaseServiceRoleKey);
}

/** Service-role client — SERVER ONLY. Never import this into a client component. */
export function serviceClient(): SupabaseClient {
  if (!client) {
    if (!dbConfigured()) throw new Error("Supabase not configured (SUPABASE_URL / SERVICE_ROLE_KEY)");
    client = createClient(serverConfig.supabaseUrl, serverConfig.supabaseServiceRoleKey, {
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

export async function recordScanRun(stats: ScanRunStats): Promise<string | null> {
  if (!dbConfigured()) return null;
  const { data, error } = await serviceClient()
    .from("scan_runs")
    .insert({ ...stats, finished_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`scan_runs insert failed: ${error.message}`);
  return data?.id ?? null;
}

/** Map an Opportunity (with token ids) to the opportunities row. */
function toRow(opp: Opportunity) {
  return {
    pair: opp.pair,
    expiry_at: opp.expiry_at,
    market_a_id: opp.market_a_id,
    market_b_id: opp.market_b_id,
    market_a_slug: opp.market_a_slug,
    market_b_slug: opp.market_b_slug,
    duration_a: opp.duration_a,
    duration_b: opp.duration_b,
    yes_a: opp.yes_a,
    yes_b: opp.yes_b,
    no_a: opp.no_a,
    no_b: opp.no_b,
    yes_spread: opp.yes_spread,
    no_spread: opp.no_spread,
    best_bid_ask_spread: opp.best_bid_ask_spread,
    liquidity_usd: opp.liquidity_usd,
    volume_usd: opp.volume_usd,
    time_remaining_sec: opp.time_remaining_sec,
    status: opp.status,
    yes_token_a: opp.yes_token_a,
    no_token_a: opp.no_token_a,
    yes_token_b: opp.yes_token_b,
    no_token_b: opp.no_token_b,
  };
}

/** Upsert on the window key; returns whether this window was already alerted (DB-backed dedup). */
export async function upsertOpportunity(opp: Opportunity): Promise<{ alreadyAlerted: boolean }> {
  const db = serviceClient();
  const existing = await db
    .from("opportunities")
    .select("alerted")
    .eq("market_a_id", opp.market_a_id)
    .eq("market_b_id", opp.market_b_id)
    .eq("expiry_at", opp.expiry_at)
    .maybeSingle();
  if (existing.error) throw new Error(`opportunities select failed: ${existing.error.message}`);
  const alreadyAlerted = existing.data?.alerted === true;

  const { error } = await db.from("opportunities").upsert(toRow(opp), { onConflict: ON_CONFLICT });
  if (error) throw new Error(`opportunities upsert failed: ${error.message}`);
  return { alreadyAlerted };
}

export async function markAlerted(opp: Opportunity): Promise<void> {
  const { error } = await serviceClient()
    .from("opportunities")
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq("market_a_id", opp.market_a_id)
    .eq("market_b_id", opp.market_b_id)
    .eq("expiry_at", opp.expiry_at);
  if (error) throw new Error(`opportunities markAlerted failed: ${error.message}`);
}

/** Raw scanner_settings row (id = 1). Returns null on missing row. */
export async function getSettingsRow(): Promise<Record<string, unknown> | null> {
  const { data, error } = await serviceClient()
    .from("scanner_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`scanner_settings select failed: ${error.message}`);
  return data;
}

export interface SettingsWrite {
  min_spread: number;
  min_liquidity: number;
  min_volume: number;
  max_bidask: number;
  pairs: string[];
}

/** Upsert scanner_settings (id = 1) and append an audit row to settings_changes. */
export async function saveSettings(
  values: SettingsWrite,
  note: string | undefined,
): Promise<{ oldValues: Record<string, unknown> | null }> {
  const db = serviceClient();
  const old = await getSettingsRow();
  const oldValues = old
    ? {
        min_spread: old.min_spread,
        min_liquidity: old.min_liquidity,
        min_volume: old.min_volume,
        max_bidask: old.max_bidask,
        pairs: old.pairs,
      }
    : null;

  const { error } = await db.from("scanner_settings").upsert({ id: 1, ...values });
  if (error) throw new Error(`scanner_settings upsert failed: ${error.message}`);

  const audit = await db.from("settings_changes").insert({
    old_values: oldValues,
    new_values: values,
    note: note ?? null,
  });
  if (audit.error) throw new Error(`settings_changes insert failed: ${audit.error.message}`);

  return { oldValues };
}

export async function listSettingsChanges(limit = 50): Promise<SettingsChangeRow[]> {
  const { data, error } = await serviceClient()
    .from("settings_changes")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`settings_changes select failed: ${error.message}`);
  return (data ?? []) as SettingsChangeRow[];
}

const MAX_SNAPSHOTS_PER_TICK = 100;

/** Batch-insert one row per compared pair. Never throws — history must not break scanning. */
export async function recordPairSnapshots(evals: Evaluation[]): Promise<number> {
  if (!dbConfigured() || !evals.length) return 0;
  const rows = evals.slice(0, MAX_SNAPSHOTS_PER_TICK).map(({ opp, isOpportunity, reasons }) => ({
    pair: opp.pair,
    expiry_at: opp.expiry_at,
    market_a_id: opp.market_a_id,
    market_b_id: opp.market_b_id,
    yes_spread: opp.yes_spread,
    no_spread: opp.no_spread,
    best_bid_ask_spread: Number.isFinite(opp.best_bid_ask_spread) ? opp.best_bid_ask_spread : null,
    liquidity_usd: opp.liquidity_usd,
    volume_usd: opp.volume_usd,
    passed: isOpportunity,
    reasons,
  }));
  try {
    const { error } = await serviceClient().from("pair_snapshots").insert(rows);
    if (error) throw new Error(error.message);
    return rows.length;
  } catch (err) {
    console.error(
      `[scan] pair_snapshots insert failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }
}
