import { NextResponse } from "next/server";
import { loadThresholds } from "@/lib/settings";
import { fetchEthUpDown } from "@/lib/polymarket/gamma";
import { groupByExpiry, type Market } from "@/lib/polymarket/markets";
import { evaluateGroup } from "@/lib/polymarket/arbitrage";
import type { MarketItem, MarketsGroup, MarketsResponse, PairItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "fra1";

// Gamma pagination takes seconds; share one fetch across pollers per lambda instance.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; payload: MarketsResponse } | null = null;

function toMarketItem(m: Market, now: number): MarketItem {
  return {
    id: m.id,
    slug: m.slug,
    question: m.question,
    duration: m.duration,
    yes: m.yes,
    no: m.no,
    liquidity: m.liquidity,
    volume: m.volume,
    bidAskSpread: Number.isFinite(m.bidAskSpread) ? m.bidAskSpread : null,
    timeRemainingSec: Math.max(0, Math.round((m.expiryAt.getTime() - now) / 1000)),
    open: m.open,
    url: `https://polymarket.com/market/${m.slug}`,
  };
}

async function buildResponse(): Promise<MarketsResponse> {
  const now = Date.now();
  const [markets, thresholds] = await Promise.all([fetchEthUpDown(), loadThresholds()]);
  const groups = groupByExpiry(markets);

  const out: MarketsGroup[] = [];
  for (const [expiryKey, group] of groups) {
    const pairs: PairItem[] = evaluateGroup(group, thresholds, now).map(
      ({ opp, isOpportunity, reasons }) => ({
        pair: opp.pair,
        yesSpread: opp.yes_spread,
        noSpread: opp.no_spread,
        spread: Math.max(opp.yes_spread, opp.no_spread),
        liq: opp.liquidity_usd,
        vol: opp.volume_usd,
        bidask: Number.isFinite(opp.best_bid_ask_spread) ? opp.best_bid_ask_spread : null,
        ok: isOpportunity,
        reasons,
      }),
    );
    out.push({
      expiryAt: expiryKey,
      markets: group
        .slice()
        .sort((a, b) => a.duration.localeCompare(b.duration))
        .map((m) => toMarketItem(m, now)),
      pairs,
    });
  }
  out.sort((a, b) => a.expiryAt.localeCompare(b.expiryAt));

  return {
    generatedAt: new Date(now).toISOString(),
    thresholds: {
      minSpread: thresholds.minSpread,
      minLiquidity: thresholds.minLiquidity,
      minVolume: thresholds.minVolume,
      maxBidAsk: thresholds.maxBidAsk,
      pairs: thresholds.pairs,
      source: thresholds.source,
      updatedAt: thresholds.updatedAt,
    },
    groups: out,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  try {
    const payload = await buildResponse();
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
