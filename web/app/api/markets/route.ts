import { NextResponse } from "next/server";
import { loadThresholds } from "@/lib/settings";
import { fetchEthUpDown } from "@/lib/polymarket/gamma";
import { groupByExpiry, type Market } from "@/lib/polymarket/markets";
import { evaluateGroup } from "@/lib/polymarket/arbitrage";
import { ethSpot, strikesFor } from "@/lib/polymarket/pyth";
import type { MarketItem, MarketsGroup, MarketsResponse, PairItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "fra1";

// Gamma pagination takes seconds; share one fetch across pollers per lambda instance.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; payload: MarketsResponse } | null = null;

function toMarketItem(
  m: Market,
  now: number,
  strikes: Map<string, number>,
  spot: number | null,
): MarketItem {
  const priceToBeat = strikes.get(m.id) ?? null;
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
    startAt: m.startAt ? m.startAt.toISOString() : null,
    priceToBeat,
    priceDiff: priceToBeat !== null && spot !== null ? spot - priceToBeat : null,
  };
}

async function buildResponse(): Promise<MarketsResponse> {
  const now = Date.now();
  const [markets, thresholds, spot] = await Promise.all([
    fetchEthUpDown(),
    loadThresholds(),
    ethSpot(),
  ]);
  const strikes = await strikesFor(markets);
  const groups = groupByExpiry(markets);

  const out: MarketsGroup[] = [];
  for (const [expiryKey, group] of groups) {
    const startedById = new Map(
      group.map((m) => [m.id, m.startAt === undefined || m.startAt.getTime() <= now]),
    );
    const startAtById = new Map(group.map((m) => [m.id, m.startAt?.toISOString() ?? null]));
    const pairs: PairItem[] = evaluateGroup(group, thresholds, now).map(
      ({ opp, isOpportunity, reasons }) => {
        const strikeA = strikes.get(opp.market_a_id) ?? null;
        const strikeB = strikes.get(opp.market_b_id) ?? null;
        return {
          pair: opp.pair,
          yesSpread: opp.yes_spread,
          noSpread: opp.no_spread,
          spread: Math.max(opp.yes_spread, opp.no_spread),
          liq: opp.liquidity_usd,
          vol: opp.volume_usd,
          bidask: Number.isFinite(opp.best_bid_ask_spread) ? opp.best_bid_ask_spread : null,
          ok: isOpportunity,
          reasons,
          strikeDiff: strikeA !== null && strikeB !== null ? strikeA - strikeB : null,
          durationA: opp.duration_a,
          durationB: opp.duration_b,
          upA: opp.yes_a,
          upB: opp.yes_b,
          downA: opp.no_a,
          downB: opp.no_b,
          strikeA,
          strikeB,
          slugA: opp.market_a_slug,
          slugB: opp.market_b_slug,
          timeRemainingSec: opp.time_remaining_sec,
          startedA: startedById.get(opp.market_a_id) ?? true,
          startedB: startedById.get(opp.market_b_id) ?? true,
          startAtA: startAtById.get(opp.market_a_id) ?? null,
          startAtB: startAtById.get(opp.market_b_id) ?? null,
        };
      },
    );
    out.push({
      expiryAt: expiryKey,
      markets: group
        .slice()
        .sort((a, b) => a.duration.localeCompare(b.duration))
        .map((m) => toMarketItem(m, now, strikes, spot)),
      pairs,
    });
  }
  out.sort((a, b) => a.expiryAt.localeCompare(b.expiryAt));

  return {
    generatedAt: new Date(now).toISOString(),
    ethSpot: spot,
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
