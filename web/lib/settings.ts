import { serverConfig, type Thresholds } from "./config";
import { ALL_PAIRS, isPair } from "./pairs";
import type { Pair } from "./polymarket/arbitrage";
import { SETTINGS_META, type SettingKey } from "./settingsMeta";
import { dbConfigured, getSettingsRow } from "./supabase/server";

/**
 * Threshold loading — SERVER ONLY.
 *
 * The scanner reads its thresholds from public.scanner_settings on every tick;
 * env vars are the fallback. Invariant: this function NEVER throws — if the DB
 * is unreachable, the row is missing, or a value is invalid, the scan continues
 * on env defaults.
 */

export interface EffectiveThresholds extends Thresholds {
  source: "db" | "env";
  updatedAt: string | null;
}

export function envThresholds(): Thresholds {
  return {
    minSpread: serverConfig.minSpread,
    minLiquidity: serverConfig.minLiquidity,
    minVolume: serverConfig.minVolume,
    maxBidAsk: serverConfig.maxBidAsk,
    pairs: [...serverConfig.pairs],
  };
}

function coerceNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function boundsFor(key: SettingKey): { min: number; max: number } {
  const meta = SETTINGS_META.find((m) => m.key === key);
  return meta ? { min: meta.min, max: meta.max } : { min: 0, max: Number.POSITIVE_INFINITY };
}

function inBounds(key: SettingKey, n: number): boolean {
  const { min, max } = boundsFor(key);
  return n >= min && n <= max;
}

const DB_KEYS: Record<SettingKey, string> = {
  minSpread: "min_spread",
  minLiquidity: "min_liquidity",
  minVolume: "min_volume",
  maxBidAsk: "max_bidask",
};

export async function loadThresholds(): Promise<EffectiveThresholds> {
  const fallback: EffectiveThresholds = { ...envThresholds(), source: "env", updatedAt: null };
  if (!dbConfigured()) return fallback;
  try {
    const row = await getSettingsRow();
    if (!row) return fallback;

    const nums: Partial<Record<SettingKey, number>> = {};
    for (const key of Object.keys(DB_KEYS) as SettingKey[]) {
      const n = coerceNum(row[DB_KEYS[key]]);
      if (n === null || !inBounds(key, n)) {
        console.warn(`[settings] invalid ${DB_KEYS[key]} in scanner_settings — using env defaults`);
        return fallback;
      }
      nums[key] = n;
    }

    const rawPairs = Array.isArray(row.pairs) ? row.pairs.map(String) : [];
    const pairs = rawPairs.filter(isPair);
    if (!pairs.length) {
      console.warn("[settings] no valid pairs in scanner_settings — using env defaults");
      return fallback;
    }

    return {
      minSpread: nums.minSpread as number,
      minLiquidity: nums.minLiquidity as number,
      minVolume: nums.minVolume as number,
      maxBidAsk: nums.maxBidAsk as number,
      pairs,
      source: "db",
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    };
  } catch (err) {
    console.warn(
      `[settings] failed to load scanner_settings (${err instanceof Error ? err.message : String(err)}) — using env defaults`,
    );
    return fallback;
  }
}

export interface SettingsInput extends Thresholds {
  note?: string;
}

export type ValidationResult =
  | { ok: true; value: SettingsInput }
  | { ok: false; errors: Record<string, string> };

export function validateSettingsInput(body: unknown): ValidationResult {
  const errors: Record<string, string> = {};
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: { body: "expected a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  const nums: Partial<Record<SettingKey, number>> = {};
  for (const meta of SETTINGS_META) {
    const n = coerceNum(b[meta.key]);
    if (n === null) errors[meta.key] = `${meta.label} must be a number`;
    else if (!inBounds(meta.key, n))
      errors[meta.key] = `${meta.label} must be between ${meta.min} and ${meta.max}`;
    else nums[meta.key] = n;
  }

  let pairs: Pair[] = [];
  if (!Array.isArray(b.pairs)) {
    errors.pairs = "pairs must be an array";
  } else {
    const invalid = b.pairs.map(String).filter((p) => !isPair(p));
    pairs = b.pairs.map(String).filter(isPair);
    if (invalid.length) errors.pairs = `unknown pairs: ${invalid.join(", ")}`;
    else if (!pairs.length)
      errors.pairs = `select at least one pair (${ALL_PAIRS.join(", ")})`;
  }

  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : undefined;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      minSpread: nums.minSpread as number,
      minLiquidity: nums.minLiquidity as number,
      minVolume: nums.minVolume as number,
      maxBidAsk: nums.maxBidAsk as number,
      pairs,
      note,
    },
  };
}
