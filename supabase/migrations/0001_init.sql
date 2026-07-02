-- ethfund — Polymarket temporal-arbitrage scanner schema
-- opportunities: one row per detected opportunity window (upserted, drives alert dedup + backtesting)
-- scan_runs:     one row per scan loop (observability)
--
-- Auth model: the scanner worker is the only writer, using the Supabase SERVICE-ROLE key
-- (bypasses RLS). RLS is ON with no permissive policies, so anon/authenticated clients get nothing.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- opportunities
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.opportunities (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  pair                text        not null,              -- e.g. '4H-vs-1H'
  expiry_at           timestamptz not null,              -- shared exact expiry of both markets

  market_a_id         text        not null,              -- longer-duration market (e.g. 4H)
  market_b_id         text        not null,              -- shorter-duration market (e.g. 1H)
  market_a_slug       text,
  market_b_slug       text,
  duration_a          text,                              -- '4H' | '1H' | '15M' | '5M'
  duration_b          text,

  yes_a               numeric     not null,              -- probability 0..1
  yes_b               numeric     not null,
  no_a                numeric     not null,
  no_b                numeric     not null,
  yes_spread          numeric     not null,              -- |yes_a - yes_b|
  no_spread           numeric     not null,              -- |no_a - no_b|
  best_bid_ask_spread numeric,                           -- worst of the two markets' bid-ask spreads

  liquidity_usd       numeric,                           -- min(liquidityNum) across the pair
  volume_usd          numeric,                           -- min(volumeNum) across the pair
  time_remaining_sec  integer,                           -- seconds until expiry at detection
  eth_price           numeric,                           -- informational (price to beat context)

  status              text        not null default 'opportunity',  -- 'opportunity' | 'below_threshold' | 'closed'
  alerted             boolean     not null default false,          -- email dedup latch
  alerted_at          timestamptz,
  final_result        text,                                        -- backtesting: filled after expiry

  -- one logical opportunity per (pair of markets, shared expiry); upsert target
  constraint opportunities_window_uniq unique (market_a_id, market_b_id, expiry_at)
);

create index if not exists opportunities_expiry_idx     on public.opportunities (expiry_at);
create index if not exists opportunities_created_idx     on public.opportunities (created_at desc);
create index if not exists opportunities_pair_idx        on public.opportunities (pair);
create index if not exists opportunities_alerted_idx     on public.opportunities (alerted) where alerted = false;

-- keep updated_at fresh on upsert (fixed search_path — no role-mutable path)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- scan_runs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.scan_runs (
  id                  uuid primary key default gen_random_uuid(),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  markets_scanned     integer     not null default 0,
  groups              integer     not null default 0,
  pairs_compared      integer     not null default 0,
  opportunities_found integer     not null default 0,
  alerts_sent         integer     not null default 0,
  error               text
);

create index if not exists scan_runs_started_idx on public.scan_runs (started_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: on, no policies → only service-role (and postgres) can read/write.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.opportunities enable row level security;
alter table public.scan_runs     enable row level security;
