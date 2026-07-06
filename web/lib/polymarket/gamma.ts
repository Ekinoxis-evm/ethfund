import { isEthUpDown, normalize, type Market, type RawMarket } from "./markets";

const GAMMA = "https://gamma-api.polymarket.com";

/** Gamma returns these as JSON-encoded strings; parse to arrays before normalize(). */
function parseArrayField(v: unknown): unknown {
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function toRaw(m: Record<string, unknown>): RawMarket {
  return {
    ...(m as unknown as RawMarket),
    id: String(m.id ?? ""),
    outcomes: parseArrayField(m.outcomes) as RawMarket["outcomes"],
    outcomePrices: parseArrayField(m.outcomePrices) as RawMarket["outcomePrices"],
    clobTokenIds: parseArrayField(m.clobTokenIds) as RawMarket["clobTokenIds"],
  };
}

async function fetchPage(limit: number, offset: number): Promise<Record<string, unknown>[]> {
  // Markets resolving soon (the temporal-arb window): end within the next ~5h, ascending by end.
  // This clusters the 5M/15M/1H/4H ETH Up/Down markets that share an upcoming expiry, and keeps
  // the payload small. Gamma caps `limit` at 100 per request, so callers paginate.
  const now = new Date();
  const maxEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    closed: "false",
    active: "true",
    limit: String(limit),
    offset: String(offset),
    order: "endDate",
    ascending: "true",
    end_date_min: now.toISOString(),
    end_date_max: maxEnd.toISOString(),
  });
  const res = await fetch(`${GAMMA}/markets?${params.toString()}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gamma /markets ${res.status} ${res.statusText}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Gamma /markets: unexpected response shape");
  return data as Record<string, unknown>[];
}

async function fetchRaw(opts?: { pages?: number; pageSize?: number }): Promise<RawMarket[]> {
  const pageSize = opts?.pageSize ?? 100; // Gamma caps limit at 100/request
  const pages = opts?.pages ?? 8; // up to 800 markets in the next-5h window
  const raw: RawMarket[] = [];
  for (let i = 0; i < pages; i++) {
    const page = await fetchPage(pageSize, i * pageSize);
    for (const m of page) raw.push(toRaw(m));
    if (page.length < pageSize) break;
  }
  return raw;
}

/**
 * Fetch active ETH Up/Down markets from the Gamma HTTP API, parse stringified arrays, and normalize.
 */
export async function fetchEthUpDown(opts?: { pages?: number; pageSize?: number }): Promise<Market[]> {
  const raw = await fetchRaw(opts);
  const out: Market[] = [];
  for (const m of raw) {
    if (!isEthUpDown(m)) continue;
    const n = normalize(m);
    if (n) out.push(n);
  }
  return out;
}

/** Debug: full raw Gamma objects for a few ETH Up/Down markets (caller must be bearer-gated). */
export async function fetchRawEthSamples(count = 4): Promise<RawMarket[]> {
  const raw = await fetchRaw({ pages: 2 });
  return raw.filter(isEthUpDown).slice(0, count);
}

/** Diagnostics: what Gamma returns vs what the ETH-Up/Down filter + duration parser match. */
export async function diagnose(opts?: { pages?: number; pageSize?: number }): Promise<{
  rawCount: number;
  ethCount: number;
  normalizedCount: number;
  ethSamples: { question?: string; slug?: string; endDate?: string; duration: string | null }[];
  rawSamples: { question?: string; slug?: string }[];
}> {
  const { parseDuration } = await import("./markets");
  const raw = await fetchRaw(opts);
  const eth = raw.filter(isEthUpDown);
  const normalized = eth.map(normalize).filter(Boolean);
  return {
    rawCount: raw.length,
    ethCount: eth.length,
    normalizedCount: normalized.length,
    ethSamples: eth.slice(0, 12).map((m) => ({
      question: typeof m.question === "string" ? m.question : undefined,
      slug: typeof m.slug === "string" ? m.slug : undefined,
      endDate: m.endDate,
      duration: parseDuration(m),
    })),
    rawSamples: raw
      .filter((m) => /eth|ethereum/i.test(`${m.question ?? ""} ${m.slug ?? ""}`))
      .slice(0, 15)
      .map((m) => ({
        question: typeof m.question === "string" ? m.question : undefined,
        slug: typeof m.slug === "string" ? m.slug : undefined,
      })),
  };
}
