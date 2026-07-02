-- ethfund dashboard: public read + Realtime for opportunities/scan_runs, token ids for trade path.
-- Applied to project rooclfwqvmwehaqmtflp (creditline).

alter table public.opportunities add column if not exists yes_token_a text;
alter table public.opportunities add column if not exists no_token_a  text;
alter table public.opportunities add column if not exists yes_token_b text;
alter table public.opportunities add column if not exists no_token_b  text;

-- Public read of market signal data (no secrets). Service-role retains full write access.
drop policy if exists "opportunities anon read" on public.opportunities;
create policy "opportunities anon read" on public.opportunities
  for select to anon using (true);

drop policy if exists "scan_runs anon read" on public.scan_runs;
create policy "scan_runs anon read" on public.scan_runs
  for select to anon using (true);

-- Realtime publication (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opportunities'
  ) then
    alter publication supabase_realtime add table public.opportunities;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scan_runs'
  ) then
    alter publication supabase_realtime add table public.scan_runs;
  end if;
end $$;
