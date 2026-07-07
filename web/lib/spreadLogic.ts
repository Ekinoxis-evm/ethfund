/**
 * Strike-aware spread classification (client-safe, pure).
 *
 * A market with a LOWER strike is easier to beat, so it should price UP higher.
 * A probability spread whose direction matches the strike relationship is
 * "explained" — expected, not a mispricing. A spread that contradicts it (or a
 * material spread with near-identical strikes) is an "anomaly" worth a look.
 */

export type SpreadVerdict = "explained" | "anomaly" | "unknown";

/** Spreads below this are noise regardless of strikes. */
const MATERIAL_SPREAD = 0.01;
/** Strikes closer than this (USD) are treated as the same starting price. */
const SAME_STRIKE_USD = 0.25;

/** A window's first spread must be at least this to be a convergence candidate. */
const CONVERGENCE_MATERIAL = 0.03;

export type Convergence = "converged" | "did-not-converge" | "not-applicable";

/**
 * Did the spread close before expiry? (spec §17 backtesting metric)
 * Applicable only when the window OPENED with a material spread; converged when
 * the spread later collapsed to ≤ max(1%, a quarter of its starting value).
 */
export function convergence(firstSpread: number, minSpread: number): Convergence {
  if (firstSpread < CONVERGENCE_MATERIAL) return "not-applicable";
  return minSpread <= Math.max(0.01, firstSpread * 0.25) ? "converged" : "did-not-converge";
}

export function classifySpread(
  upA: number,
  upB: number,
  strikeA: number | null,
  strikeB: number | null,
): SpreadVerdict {
  const upDiff = upA - upB;
  if (Math.abs(upDiff) < MATERIAL_SPREAD) return "explained";
  if (strikeA === null || strikeB === null) return "unknown";
  const gap = strikeA - strikeB;
  if (Math.abs(gap) < SAME_STRIKE_USD) return "anomaly";
  // lower strike ⇒ higher UP: expected sign(upDiff) === −sign(gap)
  return Math.sign(upDiff) === -Math.sign(gap) ? "explained" : "anomaly";
}
