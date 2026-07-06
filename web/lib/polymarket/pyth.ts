/**
 * ETH/USD prices via Pyth's public Hermes API — used for each market's
 * "price to beat" (ETH price at the market's window start) and the live spot.
 *
 * Display-grade only: Polymarket resolves these markets on Chainlink's ETH/USD
 * data stream, which we cannot query without credentials. Pyth tracks it to
 * within cents, which is enough to reason about strike gaps between markets.
 *
 * Invariant: never throws — callers render "—" on null.
 */

const HERMES = "https://hermes.pyth.network/v2/updates/price";
const ETH_USD_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

interface HermesParsed {
  parsed?: { price?: { price?: string; expo?: number; publish_time?: number } }[];
}

function extractPrice(body: HermesParsed): number | null {
  const p = body.parsed?.[0]?.price;
  if (!p || p.price === undefined || p.expo === undefined) return null;
  const n = Number(p.price) * Math.pow(10, p.expo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchHermes(path: string): Promise<number | null> {
  try {
    const res = await fetch(`${HERMES}/${path}${path.includes("?") ? "&" : "?"}ids[]=${ETH_USD_ID}&parsed=true`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return extractPrice((await res.json()) as HermesParsed);
  } catch {
    return null;
  }
}

// Strikes are immutable once the window has started — cache forever (per lambda instance).
const strikeCache = new Map<number, number>();
const STRIKE_CACHE_MAX = 2000;

/** ETH/USD at a past unix-second timestamp (a market's window start). Null if in the future or unavailable. */
export async function ethPriceAt(tsSec: number): Promise<number | null> {
  if (!Number.isFinite(tsSec) || tsSec * 1000 > Date.now()) return null;
  const cached = strikeCache.get(tsSec);
  if (cached !== undefined) return cached;
  const price = await fetchHermes(String(Math.floor(tsSec)));
  if (price !== null) {
    if (strikeCache.size >= STRIKE_CACHE_MAX) strikeCache.clear();
    strikeCache.set(tsSec, price);
  }
  return price;
}

let spotCache: { at: number; price: number } | null = null;
const SPOT_TTL_MS = 10_000;

/** Live ETH/USD spot, cached ~10s per instance. */
export async function ethSpot(): Promise<number | null> {
  if (spotCache && Date.now() - spotCache.at < SPOT_TTL_MS) return spotCache.price;
  const price = await fetchHermes("latest");
  if (price !== null) spotCache = { at: Date.now(), price };
  return price;
}

/** Batch strike lookup for markets, deduped by start timestamp. Returns marketId → strike. */
export async function strikesFor(
  markets: { id: string; startAt?: Date }[],
): Promise<Map<string, number>> {
  const byTs = new Map<number, string[]>();
  for (const m of markets) {
    if (!m.startAt) continue;
    const ts = Math.floor(m.startAt.getTime() / 1000);
    const ids = byTs.get(ts);
    if (ids) ids.push(m.id);
    else byTs.set(ts, [m.id]);
  }
  const out = new Map<string, number>();
  await Promise.all(
    [...byTs.entries()].map(async ([ts, ids]) => {
      const price = await ethPriceAt(ts);
      if (price !== null) for (const id of ids) out.set(id, price);
    }),
  );
  return out;
}
