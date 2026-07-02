import type { Pair } from "./polymarket/arbitrage";
import { ALL_PAIRS } from "./pairs";

export { ALL_PAIRS };

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parsePairs(raw: string | undefined): Pair[] {
  const list = (raw ?? "4H-vs-1H")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is Pair => (ALL_PAIRS as readonly string[]).includes(p));
  return list.length ? list : ["4H-vs-1H"];
}

/** Server-side scanner config (thresholds + integrations). Read in the cron route. */
export const serverConfig = {
  // Supabase (server): the reused supabase lib reads SUPABASE_URL; fall back to the public one.
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  cronSecret: process.env.CRON_SECRET ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  alertFrom: process.env.ALERT_FROM ?? "",
  alertTo: (process.env.ALERT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  minSpread: num("MIN_SPREAD", 0.05),
  minLiquidity: num("MIN_LIQUIDITY", 5000),
  minVolume: num("MIN_VOLUME", 20000),
  maxBidAsk: num("MAX_BIDASK", 0.02),
  pairs: parsePairs(process.env.PAIRS),
} as const;

export type ServerConfig = typeof serverConfig;

/** Thresholds shape consumed by the pure evaluator (subset of serverConfig). */
export interface Thresholds {
  minSpread: number;
  minLiquidity: number;
  minVolume: number;
  maxBidAsk: number;
  pairs: Pair[];
}

/** Public flags safe for the browser bundle. */
export const tradingEnabled = process.env.NEXT_PUBLIC_TRADING === "on";
