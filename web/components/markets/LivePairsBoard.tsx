"use client";

import { useState } from "react";
import { expiryLabel, pct, remaining, usd, usd2, usdSigned } from "@/lib/format";
import { classifySpread, type SpreadVerdict } from "@/lib/spreadLogic";
import type { MarketsResponse, PairItem } from "@/lib/types";

type BoardVerdict = SpreadVerdict | "pre-start";

interface BoardRow {
  expiryAt: string;
  p: PairItem;
  verdict: BoardVerdict;
}

function rank(a: BoardRow, b: BoardRow): number {
  const w = (v: BoardVerdict) =>
    v === "anomaly" ? 0 : v === "unknown" ? 1 : v === "explained" ? 2 : 3;
  if (w(a.verdict) !== w(b.verdict)) return w(a.verdict) - w(b.verdict);
  return b.p.spread - a.p.spread;
}

const VERDICT_LABEL: Record<BoardVerdict, string> = {
  anomaly: "UNEXPLAINED",
  explained: "strike-explained",
  unknown: "strikes unknown",
  "pre-start": "not started",
};

export function LivePairsBoard({ data }: { data: MarketsResponse | null }) {
  const [pairFilter, setPairFilter] = useState("");
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  const rows: BoardRow[] = (data?.groups ?? [])
    .flatMap((g) =>
      g.pairs.map((p): BoardRow => {
        const verdict: BoardVerdict =
          !p.startedA || !p.startedB
            ? "pre-start"
            : classifySpread(p.upA, p.upB, p.strikeA, p.strikeB);
        return { expiryAt: g.expiryAt, p, verdict };
      }),
    )
    .filter((r) => !pairFilter || r.p.pair === pairFilter)
    .filter((r) => !onlyAnomalies || r.verdict === "anomaly")
    .sort(rank);

  const pairNames = [...new Set((data?.groups ?? []).flatMap((g) => g.pairs.map((p) => p.pair)))];

  return (
    <>
      <div className="section-title">Live pairs — where to look now</div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        Every comparable same-expiry pair, ranked by how <b>unexplained</b> its spread is. A market
        with a lower “price to beat” should price UP higher — a spread in that direction is
        expected. <span className="badge fail" style={{ margin: "0 2px" }}>UNEXPLAINED</span> means
        the spread contradicts the strike relationship (or strikes are equal) — those are the ones
        worth a look.
      </p>
      {pairNames.length > 1 && (
        <div className="controls">
          <div className="control">
            <label>Pair</label>
            <select value={pairFilter} onChange={(e) => setPairFilter(e.target.value)}>
              <option value="">all</option>
              {pairNames.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="control">
            <label>Only unexplained</label>
            <select
              value={onlyAnomalies ? "yes" : "no"}
              onChange={(e) => setOnlyAnomalies(e.target.value === "yes")}
            >
              <option value="no">no</option>
              <option value="yes">yes</option>
            </select>
          </div>
        </div>
      )}
      {!data && <div className="empty">Loading live pairs…</div>}
      {data && rows.length === 0 && (
        <div className="empty">
          No comparable pairs right now — pairs form in the final stretch when a shorter market
          overlaps a longer one ending at the same minute.
        </div>
      )}
      {rows.length > 0 && (
        <div className="tablewrap" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Verdict</th>
                <th>Pair</th>
                <th className="num">Spread</th>
                <th className="num">UP (A / B)</th>
                <th className="num">Strikes (A / B)</th>
                <th className="num">Strike gap</th>
                <th className="num">Liquidity</th>
                <th className="num">Ends in</th>
                <th>Expiry</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ expiryAt, p, verdict }, i) => (
                <tr
                  key={`${p.pair}-${expiryAt}-${i}`}
                  style={verdict === "pre-start" ? { opacity: 0.55 } : undefined}
                >
                  <td>
                    <span className={`badge ${verdict === "anomaly" ? "fail" : ""}`}>
                      {VERDICT_LABEL[verdict]}
                    </span>
                  </td>
                  <td>
                    <span className="pairname">{p.pair}</span>
                  </td>
                  <td className="num" style={{ fontWeight: 650 }}>
                    {pct(p.spread)}
                  </td>
                  <td className="num">
                    {pct(p.upA)} / {pct(p.upB)}
                  </td>
                  <td className="num">
                    {usd2(p.strikeA)} / {usd2(p.strikeB)}
                  </td>
                  <td className="num">{usdSigned(p.strikeDiff)}</td>
                  <td className="num">{usd(p.liq)}</td>
                  <td className="num">{remaining(p.timeRemainingSec)}</td>
                  <td>{expiryLabel(expiryAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`https://polymarket.com/market/${p.slugA}`} target="_blank" rel="noreferrer">
                      A ↗
                    </a>{" "}
                    <a href={`https://polymarket.com/market/${p.slugB}`} target="_blank" rel="noreferrer">
                      B ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
