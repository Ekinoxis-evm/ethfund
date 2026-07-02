"use client";

import { useEffect, useState } from "react";
import { pct, usd } from "@/lib/format";
import type { SettingsChangeRow } from "@/lib/types";

function fmtValue(key: string, v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return String(v);
  if (key === "min_spread" || key === "max_bidask") return pct(n);
  return usd(n);
}

const FIELD_LABELS: Record<string, string> = {
  min_spread: "min spread",
  min_liquidity: "min liquidity",
  min_volume: "min volume",
  max_bidask: "max bid-ask",
  pairs: "pairs",
};

/** "min spread 5.0% → 4.0%" for each field that actually changed. */
function diffLines(change: SettingsChangeRow): string[] {
  const lines: string[] = [];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const before = change.old_values?.[key];
    const after = change.new_values[key];
    if (after === undefined) continue;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    lines.push(
      before === undefined || before === null
        ? `${label} set to ${fmtValue(key, after)}`
        : `${label} ${fmtValue(key, before)} → ${fmtValue(key, after)}`,
    );
  }
  return lines.length ? lines : ["(no field changed)"];
}

export function ChangeLog({ refreshKey }: { refreshKey: number }) {
  const [changes, setChanges] = useState<SettingsChangeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/changes");
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const body = (await res.json()) as { changes: SettingsChangeRow[] };
        if (!cancelled) setChanges(body.changes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <>
      <div className="section-title">Changes we have done</div>
      {error && <div className="notice error">Could not load change log: {error}</div>}
      {!error && changes.length === 0 && (
        <div className="empty">No settings changes yet — the first save will appear here.</div>
      )}
      {changes.length > 0 && (
        <div className="tablewrap" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>What changed</th>
                <th>Why (note)</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(c.changed_at).toLocaleString()}
                  </td>
                  <td>
                    {diffLines(c).map((line) => (
                      <div key={line} className="mono">
                        {line}
                      </div>
                    ))}
                  </td>
                  <td>{c.note ?? <span className="field-desc">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
