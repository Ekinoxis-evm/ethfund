import { Resend } from "resend";
import { config } from "./config.js";
import type { Opportunity } from "./arbitrage.js";

let resend: Resend | null = null;

export function emailConfigured(): boolean {
  return Boolean(config.resendApiKey && config.alertFrom && config.alertTo.length);
}

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function fmtUsd(x: number): string {
  return `$${Math.round(x).toLocaleString("en-US")}`;
}
function fmtRemaining(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${sec % 60}s`;
}

/** Render the spec §14 opportunity card as standalone HTML. */
export function renderCard(opp: Opportunity): string {
  const spread = Math.max(opp.yes_spread, opp.no_spread);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;border:1px solid #e2e8f0;border-radius:12px;padding:20px">
    <h2 style="margin:0 0 4px">⚡ ETH Up/Down arbitrage — ${opp.pair}</h2>
    <p style="color:#64748b;margin:0 0 16px">Both markets expire at <b>${new Date(opp.expiry_at).toUTCString()}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#64748b">YES ${opp.duration_a}</td><td style="text-align:right"><b>${fmtPct(opp.yes_a)}</b></td>
          <td style="padding:4px 0;color:#64748b">YES ${opp.duration_b}</td><td style="text-align:right"><b>${fmtPct(opp.yes_b)}</b></td></tr>
      <tr><td style="padding:4px 0;color:#64748b">NO ${opp.duration_a}</td><td style="text-align:right">${fmtPct(opp.no_a)}</td>
          <td style="padding:4px 0;color:#64748b">NO ${opp.duration_b}</td><td style="text-align:right">${fmtPct(opp.no_b)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Spread</td><td style="text-align:right;color:#16a34a"><b>${fmtPct(spread)}</b></td>
          <td style="padding:8px 0;color:#64748b">Bid/Ask</td><td style="text-align:right">${opp.best_bid_ask_spread.toFixed(3)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b">Liquidity</td><td style="text-align:right">${fmtUsd(opp.liquidity_usd)}</td>
          <td style="padding:4px 0;color:#64748b">Volume</td><td style="text-align:right">${fmtUsd(opp.volume_usd)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b">Time left</td><td style="text-align:right">${fmtRemaining(opp.time_remaining_sec)}</td>
          <td style="padding:4px 0;color:#64748b">Status</td><td style="text-align:right">🟢 OPPORTUNITY</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
      ${opp.market_a_slug} &nbsp;vs&nbsp; ${opp.market_b_slug}
    </p>
  </div>`;
}

export function subjectFor(opp: Opportunity): string {
  const spread = Math.max(opp.yes_spread, opp.no_spread);
  return `⚡ Arb ${opp.pair} · ${fmtPct(spread)} · expires ${new Date(opp.expiry_at).toUTCString()}`;
}

/** Send an alert email. In dryRun, logs instead of sending. Errors are thrown to the caller. */
export async function sendAlert(opp: Opportunity, dryRun: boolean): Promise<void> {
  if (dryRun || !emailConfigured()) {
    console.log(`[email${dryRun ? ":dry-run" : ":unconfigured"}] ${subjectFor(opp)} → ${config.alertTo.join(", ")}`);
    return;
  }
  if (!resend) resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: config.alertFrom,
    to: config.alertTo,
    subject: subjectFor(opp),
    html: renderCard(opp),
  });
  if (error) throw new Error(`resend send failed: ${JSON.stringify(error)}`);
}
