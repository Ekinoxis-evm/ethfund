---
name: supabase
description: Supabase (Postgres) conventions for ethfund — schema, RLS, service-role access, and migrations for the opportunities/scan_runs history. Use when changing the DB schema, querying history, or wiring the worker's DB client.
---

# Supabase (history + alert dedup)

The scanner persists opportunities for alerting + backtesting. Auth is **not** end-user — the worker
is the only writer and uses the **service-role** key (server-only, bypasses RLS).

## Project + migrations

- Manage the project via the Supabase MCP (`.mcp.json` → `supabase`, needs `SUPABASE_PROJECT_REF` +
  `SUPABASE_ACCESS_TOKEN`). The MCP is `--read-only`; apply DDL via the MCP `apply_migration` tool.
- Schema source of truth: `supabase/migrations/0001_init.sql`.
- After changes, run the MCP `get_advisors` (security + performance) and address RLS / index findings.

## Tables

- **`opportunities`** — one row per detected opportunity window, upserted on
  `(market_a_id, market_b_id, expiry_at)`. Holds YES/NO prices, spreads, liquidity, volume,
  time-remaining, status, `alerted` (bool, drives email dedup), and nullable `final_result`
  (backtesting).
- **`scan_runs`** — one row per loop: counts of markets scanned, groups, opportunities found, errors.

## Rules

- RLS **on**; no anon/public access. The worker connects with the service-role key only — never ship
  that key to a browser.
- Idempotent writes: upsert on the window key so re-detecting the same opportunity updates, not
  duplicates.
- USDC amounts are numeric USDC (the source `volumeNum`/`liquidityNum` are already human units).

The on-disk supabase skill (`supabase/agent-skills`) and the bundled `supabase` plugin skill have
deeper Postgres best-practices; this file is the project-specific overlay.
