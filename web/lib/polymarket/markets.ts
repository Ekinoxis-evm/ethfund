export type Duration = "4H" | "1H" | "15M" | "5M";

/**
 * Raw market after gamma.ts has parsed Gamma's stringified-JSON fields into arrays.
 * (Gamma HTTP returns outcomes / outcomePrices / clobTokenIds as JSON strings — gamma.ts JSON.parses
 * them before constructing this. `normalize` below also tolerates strings as a defensive fallback.)
 */
export interface RawMarket {
  id: string;
  question?: string;
  slug?: string;
  conditionId?: string;
  endDate?: string;
  startDate?: string;
  /** When the market's price window opens — the "price to beat" is the ETH price at this instant. */
  eventStartTime?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  outcomes?: string[] | string;
  outcomePrices?: (number | string)[] | string;
  clobTokenIds?: string[] | string;
  volume?: number | string;
  volumeNum?: number | string;
  liquidity?: number | string;
  liquidityNum?: number | string;
  bestBid?: number | string;
  bestAsk?: number | string;
  spread?: number | string;
}

export interface Market {
  id: string;
  slug: string;
  question: string;
  duration: Duration;
  expiryAt: Date;
  expiryKey: string;
  /** Window start (from Gamma eventStartTime); undefined when Gamma omits it. */
  startAt?: Date;
  yes: number;
  no: number;
  yesTokenId?: string;
  noTokenId?: string;
  liquidity: number;
  volume: number;
  bidAskSpread: number;
  bestBid?: number;
  bestAsk?: number;
  open: boolean;
}

function toNum(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Tolerate both real arrays and Gamma's JSON-encoded string arrays. */
function asArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isEthUpDown(m: RawMarket): boolean {
  const hay = `${m.question ?? ""} ${m.slug ?? ""}`.toLowerCase();
  const isEth = /\beth\b|ethereum/.test(hay);
  const isUpDown = /up\s*(or|\/|-)?\s*down|up-or-down/.test(hay);
  return isEth && isUpDown;
}

export function parseDuration(m: RawMarket): Duration | null {
  const slug = (m.slug ?? "").toLowerCase();
  const hay = `${slug} ${(m.question ?? "").toLowerCase()}`;

  // Polymarket's programmatic slugs: eth-updown-{5m,15m,1h,4h}-{unixts}
  if (/eth-updown-4h|\b4\s*h(our)?s?\b|4-?hour|four[\s-]?hour/.test(hay)) return "4H";
  if (/eth-updown-1h|hourly|\b1\s*h(our)?\b|1-?hour|\bone[\s-]?hour/.test(hay)) return "1H";
  if (/eth-updown-15m|\b15\s*m(in)?(ute)?s?\b|15-?min/.test(hay)) return "15M";
  if (/eth-updown-5m|\b5\s*m(in)?(ute)?s?\b|5-?min/.test(hay)) return "5M";

  // Descriptive hourly form, e.g. slug `ethereum-up-or-down-july-1-2026-11am-et`
  // (a single hour label, no HH:MM range like the 5M/15M markets have) → treat as 1H.
  if (/up-or-down.*\b\d{1,2}\s*(am|pm)\b.*\bet\b/.test(hay) && !/\d{1,2}:\d{2}/.test(hay)) return "1H";

  return null;
}

function yesIndex(outcomes: string[]): number {
  if (!outcomes.length) return 0;
  const i = outcomes.findIndex((o) => /^(up|yes)$/i.test(String(o).trim()));
  return i >= 0 ? i : 0;
}

function minuteKey(d: Date): string {
  return new Date(Math.round(d.getTime() / 60000) * 60000).toISOString();
}

export function normalize(m: RawMarket): Market | null {
  const duration = parseDuration(m);
  if (!duration) return null;
  if (!m.endDate) return null;
  const expiryAt = new Date(m.endDate);
  if (Number.isNaN(expiryAt.getTime())) return null;

  const outcomes = asArray<string>(m.outcomes);
  const prices = asArray<number | string>(m.outcomePrices).map((p) => toNum(p));
  const tokenIds = asArray<string>(m.clobTokenIds).map((t) => String(t));

  const yi = yesIndex(outcomes);
  const ni = yi === 0 ? 1 : 0;
  const yes = prices[yi];
  const no = prices[ni] ?? (yes !== undefined ? 1 - yes : undefined);
  if (yes === undefined || no === undefined) return null;

  const bestBid = toNum(m.bestBid);
  const bestAsk = toNum(m.bestAsk);
  const bidAskSpread =
    bestBid !== undefined && bestAsk !== undefined
      ? Math.abs(bestAsk - bestBid)
      : (toNum(m.spread) ?? Number.POSITIVE_INFINITY);

  const open = (m.active ?? true) && !(m.closed ?? false) && (m.acceptingOrders ?? true);

  let startAt: Date | undefined;
  if (m.eventStartTime) {
    const d = new Date(m.eventStartTime);
    if (!Number.isNaN(d.getTime())) startAt = d;
  }

  return {
    id: m.id,
    slug: m.slug ?? m.id,
    question: m.question ?? m.slug ?? m.id,
    duration,
    expiryAt,
    expiryKey: minuteKey(expiryAt),
    startAt,
    yes,
    no,
    yesTokenId: tokenIds[yi],
    noTokenId: tokenIds[ni],
    liquidity: toNum(m.liquidityNum) ?? toNum(m.liquidity) ?? 0,
    volume: toNum(m.volumeNum) ?? toNum(m.volume) ?? 0,
    bidAskSpread,
    bestBid,
    bestAsk,
    open,
  };
}

export function groupByExpiry(markets: Market[]): Map<string, Market[]> {
  const groups = new Map<string, Market[]>();
  for (const m of markets) {
    const g = groups.get(m.expiryKey);
    if (g) g.push(m);
    else groups.set(m.expiryKey, [m]);
  }
  return groups;
}
