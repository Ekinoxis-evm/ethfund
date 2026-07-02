import type { Config, Pair } from "./config.js";
import type { Duration, Market } from "./markets.js";

const PAIR_DURATIONS: Record<Pair, [Duration, Duration]> = {
  "4H-vs-1H": ["4H", "1H"],
  "1H-vs-15M": ["1H", "15M"],
  "15M-vs-5M": ["15M", "5M"],
  "4H-vs-15M": ["4H", "15M"],
  "4H-vs-5M": ["4H", "5M"],
  "1H-vs-5M": ["1H", "5M"],
};

/** A persisted opportunity row (snake_case = Supabase columns). */
export interface Opportunity {
  pair: Pair;
  expiry_at: string;
  market_a_id: string;
  market_b_id: string;
  market_a_slug: string;
  market_b_slug: string;
  duration_a: Duration;
  duration_b: Duration;
  yes_a: number;
  yes_b: number;
  no_a: number;
  no_b: number;
  yes_spread: number;
  no_spread: number;
  best_bid_ask_spread: number;
  liquidity_usd: number;
  volume_usd: number;
  time_remaining_sec: number;
  status: "opportunity" | "below_threshold";
}

export interface Evaluation {
  opp: Opportunity;
  isOpportunity: boolean;
  reasons: string[]; // why it failed (empty if it passed)
}

function evaluatePair(
  pair: Pair,
  a: Market,
  b: Market,
  cfg: Config,
  now: number,
): Evaluation {
  const yesSpread = Math.abs(a.yes - b.yes);
  const noSpread = Math.abs(a.no - b.no);
  const maxSpread = Math.max(yesSpread, noSpread);
  const liquidity = Math.min(a.liquidity, b.liquidity);
  const volume = Math.min(a.volume, b.volume);
  const bidAsk = Math.max(a.bidAskSpread, b.bidAskSpread);
  const timeRemaining = Math.max(0, Math.round((a.expiryAt.getTime() - now) / 1000));

  const reasons: string[] = [];
  if (maxSpread < cfg.minSpread)
    reasons.push(`spread ${(maxSpread * 100).toFixed(1)}% < ${(cfg.minSpread * 100).toFixed(1)}%`);
  if (liquidity < cfg.minLiquidity)
    reasons.push(`liquidity $${liquidity.toFixed(0)} < $${cfg.minLiquidity}`);
  if (volume < cfg.minVolume) reasons.push(`volume $${volume.toFixed(0)} < $${cfg.minVolume}`);
  if (!(bidAsk <= cfg.maxBidAsk))
    reasons.push(`bid-ask ${bidAsk.toFixed(3)} > ${cfg.maxBidAsk}`);
  if (!a.open || !b.open) reasons.push("a market is not open");

  const isOpportunity = reasons.length === 0;

  const opp: Opportunity = {
    pair,
    expiry_at: a.expiryAt.toISOString(),
    market_a_id: a.id,
    market_b_id: b.id,
    market_a_slug: a.slug,
    market_b_slug: b.slug,
    duration_a: a.duration,
    duration_b: b.duration,
    yes_a: a.yes,
    yes_b: b.yes,
    no_a: a.no,
    no_b: b.no,
    yes_spread: yesSpread,
    no_spread: noSpread,
    best_bid_ask_spread: bidAsk,
    liquidity_usd: liquidity,
    volume_usd: volume,
    time_remaining_sec: timeRemaining,
    status: isOpportunity ? "opportunity" : "below_threshold",
  };
  return { opp, isOpportunity, reasons };
}

/**
 * Evaluate every configured pair within one expiry group. Markets must already share the same
 * expiry (the grouping guarantees it). Returns one Evaluation per (pair, marketA, marketB) combo.
 */
export function evaluateGroup(group: Market[], cfg: Config, now: number): Evaluation[] {
  const out: Evaluation[] = [];
  for (const pair of cfg.pairs) {
    const [dA, dB] = PAIR_DURATIONS[pair];
    const aMarkets = group.filter((m) => m.duration === dA);
    const bMarkets = group.filter((m) => m.duration === dB);
    for (const a of aMarkets) {
      for (const b of bMarkets) {
        if (a.id === b.id) continue;
        out.push(evaluatePair(pair, a, b, cfg, now));
      }
    }
  }
  return out;
}
