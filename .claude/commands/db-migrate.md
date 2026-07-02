---
description: Apply the Supabase schema migration via the Supabase MCP
---

Apply `supabase/migrations/0001_init.sql` to the configured Supabase project.

1. Confirm `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` are set (the Supabase MCP needs them). If no project exists yet, create one via the MCP `create_project` (run `get_cost`/`confirm_cost` first) and capture the new ref.
2. Read `supabase/migrations/0001_init.sql` and apply it with the Supabase MCP `apply_migration` tool (name `init`).
3. Verify with `list_tables` — expect `opportunities` and `scan_runs`.
4. Run `get_advisors` (security + performance) and report any findings (e.g. RLS, missing indexes).
