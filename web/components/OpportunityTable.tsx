"use client";

import type { OpportunityRow } from "@/lib/types";
import { pct, usd, remaining, maxSpread, expiryLabel } from "@/lib/format";

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Pair</th>
            <th>Expiry</th>
            <th className="num">YES A</th>
            <th className="num">YES B</th>
            <th className="num">Spread</th>
            <th className="num">Liquidity</th>
            <th className="num">Volume</th>
            <th className="num">Time left</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.pair}</td>
              <td>{expiryLabel(o.expiry_at)}</td>
              <td className="num">{pct(o.yes_a)}</td>
              <td className="num">{pct(o.yes_b)}</td>
              <td className="num" style={{ color: "var(--green)" }}>{pct(maxSpread(o))}</td>
              <td className="num">{usd(o.liquidity_usd)}</td>
              <td className="num">{usd(o.volume_usd)}</td>
              <td className="num">{remaining(o.time_remaining_sec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
