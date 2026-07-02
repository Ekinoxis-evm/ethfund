export function Disclaimer() {
  return (
    <div className="disclaimer">
      <b>Not financial advice · not riskless arbitrage.</b> These are directional “temporal mispricing”
      signals: the compared markets (e.g. 4H vs 1H) share an expiry minute but are different events, so
      a spread is not a guaranteed profit. Data is sourced from Polymarket’s public API and may be
      delayed or incomplete. Trading prediction markets carries risk and is restricted in some
      jurisdictions (Polymarket prohibits trading by US persons and others) — you are responsible for
      compliance. ethfund does not custody funds or place orders on your behalf in this build.
    </div>
  );
}
