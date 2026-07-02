---
name: polymarket-cli
description: Drive the Rust polymarket-cli as a read-only data engine for Polymarket market and CLOB order-book data. Use when fetching markets, prices, liquidity, volume, expiry, or order books from TypeScript/shell with JSON output.
---

# polymarket-cli (data engine)

The CLI lives at `polia/polymarket-cli`. Build once: `cargo build --release` → binary at
`polia/polymarket-cli/target/release/polymarket`. **Always pass `-o json`** when calling from code.

The `agent` and `telegram` subcommands are behind a Cargo `agent` feature (off by default; their
upstream deps don't compile). The scanner only needs `markets` and `clob` — both in the default build.

## Commands the scanner uses

```bash
polymarket -o json markets list   --active true --limit 100 --order volumeNum
polymarket -o json markets search "ETH Up or Down" --limit 20
polymarket -o json markets get   <id-or-slug>
polymarket -o json clob book     <tokenId>        # full order book (bids/asks)
polymarket -o json clob spread   <tokenId>        # bid-ask spread
polymarket -o json clob price    <tokenId> --side buy
polymarket -o json clob midpoint <tokenId>
```

## Market JSON shape (camelCase — verified against SDK v0.4.2)

A market object includes (all optional, snake→camel):
`id`, `question`, `slug`, `conditionId`, `endDate` (ISO datetime), `startDate`, `active`, `closed`,
`acceptingOrders`, `enableOrderBook`, `outcomes` (`["Up","Down"]` array), `outcomePrices` (parallel
decimal array, probabilities 0–1), `volume`, `volumeNum`, `volume24hr`, `liquidity`, `liquidityNum`,
`clobTokenIds` (parallel token-id array), `bestBid`, `bestAsk`, `spread`.

**Map outcomes by name, not position** — find the index of `Up`/`Yes` in `outcomes`, then read the
same index in `outcomePrices` / `clobTokenIds`. Prices are probabilities (0–1); liquidity/volume are USDC.

## CLOB order book shape

`clob book <tokenId>` → `{ bids: [{price,size}...], asks: [{price,size}...] , ... }`.
Best bid = max bid price; best ask = min ask price; bid-ask spread = bestAsk − bestBid.

## Failure handling

Non-zero exit or a `{"error": "..."}` JSON payload = failure; surface it. Polymarket's API is
geofenced — connection resets mean "run from a reachable network", not a code bug.
