# ethfund — Polymarket temporal-arbitrage scanner

Monitors Polymarket's **ETH Up or Down** markets (4H / 1H / 15M / 5M), groups the ones that **expire at
the same instant**, and alerts when the YES/NO probability spread between two same-expiry markets
exceeds a threshold (with liquidity / volume / bid-ask filters). Opportunities are stored in Supabase
(history → backtesting) and emailed via Resend. It does **not** predict ETH — it detects temporary
mispricings between markets that resolve on the same move.

Functional spec: [`polia/Scanner de Arbitraje Temporal para Polymarket.docx.md`](polia/) (ES).
Agent guidance: [`CLAUDE.md`](CLAUDE.md) + [`AGENTS.md`](AGENTS.md).

## Architecture

```
polia/polymarket-cli   Rust CLI — the read-only data engine (markets + CLOB), JSON output
        │  -o json
        ▼
scanner/ (TypeScript)  fetch ETH Up/Down → group by expiry → evaluate spreads → persist + alert
        │                                                         │            │
        ▼                                                         ▼            ▼
   Supabase (opportunities + scan_runs, RLS, service-role)   Resend email   (Railway worker)
```

The scanner shells out to the CLI (`-o json`) — we don't reimplement the Polymarket API. The core
alert decision uses market-level fields (`outcomePrices`, `liquidityNum`, `volumeNum`, `bestBid`,
`bestAsk`, `spread`, `endDate`); set `USE_CLOB=true` to refine best bid/ask from the live order book.

## Setup

### 1. Build the data engine (once)

```bash
cd polia/polymarket-cli
cargo build --release        # binary → target/release/polymarket
```

> The `agent`/`telegram` subcommands are behind a Cargo `agent` feature (off by default — their
> upstream deps don't currently compile and the scanner doesn't need them). The default build has
> everything the scanner uses.

### 2. Configure env

Copy `.env.example` → `scanner/.env` and fill: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `ALERT_FROM` (a Resend-verified sender), `ALERT_TO`. Thresholds have spec defaults.
For the MCP tooling, also fill the root `.env` (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
optional `BLOCKSCOUT_PRO_API_KEY`).

### 3. Supabase

The schema is **already applied** to the shared `creditline` project
(ref `rooclfwqvmwehaqmtflp`, `https://rooclfwqvmwehaqmtflp.supabase.co`) — tables `opportunities`
(upserted per window; drives email dedup + backtesting) and `scan_runs`. To target a different
project later, re-apply `supabase/migrations/0001_init.sql` via the Supabase MCP (`/db-migrate`) or
`supabase db push`. Put the **service-role** key (dashboard → Project Settings → API keys) in
`scanner/.env`.

### 4. Run the scanner

```bash
cd scanner
npm install
npm run scan -- --once --dry-run    # offline: prints markets, expiry groups, spreads — no DB/email
npm run scan                        # full loop: persist + alert every SCAN_INTERVAL_MS
npm test                            # offline logic tests (grouping, spreads, thresholds)
```

## Configuration (env)

| Key | Default | Meaning |
|-----|---------|---------|
| `MIN_SPREAD` | `0.05` | Min YES/NO probability spread to alert (5%) |
| `MIN_LIQUIDITY` | `5000` | Min liquidity (USDC) on the thinner market |
| `MIN_VOLUME` | `20000` | Min volume (USDC) on the thinner market |
| `MAX_BIDASK` | `0.02` | Max acceptable bid-ask spread on either market |
| `SCAN_INTERVAL_MS` | `5000` | Loop cadence |
| `PAIRS` | `4H-vs-1H` | Comma list. Others: `1H-vs-15M`, `15M-vs-5M`, `4H-vs-15M`, `4H-vs-5M`, `1H-vs-5M` |
| `USE_CLOB` | `false` | Refine best bid/ask via `clob book` (extra calls) |

## Deploy

The scanner is a long-running worker — deploy on Railway (or any always-on host). See `/deploy-worker`.
Vercel functions aren't suited to a sub-minute loop. A read-only dashboard over `opportunities` can be
added later.

## Notes

- **v1 is read-only** — monitoring + alerting only, no order placement.
- **v1 ships 4H-vs-1H**; the other pairs are wired into grouping and enabled via `PAIRS`.
- **Geofencing**: Polymarket's API is geo-restricted; if the CLI returns connection errors, run from a
  reachable network. This is environmental, not a code bug.

## Workspace tooling

- **MCP** (`.mcp.json`): context7, supabase, blockscout, github, vercel. Run `/mcp` to authorize OAuth.
- **Skills** (`.claude/skills/` → `.agents/skills/`): polymarket-cli, arbitrage-scanner, resend,
  blockscout, supabase.
- **Commands**: `/scan`, `/db-migrate`, `/deploy-worker`. **Agents**: arbitrage-analyst,
  integrations-engineer.
