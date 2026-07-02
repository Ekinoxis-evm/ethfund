-- ethfund: dashboard-managed scanner settings, audit log, per-tick pair snapshots.
-- Applied to project rooclfwqvmwehaqmtflp (creditline).

-- Single-row scanner settings, edited from the dashboard. Env vars remain the fallback.
create table if not exists public.scanner_settings (
  id            int primary key default 1 check (id = 1),
  min_spread    numeric not null check (min_spread >= 0 and min_spread <= 1),
  min_liquidity numeric not null check (min_liquidity >= 0),
  min_volume    numeric not null check (min_volume >= 0),
  max_bidask    numeric not null check (max_bidask >= 0 and max_bidask <= 1),
  pairs         text[]  not null check (array_length(pairs, 1) >= 1),
  updated_at    timestamptz not null default now()
);

-- Seed with the thresholds currently live in Vercel env.
insert into public.scanner_settings (id, min_spread, min_liquidity, min_volume, max_bidask, pairs)
values (1, 0.05, 5000, 20000, 0.02, '{4H-vs-1H,1H-vs-15M,15M-vs-5M}')
on conflict (id) do nothing;

drop trigger if exists scanner_settings_updated_at on public.scanner_settings;
create trigger scanner_settings_updated_at
  before update on public.scanner_settings
  for each row execute function public.set_updated_at();

alter table public.scanner_settings enable row level security;
drop policy if exists "scanner_settings anon read" on public.scanner_settings;
create policy "scanner_settings anon read" on public.scanner_settings
  for select to anon using (true);

-- Audit log of settings changes ("changes we have done"). Admin-only: no anon policy;
-- read through the cookie-gated /api/settings/changes route via service role.
create table if not exists public.settings_changes (
  id         uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb not null,
  note       text
);
create index if not exists settings_changes_at_idx on public.settings_changes (changed_at desc);
alter table public.settings_changes enable row level security;

-- One row per compared pair per scan tick — spread history below the alert threshold,
-- for threshold tuning and backtesting. Raw metrics stored so any threshold set can be
-- re-evaluated later.
create table if not exists public.pair_snapshots (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  pair                text not null,
  expiry_at           timestamptz not null,
  market_a_id         text not null,
  market_b_id         text not null,
  yes_spread          numeric not null,
  no_spread           numeric not null,
  best_bid_ask_spread numeric,
  liquidity_usd       numeric,
  volume_usd          numeric,
  passed              boolean not null,
  reasons             text[] not null default '{}'
);
create index if not exists pair_snapshots_created_idx      on public.pair_snapshots (created_at desc);
create index if not exists pair_snapshots_pair_created_idx on public.pair_snapshots (pair, created_at desc);
alter table public.pair_snapshots enable row level security;
drop policy if exists "pair_snapshots anon read" on public.pair_snapshots;
create policy "pair_snapshots anon read" on public.pair_snapshots
  for select to anon using (true);

-- Retention: purge snapshots older than 30 days, daily at 03:17 UTC.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ethfund-purge-snapshots') then
    perform cron.unschedule('ethfund-purge-snapshots');
  end if;
  perform cron.schedule(
    'ethfund-purge-snapshots',
    '17 3 * * *',
    $sql$delete from public.pair_snapshots where created_at < now() - interval '30 days'$sql$
  );
end $$;
