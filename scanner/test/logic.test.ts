import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEthUpDown,
  parseDuration,
  normalize,
  groupByExpiry,
  type RawMarket,
} from "../src/markets.js";
import { evaluateGroup } from "../src/arbitrage.js";
import { config } from "../src/config.js";

const EXPIRY = "2030-01-01T16:00:00.000Z";

function mk(over: Partial<RawMarket>): RawMarket {
  return {
    id: Math.random().toString(36).slice(2),
    question: "Ethereum Up or Down",
    slug: "ethereum-up-or-down",
    endDate: EXPIRY,
    active: true,
    closed: false,
    acceptingOrders: true,
    outcomes: ["Up", "Down"],
    outcomePrices: ["0.50", "0.50"],
    clobTokenIds: ["111", "222"],
    liquidityNum: "20000",
    volumeNum: "100000",
    bestBid: "0.49",
    bestAsk: "0.50",
    ...over,
  };
}

test("isEthUpDown matches ETH up/down, rejects others", () => {
  assert.ok(isEthUpDown(mk({ question: "Ethereum Up or Down 4H" })));
  assert.ok(isEthUpDown(mk({ slug: "eth-up-or-down-hourly", question: "ETH Up/Down" })));
  assert.equal(isEthUpDown(mk({ question: "Will BTC hit 100k?", slug: "btc-100k" })), false);
});

test("parseDuration classifies the four windows", () => {
  assert.equal(parseDuration(mk({ slug: "ethereum-up-or-down-4h" })), "4H");
  assert.equal(parseDuration(mk({ question: "Ethereum Up or Down (Hourly)" })), "1H");
  assert.equal(parseDuration(mk({ slug: "eth-up-or-down-15-minute" })), "15M");
  assert.equal(parseDuration(mk({ slug: "eth-up-or-down-5-minute" })), "5M");
  assert.equal(parseDuration(mk({ slug: "eth-up-or-down-daily" })), null);
});

test("normalize maps YES to the Up outcome index", () => {
  const m = normalize(mk({ slug: "eth-up-or-down-4h", outcomes: ["Down", "Up"], outcomePrices: ["0.40", "0.60"] }));
  assert.ok(m);
  assert.equal(m!.yes, 0.6); // Up is index 1 here
  assert.equal(m!.no, 0.4);
  assert.equal(m!.yesTokenId, "222");
});

test("evaluateGroup flags a 4H-vs-1H opportunity above threshold", () => {
  const a = normalize(mk({ slug: "eth-up-or-down-4h", outcomePrices: ["0.63", "0.37"] }))!;
  const b = normalize(mk({ slug: "eth-up-or-down-hourly", outcomePrices: ["0.55", "0.45"] }))!;
  const group = [a, b];
  assert.equal(groupByExpiry(group).size, 1, "same expiry → one group");

  const evals = evaluateGroup(group, config, Date.parse("2030-01-01T15:00:00Z"));
  assert.equal(evals.length, 1);
  const e = evals[0]!;
  assert.ok(e.isOpportunity, `expected opportunity, got: ${e.reasons.join("; ")}`);
  assert.ok(Math.abs(e.opp.yes_spread - 0.08) < 1e-9);
  assert.equal(e.opp.duration_a, "4H");
  assert.equal(e.opp.duration_b, "1H");
  assert.ok(e.opp.time_remaining_sec > 0);
});

test("below-threshold spread is not an opportunity", () => {
  const a = normalize(mk({ slug: "eth-up-or-down-4h", outcomePrices: ["0.52", "0.48"] }))!;
  const b = normalize(mk({ slug: "eth-up-or-down-hourly", outcomePrices: ["0.50", "0.50"] }))!;
  const evals = evaluateGroup([a, b], config, Date.parse("2030-01-01T15:00:00Z"));
  assert.equal(evals[0]!.isOpportunity, false);
  assert.ok(evals[0]!.reasons.some((r) => r.includes("spread")));
});

test("low liquidity disqualifies an otherwise-good spread", () => {
  const a = normalize(mk({ slug: "eth-up-or-down-4h", outcomePrices: ["0.63", "0.37"], liquidityNum: "100" }))!;
  const b = normalize(mk({ slug: "eth-up-or-down-hourly", outcomePrices: ["0.55", "0.45"] }))!;
  const evals = evaluateGroup([a, b], config, Date.now());
  assert.equal(evals[0]!.isOpportunity, false);
  assert.ok(evals[0]!.reasons.some((r) => r.includes("liquidity")));
});

test("different expiries never group together", () => {
  const a = normalize(mk({ slug: "eth-up-or-down-4h", endDate: "2030-01-01T16:00:00Z" }))!;
  const b = normalize(mk({ slug: "eth-up-or-down-hourly", endDate: "2030-01-01T17:00:00Z" }))!;
  assert.equal(groupByExpiry([a, b]).size, 2);
});
