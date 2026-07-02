# AGENTS.md

Guidance for coding agents working in **ethfund**. The canonical project memory is **`CLAUDE.md`** (which imports this file); where they differ, `CLAUDE.md` wins.

## What this repo is

A temporal-arbitrage scanner for Polymarket ETH Up/Down markets. A Rust CLI (`polia/polymarket-cli`) is the read-only data engine; a TypeScript worker (`scanner/`) runs the scan loop, persists to Supabase, and emails alerts via Resend. Read-only — no order placement in v1.

## Repo map

```
polia/polymarket-cli/   Rust data engine (build: cargo build --release)
polia/Scanner ... .md    functional spec (Spanish)
scanner/                TypeScript worker
supabase/migrations/    SQL schema
.claude/ .agents/        agents, commands, skills, settings
.mcp.json                MCP servers
```

## Common commands

```bash
# Data engine (build once; binary at target/release/polymarket)
cd polia/polymarket-cli && cargo build --release        # default features (no agent/telegram)

# Sanity-check the engine
./polia/polymarket-cli/target/release/polymarket -o json markets list --limit 3
./polia/polymarket-cli/target/release/polymarket -o json markets get <slug>
./polia/polymarket-cli/target/release/polymarket -o json clob book <tokenId>

# Scanner
cd scanner && npm install
npm run scan -- --once --dry-run    # offline diagnostics: markets, groups, spreads (no DB/email)
npm run scan                        # full loop
npm run build && npm run typecheck
```

> The `agent` and `telegram` CLI subcommands are behind a Cargo `agent` feature (off by default) because their upstream deps don't currently compile and the scanner doesn't need them. Build them only with `cargo build --release --features agent` after fixing those deps.

## Rules (carry-over)

- **Verify state before coding.** Inspect live JSON (`markets get`, `clob book`) before trusting field names/decimals. The CLI emits **camelCase** keys (`outcomePrices`, `clobTokenIds`, `endDate`, `bestBid`, `bestAsk`, `volumeNum`, `liquidityNum`). USDC = 6 decimals.
- **Never commit secrets.** `scanner/.env` is gitignored; reading `.env*` is denied in `.claude/settings.json`.
- **Always `-o json`** from code; handle `{"error": ...}` payloads and non-zero exits.
- **Idempotent alerts.** Dedup on the opportunity window so a standing spread emails once.
- TypeScript strict, no `any` in shared code. Prettier defaults.

## Where Polymarket is reachable

Polymarket's Gamma/CLOB APIs are geofenced and may reset connections from some networks/CI. If `markets list` returns a connection error, run from a network where Polymarket is reachable (or via VPN). This is environmental, not a code bug.
