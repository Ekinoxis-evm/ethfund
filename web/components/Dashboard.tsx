"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOpportunities } from "@/hooks/useOpportunities";
import type { OpportunityRow, ScanRunRow } from "@/lib/types";
import { maxSpread } from "@/lib/format";
import { ALL_PAIRS } from "@/lib/pairs";
import { LiveBadge } from "./LiveBadge";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityTable } from "./OpportunityTable";
import { ThresholdFilters, type Filters } from "./ThresholdFilters";
import { Disclaimer } from "./Disclaimer";
import { MarketsTracking } from "./markets/MarketsTracking";

const PAIRS = [...ALL_PAIRS];

export function Dashboard({
  initial,
  initialScan,
}: {
  initial: OpportunityRow[];
  initialScan: ScanRunRow | null;
}) {
  const { opportunities, lastScan, live } = useOpportunities(initial, initialScan);
  const [filters, setFilters] = useState<Filters>({ minSpread: 0, pair: "", hideExpired: true });

  const filtered = useMemo(() => {
    const now = Date.now();
    return opportunities.filter((o) => {
      if (maxSpread(o) < filters.minSpread) return false;
      if (filters.pair && o.pair !== filters.pair) return false;
      if (filters.hideExpired && new Date(o.expiry_at).getTime() <= now) return false;
      return true;
    });
  }, [opportunities, filters]);

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
        Live signals across Polymarket’s ETH Up or Down markets (4H · 1H · 15M · 5M). When two markets
        that resolve at the same minute price the same outcome differently, that gap shows up here.
        Directional signals — not riskless arbitrage.
      </p>

      <ThresholdFilters filters={filters} onChange={setFilters} pairs={PAIRS} />

      {filtered.length === 0 ? (
        <div className="empty">
          No active signals right now. The scanner runs every minute — new ones stream in live.
        </div>
      ) : (
        <div className="grid">
          {filtered.map((o) => (
            <OpportunityCard key={o.id} opp={o} />
          ))}
        </div>
      )}

      <MarketsTracking />

      <div className="section-title">History</div>
      <OpportunityTable rows={filtered} />

      <Disclaimer />
    </div>
  );
}
