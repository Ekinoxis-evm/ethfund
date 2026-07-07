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
