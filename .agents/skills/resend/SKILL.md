---
name: resend
description: Send transactional/alert emails via Resend from Node/TypeScript. Use when wiring email alerts, the resend SDK, verified senders, or dedup of repeated notifications.
---

# Resend (alert emails)

The scanner emails arbitrage opportunities via Resend.

## Setup

- Create an API key at https://resend.com → `RESEND_API_KEY`.
- Verify a sending domain (or use Resend's onboarding sender for testing). `ALERT_FROM` must be a
  verified address/domain, e.g. `alerts@yourdomain.com`.
- `ALERT_TO` may be comma-separated for multiple recipients.

## SDK usage

```ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: process.env.ALERT_FROM!,
  to: process.env.ALERT_TO!.split(",").map((s) => s.trim()),
  subject: `⚡ Arb 4H-vs-1H · ${spreadPct}% · expires ${expiry}`,
  html: renderOpportunityCard(opp),
});
```

## Rules

- **Dedup**: send only when an opportunity window first crosses the threshold (`alerted` false→true).
  Never email every loop for the same standing spread.
- Honor `DRY_RUN` — log the email instead of sending.
- Never log the full API key. Handle send errors without crashing the scan loop (log + continue).
- Keep the body self-contained HTML (spec §14 card: pair, expiry, YES A/B, spread, liquidity, volume,
  time remaining, status).

Docs: https://resend.com/docs — append "use context7" for live API details.
