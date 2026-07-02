import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { fetchEthUpDown, diagnose } from "@/lib/polymarket/gamma";
import { groupByExpiry } from "@/lib/polymarket/markets";
import { evaluateGroup, type Evaluation } from "@/lib/polymarket/arbitrage";
import {
  dbConfigured,
  recordScanRun,
  recordPairSnapshots,
  upsertOpportunity,
  markAlerted,
  type ScanRunStats,
} from "@/lib/supabase/server";
import { sendAlert } from "@/lib/resend";
import { loadThresholds } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "fra1"; // read reachability only — NOT a trading-compliance control

function authorized(req: Request): boolean {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Allow if it matches.
  const secret = serverConfig.cronSecret;
  if (!secret) return true; // no secret configured (local dev)
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function runScan(): Promise<ScanRunStats> {
  const now = Date.now();
  const thresholds = await loadThresholds();
  const markets = await fetchEthUpDown();
  const groups = groupByExpiry(markets);

  let alertsSent = 0;
  const allEvals: Evaluation[] = [];

  for (const group of groups.values()) {
    allEvals.push(...evaluateGroup(group, thresholds, now));
  }
  const pairsCompared = allEvals.length;
  const opportunities = allEvals.filter((e) => e.isOpportunity);

  const persist = dbConfigured();
  if (persist) await recordPairSnapshots(allEvals); // never throws — history must not break alerting
  for (const { opp } of opportunities) {
    if (!persist) continue;
    const { alreadyAlerted } = await upsertOpportunity(opp);
    if (!alreadyAlerted) {
      try {
        await sendAlert(opp);
        await markAlerted(opp);
        alertsSent++;
      } catch (err) {
        console.error(`[scan] alert failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    markets_scanned: markets.length,
    groups: groups.size,
    pairs_compared: pairsCompared,
    opportunities_found: opportunities.length,
    alerts_sent: alertsSent,
  };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (new URL(req.url).searchParams.get("debug") === "1") {
    try {
      const now = Date.now();
      const thresholds = await loadThresholds();
      const markets = await fetchEthUpDown();
      const groups = groupByExpiry(markets);
      const evals: Evaluation[] = [];
      for (const g of groups.values()) evals.push(...evaluateGroup(g, thresholds, now));
      const top = evals
        .sort((a, b) => Math.max(b.opp.yes_spread, b.opp.no_spread) - Math.max(a.opp.yes_spread, a.opp.no_spread))
        .slice(0, 8)
        .map((e) => ({
          pair: e.opp.pair,
          spread: +Math.max(e.opp.yes_spread, e.opp.no_spread).toFixed(4),
          liq: e.opp.liquidity_usd,
          vol: e.opp.volume_usd,
          bidask: e.opp.best_bid_ask_spread,
          ok: e.isOpportunity,
          reasons: e.reasons,
        }));
      return NextResponse.json({
        ok: true,
        thresholds: {
          minSpread: thresholds.minSpread,
          minLiquidity: thresholds.minLiquidity,
          minVolume: thresholds.minVolume,
          maxBidAsk: thresholds.maxBidAsk,
          pairs: thresholds.pairs,
          source: thresholds.source,
          updatedAt: thresholds.updatedAt,
        },
        pairsCompared: evals.length,
        topPairs: top,
        durations: await diagnose(),
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  try {
    const stats = await runScan();
    if (dbConfigured()) await recordScanRun(stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scan:error] ${message}`);
    if (dbConfigured()) {
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
        /* ignore logging failure */
      }
    }
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
