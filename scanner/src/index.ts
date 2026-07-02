import { config } from "./config.js";
import { fetchEthUpDown, groupByExpiry, type Market } from "./markets.js";
import { bookTop } from "./clob.js";
import { evaluateGroup, type Evaluation, type Opportunity } from "./arbitrage.js";
import {
  dbConfigured,
  recordScanRun,
  upsertOpportunity,
  markAlerted,
  type ScanRunStats,
} from "./supabase.js";
import { sendAlert, emailConfigured } from "./resend.js";

const dryRun = config.flags.dryRun;
const persist = !dryRun && dbConfigured();
const alertedKeys = new Set<string>(); // in-memory dedup fallback (no DB / dry-run)

function windowKey(o: Opportunity): string {
  return `${o.market_a_id}|${o.market_b_id}|${o.expiry_at}`;
}

/** Optionally refine each market's bid/ask via the live CLOB book (USE_CLOB=true). */
async function enrichWithClob(groups: Map<string, Market[]>): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const markets of groups.values()) {
    if (markets.length < 2) continue;
    for (const m of markets) {
      if (!m.yesTokenId) continue;
      tasks.push(
        bookTop(m.yesTokenId)
          .then((t) => {
            if (t.bestBid !== undefined) m.bestBid = t.bestBid;
            if (t.bestAsk !== undefined) m.bestAsk = t.bestAsk;
            if (t.bidAskSpread !== undefined) m.bidAskSpread = t.bidAskSpread;
          })
          .catch(() => {
            /* keep market-level spread on failure */
          }),
      );
    }
  }
  await Promise.all(tasks);
}

async function scanOnce(): Promise<ScanRunStats> {
  const now = Date.now();
  const markets = await fetchEthUpDown();
  const groups = groupByExpiry(markets);
  if (config.useClob) await enrichWithClob(groups);

  let pairsCompared = 0;
  let opportunitiesFound = 0;
  let alertsSent = 0;

  const opportunities: Evaluation[] = [];
  for (const group of groups.values()) {
    const evals = evaluateGroup(group, config, now);
    pairsCompared += evals.length;
    for (const e of evals) if (e.isOpportunity) opportunities.push(e);
  }

  // Logging summary
  const multi = [...groups.values()].filter((g) => g.length >= 2).length;
  console.log(
    `[scan] ${markets.length} ETH Up/Down markets · ${groups.size} expiry groups (${multi} comparable) · ${pairsCompared} pairs · ${opportunities.length} opportunities`,
  );

  for (const { opp } of opportunities) {
    opportunitiesFound++;
    const key = windowKey(opp);
    const spreadPct = (Math.max(opp.yes_spread, opp.no_spread) * 100).toFixed(1);
    console.log(`  🟢 ${opp.pair} @ ${opp.expiry_at} — spread ${spreadPct}% liq $${opp.liquidity_usd.toFixed(0)} vol $${opp.volume_usd.toFixed(0)}`);

    let alreadyAlerted: boolean;
    if (persist) {
      ({ alreadyAlerted } = await upsertOpportunity(opp));
    } else {
      alreadyAlerted = alertedKeys.has(key);
    }

    if (!alreadyAlerted) {
      await sendAlert(opp, dryRun);
      alertedKeys.add(key);
      if (persist) await markAlerted(opp);
      if (!dryRun) alertsSent++;
    }
  }

  // In dry-run, also show the near-misses for the configured pairs (debugging aid).
  if (dryRun) {
    for (const group of groups.values()) {
      for (const e of evaluateGroup(group, config, now)) {
        if (!e.isOpportunity)
          console.log(`  ▫︎ ${e.opp.pair} @ ${e.opp.expiry_at} — skip: ${e.reasons.join("; ")}`);
      }
    }
  }

  return {
    markets_scanned: markets.length,
    groups: groups.size,
    pairs_compared: pairsCompared,
    opportunities_found: opportunitiesFound,
    alerts_sent: alertsSent,
  };
}

async function tick(): Promise<void> {
  try {
    const stats = await scanOnce();
    if (persist) await recordScanRun(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scan:error] ${message}`);
    if (persist) {
      try {
        await recordScanRun({
          markets_scanned: 0,
          groups: 0,
          pairs_compared: 0,
          opportunities_found: 0,
          alerts_sent: 0,
          error: message,
        });
      } catch {
        /* swallow logging error */
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `[ethfund-scanner] pairs=${config.pairs.join(",")} minSpread=${config.minSpread} minLiq=${config.minLiquidity} minVol=${config.minVolume} maxBidAsk=${config.maxBidAsk} interval=${config.scanIntervalMs}ms`,
  );
  console.log(
    `[ethfund-scanner] mode=${dryRun ? "DRY-RUN (no DB/email)" : "LIVE"} persist=${persist ? "supabase" : "in-memory"} email=${emailConfigured() ? "resend" : "disabled"} cli=${config.cliBin}`,
  );

  if (config.flags.once) {
    await tick();
    return;
  }

  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log("\n[ethfund-scanner] shutting down…");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    const started = Date.now();
    await tick();
    const elapsed = Date.now() - started;
    const wait = Math.max(0, config.scanIntervalMs - elapsed);
    if (stopping) break;
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
