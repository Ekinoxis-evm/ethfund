---
description: Deploy the scanner worker as a long-running service (Railway)
---

Deploy `scanner/` as a long-running worker.

1. Typecheck + build: `cd scanner && npm run typecheck && npm run build`.
2. Ensure the Polymarket CLI binary is available in the deploy image (build it in the Dockerfile/build step, or vendor the release binary). The worker reads `POLYMARKET_CLI_BIN`.
3. Set the service env from `.env.example` section A (Supabase service-role, Resend, thresholds) in the platform dashboard — never commit secrets.
4. Deploy (`railway up` — gated by an `ask` permission). Confirm logs show scan loops and `scan_runs` rows appearing in Supabase.

Note: the worker must run where Polymarket's API is reachable (not geofenced).
