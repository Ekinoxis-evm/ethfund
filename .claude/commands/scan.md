---
description: Run the arbitrage scanner once in offline dry-run mode (no DB/email)
---

Run a single offline scan and report results — no Supabase writes, no Resend emails.

1. Ensure the data engine is built: if `polia/polymarket-cli/target/release/polymarket` is missing, run `cd polia/polymarket-cli && cargo build --release`.
2. Run `cd scanner && npm run scan -- --once --dry-run`.
3. Summarize: how many ETH Up/Down markets were fetched, the expiry groups found, any same-expiry pairs for the configured `PAIRS`, and for each pair the YES/NO spreads vs `MIN_SPREAD` and whether liquidity/volume/bid-ask filters pass.
4. If the CLI returns a connection error, note that Polymarket is geofenced from this network (run from a reachable network); this is not a code bug.

$ARGUMENTS may override flags (e.g. a different `--pairs`).
