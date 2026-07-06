"use client";

import { useMarkets } from "@/hooks/useMarkets";
import { expiryLabel, pct, remaining, usd, usd2, usdSigned } from "@/lib/format";
import type { MarketsGroup } from "@/lib/types";

function GroupBlock({ group, ethSpot }: { group: MarketsGroup; ethSpot: number | null }) {
  return (
    <div>
      <div className="grouphead">
        Expires {expiryLabel(group.expiryAt)}
        <span className="when">
          {group.markets.length} market{group.markets.length === 1 ? "" : "s"} ·{" "}
          {group.pairs.length} comparable pair{group.pairs.length === 1 ? "" : "s"}
          {ethSpot !== null && <> · ETH now {usd2(ethSpot)}</>}
        </span>
      </div>
      <div className="tablewrap" style={{ marginTop: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Crypto</th>
              <th>Duration</th>
              <th className="num">DOWN</th>
              <th className="num">UP</th>
              <th className="num">Price to beat</th>
              <th className="num">Price diff</th>
              <th className="num">Ends in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {group.markets.map((m) => (
              <tr key={m.id}>
                <td>{m.question}</td>
                <td>ETH</td>
                <td>
                  <span className="badge">{m.duration}</span>
                </td>
                <td className="num">{pct(m.no)}</td>
                <td className="num">{pct(m.yes)}</td>
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
                  spread {pct(p.spread)}
                  {p.strikeDiff !== null && <> · strike gap {usdSigned(p.strikeDiff)}</>} · liquidity{" "}
                  {usd(p.liq)} · volume {usd(p.vol)}
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
      <div className="section-title">
        Markets we’re tracking
        {data?.ethSpot != null && (
          <span style={{ marginLeft: 10, textTransform: "none", letterSpacing: 0 }}>
            · ETH {usd2(data.ethSpot)}
          </span>
        )}
      </div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        Every live ETH Up/Down market on Polymarket, grouped by the exact minute it resolves. Each
        market resolves UP if ETH ends at or above <b>its own</b> “price to beat” (the Chainlink
        price when its window opened) — so two same-expiry markets can price differently when their
        strikes differ. <b>Price diff</b> = live ETH minus that market’s strike; the pair’s{" "}
        <b>strike gap</b> is how far apart the two starting prices are. Prices via Pyth
        (display-grade; resolution uses Chainlink).{" "}
        {data
          ? `Thresholds: spread ≥ ${pct(data.thresholds.minSpread)}, liquidity ≥ ${usd(
              data.thresholds.minLiquidity,
            )}, volume ≥ ${usd(data.thresholds.minVolume)}, bid-ask ≤ ${pct(
              data.thresholds.maxBidAsk,
            )} (${data.thresholds.source === "db" ? "set from dashboard" : "env defaults"}).`
          : ""}
      </p>
      {error && <div className="notice error">Markets feed unavailable: {error}</div>}
      {loading && !data && <div className="empty">Loading live markets…</div>}
      {data && data.groups.length === 0 && (
        <div className="empty">No open ETH Up/Down markets right now.</div>
      )}
      {data?.groups.map((g) => <GroupBlock key={g.expiryAt} group={g} ethSpot={data.ethSpot} />)}
    </>
  );
}
