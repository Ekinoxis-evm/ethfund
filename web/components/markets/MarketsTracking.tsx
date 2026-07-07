"use client";

import { useState } from "react";
import { useNow, secondsUntil } from "@/hooks/useNow";
import { expiryLabel, pct, remaining, usd, usd2, usdSigned } from "@/lib/format";
import type { MarketItem, MarketsResponse } from "@/lib/types";

const DURATION_ORDER: Record<string, number> = { "4H": 0, "1H": 1, "15M": 2, "5M": 3 };

/** "Ethereum Up or Down - July 6, 9:05PM-9:10PM ET" → "9:05PM–9:10PM ET" */
function windowLabel(question: string): string {
  const m = question.match(/[\d:]+\s*(?:AM|PM).*$/i);
  return m ? m[0] : question;
}

function ProbBar({ up, down }: { up: number; down: number }) {
  const upPctVal = Math.max(0, Math.min(100, up * 100));
  return (
    <span className="probbar" title={`UP ${pct(up)} · DOWN ${pct(down)}`}>
      <span className="up" style={{ width: `${upPctVal}%` }} />
    </span>
  );
}

function MarketRow({ m, now }: { m: MarketItem; now: number }) {
  const preStart = m.startAt !== null && new Date(m.startAt).getTime() > now;
  return (
    <tr style={preStart ? { opacity: 0.55 } : undefined}>
      <td>
        <span className="badge">{m.duration}</span>
      </td>
      <td title={m.question}>
        {windowLabel(m.question)}
        {preStart && (
          <span className="badge" style={{ marginLeft: 6 }}>
            starts in {remaining(m.startAt ? secondsUntil(m.startAt, now) : null)}
          </span>
        )}
      </td>
      <td className="num" style={{ whiteSpace: "nowrap" }}>
        <ProbBar up={m.yes} down={m.no} /> {pct(m.no)} / {pct(m.yes)}
      </td>
      <td className="num">{usd2(m.priceToBeat)}</td>
      <td
        className="num"
        style={
          m.priceDiff === null
            ? undefined
            : { color: m.priceDiff >= 0 ? "var(--green)" : "var(--amber)" }
        }
      >
        {usdSigned(m.priceDiff)}
      </td>
      <td className="num">{usd(m.liquidity)}</td>
      <td className="num">{usd(m.volume)}</td>
      <td>
        <a href={m.url} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </td>
    </tr>
  );
}

export function MarketsTracking({
  data,
  error,
  loading,
}: {
  data: MarketsResponse | null;
  error: string | null;
  loading: boolean;
}) {
  const now = useNow();
  const [showAll, setShowAll] = useState(false);

  const groups = data?.groups ?? [];
  const withPairs = groups.filter((g) => g.pairs.length > 0);
  const withoutPairs = groups.length - withPairs.length;
  const visible = showAll ? groups : withPairs;

  return (
    <>
      <div className="section-title">
        Markets we’re tracking
        {data?.ethSpot != null && (
          <span style={{ marginLeft: 10, textTransform: "none", letterSpacing: 0 }}>
            · ETH {usd2(data.ethSpot)}
          </span>
        )}
      </div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        Every live ETH Up/Down market, grouped by the minute it resolves — closest first.
      </p>
      {data && (
        <div className="controls" style={{ marginBottom: 8 }}>
          <span className="badge">spread ≥ {pct(data.thresholds.minSpread)}</span>
          <span className="badge">liquidity ≥ {usd(data.thresholds.minLiquidity)}</span>
          <span className="badge">volume ≥ {usd(data.thresholds.minVolume)}</span>
          <span className="badge">bid-ask ≤ {pct(data.thresholds.maxBidAsk)}</span>
          <span className="badge">
            {data.thresholds.source === "db" ? "set from dashboard" : "env defaults"}
          </span>
        </div>
      )}
      <details className="field-desc" style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer" }}>How to read this</summary>
        <p style={{ marginTop: 6 }}>
          Each market resolves UP if ETH ends at or above <b>its own</b> “price to beat” — the
          Chainlink ETH/USD price the instant its window opened. Two same-expiry markets have
          different strikes, so they can legitimately price differently. <b>Price diff</b> = live
          ETH minus that market’s strike (green: ETH above, UP winning; amber: below). The bar
          shows the DOWN/UP split. Prices via Pyth — display-grade; resolution uses Chainlink.
          Thresholds are editable in Settings and apply from the scanner’s next run.
        </p>
      </details>

      {error && <div className="notice error">Markets feed unavailable: {error}</div>}
      {loading && !data && <div className="empty">Loading live markets…</div>}
      {data && groups.length === 0 && (
        <div className="empty">No open ETH Up/Down markets right now.</div>
      )}
      {data && groups.length > 0 && withoutPairs > 0 && (
        <div className="controls" style={{ marginBottom: 4 }}>
          <button className="btn" onClick={() => setShowAll((s) => !s)}>
            {showAll
              ? "Show only groups with pairs"
              : `Show all groups (${withoutPairs} without pairs hidden)`}
          </button>
        </div>
      )}
      {data && groups.length > 0 && visible.length === 0 && (
        <div className="empty">
          No expiry group has a comparable pair right now — they appear when a shorter market’s
          final stretch overlaps a longer one.
        </div>
      )}

      {visible.length > 0 && (
        <div className="tablewrap" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Duration</th>
                <th>Window (ET)</th>
                <th className="num">DOWN / UP</th>
                <th className="num">Price to beat</th>
                <th className="num">Price diff</th>
                <th className="num">Liquidity</th>
                <th className="num">Volume</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <FragmentGroup key={g.expiryAt} g={g} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FragmentGroup({ g, now }: { g: MarketsResponse["groups"][number]; now: number }) {
  const sorted = g.markets
    .slice()
    .sort((a, b) => (DURATION_ORDER[a.duration] ?? 9) - (DURATION_ORDER[b.duration] ?? 9));
  return (
    <>
      <tr className="grouprow">
        <td colSpan={8}>
          Expires {expiryLabel(g.expiryAt)} · in {remaining(secondsUntil(g.expiryAt, now))} ·{" "}
          {g.markets.length} market{g.markets.length === 1 ? "" : "s"} · {g.pairs.length} pair
          {g.pairs.length === 1 ? "" : "s"}
        </td>
      </tr>
      {sorted.map((m) => (
        <MarketRow key={m.id} m={m} now={now} />
      ))}
      {g.pairs.map((p, i) => (
        <tr key={`pair-${p.pair}-${i}`}>
          <td colSpan={8} style={{ padding: "6px 12px" }}>
            <span className={`badge ${p.ok ? "signal" : "fail"}`}>
              {p.ok ? "SIGNAL" : "no signal"}
            </span>{" "}
            <span className="pairname">{p.pair}</span>{" "}
            <span className="field-desc">
              spread {pct(p.spread)}
              {p.strikeDiff !== null && <> · strike gap {usdSigned(p.strikeDiff)}</>} · liquidity{" "}
              {usd(p.liq)} · volume {usd(p.vol)}
              {!p.ok && p.reasons.length > 0 && <> — {p.reasons.join("; ")}</>}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
