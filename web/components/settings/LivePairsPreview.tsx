"use client";

import { useMarkets } from "@/hooks/useMarkets";
import { expiryLabel, pct, usd } from "@/lib/format";
import type { Thresholds } from "@/lib/config";
import type { PairItem } from "@/lib/types";

/** Re-evaluate a live pair against UNSAVED draft thresholds (mirrors lib/polymarket/arbitrage.ts). */
function evalDraft(p: PairItem, t: Thresholds): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!t.pairs.includes(p.pair as Thresholds["pairs"][number]))
    reasons.push("pair not enabled");
  if (p.spread < t.minSpread)
    reasons.push(`spread ${(p.spread * 100).toFixed(1)}% < ${(t.minSpread * 100).toFixed(1)}%`);
  if (p.liq < t.minLiquidity) reasons.push(`liquidity $${p.liq.toFixed(0)} < $${t.minLiquidity}`);
  if (p.vol < t.minVolume) reasons.push(`volume $${p.vol.toFixed(0)} < $${t.minVolume}`);
  if (p.bidask === null || p.bidask > t.maxBidAsk)
    reasons.push(`bid-ask ${p.bidask === null ? "unknown" : p.bidask.toFixed(3)} > ${t.maxBidAsk}`);
  return { ok: reasons.length === 0, reasons };
}

export function LivePairsPreview({ draft }: { draft: Thresholds }) {
  const { data, error, loading } = useMarkets();

  const rows = (data?.groups ?? []).flatMap((g) =>
    g.pairs.map((p) => ({ expiryAt: g.expiryAt, p, verdict: evalDraft(p, draft) })),
  );
  const passing = rows.filter((r) => r.verdict.ok).length;

  return (
    <div className="card">
      <h3 style={{ margin: 0 }}>If you save this…</h3>
      <p className="field-desc" style={{ margin: 0 }}>
        Live Polymarket pairs re-checked against your <b>unsaved</b> values every 20s —{" "}
        {loading && !data ? "loading…" : `${passing} of ${rows.length} pairs would be a signal right now.`}
      </p>
      {error && <div className="notice error">Live preview unavailable: {error}</div>}
      {rows.length === 0 && data && (
        <div className="field-desc">No comparable pairs live right now (pairs form in the final stretch of overlapping markets).</div>
      )}
      {rows.map(({ expiryAt, p, verdict }, i) => (
        <div className="checkrow" key={`${p.pair}-${expiryAt}-${i}`}>
          <span className={`badge ${verdict.ok ? "signal" : "fail"}`}>
            {verdict.ok ? "SIGNAL" : "no"}
          </span>
          <div>
            <span className="pairname">{p.pair}</span>{" "}
            <span className="field-desc">
              expires {expiryLabel(expiryAt)} · spread {pct(p.spread)} · liq {usd(p.liq)} · vol{" "}
              {usd(p.vol)}
            </span>
            {!verdict.ok && (
              <ul className="reasons">
                {verdict.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
