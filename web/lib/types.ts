export interface OpportunityRow {
  id: string;
  created_at: string;
  updated_at: string;
  pair: string;
  expiry_at: string;
  market_a_id: string;
  market_b_id: string;
  market_a_slug: string | null;
  market_b_slug: string | null;
  duration_a: string | null;
  duration_b: string | null;
  yes_a: number;
  yes_b: number;
  no_a: number;
  no_b: number;
  yes_spread: number;
  no_spread: number;
  best_bid_ask_spread: number | null;
  liquidity_usd: number | null;
  volume_usd: number | null;
  time_remaining_sec: number | null;
  eth_price: number | null;
  status: string;
  alerted: boolean;
  alerted_at: string | null;
  final_result: string | null;
  yes_token_a: string | null;
  no_token_a: string | null;
  yes_token_b: string | null;
  no_token_b: string | null;
}

export interface SettingsChangeRow {
  id: string;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown>;
  note: string | null;
}

export interface MarketItem {
  id: string;
  slug: string;
  question: string;
  duration: string;
  yes: number;
  no: number;
  liquidity: number;
  volume: number;
  bidAskSpread: number | null;
  timeRemainingSec: number;
  open: boolean;
  url: string;
  /** Window start (ISO); the market resolves UP iff ETH ends >= its price at this instant. */
  startAt: string | null;
  /** ETH price at window start (Pyth, display-grade). Null if window not started / unavailable. */
  priceToBeat: number | null;
  /** Live spot minus priceToBeat — how far ETH is above (+) or below (−) the strike right now. */
  priceDiff: number | null;
}

export interface PairItem {
  pair: string;
  yesSpread: number;
  noSpread: number;
  spread: number;
  liq: number;
  vol: number;
  bidask: number | null;
  ok: boolean;
  reasons: string[];
  /** Gap between the two markets' strikes (priceToBeat A − B), USD. The spread should reflect this. */
  strikeDiff: number | null;
  durationA: string;
  durationB: string;
  upA: number;
  upB: number;
  strikeA: number | null;
  strikeB: number | null;
  slugA: string;
  slugB: string;
  timeRemainingSec: number;
}

/** One compared window from history (pair_windows view + resolutions). */
export interface PairWindowRow {
  pair: string;
  expiry_at: string;
  market_a_id: string;
  market_b_id: string;
  samples: number;
  max_spread: number;
  avg_spread: number;
  strike_a: number | null;
  strike_b: number | null;
  min_liquidity: number | null;
  last_up_a: number | null;
  last_up_b: number | null;
  ever_passed: boolean;
  resolved_a: "up" | "down" | null;
  resolved_b: "up" | "down" | null;
  eth_at_expiry: number | null;
}

export interface MarketsGroup {
  expiryAt: string;
  markets: MarketItem[];
  pairs: PairItem[];
}

export interface MarketsResponse {
  generatedAt: string;
  /** Live ETH/USD spot (Pyth, display-grade). */
  ethSpot: number | null;
  thresholds: {
    minSpread: number;
    minLiquidity: number;
    minVolume: number;
    maxBidAsk: number;
    pairs: string[];
    source: "db" | "env";
    updatedAt: string | null;
  };
  groups: MarketsGroup[];
}

export interface ScanRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  markets_scanned: number;
  groups: number;
  pairs_compared: number;
  opportunities_found: number;
  alerts_sent: number;
  error: string | null;
}
