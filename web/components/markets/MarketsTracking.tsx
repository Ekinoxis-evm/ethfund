"use client";

import { useMarkets } from "@/hooks/useMarkets";
import { expiryLabel, pct, remaining, usd } from "@/lib/format";
import type { MarketsGroup } from "@/lib/types";

function GroupBlock({ group }: { group: MarketsGroup }) {
  return (
    <div>
      <div className="grouphead">
        Expires {expiryLabel(group.expiryAt)}
        <span className="when">
          {group.markets.length} market{group.markets.length === 1 ? "" : "s"} ·{" "}
          {group.pairs.length} comparable pair{group.pairs.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="tablewrap" style={{ marginTop: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Duration</th>
              <th>Market</th>
              <th className="num">UP</th>
              <th className="num">DOWN</th>
              <th className="num">Liquidity</th>
              <th className="num">Volume</th>
              <th className="num">Ends in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {group.markets.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="badge">{m.duration}</span>
                </td>
                <td>{m.question}</td>
                <td className="num">{pct(m.yes)}</td>
                <td className="num">{pct(m.no)}</td>
                <td className="num">{usd(m.liquidity)}</td>
                <td className="num">{usd(m.volume)}</td>
                <td className="num">{remaining(m.timeRemainingSec)}</td>
                <td>
                  <a href={m.url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {group.pairs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {group.pairs.map((p, i) => (
            <div key={`${p.pair}-${i}`} className="checkrow">
              <span className={`badge ${p.ok ? "signal" : "fail"}`}>
                {p.ok ? "SIGNAL" : "no signal"}
              </span>
              <div>
                <span className="pairname">{p.pair}</span>{" "}
                <span className="field-desc">
                  spread {pct(p.spread)} · liquidity {usd(p.liq)} · volume {usd(p.vol)}
                </span>
                {!p.ok && p.reasons.length > 0 && (
                  <ul className="reasons">
                    {p.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketsTracking() {
  const { data, error, loading } = useMarkets();

  return (
    <>
      <div className="section-title">Markets we’re tracking</div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        Every live ETH Up/Down market on Polymarket, grouped by the exact minute it resolves. The
        scanner only compares markets inside the same group — same expiry, same remaining ETH move.
        Thresholds in force:{" "}
        {data
          ? `spread ≥ ${pct(data.thresholds.minSpread)}, liquidity ≥ ${usd(
              data.thresholds.minLiquidity,
            )}, volume ≥ ${usd(data.thresholds.minVolume)}, bid-ask ≤ ${pct(
              data.thresholds.maxBidAsk,
            )} (${data.thresholds.source === "db" ? "set from dashboard" : "env defaults"})`
          : "…"}
      </p>
      {error && <div className="notice error">Markets feed unavailable: {error}</div>}
      {loading && !data && <div className="empty">Loading live markets…</div>}
      {data && data.groups.length === 0 && (
        <div className="empty">No open ETH Up/Down markets right now.</div>
      )}
      {data?.groups.map((g) => <GroupBlock key={g.expiryAt} group={g} />)}
    </>
  );
}
