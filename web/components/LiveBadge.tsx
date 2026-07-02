"use client";

import { useEffect, useState } from "react";
import type { ScanRunRow } from "@/lib/types";

function ago(iso: string | null | undefined): string {
  if (!iso) return "no scans yet";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function LiveBadge({ live, lastScan }: { live: boolean; lastScan: ScanRunRow | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="live" title={lastScan?.error ? `last error: ${lastScan.error}` : undefined}>
      <span className={`dot ${live ? "on" : ""}`} />
      {live ? "live" : "connecting"} · last scan {ago(lastScan?.started_at)}
      {lastScan ? ` · ${lastScan.markets_scanned} mkts` : ""}
    </span>
  );
}
