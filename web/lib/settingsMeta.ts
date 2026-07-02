import type { Pair } from "./polymarket/arbitrage";

/**
 * Plain-language metadata for every tunable scanner setting — drives both the
 * settings form UI and server-side validation bounds. Client-safe (no secrets).
 */

export type SettingKey = "minSpread" | "minLiquidity" | "minVolume" | "maxBidAsk";

export interface SettingMeta {
  key: SettingKey;
  label: string;
  unit: "%" | "$" | "¢";
  /** UI/validation bounds in the stored unit (fractions for %/¢ fields, USD for $ fields). */
  min: number;
  max: number;
  step: number;
  /** What the setting is, in one sentence. */
  description: string;
  /** What raising / lowering it does. */
  effect: string;
}

export const SETTINGS_META: readonly SettingMeta[] = [
  {
    key: "minSpread",
    label: "Minimum spread",
    unit: "%",
    min: 0,
    max: 1,
    step: 0.005,
    description:
      "The minimum probability gap between two markets that expire at the same instant before we call it a signal.",
    effect:
      "Raise it for fewer, stronger alerts. Lower it to surface smaller mispricings — with more noise.",
  },
  {
    key: "minLiquidity",
    label: "Minimum liquidity",
    unit: "$",
    min: 0,
    max: 1_000_000,
    step: 100,
    description:
      "Both markets must have at least this much liquidity (USD) — a proxy for whether you could actually take the trade.",
    effect:
      "Raise it to only see tradable-size signals. Lower it to include thin micro-markets (5M/15M candles rarely exceed a few thousand dollars).",
  },
  {
    key: "minVolume",
    label: "Minimum volume",
    unit: "$",
    min: 0,
    max: 10_000_000,
    step: 100,
    description:
      "Both markets must have traded at least this much (USD) — a proxy for real price discovery, not a stale quote.",
    effect:
      "Raise it to demand proven activity. Lower it for the short-lived 5M/15M markets, which resolve before volume can accumulate.",
  },
  {
    key: "maxBidAsk",
    label: "Maximum bid-ask spread",
    unit: "¢",
    min: 0,
    max: 1,
    step: 0.005,
    description:
      "The widest order-book bid-ask spread we tolerate on either market — wide books eat the edge before you can capture it.",
    effect:
      "Lower it to only alert when the books are tight enough to execute near the quoted prices. Raise it to see more signals you may not be able to fill.",
  },
];

export const PAIR_META: Record<Pair, string> = {
  "4H-vs-1H":
    "During the final hour of a 4-hour market, compare it with the 1-hour market ending at the same instant.",
  "1H-vs-15M":
    "During the final 15 minutes of an hourly market, compare it with the 15-minute market ending at the same instant.",
  "15M-vs-5M":
    "During the final 5 minutes of a 15-minute market, compare it with the 5-minute market ending at the same instant.",
  "4H-vs-15M":
    "Compare a 4-hour market with a 15-minute market sharing its exact expiry (wider duration gap — prices diverge more, but so does the remaining-move overlap).",
  "4H-vs-5M":
    "Compare a 4-hour market with a 5-minute market sharing its exact expiry (widest duration gap).",
  "1H-vs-5M":
    "Compare an hourly market with a 5-minute market sharing its exact expiry.",
};
