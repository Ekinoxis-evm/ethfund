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

## Strikes ("price to beat") — the rigidity caveat

**Each market resolves against ITS OWN starting price**, not a shared one: UP iff the Chainlink
ETH/USD price at window end ≥ the price at that market's `eventStartTime` (Gamma exposes the
timestamp but **not** the strike value). Two same-expiry markets opened at different times, so their
strikes differ (e.g. 4H opened at $1,720, 1H at $1,722). A strike gap means their probabilities
should NOT be equal even with zero inefficiency — a raw probability spread partly reflects the strike
gap, not mispricing. Perfect convergence never happens; expect ~$1–2 gaps (user feedback, Jul 2026).

## Overlap windows (spec §7) — when a pair is comparable

A pair is only meaningful during its **overlap window** — the shorter leg's lifetime (4H-vs-1H in
the 4H market's final hour; 1H-vs-15M in the final 15 min; 15M-vs-5M in the final 5 min). Before the
shorter leg's `eventStartTime`, its Gamma prices are ~50/50 placeholders and any "spread" is noise.
The dashboard's **Opportunity radar** encodes this as a status ladder — WAITING (overlap not open;
shows "live in Xm") → LIVE (verdict `strike-explained` / `UNEXPLAINED` via
`web/lib/spreadLogic.ts:classifySpread`) → SIGNAL (passes thresholds). Overlap open time = the later
of the two legs' `startAt`. Convergence per window (spec §17: did the spread close before expiry?)
is computed from `pair_windows.first_spread/min_spread` via `spreadLogic.ts:convergence`.

**Any future signal logic must be strike-aware**: compare spreads against the strike gap + remaining
time, don't treat raw spread as pure mispricing. Data available for this:

- `web/lib/polymarket/pyth.ts` — ETH/USD at any past timestamp (`ethPriceAt`), live spot (`ethSpot`),
  batch per-market strikes (`strikesFor`). Source: Pyth Hermes (public, keyless, works from fra1).
  Display-grade: resolution uses Chainlink data streams (credentialed) — Pyth tracks within cents.
- `pair_snapshots.price_to_beat_a/b` + `eth_spot` — strike context persisted every scan tick since
  migration 0004, for backtesting strike-aware rules.
- `/api/markets` returns per-market `priceToBeat`/`priceDiff` and per-pair `strikeDiff`.

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
