"use client";

import type { OpportunityRow } from "@/lib/types";
import { pct, usd, remaining, maxSpread, expiryLabel } from "@/lib/format";
import { TradeButton } from "./trade/TradeButton";

export function OpportunityCard({ opp }: { opp: OpportunityRow }) {
  const spread = maxSpread(opp);
  return (
    <div className="card">
      <div className="head">
        <span className="pair">⚡ {opp.pair}</span>
        <span className="badge signal">SIGNAL</span>
      </div>

      <div className="spread">
        {pct(spread)}
        <small>spread</small>
      </div>

      <div className="legs">
        <div className="leg">
          <div className="d">YES {opp.duration_a}</div>
          <div className="v">{pct(opp.yes_a)}</div>
        </div>
        <div className="leg">
          <div className="d">YES {opp.duration_b}</div>
          <div className="v">{pct(opp.yes_b)}</div>
        </div>
      </div>

      <div className="meta">
        <div className="row"><span className="k">Liquidity</span><span>{usd(opp.liquidity_usd)}</span></div>
        <div className="row"><span className="k">Volume</span><span>{usd(opp.volume_usd)}</span></div>
        <div className="row"><span className="k">Bid/Ask</span><span>{opp.best_bid_ask_spread?.toFixed(3) ?? "—"}</span></div>
        <div className="row"><span className="k">Time left</span><span>{remaining(opp.time_remaining_sec)}</span></div>
      </div>

      <div className="expiry">Expires {expiryLabel(opp.expiry_at)}</div>

      <div style={{ display: "flex", gap: 8 }}>
        <a
          className="btn"
          href={`https://polymarket.com/market/${opp.market_a_slug ?? ""}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on Polymarket ↗
        </a>
        <TradeButton opp={opp} />
      </div>
    </div>
  );
}
