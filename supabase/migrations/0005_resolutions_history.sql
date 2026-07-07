-- ethfund: market resolutions ("how they went") + per-window history rollup.
-- Resolutions are computed retroactively by the scan tick: ETH/USD at expiry (Pyth)
-- vs the market's strike → 'up' | 'down'. pair_windows aggregates snapshots per
-- compared window and joins both legs' resolutions for the dashboard history view.

-- Leg prices on snapshots (needed to evaluate "would buying the cheap side have paid").
alter table public.pair_snapshots add column if not exists yes_a numeric;
alter table public.pair_snapshots add column if not exists yes_b numeric;
alter table public.pair_snapshots add column if not exists no_a  numeric;
alter table public.pair_snapshots add column if not exists no_b  numeric;

create table if not exists public.market_resolutions (
  market_id     text primary key,
  expiry_at     timestamptz not null,
  strike        numeric not null,
  eth_at_expiry numeric not null,
  resolved      text not null check (resolved in ('up','down')),
  created_at    timestamptz not null default now()
);
create index if not exists market_resolutions_expiry_idx on public.market_resolutions (expiry_at desc);
alter table public.market_resolutions enable row level security;
drop policy if exists "market_resolutions anon read" on public.market_resolutions;
create policy "market_resolutions anon read" on public.market_resolutions
  for select to anon using (true);

-- Expired snapshot legs (with a known strike) that have no resolution yet.
create or replace function public.pending_resolutions(limit_n int default 40)
returns table(market_id text, expiry_at timestamptz, strike numeric)
language sql stable
set search_path = ''
as $$
  with legs as (
    select s.market_a_id as market_id, s.expiry_at, max(s.price_to_beat_a) as strike
    from public.pair_snapshots s group by 1, 2
    union all
    select s.market_b_id, s.expiry_at, max(s.price_to_beat_b)
    from public.pair_snapshots s group by 1, 2
  )
  select l.market_id, l.expiry_at, max(l.strike) as strike
  from legs l
  left join public.market_resolutions r on r.market_id = l.market_id
  where r.market_id is null
    and l.expiry_at < now() - interval '30 seconds'
  group by l.market_id, l.expiry_at
  having max(l.strike) is not null
  order by l.expiry_at desc
  limit limit_n;
$$;

-- One row per compared window: spread stats, strikes, last leg prices, resolutions.
create or replace view public.pair_windows
with (security_invoker = on) as
select
  s.pair,
  s.expiry_at,
  s.market_a_id,
  s.market_b_id,
  count(*)::int as samples,
  max(greatest(s.yes_spread, s.no_spread)) as max_spread,
  avg(greatest(s.yes_spread, s.no_spread)) as avg_spread,
  max(s.price_to_beat_a) as strike_a,
  max(s.price_to_beat_b) as strike_b,
  min(s.liquidity_usd) as min_liquidity,
  (array_agg(s.yes_a order by s.created_at desc))[1] as last_up_a,
  (array_agg(s.yes_b order by s.created_at desc))[1] as last_up_b,
  bool_or(s.passed) as ever_passed,
  ra.resolved as resolved_a,
  rb.resolved as resolved_b,
  ra.eth_at_expiry
from public.pair_snapshots s
left join public.market_resolutions ra on ra.market_id = s.market_a_id
left join public.market_resolutions rb on rb.market_id = s.market_b_id
group by s.pair, s.expiry_at, s.market_a_id, s.market_b_id,
         ra.resolved, rb.resolved, ra.eth_at_expiry;
