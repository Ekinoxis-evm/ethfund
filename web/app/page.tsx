import { createClient } from "@supabase/supabase-js";
import { Dashboard } from "@/components/Dashboard";
import type { OpportunityRow, ScanRunRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Server-side initial read using the anon key (public market data; never service-role here). */
async function loadInitial(): Promise<{ opps: OpportunityRow[]; scan: ScanRunRow | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return { opps: [], scan: null };

  const supa = createClient(url, anon, { auth: { persistSession: false } });

  const [oppRes, scanRes] = await Promise.all([
    supa
      .from("opportunities")
      .select("*")
      .eq("status", "opportunity")
      .order("created_at", { ascending: false })
      .limit(200),
    supa.from("scan_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    opps: (oppRes.data as OpportunityRow[] | null) ?? [],
    scan: (scanRes.data as ScanRunRow | null) ?? null,
  };
}

export default async function Page() {
  const { opps, scan } = await loadInitial();
  return <Dashboard initial={opps} initialScan={scan} />;
}
