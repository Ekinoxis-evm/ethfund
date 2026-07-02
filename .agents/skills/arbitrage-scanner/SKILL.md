---
name: arbitrage-scanner
description: The temporal-arbitrage strategy for Polymarket ETH Up/Down markets — expiry grouping, spread math, and alert thresholds. Use when implementing or reviewing the scan loop, grouping, or opportunity evaluation.
---

# Temporal-arbitrage scanner (ETH Up/Down)

Full spec: `polia/Scanner de Arbitraje Temporal para Polymarket.docx.md` (ES).

## Idea

Polymarket runs parallel ETH Up/Down markets of different durations (4H, 1H/Hourly, 15M, 5M). At
moments two of them **end at the same instant** (e.g. 12:00→16:00 4H and 15:00→16:00 1H both resolve
at 16:00). During the overlap both depend on the same remaining ETH move, so their probabilities
should converge — when they don't, there's a temporary, tradeable inefficiency. Never compare markets
across different expiries.

## Algorithm (each loop)

1. Fetch active ETH Up/Down markets (`markets search "ETH Up or Down"` / `markets list`).
2. Keep markets whose question matches ETH Up/Down; classify duration (`4H | 1H | 15M | 5M`) from
   slug/question text.
3. Group by exact `endDate` (to the minute).
4. Within each group, for each configured pair (v1: **4H-vs-1H**) compute spreads.
5. Apply thresholds → opportunity.
6. Persist (`opportunities`, `scan_runs`) and alert (dedup).

## Math (spec §11)

- `yesSpread = |YES_A − YES_B|`, `noSpread = |NO_A − NO_B|`  (YES = the Up/Yes outcome price).
- Potential gain ≈ `spread − costs − slippage` (informational).

## Alert conditions (spec §12) — ALL must hold

- same exact expiry ✔
- `max(yesSpread, noSpread) ≥ MIN_SPREAD` (default 0.05)
- `min(liquidityNum) ≥ MIN_LIQUIDITY` (default 5000 USDC)
- `min(volumeNum) ≥ MIN_VOLUME` (default 20000 USDC)
- bid-ask spread ≤ `MAX_BIDASK` (default 0.02) on both markets (market `spread`, or CLOB bestAsk−bestBid)
- both markets open: `active && !closed && acceptingOrders`

## History (spec §15)

Persist date/time, pair, expiry, both market ids/slugs, YES/NO prices, spreads, liquidity, volume,
time-remaining, status, and a nullable `final_result` for later backtesting. Dedup alerts per window
`(market_a_id, market_b_id, expiry_at)` so a standing spread emails once.
