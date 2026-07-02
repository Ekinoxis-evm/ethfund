import { runCli } from "./cli.js";

interface OrderSummary {
  price: number | string;
  size: number | string;
}
interface OrderBook {
  bids?: OrderSummary[];
  asks?: OrderSummary[];
}

export interface BookTop {
  bestBid?: number;
  bestAsk?: number;
  bidAskSpread?: number;
}

function n(v: number | string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : undefined;
}

/**
 * Optional enrichment: read the live order book for a token and derive best bid/ask + spread.
 * Only used when USE_CLOB=true — the market object already carries bestBid/bestAsk/spread, which
 * the scanner uses by default to avoid an extra subprocess per market per loop.
 */
export async function bookTop(tokenId: string): Promise<BookTop> {
  const book = await runCli<OrderBook>(["clob", "book", tokenId]);
  const bids = (book.bids ?? []).map((b) => n(b.price)).filter((x): x is number => x !== undefined);
  const asks = (book.asks ?? []).map((a) => n(a.price)).filter((x): x is number => x !== undefined);
  const bestBid = bids.length ? Math.max(...bids) : undefined;
  const bestAsk = asks.length ? Math.min(...asks) : undefined;
  const bidAskSpread =
    bestBid !== undefined && bestAsk !== undefined ? Math.abs(bestAsk - bestBid) : undefined;
  return { bestBid, bestAsk, bidAskSpread };
}
