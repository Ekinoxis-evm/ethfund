"use client";

import Link from "next/link";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useMarkets } from "@/hooks/useMarkets";
import type { OpportunityRow, ScanRunRow } from "@/lib/types";
import { LiveBadge } from "./LiveBadge";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityTable } from "./OpportunityTable";
import { Disclaimer } from "./Disclaimer";
import { LivePairsBoard } from "./markets/LivePairsBoard";
import { MarketsTracking } from "./markets/MarketsTracking";
import { HistoryWindows } from "./markets/HistoryWindows";

export function Dashboard({
  initial,
  initialScan,
}: {
  initial: OpportunityRow[];
  initialScan: ScanRunRow | null;
}) {
  const { opportunities, lastScan, live } = useOpportunities(initial, initialScan);
  const markets = useMarkets();

  const active = opportunities.filter((o) => new Date(o.expiry_at).getTime() > Date.now());

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <h1>ethfund</h1>
          <span className="tag">ETH Up/Down · temporal mispricing signals</span>
        </div>
        <div className="nav">
          <Link href="/settings">Settings</Link>
          <LiveBadge live={live} lastScan={lastScan} />
        </div>
      </div>
      <p className="subtitle">
        Live signals across Polymarket’s ETH Up or Down markets (4H · 1H · 15M · 5M). When two
        markets that resolve at the same minute price the same outcome differently — beyond what
        their different starting prices explain — that gap shows up here. Directional signals — not
        riskless arbitrage.
      </p>

      {active.length > 0 && (
        <>
          <div className="section-title">Active alerts</div>
          <div className="grid">
            {active.map((o) => (
              <OpportunityCard key={o.id} opp={o} />
            ))}
          </div>
        </>
      )}

      <LivePairsBoard data={markets.data} />

      <MarketsTracking data={markets.data} error={markets.error} loading={markets.loading} />

      <HistoryWindows />

      {opportunities.length > 0 && (
        <>
          <div className="section-title">Alert history</div>
          <OpportunityTable rows={opportunities} />
        </>
      )}

      <Disclaimer />
    </div>
  );
}
