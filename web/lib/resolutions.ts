import { dbConfigured, serviceClient } from "./supabase/server";
import { ethPriceAt } from "./polymarket/pyth";

/**
 * Retroactive market resolutions — SERVER ONLY, called from the scan tick.
 *
 * For expired markets seen in pair_snapshots (with a known strike) and not yet
 * resolved, fetch ETH/USD at the expiry instant (Pyth) and record 'up' | 'down'.
 * Bounded per tick; catches up on backlog across ticks. Never throws.
 */

const DEFAULT_LIMIT = 40;

interface PendingRow {
  market_id: string;
  expiry_at: string;
  strike: number | string;
}

export async function resolvePendingMarkets(limit = DEFAULT_LIMIT): Promise<number> {
  if (!dbConfigured()) return 0;
  try {
    const { data, error } = await serviceClient().rpc("pending_resolutions", { limit_n: limit });
    if (error) throw new Error(`pending_resolutions: ${error.message}`);
    const rows = (data ?? []) as PendingRow[];
    if (!rows.length) return 0;

    // One Pyth call per distinct expiry instant.
    const tsSet = [...new Set(rows.map((r) => Math.floor(new Date(r.expiry_at).getTime() / 1000)))];
    const prices = new Map<number, number | null>();
    await Promise.all(
      tsSet.map(async (ts) => {
        prices.set(ts, await ethPriceAt(ts));
      }),
    );

    const inserts = rows.flatMap((r) => {
      const strike = Number(r.strike);
      const ts = Math.floor(new Date(r.expiry_at).getTime() / 1000);
      const ethAtExpiry = prices.get(ts) ?? null;
      if (!Number.isFinite(strike) || ethAtExpiry === null) return [];
      return [
        {
          market_id: r.market_id,
          expiry_at: r.expiry_at,
          strike,
          eth_at_expiry: ethAtExpiry,
          resolved: ethAtExpiry >= strike ? "up" : "down",
        },
      ];
    });
    if (!inserts.length) return 0;

    const { error: insErr } = await serviceClient()
      .from("market_resolutions")
      .upsert(inserts, { onConflict: "market_id" });
    if (insErr) throw new Error(`market_resolutions upsert: ${insErr.message}`);
    return inserts.length;
  } catch (err) {
    console.error(
      `[scan] resolutions failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }
}
