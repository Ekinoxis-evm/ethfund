"use client";

import { useState } from "react";
import { useNow, secondsUntil } from "@/hooks/useNow";
import { expiryLabel, pct, remaining, usd, usd2, usdSigned } from "@/lib/format";
import { classifySpread, type SpreadVerdict } from "@/lib/spreadLogic";
import type { MarketsResponse, PairItem } from "@/lib/types";

type Status = "signal" | "live" | "waiting";

interface RadarRow {
  expiryAt: string;
  p: PairItem;
  status: Status;
  verdict: SpreadVerdict;
  /** When the overlap opens: the LATER of the two legs' window starts. */
  overlapOpensAt: string | null;
}

function toRow(expiryAt: string, p: PairItem): RadarRow {
  const waiting = !p.startedA || !p.startedB;
  const opens =
    p.startAtA && p.startAtB
      ? new Date(p.startAtA) > new Date(p.startAtB)
        ? p.startAtA
        : p.startAtB
      : (p.startAtA ?? p.startAtB);
  return {
    expiryAt,
    p,
    status: waiting ? "waiting" : p.ok ? "signal" : "live",
    verdict: waiting ? "unknown" : classifySpread(p.upA, p.upB, p.strikeA, p.strikeB),
    overlapOpensAt: opens,
  };
}

function Leg({
  label,
  duration,
  up,
  down,
  strike,
  spot,
  slug,
}: {
  label: string;
  duration: string;
  up: number;
  down: number;
  strike: number | null;
  spot: number | null;
  slug: string;
}) {
  const dist = strike !== null && spot !== null ? spot - strike : null;
  return (
    <div className="leg">
      <div className="d">
        {label} · <span className="badge">{duration}</span>{" "}
        <a href={`https://polymarket.com/market/${slug}`} target="_blank" rel="noreferrer">
          ↗
        </a>
      </div>
      <div className="v">
        UP {pct(up)} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· DOWN {pct(down)}</span>
      </div>
      <div className="d">
        beat {usd2(strike)}
        {dist !== null && (
          <span style={{ color: dist >= 0 ? "var(--green)" : "var(--amber)" }}>
            {" "}
            ({usdSigned(dist)})
          </span>
        )}
      </div>
    </div>
  );
}

export function OpportunityRadar({ data }: { data: MarketsResponse | null }) {
  const now = useNow();
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  const rows = (data?.groups ?? []).flatMap((g) => g.pairs.map((p) => toRow(g.expiryAt, p)));

  const active = rows
    .filter((r) => r.status !== "waiting")
    .filter((r) => !onlyAnomalies || r.verdict === "anomaly")
    .sort((a, b) => {
      const w = (r: RadarRow) => (r.status === "signal" ? 0 : r.verdict === "anomaly" ? 1 : 2);
      if (w(a) !== w(b)) return w(a) - w(b);
      return b.p.spread - a.p.spread;
    });

  const upcoming = rows
    .filter((r) => r.status === "waiting" && r.overlapOpensAt)
    .sort(
      (a, b) =>
        new Date(a.overlapOpensAt as string).getTime() -
        new Date(b.overlapOpensAt as string).getTime(),
    )
    .slice(0, 6);

  return (
    <>
      <div className="section-title">Opportunity radar</div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        A pair is comparable only during its <b>overlap window</b> — the final stretch when the
        shorter market runs alongside the longer one (spec §7: 4H-vs-1H in the last hour, 1H-vs-15M
        in the last 15 minutes, 15M-vs-5M in the last 5). Cards below are pairs in their window
        right now; the strip shows when the next comparisons go live.
      </p>

      {upcoming.length > 0 && (
        <div className="controls" style={{ marginBottom: 12 }}>
          {upcoming.map((r) => (
            <span key={`${r.p.pair}-${r.expiryAt}`} className="badge">
              {r.p.pair} · expires {expiryLabel(r.expiryAt)} · live in{" "}
              {remaining(secondsUntil(r.overlapOpensAt as string, now))}
            </span>
          ))}
        </div>
      )}

      {rows.some((r) => r.verdict === "anomaly") && (
        <div className="controls">
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

      {!data && <div className="empty">Loading pairs…</div>}
      {data && active.length === 0 && (
        <div className="empty">
          No pair is in its overlap window right now
          {upcoming[0]?.overlapOpensAt &&
            ` — next one goes live in ${remaining(secondsUntil(upcoming[0].overlapOpensAt, now))}`}
          .
        </div>
      )}

      {active.length > 0 && (
        <div className="grid">
          {active.map(({ expiryAt, p, status, verdict }) => (
            <div className="card" key={`${p.pair}-${expiryAt}`}>
              <div className="head">
                <span className="pair">{p.pair}</span>
                <span
                  className={`badge ${
                    status === "signal" ? "signal" : verdict === "anomaly" ? "fail" : ""
                  }`}
                >
                  {status === "signal"
                    ? "🟢 OPPORTUNITY"
                    : verdict === "anomaly"
                      ? "UNEXPLAINED"
                      : verdict === "explained"
                        ? "strike-explained"
                        : "strikes unknown"}
                </span>
              </div>
              <div className="spread">
                {pct(p.spread)}
                <small>
                  spread · strike gap {usdSigned(p.strikeDiff)}
                </small>
              </div>
              <div className="legs">
                <Leg
                  label="A"
                  duration={p.durationA}
                  up={p.upA}
                  down={p.downA}
                  strike={p.strikeA}
                  spot={data?.ethSpot ?? null}
                  slug={p.slugA}
                />
                <Leg
                  label="B"
                  duration={p.durationB}
                  up={p.upB}
                  down={p.downB}
                  strike={p.strikeB}
                  spot={data?.ethSpot ?? null}
                  slug={p.slugB}
                />
              </div>
              <div className="meta">
                <div className="row">
                  <span className="k">Liquidity</span>
                  <span>{usd(p.liq)}</span>
                </div>
                <div className="row">
                  <span className="k">Volume</span>
                  <span>{usd(p.vol)}</span>
                </div>
                <div className="row">
                  <span className="k">Expires</span>
                  <span>{expiryLabel(expiryAt)}</span>
                </div>
                <div className="row">
                  <span className="k">Ends in</span>
                  <span>{remaining(secondsUntil(expiryAt, now))}</span>
                </div>
              </div>
              {status !== "signal" && p.reasons.length > 0 && (
                <ul className="reasons">
                  {p.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
