"use client";

import type { OpportunityRow } from "@/lib/types";
import { pct } from "@/lib/format";

/**
 * Placeholder trade ticket. The real execution path is DEFERRED (see plan) and must add, before it
 * can place an order:
 *  - wallet connect (Privy/wagmi) on Polygon + ethers v5 signer for @polymarket/clob-client
 *  - CLOB check_geoblock + explicit eligibility attestation (hard-disable when blocked)
 *  - signature type = Proxy by default, gated by a CLOB collateral balance check
 *  - the correct outcome token id (yes_token_* / no_token_* for the cheaper leg)
 *  - per-token tickSize + negRisk threaded into createAndPostOrder
 *  - a fresh /book fetch → computed maxPrice (slippage bound); no unbounded FOK
 *  - bounded USDC.e approvals (6 decimals) + a revoke/disable control
 *
 * This component intentionally does NOT sign or submit anything.
 */
export function TradeModal({ opp, onClose }: { opp: OpportunityRow; onClose: () => void }) {
  const cheaperIsB = opp.yes_b < opp.yes_a; // illustrative: the lower YES leg
  const leg = cheaperIsB ? opp.duration_b : opp.duration_a;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Trade {opp.pair}</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          Suggested directional leg: buy <b>YES {leg}</b> (the lower-priced side, {pct(Math.min(opp.yes_a, opp.yes_b))}).
        </p>
        <p style={{ color: "var(--amber)", fontSize: 12, lineHeight: 1.6 }}>
          Execution is not wired in this build. This is a directional trade, not riskless arbitrage —
          the two markets are different events sharing an expiry. Enabling it requires wallet connect,
          a geoblock + eligibility check, slippage bounds, and bounded approvals (see plan).
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
