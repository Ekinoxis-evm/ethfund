---
name: vercel-cli
description: Deploy and operate the ethfund web/ app on Vercel via the Vercel CLI (token auth, env vars, cron, regions). Use when deploying, setting env, checking logs, or configuring the Vercel project.
---

# Vercel CLI (ethfund deploy)

The live app is `web/` (Next.js App Router). It deploys to the **Ekinoxis** team
(`team_jxTNRBmimeErr5ULGBepXlL0`). Install once: `npm i -g vercel` (or use `npx vercel@latest`).
Pair with the `vercel` MCP (`.mcp.json`) for logs/inspection and the bundled `vercel:*` plugin skills.

## Auth (non-interactive)

Use a token from https://vercel.com/account/tokens as `--token` (or `VERCEL_TOKEN` env). Never commit it.

```bash
export VERCEL_TOKEN=…            # scope: Ekinoxis team
export VERCEL_ORG_ID=team_jxTNRBmimeErr5ULGBepXlL0
```

## Link + deploy (run from web/)

```bash
cd web
vercel link --yes --token "$VERCEL_TOKEN" --scope ekinoxis-team   # creates/links the project
vercel deploy --token "$VERCEL_TOKEN"                              # preview
vercel deploy --prod --token "$VERCEL_TOKEN"                       # production
```

Root directory is `web/` — if importing via dashboard, set **Root Directory = web**. Framework: Next.js.

## Environment variables

Set every key the app needs (see `web/.env.example`). NEXT_PUBLIC_* are build-time (inlined), so set
them **before** the build and redeploy after changes.

```bash
# add to production (repeat for preview/development as needed)
printf '%s' "$VALUE" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --token "$VERCEL_TOKEN"
vercel env ls --token "$VERCEL_TOKEN"
vercel env pull .env.local --token "$VERCEL_TOKEN"   # sync down for local dev
```

Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable),
`SUPABASE_SERVICE_ROLE_KEY` (secret — cron writes), `CRON_SECRET`, `RESEND_API_KEY`, `ALERT_FROM`,
`ALERT_TO`, thresholds (`MIN_SPREAD`…`PAIRS`), `NEXT_PUBLIC_TRADING=off`.

## Cron

`web/vercel.json` schedules `GET /api/scan` at `* * * * *` (every minute). **Requires a paid tier**
(Hobby crons only run daily). Vercel sends `Authorization: Bearer $CRON_SECRET`; the route rejects
otherwise. The scan function pins `runtime="nodejs"`, `maxDuration=60`, `preferredRegion="fra1"`
(read reachability only — not a trading-compliance control).

## Logs / debug

```bash
vercel ls --token "$VERCEL_TOKEN"
vercel inspect <deployment-url> --token "$VERCEL_TOKEN"
vercel logs <deployment-url> --token "$VERCEL_TOKEN"
```
Or use the `vercel` MCP: `get_deployment_build_logs`, `get_runtime_logs`, `list_deployments`.

## Gotchas

- **Polymarket is geofenced** — the cron only returns data from a permitted region; `fra1` helps but
  verify with a manual `GET /api/scan` (with the bearer secret) after deploy.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` as `NEXT_PUBLIC_*`.
- After changing NEXT_PUBLIC_* env, redeploy (they're baked at build time).
