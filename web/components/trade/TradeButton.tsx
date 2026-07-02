"use client";

import { useState } from "react";
import { tradingEnabled } from "@/lib/config";
import type { OpportunityRow } from "@/lib/types";
import { TradeModal } from "./TradeModal";

/**
 * Trade entry point. Disabled unless NEXT_PUBLIC_TRADING=on AND the deferred execution module is
 * wired (see plan: geoblock gate, slippage bound, proxy/EOA balance check, bounded approvals).
 * Until then it renders disabled so the UI is complete but cannot place orders.
 */
export function TradeButton({ opp }: { opp: OpportunityRow }) {
  const [open, setOpen] = useState(false);

  if (!tradingEnabled) {
    return (
      <button className="btn" disabled title="Trading is disabled in this build">
        Trade — disabled
      </button>
    );
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        Trade signal
      </button>
      {open && <TradeModal opp={opp} onClose={() => setOpen(false)} />}
    </>
  );
}
