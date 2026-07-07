-- ethfund: convergence fields on the pair_windows history view (spec §17 v2).
-- first/min/last spread per compared window → did the spread converge before
-- expiry, and how fast? View-only change; aggregates compute over existing rows.

-- CREATE OR REPLACE can't reorder view columns — drop and recreate.
drop view if exists public.pair_windows;

create view public.pair_windows
with (security_invoker = on) as
select
  s.pair,
  s.expiry_at,
  s.market_a_id,
  s.market_b_id,
  count(*)::int as samples,
  max(greatest(s.yes_spread, s.no_spread)) as max_spread,
  avg(greatest(s.yes_spread, s.no_spread)) as avg_spread,
  (array_agg(greatest(s.yes_spread, s.no_spread) order by s.created_at asc))[1]  as first_spread,
  (array_agg(greatest(s.yes_spread, s.no_spread) order by s.created_at desc))[1] as last_spread,
  min(greatest(s.yes_spread, s.no_spread)) as min_spread,
  min(s.created_at) as first_seen,
  max(s.created_at) as last_seen,
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
