"use client";

import { useEffect, useState } from "react";
import { expiryLabel, pct, usd2, usdSigned } from "@/lib/format";
import type { PairWindowRow } from "@/lib/types";

type Payoff = "paid" | "lost" | "unknown";

/** Naive trade: buy UP on the leg pricing UP cheaper (last observed). Did that leg resolve UP? */
function payoff(w: PairWindowRow): Payoff {
  if (w.last_up_a === null || w.last_up_b === null) return "unknown";
  const cheapIsA = w.last_up_a < w.last_up_b;
  const resolved = cheapIsA ? w.resolved_a : w.resolved_b;
  if (!resolved) return "unknown";
  return resolved === "up" ? "paid" : "lost";
}

export function HistoryWindows() {
  const [windows, setWindows] = useState<PairWindowRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairFilter, setPairFilter] = useState("");
  const [onlyDiverged, setOnlyDiverged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/history");
        const body = (await res.json()) as { windows?: PairWindowRow[]; error?: string };
        if (cancelled) return;
        if (body.windows) setWindows(body.windows);
        else setError(body.error ?? `load failed (${res.status})`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void load();
    const t = setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const pairNames = [...new Set(windows.map((w) => w.pair))];
  const rows = windows
    .filter((w) => !pairFilter || w.pair === pairFilter)
    .filter((w) => !onlyDiverged || (w.resolved_a && w.resolved_b && w.resolved_a !== w.resolved_b));

  return (
    <>
      <div className="section-title">How they went — expired windows</div>
      <p className="field-desc" style={{ marginTop: -4 }}>
        Every compared window after expiry: the biggest spread it showed, its strike gap, how each
        leg resolved, and whether the naive trade (buy UP on whichever market priced it cheaper)
        would have paid. Legs resolving <b>differently</b> means the spread was justified — ETH
        finished between the two strikes.
      </p>
      {error && <div className="notice error">History unavailable: {error}</div>}
      {!error && windows.length === 0 && (
        <div className="empty">No expired windows recorded yet — history builds up as markets close.</div>
      )}
      {windows.length > 0 && (
        <>
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
              <label>Only diverged legs</label>
              <select
                value={onlyDiverged ? "yes" : "no"}
                onChange={(e) => setOnlyDiverged(e.target.value === "yes")}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </div>
          </div>
          <div className="tablewrap" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Expired</th>
                  <th>Pair</th>
                  <th className="num">Max spread</th>
                  <th className="num">Strike gap</th>
                  <th className="num">ETH at expiry</th>
                  <th>Resolved (A / B)</th>
                  <th>Naive trade</th>
                  <th className="num">Samples</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const gap =
                    w.strike_a !== null && w.strike_b !== null ? w.strike_a - w.strike_b : null;
                  const diverged = w.resolved_a && w.resolved_b && w.resolved_a !== w.resolved_b;
                  const pay = payoff(w);
                  return (
                    <tr key={`${w.pair}-${w.expiry_at}-${w.market_a_id}`}>
                      <td>{expiryLabel(w.expiry_at)}</td>
                      <td>
                        <span className="pairname">{w.pair}</span>
                      </td>
                      <td className="num" style={{ fontWeight: 650 }}>
                        {pct(w.max_spread)}
                      </td>
                      <td className="num">{usdSigned(gap)}</td>
                      <td className="num">{usd2(w.eth_at_expiry)}</td>
                      <td>
                        {w.resolved_a?.toUpperCase() ?? "—"} / {w.resolved_b?.toUpperCase() ?? "—"}
                        {diverged && (
                          <span className="badge" style={{ marginLeft: 6 }}>
                            diverged
                          </span>
                        )}
                      </td>
                      <td>
                        {pay === "paid" && <span style={{ color: "var(--green)" }}>✓ paid</span>}
                        {pay === "lost" && <span style={{ color: "var(--amber)" }}>✗ lost</span>}
                        {pay === "unknown" && <span className="field-desc">—</span>}
                      </td>
                      <td className="num">{w.samples}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
