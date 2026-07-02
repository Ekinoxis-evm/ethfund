import { runCli } from "./cli.js";

export type Duration = "4H" | "1H" | "15M" | "5M";

/** Raw market as emitted by `polymarket -o json markets ...` (camelCase, all optional). */
export interface RawMarket {
  id: string;
  question?: string;
  slug?: string;
  conditionId?: string;
  endDate?: string; // ISO datetime
  startDate?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  outcomes?: string[];
  outcomePrices?: (number | string)[];
  clobTokenIds?: string[];
  volume?: number | string;
  volumeNum?: number | string;
  liquidity?: number | string;
  liquidityNum?: number | string;
  bestBid?: number | string;
  bestAsk?: number | string;
  spread?: number | string;
}

/** Normalized market the scanner reasons about. */
export interface Market {
  id: string;
  slug: string;
  question: string;
  duration: Duration;
  expiryAt: Date;
  expiryKey: string; // minute-precision ISO key for grouping
  yes: number; // probability 0..1 of the Up/Yes outcome
  no: number;
  yesTokenId?: string;
  liquidity: number;
  volume: number;
  bidAskSpread: number; // market-level spread (bestAsk - bestBid, or `spread`)
  bestBid?: number;
  bestAsk?: number;
  open: boolean;
  raw: RawMarket;
}

function toNum(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Match ETH Up/Down markets by question/slug text. */
export function isEthUpDown(m: RawMarket): boolean {
  const hay = `${m.question ?? ""} ${m.slug ?? ""}`.toLowerCase();
  const isEth = /\beth\b|ethereum/.test(hay);
  const isUpDown = /up\s*(or|\/|-)?\s*down|up-or-down/.test(hay);
  return isEth && isUpDown;
}

/** Classify the market's duration window from its text; null if not one of the four. */
export function parseDuration(m: RawMarket): Duration | null {
  const hay = `${m.slug ?? ""} ${m.question ?? ""}`.toLowerCase();
  if (/\b4\s*h(our)?s?\b|4-?hour|four[\s-]?hour/.test(hay)) return "4H";
  if (/\b1\s*h(our)?\b|hourly|1-?hour|\bone[\s-]?hour/.test(hay)) return "1H";
  if (/\b15\s*m(in)?(ute)?s?\b|15-?min/.test(hay)) return "15M";
  if (/\b5\s*m(in)?(ute)?s?\b|5-?min/.test(hay)) return "5M";
  return null;
}

/** Index of the "Up"/"Yes" outcome, else 0. */
function yesIndex(outcomes: string[] | undefined): number {
  if (!outcomes?.length) return 0;
  const i = outcomes.findIndex((o) => /^(up|yes)$/i.test(o.trim()));
  return i >= 0 ? i : 0;
}

function minuteKey(d: Date): string {
  // round to the minute; ETH Up/Down markets resolve on minute boundaries
  return new Date(Math.round(d.getTime() / 60000) * 60000).toISOString();
}

/** Normalize a raw market; returns null if it can't be used (missing prices/expiry/duration). */
export function normalize(m: RawMarket): Market | null {
  const duration = parseDuration(m);
  if (!duration) return null;
  if (!m.endDate) return null;
  const expiryAt = new Date(m.endDate);
  if (Number.isNaN(expiryAt.getTime())) return null;

  const yi = yesIndex(m.outcomes);
  const ni = yi === 0 ? 1 : 0;
  const prices = (m.outcomePrices ?? []).map((p) => toNum(p));
  const yes = prices[yi];
  const no = prices[ni] ?? (yes !== undefined ? 1 - yes : undefined);
  if (yes === undefined || no === undefined) return null;

  const bestBid = toNum(m.bestBid);
  const bestAsk = toNum(m.bestAsk);
  const bidAskSpread =
    bestBid !== undefined && bestAsk !== undefined
      ? Math.abs(bestAsk - bestBid)
      : (toNum(m.spread) ?? Number.POSITIVE_INFINITY);

  const open =
    (m.active ?? true) && !(m.closed ?? false) && (m.acceptingOrders ?? true);

  return {
    id: m.id,
    slug: m.slug ?? m.id,
    question: m.question ?? m.slug ?? m.id,
    duration,
    expiryAt,
    expiryKey: minuteKey(expiryAt),
    yes,
    no,
    yesTokenId: m.clobTokenIds?.[yi],
    liquidity: toNum(m.liquidityNum) ?? toNum(m.liquidity) ?? 0,
    volume: toNum(m.volumeNum) ?? toNum(m.volume) ?? 0,
    bidAskSpread,
    bestBid,
    bestAsk,
    open,
    raw: m,
  };
}

/** Fetch active ETH Up/Down markets via the CLI (search, with a list fallback). */
export async function fetchEthUpDown(): Promise<Market[]> {
  let raw: RawMarket[] = [];
  try {
    raw = await runCli<RawMarket[]>(["markets", "search", "ETH Up or Down", "--limit", "50"]);
  } catch {
    // fall through to list
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    const listed = await runCli<RawMarket[]>([
      "markets",
      "list",
      "--active",
      "true",
      "--limit",
      "500",
    ]);
    raw = Array.isArray(listed) ? listed : [];
  }
  const out: Market[] = [];
  for (const m of raw) {
    if (!isEthUpDown(m)) continue;
    const n = normalize(m);
    if (n) out.push(n);
  }
  return out;
}

/** Group normalized markets by exact (minute) expiry. */
export function groupByExpiry(markets: Market[]): Map<string, Market[]> {
  const groups = new Map<string, Market[]>();
  for (const m of markets) {
    const g = groups.get(m.expiryKey);
    if (g) g.push(m);
    else groups.set(m.expiryKey, [m]);
  }
  return groups;
}
