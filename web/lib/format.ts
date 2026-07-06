export function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

export function usd(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `$${Math.round(x).toLocaleString("en-US")}`;
}

/** USD with cents — for ETH prices and strike gaps where dollars matter. */
export function usd2(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Signed USD with cents — for price differences (+$2.13 / −$1.05). */
export function usdSigned(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  const sign = x > 0 ? "+" : x < 0 ? "−" : "";
  return `${sign}$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function remaining(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "—";
  if (sec <= 0) return "expired";
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1) return `${m}m ${sec % 60}s`;
  return `${sec}s`;
}

export function maxSpread(o: { yes_spread: number; no_spread: number }): number {
  return Math.max(o.yes_spread, o.no_spread);
}

export function expiryLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
