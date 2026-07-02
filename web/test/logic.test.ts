import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEthUpDown,
  parseDuration,
  normalize,
  groupByExpiry,
  type RawMarket,
} from "../lib/polymarket/markets";
import { evaluateGroup, type Pair } from "../lib/polymarket/arbitrage";
import type { Thresholds } from "../lib/config";

const EXPIRY = "2030-01-01T16:00:00.000Z";

const THRESHOLDS: Thresholds = {
  minSpread: 0.05,
  minLiquidity: 5000,
  minVolume: 20000,
  maxBidAsk: 0.02,
  pairs: ["4H-vs-1H"] as Pair[],
};

/** Gamma HTTP shape: outcomes/outcomePrices/clobTokenIds are JSON-ENCODED STRINGS (the C1 case). */
function gammaMarket(over: Partial<RawMarket>): RawMarket {
  return {
    id: Math.random().toString(36).slice(2),
    question: "Ethereum Up or Down",
    slug: "ethereum-up-or-down",
    endDate: EXPIRY,
    active: true,
    closed: false,
    acceptingOrders: true,
    outcomes: '["Up","Down"]',
    outcomePrices: '["0.50","0.50"]',
    clobTokenIds: '["111","222"]',
    liquidityNum: "20000",
    volumeNum: "100000",
    bestBid: "0.49",
    bestAsk: "0.50",
    ...over,
  };
}

test("normalize parses Gamma stringified arrays (C1) — correct YES/NO + token ids", () => {
  const m = normalize(
    gammaMarket({
      slug: "eth-up-or-down-4h",
      outcomes: '["Up","Down"]',
      outcomePrices: '["0.63","0.37"]',
      clobTokenIds: '["AAA","BBB"]',
    }),
  );
  assert.ok(m, "should normalize stringified market");
  assert.equal(m!.yes, 0.63);
  assert.equal(m!.no, 0.37);
  assert.equal(m!.yesTokenId, "AAA");
  assert.equal(m!.noTokenId, "BBB");
});

test("normalize maps YES to the Up index even when Down is first (stringified)", () => {
  const m = normalize(
    gammaMarket({
      slug: "eth-up-or-down-4h",
      outcomes: '["Down","Up"]',
      outcomePrices: '["0.40","0.60"]',
      clobTokenIds: '["DOWN","UP"]',
    }),
  );
  assert.ok(m);
  assert.equal(m!.yes, 0.6);
  assert.equal(m!.no, 0.4);
  assert.equal(m!.yesTokenId, "UP");
  assert.equal(m!.noTokenId, "DOWN");
});

test("isEthUpDown + parseDuration", () => {
  assert.ok(isEthUpDown(gammaMarket({ question: "Ethereum Up or Down 4H" })));
  assert.equal(isEthUpDown(gammaMarket({ question: "Will BTC hit 100k?", slug: "btc" })), false);
  assert.equal(parseDuration(gammaMarket({ slug: "ethereum-up-or-down-4h" })), "4H");
  assert.equal(parseDuration(gammaMarket({ question: "Ethereum Up or Down (Hourly)" })), "1H");
  assert.equal(parseDuration(gammaMarket({ slug: "eth-up-or-down-15-minute" })), "15M");
  assert.equal(parseDuration(gammaMarket({ slug: "eth-up-or-down-5-minute" })), "5M");
});

test("parseDuration handles Polymarket's real slug forms", () => {
  // programmatic token slugs
  assert.equal(parseDuration(gammaMarket({ slug: "eth-updown-5m-1782919500", question: "Ethereum Up or Down - July 2, 11:00AM-11:05AM ET" })), "5M");
  assert.equal(parseDuration(gammaMarket({ slug: "eth-updown-15m-1782918900", question: "Ethereum Up or Down - July 2, 11:00AM-11:15AM ET" })), "15M");
  assert.equal(parseDuration(gammaMarket({ slug: "eth-updown-4h-1782907200", question: "Ethereum Up or Down - July 1, 8AM-12PM ET" })), "4H");
  // descriptive hourly form (no explicit 1h/hourly token, single hour label)
  assert.equal(parseDuration(gammaMarket({ slug: "ethereum-up-or-down-july-1-2026-11am-et", question: "Ethereum Up or Down - July 1, 11AM ET" })), "1H");
});

test("evaluateGroup flags a 4H-vs-1H signal above threshold (from Gamma data)", () => {
  const a = normalize(gammaMarket({ slug: "eth-up-or-down-4h", outcomePrices: '["0.63","0.37"]' }))!;
  const b = normalize(gammaMarket({ slug: "eth-up-or-down-hourly", outcomePrices: '["0.55","0.45"]' }))!;
  assert.equal(groupByExpiry([a, b]).size, 1);

  const evals = evaluateGroup([a, b], THRESHOLDS, Date.parse("2030-01-01T15:00:00Z"));
  assert.equal(evals.length, 1);
  const e = evals[0]!;
  assert.ok(e.isOpportunity, e.reasons.join("; "));
  assert.ok(Math.abs(e.opp.yes_spread - 0.08) < 1e-9);
  assert.equal(e.opp.duration_a, "4H");
  assert.equal(e.opp.duration_b, "1H");
  assert.ok(e.opp.yes_token_a && e.opp.yes_token_b, "token ids carried for trade path");
});

test("below-threshold spread is not a signal", () => {
  const a = normalize(gammaMarket({ slug: "eth-up-or-down-4h", outcomePrices: '["0.52","0.48"]' }))!;
  const b = normalize(gammaMarket({ slug: "eth-up-or-down-hourly", outcomePrices: '["0.50","0.50"]' }))!;
  const evals = evaluateGroup([a, b], THRESHOLDS, Date.parse("2030-01-01T15:00:00Z"));
  assert.equal(evals[0]!.isOpportunity, false);
  assert.ok(evals[0]!.reasons.some((r) => r.includes("spread")));
});

test("low liquidity disqualifies", () => {
  const a = normalize(gammaMarket({ slug: "eth-up-or-down-4h", outcomePrices: '["0.63","0.37"]', liquidityNum: "100" }))!;
  const b = normalize(gammaMarket({ slug: "eth-up-or-down-hourly", outcomePrices: '["0.55","0.45"]' }))!;
  const evals = evaluateGroup([a, b], THRESHOLDS, Date.now());
  assert.equal(evals[0]!.isOpportunity, false);
  assert.ok(evals[0]!.reasons.some((r) => r.includes("liquidity")));
});

test("different expiries never group together", () => {
  const a = normalize(gammaMarket({ slug: "eth-up-or-down-4h", endDate: "2030-01-01T16:00:00Z" }))!;
  const b = normalize(gammaMarket({ slug: "eth-up-or-down-hourly", endDate: "2030-01-01T17:00:00Z" }))!;
  assert.equal(groupByExpiry([a, b]).size, 2);
});
