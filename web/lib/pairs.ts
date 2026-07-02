import type { Pair } from "./polymarket/arbitrage";

/** Canonical pair list — pure module (no process.env) so client components can import it. */
export const ALL_PAIRS: readonly Pair[] = [
  "4H-vs-1H",
  "1H-vs-15M",
  "15M-vs-5M",
  "4H-vs-15M",
  "4H-vs-5M",
  "1H-vs-5M",
];

export function isPair(p: string): p is Pair {
  return (ALL_PAIRS as readonly string[]).includes(p);
}
