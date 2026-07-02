"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import type { OpportunityRow, ScanRunRow } from "@/lib/types";

function sortOpps(rows: OpportunityRow[]): OpportunityRow[] {
  return [...rows].sort((a, b) => {
    const sa = Math.max(a.yes_spread, a.no_spread);
    const sb = Math.max(b.yes_spread, b.no_spread);
    return sb - sa;
  });
}

/**
 * Live opportunities + latest scan run via Supabase Realtime (anon).
 * Seeds from server-provided initial rows, then merges INSERT/UPDATE events.
 */
export function useOpportunities(
  initial: OpportunityRow[],
  initialScan: ScanRunRow | null,
): { opportunities: OpportunityRow[]; lastScan: ScanRunRow | null; live: boolean } {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>(initial);
  const [lastScan, setLastScan] = useState<ScanRunRow | null>(initialScan);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supa = browserSupabase();

    const oppChannel = supa
      .channel("opportunities-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opportunities" },
        (payload) => {
          const row = payload.new as OpportunityRow;
          if (!row?.id) return;
          setOpportunities((prev) => {
            const next = prev.filter((o) => o.id !== row.id);
            next.push(row);
            return sortOpps(next);
          });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    const scanChannel = supa
      .channel("scan-runs-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_runs" },
        (payload) => setLastScan(payload.new as ScanRunRow),
      )
      .subscribe();

    return () => {
      supa.removeChannel(oppChannel);
      supa.removeChannel(scanChannel);
    };
  }, []);

  return { opportunities, lastScan, live };
}
