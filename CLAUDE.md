# ethfund — project memory

@AGENTS.md

**ethfund** is a **temporal-arbitrage scanner** for Polymarket's **ETH Up or Down** markets. It continuously monitors the 4H / 1H / 15M / 5M "ETH Up or Down" markets, groups the markets that **expire at the exact same instant**, and raises an alert when the YES/NO probability spread between two same-expiry markets exceeds a configured threshold (with liquidity / volume / bid-ask filters). It does **not** predict ETH's price — it detects temporary mispricings between markets that resolve on the same underlying move. Opportunities are persisted to Supabase (history → backtesting) and emailed via Resend. This file is the shared project memory for Claude Code — keep it current.

The full functional spec is `polia/Scanner de Arbitraje Temporal para Polymarket.docx.md` (ES). New collaborators: read `README.md` first.

## Live deployment

- **Repo:** https://github.com/Ekinoxis-evm/ethfund — connected to Vercel (root directory `web`);
  pushes to `main` auto-deploy to production. The Rust CLI (`polia/polymarket-cli`) is a local
  clone with local patches and is gitignored — not part of the GitHub repo.
- **Dashboard:** https://ethfund.vercel.app (Vercel, team `ekinoxis-team`, project `ethfund`). Source in `web/`.
  `/settings` (admin passcode) edits scanner thresholds live — stored in Supabase `scanner_settings`,
  audited in `settings_changes`, applied on the next scan tick; env vars are the fallback.
- **Scanner endpoint:** `GET /api/scan` (fra1, `runtime=nodejs`) — fetches Polymarket Gamma over HTTP,
  evaluates, writes Supabase, emails via Resend. Gated by `Authorization: Bearer $CRON_SECRET`.
- **Cadence:** driven by **Supabase pg_cron** — job `ethfund-scan` (`* * * * *`) on the creditline
  project calls `net.http_get` against `/api/scan` every minute, with the bearer token read from
  Supabase Vault secret `ethfund_cron_secret` (Vercel Hobby rejects per-minute native crons).
  Pause with `select cron.unschedule('ethfund-scan');`; responses land in `net._http_response`.
- **Gamma quirks (verified live):** `limit` caps at 100/request (paginate); the scanner queries the
  next-5h `endDate` window ascending. Duration parsing: 5M/15M/4H use slug `eth-updown-{dur}-{ts}`;
  the **1H (hourly)** market uses a descriptive slug like `ethereum-up-or-down-<date>-<h>am-et` with
  no duration token — handled in `web/lib/polymarket/markets.ts:parseDuration`.

## The strategy (why it works)

Polymarket runs several ETH Up/Down markets in parallel (4H, Hourly, 15M, 5M), each with its own start time and **Price To Beat**. At certain moments two of them **end at the same wall-clock time** (e.g. the 12:00→16:00 4H market and the 15:00→16:00 1H market both resolve at 16:00). During that overlap both markets depend on essentially the same remaining ETH move, so their probabilities **should converge** — when they don't, there's a temporary inefficiency. The scanner only ever **compares markets inside the same expiry group**.

Comparisons (spec §7): **4H vs 1H** (when 1h remains) · **1H vs 15M** (15m remains) · **15M vs 5M** (5m remains); optional 4H-vs-15M, 4H-vs-5M, 1H-vs-5M. **v1 ships 4H-vs-1H only**; the rest are wired in grouping but gated off.

Alert when (spec §12): same exact expiry ✔ · `max(yesSpread, noSpread) ≥ MIN_SPREAD` ✔ · liquidity ≥ `MIN_LIQUIDITY` ✔ · bid-ask spread ≤ `MAX_BIDASK` ✔ · both markets open ✔. Spreads (spec §11): `yesSpread = |YES_A − YES_B|`, `noSpread = |NO_A − NO_B|`.

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Market data engine | **polymarket-cli** (Rust) | Existing CLI in `polia/polymarket-cli`. The scanner shells out to it with `-o json` — we do **not** reimplement the Polymarket API. Build once: `cargo build --release`. |
| Scanner worker | **Node + TypeScript** | `scanner/`. The scan loop: fetch → group by expiry → evaluate → persist → alert. Deploy as a long-running worker (Railway). |
| History / backend | **Supabase** | Postgres on the shared **`creditline`** project (ref `rooclfwqvmwehaqmtflp`, `https://rooclfwqvmwehaqmtflp.supabase.co`). Tables `opportunities` (+ backtest result) and `scan_runs` — **applied & live**. RLS on, **no policies** → service-role-only (worker uses the service-role key); same posture as that project's kredito tables. |
| Alerts | **Resend** | `resend` npm SDK. One email per opportunity window (dedup) — never one per loop. |
| Onchain checks | **Blockscout** (MCP) | Verify token/contract/tx state when debugging market resolution. |

## Run loop

```bash
# 1. Build the data engine once
cd polia/polymarket-cli && cargo build --release

# 2. Run the scanner
cd scanner && npm install
npm run scan -- --once --dry-run   # offline: print markets, groups, spreads — no DB/email
npm run scan                       # full loop: persist + alert every SCAN_INTERVAL_MS
```

Edit thresholds via env (see `.env.example`). The CLI binary path is `POLYMARKET_CLI_BIN`.

## Conventions

- **Always `-o json`** when invoking the CLI from code. Parse stdout; treat non-zero exit / `{"error":...}` as failure.
- **Never commit secrets.** Secrets live in `scanner/.env` (gitignored) and the deploy platform's env, never in code or chat. AI agents are the #1 credential leak vector.
- **Dedup alerts.** Email only when an opportunity window flips `alerted` false→true. A persistent 6% spread emails once.
- **Verify state before coding.** Polymarket market shapes, token IDs and decimals change — check live JSON (`markets get <slug>`, `clob book <token_id>`) before trusting field names. USDC = 6 decimals.
- **Read-only.** v1 is monitoring + alerting only — no order placement. Any CLI command that signs/sends (orders, approvals, transfers) is gated behind an `ask` permission.
- TypeScript strict; no `any` in shared code.

## Skills available (`.claude/skills/` → `.agents/skills/`)

- **polymarket-cli** — how to drive the Rust CLI for market/CLOB data (commands, JSON shapes, fields).
- **arbitrage-scanner** — the temporal-arbitrage strategy, expiry grouping, thresholds, spread math.
- **resend** — sending alert emails via the Resend SDK + dedup pattern.
- **blockscout** — onchain reads/debugging via the Blockscout MCP.
- **supabase** — DB conventions, RLS, migrations for this project.
- **vercel-cli** — deploy/operate the `web/` app on Vercel (token auth, env, cron, regions). The CLI
  runs via `npx vercel@latest` (global install needs sudo here). The bundled `vercel:*` plugin skills
  (deploy, env, vercel-cli, bootstrap, status) and the `vercel` MCP are also available.

## MCP servers (`.mcp.json`)

- **context7** — live library docs ("use context7").
- **supabase** — read-only project access (needs `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`).
- **blockscout** — explorer reads (tx/address/contract/token), multichain. Optional `BLOCKSCOUT_PRO_API_KEY`.
- **github** — repos/PRs/issues (OAuth via `/mcp`).
- **vercel** — deployments/logs/docs (OAuth via `/mcp`).

After editing `.mcp.json`, restart Claude Code and run `/mcp` to authorize OAuth servers and check status.

## Layout

```
polia/
  polymarket-cli/   # Rust data engine (existing) — built to target/release/polymarket
  Scanner ... .md   # functional spec (ES)
scanner/            # TS worker: src/{config,cli,markets,clob,arbitrage,supabase,resend,index}.ts
supabase/           # migrations/0001_init.sql (opportunities + scan_runs)
.claude/            # settings, commands, agents, skills (symlinks)
.agents/skills/     # real skill dirs
.mcp.json           # MCP servers
AGENTS.md           # generic agent guidance (imported above)
```
